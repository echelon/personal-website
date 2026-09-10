use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, bail, ensure};
use lol_html::{RewriteStrSettings, element, rewrite_str};
use percent_encoding::{AsciiSet, CONTROLS, percent_decode_str, utf8_percent_encode};
use pulldown_cmark::{CodeBlockKind, Event, Options, Parser, Tag, TagEnd, html};
use serde::{Deserialize, Serialize};

use crate::{article::Article, render::escape};

#[derive(Debug, Serialize)]
pub struct Entry {
    pub source: PathBuf,
    pub output: String,
}

#[derive(Debug)]
pub struct Heading {
    pub level: usize,
    pub id: String,
    pub title: String,
}

pub struct Rendered {
    pub html: String,
    pub headings: Vec<Heading>,
    pub entries: Vec<Entry>,
    pub minutes: usize,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Embed {
    src: String,
    title: String,
    #[serde(default = "default_height")]
    height: u32,
    #[serde(default = "default_kind")]
    kind: String,
    fallback: Option<String>,
}

fn default_height() -> u32 {
    360
}
fn default_kind() -> String {
    "app".into()
}

pub fn asset_allowed(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|s| s.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some(
            "avif"
                | "gif"
                | "ico"
                | "jpeg"
                | "jpg"
                | "png"
                | "svg"
                | "webp"
                | "mp4"
                | "webm"
                | "ogg"
                | "mp3"
                | "wav"
                | "vtt"
                | "pdf"
                | "woff"
                | "woff2"
                | "glb"
                | "gltf"
                | "bin"
                | "wasm"
                | "html"
                | "css"
                | "js"
                | "mjs"
                | "json"
                | "txt"
        )
    )
}

const PATH_SEGMENT: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'<')
    .add(b'>')
    .add(b'?')
    .add(b'`')
    .add(b'{')
    .add(b'}');

fn encode_path(path: &Path) -> String {
    path.iter()
        .map(|s| utf8_percent_encode(&s.to_string_lossy(), PATH_SEGMENT).to_string())
        .collect::<Vec<_>>()
        .join("/")
}

fn local_file(directory: &Path, input: &str) -> Result<PathBuf> {
    let decoded = percent_decode_str(input)
        .decode_utf8()
        .context("Invalid UTF-8 URL")?;
    let joined = directory.join(decoded.as_ref());
    // WalkDir rejects source symlinks too; also reject symlink escapes here before reading anything.
    let resolved = joined
        .canonicalize()
        .with_context(|| format!("Missing local file: {}", joined.display()))?;
    ensure!(
        resolved.is_file(),
        "Expected a file: {}",
        resolved.display()
    );
    Ok(resolved)
}

pub fn rewrite_url(
    article: &Article,
    value: &str,
    routes: &HashMap<PathBuf, String>,
) -> Result<String> {
    if value.is_empty() || value.starts_with(['/', '#', '?']) || url::Url::parse(value).is_ok() {
        return Ok(value.to_owned());
    }
    let split = value.find(['?', '#']).unwrap_or(value.len());
    let (path, suffix) = value.split_at(split);
    let resolved = local_file(article.directory(), path)?;
    if resolved.extension().is_some_and(|e| e == "md") {
        return Ok(format!(
            "{}{suffix}",
            routes.get(&resolved).with_context(|| format!(
                "Linked article is excluded or not discovered: {}",
                resolved.display()
            ))?
        ));
    }
    ensure!(
        resolved.starts_with(article.directory()),
        "Media must be inside the article directory: {value}"
    );
    ensure!(
        asset_allowed(&resolved),
        "Unsupported public asset: {value}"
    );
    let relative = resolved.strip_prefix(article.directory())?;
    ensure!(
        !relative
            .iter()
            .any(|part| part.to_string_lossy().starts_with('.')),
        "Hidden assets are not published: {value}"
    );
    ensure!(
        !relative.starts_with("_embeds") && relative != Path::new("index.html"),
        "Reserved article asset path: {value}"
    );
    // Media owned by a nested article is not copied into this article's output.
    ensure!(
        !routes.keys().any(|source| source != &article.source
            && source.parent().is_some_and(|dir| dir != article.directory()
                && dir.starts_with(article.directory())
                && resolved.starts_with(dir))),
        "Reference media from this article's own directory: {value}"
    );
    Ok(format!(
        "{}/{}{suffix}",
        article.url(),
        encode_path(relative)
    ))
}

