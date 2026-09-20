pub mod article;
pub mod config;
pub mod markdown;
pub mod render;
#[cfg(feature = "dev")]
pub mod watch;

use std::{collections::HashMap, fs, path::Path, process::Command};

use anyhow::{Context, Result, ensure};
use serde::Serialize;
use walkdir::WalkDir;

use article::Article;
use config::Config;
use markdown::{Entry, Rendered};

const OUTPUT_MARKER: &str = ".sitegen-output";

fn prepare(config: &Config, drafts: bool) -> Result<(Vec<Article>, Vec<Rendered>)> {
    let articles = article::discover(
        &config.build.articles_dir,
        drafts || config.build.include_drafts,
    )?;
    let routes = articles
        .iter()
        .map(|a| (a.source.clone(), a.url()))
        .collect::<HashMap<_, _>>();
    let rendered = articles
        .iter()
        .map(|a| markdown::render(a, &routes).with_context(|| format!("In {}", a.source.display())))
        .collect::<Result<Vec<_>>>()?;
    Ok((articles, rendered))
}

pub fn check(config_path: &Path, drafts: bool) -> Result<()> {
    let config = Config::load(config_path)?;
    let (articles, rendered) = prepare(&config, drafts)?;
    println!(
        "Validated {} articles and {} app embeds. Run build to compile TypeScript/JavaScript.",
        articles.len(),
        rendered.iter().map(|r| r.entries.len()).sum::<usize>()
    );
    Ok(())
}

fn write(path: impl AsRef<Path>, content: impl AsRef<[u8]>) -> Result<()> {
    let path = path.as_ref();
    fs::create_dir_all(path.parent().context("No output parent")?)?;
    ensure!(!path.exists(), "Output collision: {}", path.display());
    fs::write(path, content).with_context(|| format!("Cannot write {}", path.display()))
}

fn copy_assets(article: &Article, articles: &[Article], staging: &Path) -> Result<()> {
    let root = article.directory();
    let destination = staging.join("article").join(&article.slug);
    let others = articles
        .iter()
        .map(Article::directory)
        .filter(|p| *p != root)
        .collect::<Vec<_>>();
    for entry in WalkDir::new(root)
        .sort_by_file_name()
        .into_iter()
        .filter_entry(|e| {
            e.depth() == 0
                || (!e.file_name().to_string_lossy().starts_with('.')
                    && !others.contains(&e.path()))
        })
    {
        let entry = entry?;
        ensure!(
            !entry.file_type().is_symlink(),
            "Symlink in article assets: {}",
            entry.path().display()
        );
        if !entry.file_type().is_file() || !markdown::asset_allowed(entry.path()) {
            continue;
        }
        let relative = entry.path().strip_prefix(root)?;
        ensure!(
            relative != Path::new("index.html") && !relative.starts_with("_embeds"),
            "Reserved article asset name: {}. Put standalone apps in a subdirectory.",
            entry.path().display()
        );
        let target = destination.join(relative);
        fs::create_dir_all(target.parent().unwrap())?;
        fs::copy(entry.path(), target)?;
    }
    Ok(())
}

#[derive(Serialize)]
struct FrontendPlan<'a> {
    out_dir: &'a Path,
    entries: Vec<&'a Entry>,
}

pub fn build(config_path: &Path, drafts: bool) -> Result<()> {
    let config = Config::load(config_path)?;
    let (articles, rendered) = prepare(&config, drafts)?;
    let output = &config.build.output_dir;
    if output.exists() {
        ensure!(output.is_dir(), "output_dir is not a directory");
        ensure!(
            fs::read_dir(output)?.next().is_none() || output.join(OUTPUT_MARKER).is_file(),
            "Refusing to replace nonempty unmanaged output {}. Choose an empty output directory.",
            output.display()
        );
    }
    let parent = output.parent().unwrap();
    fs::create_dir_all(parent)?;
    let temp = tempfile::Builder::new()
        .prefix(".sitegen-")
        .tempdir_in(parent)?;
    let staging = temp.path().join("site");
    fs::create_dir(&staging)?;
    write(staging.join("index.html"), render::home(&config.site))?;
    write(
        staging.join("articles/index.html"),
        render::archive(&config.site, &articles),
    )?;
    write(staging.join("404.html"), render::not_found(&config.site))?;
    // Discover drafts too when deciding asset ownership, so an excluded nested article
    // cannot accidentally have its media copied through a published parent article.
    let all_articles = article::discover(&config.build.articles_dir, true)?;
    for article in &articles {
        copy_assets(article, &all_articles, &staging)?;
    }
    let plan = FrontendPlan {
        out_dir: &staging,
        entries: rendered.iter().flat_map(|r| &r.entries).collect(),
    };
    let manifest = temp.path().join("frontend-plan.json");
    fs::write(&manifest, serde_json::to_vec_pretty(&plan)?)?;
    let status = Command::new("node")
        .arg(config.build.frontend_dir.join("tools/build.ts"))
        .arg("--manifest")
        .arg(&manifest)
        .current_dir(&config.build.frontend_dir)
        .status()
        .context("Cannot start Node.js. Install Node 22.18+ or 24+ and run npm ci in frontend/")?;
    ensure!(
        status.success(),
        "Frontend compilation failed; previous output is unchanged"
    );
    for required in [
        "assets/site.js",
        "assets/theme-init.js",
        "assets/site.css",
        "assets/favicon.svg",
    ] {
        ensure!(
            staging.join(required).is_file(),
            "Frontend did not emit {required}"
        );
    }
    for (article, rendered) in articles.iter().zip(&rendered) {
        let styles = rendered
            .entries
            .iter()
            .map(|entry| format!("{}.css", entry.output))
            .filter(|path| staging.join(path).is_file())
            .map(|path| format!("/{path}"))
            .collect::<Vec<_>>();
        write(
            staging
                .join("article")
                .join(&article.slug)
                .join("index.html"),
            render::article(&config.site, article, rendered, &styles)?,
        )?;
    }
    write(
        staging.join("robots.txt"),
        format!(
            "User-agent: *\nAllow: /\nSitemap: {}/sitemap.xml\n",
            config.site.base_url
        ),
    )?;
    let mut sitemap = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"><url><loc>{}/</loc></url><url><loc>{}/articles</loc></url>",
        render::escape(&config.site.base_url),
        render::escape(&config.site.base_url)
    );
    for article in articles.iter().filter(|a| !a.metadata.draft) {
        sitemap.push_str(&format!(
            "<url><loc>{}{}</loc>",
            render::escape(&config.site.base_url),
            article.url()
        ));
        if let Some(date) = article
            .metadata
            .updated_at
            .as_ref()
            .or(article.metadata.published_at.as_ref())
        {
            sitemap.push_str(&format!(
                "<lastmod>{}</lastmod>",
                render::escape(&date.raw[..10])
            ));
        }
        sitemap.push_str("</url>");
    }
    sitemap.push_str("</urlset>\n");
    write(staging.join("sitemap.xml"), sitemap)?;
    write(
        staging.join(OUTPUT_MARKER),
        "Generated by brand sitegen. Safe to rebuild.\n",
    )?;
    let previous = temp.path().join("previous");
    if output.exists() {
        fs::rename(output, &previous).context("Cannot move previous build")?;
    }
    if let Err(error) = fs::rename(&staging, output) {
        if previous.exists() {
            fs::rename(&previous, output).context("Could not restore previous output")?;
        }
        return Err(error).context("Could not install new build");
    }
    println!("Built {} articles → {}", articles.len(), output.display());
    Ok(())
}