fn render_embed(
    article: &Article,
    input: &str,
    entries: &mut Vec<Entry>,
    index: usize,
) -> Result<String> {
    let embed: Embed = toml::from_str(input).context("Invalid embed block (expected TOML)")?;
    ensure!(
        !embed.title.trim().is_empty(),
        "Embed title is required for accessibility"
    );
    ensure!(
        (160..=1200).contains(&embed.height),
        "Embed height must be between 160 and 1200 pixels"
    );
    ensure!(
        !embed.src.starts_with('/')
            && !embed.src.contains(['?', '#'])
            && url::Url::parse(&embed.src).is_err(),
        "Embed src must be a local path inside the article directory"
    );
    let source = local_file(article.directory(), &embed.src)?;
    ensure!(
        source.starts_with(article.directory()),
        "Embed may not escape its article directory"
    );
    let title = escape(&embed.title);
    let fallback = escape(
        embed
            .fallback
            .as_deref()
            .unwrap_or("This interactive figure requires JavaScript."),
    );
    match embed.kind.as_str() {
        "app" => {
            ensure!(
                matches!(
                    source.extension().and_then(|s| s.to_str()),
                    Some("ts" | "tsx" | "js" | "jsx" | "mjs")
                ),
                "App embeds need a TypeScript or JavaScript entry point"
            );
            let output = format!("article/{}/_embeds/{index}", article.slug);
            let result = format!(
                r#"<figure class="interactive"><figcaption>{title}</figcaption><div class="embed-root" data-embed-src="/{output}.js" style="--embed-height: {}px"><p class="embed-fallback">{fallback}</p></div></figure>"#,
                embed.height
            );
            entries.push(Entry { source, output });
            Ok(result)
        }
        "iframe" => {
            ensure!(
                source.extension().is_some_and(|e| e == "html"),
                "Iframe embeds need a local HTML file"
            );
            let src = format!(
                "{}/{}",
                article.url(),
                encode_path(source.strip_prefix(article.directory())?)
            );
            Ok(format!(
                r#"<figure class="interactive"><figcaption>{title}</figcaption><iframe src="{src}" title="{title}" loading="lazy" height="{}" allow="fullscreen" referrerpolicy="no-referrer"></iframe></figure>"#,
                embed.height
            ))
        }
        _ => bail!("Unknown embed kind '{}'; use app or iframe", embed.kind),
    }
}

pub fn render(article: &Article, routes: &HashMap<PathBuf, String>) -> Result<Rendered> {
    let options = Options::ENABLE_TABLES
        | Options::ENABLE_FOOTNOTES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_SMART_PUNCTUATION;
    let events: Vec<_> = Parser::new_ext(&article.markdown, options).collect();
    let mut output = Vec::new();
    let mut headings = Vec::new();
    let mut entries = Vec::new();
    let mut ids = HashSet::new();
    let mut index = 0;
    let mut embeds = 0;
    let mut words = 0;
    while index < events.len() {
        match &events[index] {
            Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(info)))
                if info.as_ref() == "embed" =>
            {
                index += 1;
                let mut content = String::new();
                while index < events.len()
                    && !matches!(events[index], Event::End(TagEnd::CodeBlock))
                {
                    if let Event::Text(text) = &events[index] {
                        content.push_str(text);
                    }
                    index += 1;
                }
                embeds += 1;
                output.push(Event::Html(
                    render_embed(article, &content, &mut entries, embeds)?.into(),
                ));
            }
            Event::Start(Tag::Heading { level, .. }) => {
                let mut title = String::new();
                for event in events
                    .iter()
                    .skip(index + 1)
                    .take_while(|e| !matches!(e, Event::End(TagEnd::Heading(_))))
                {
                    match event {
                        Event::Text(text) | Event::Code(text) => title.push_str(text),
                        Event::SoftBreak | Event::HardBreak => title.push(' '),
                        _ => {}
                    }
                }
                let base = slug::slugify(&title);
                let base = if base.is_empty() {
                    "section".to_owned()
                } else {
                    base
                };
                let mut id = base.clone();
                let mut count = 2;
                while !ids.insert(id.clone()) {
                    id = format!("{base}-{count}");
                    count += 1;
                }
                let level_number = *level as usize;
                headings.push(Heading {
                    level: level_number,
                    id: id.clone(),
                    title,
                });
                output.push(Event::Html(format!("<h{level_number} id=\"{id}\">").into()));
            }
            Event::End(TagEnd::Heading(level)) => {
                output.push(Event::Html(format!("</h{}>\n", *level as usize).into()))
            }
            Event::Text(text) => {
                words += text.split_whitespace().count();
                output.push(events[index].clone());
            }
            _ => output.push(events[index].clone()),
        }
        index += 1;
    }
    let mut rendered = String::new();
    html::push_html(&mut rendered, output.into_iter());
    // Rewrite after Markdown rendering so raw HTML video, poster, source, and iframe URLs
    // follow the same rules as Markdown images and links. Author HTML is trusted.
    let rendered = rewrite_str(&rendered, RewriteStrSettings {
        element_content_handlers: vec![
            element!("[href], [src], [poster]", |el| {
                for attr in ["href", "src", "poster"] {
                    if let Some(value) = el.get_attribute(attr) {
                        let rewritten = rewrite_url(article, &value, routes).map_err(|e| format!("{e:#}"))?;
                        el.set_attribute(attr, &rewritten)?;
                    }
                }
                Ok(())
            }),
            element!("img", |el| {
                if !el.has_attribute("alt") { return Err("Images require alt text (use alt=\"\" for decorative images)".into()); }
                if !el.has_attribute("loading") { el.set_attribute("loading", "lazy")?; }
                el.set_attribute("decoding", "async")?;
                Ok(())
            }),
            element!("table", |el| {
                el.before("<div class=\"table-scroll\" tabindex=\"0\" role=\"region\" aria-label=\"Scrollable table\">", lol_html::html_content::ContentType::Html);
                el.after("</div>", lol_html::html_content::ContentType::Html);
                Ok(())
            }),
        ], ..RewriteStrSettings::default()
    }).map_err(|e| anyhow::anyhow!("HTML rendering: {e}"))?;
    Ok(Rendered {
        html: rendered,
        headings,
        entries,
        minutes: words.div_ceil(220).max(1),
    })
}
