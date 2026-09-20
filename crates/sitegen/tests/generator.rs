use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use sitegen::{
    article::{discover, split_frontmatter, title_from_slug},
    config::Config,
    markdown, render,
};
use tempfile::TempDir;

struct Fixture {
    temp: TempDir,
}
impl Fixture {
    fn new() -> Self {
        let fixture = Self {
            temp: tempfile::tempdir().unwrap(),
        };
        fs::create_dir(fixture.root().join("articles")).unwrap();
        fs::create_dir(fixture.root().join("frontend")).unwrap();
        fixture.config("build", "frontend");
        fixture
    }
    fn root(&self) -> PathBuf {
        self.temp.path().canonicalize().unwrap()
    }
    fn config(&self, output: &str, frontend: &str) {
        self.put(
            "config.toml",
            &format!(
                r#"
[site]
name = "brand"
email = "bt@brand.io"
base_url = "https://brand.io"
title_append = "brand"
home_title = "Home"
articles_title = "Articles"
description = "An example"
default_theme = "day"
[build]
articles_dir = "articles"
frontend_dir = {frontend:?}
output_dir = {output:?}
"#
            ),
        );
    }
    fn put(&self, path: &str, content: &str) {
        let path = self.root().join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }
    fn articles(&self) -> Vec<sitegen::article::Article> {
        discover(&self.root().join("articles"), false).unwrap()
    }
}

#[test]
fn slug_precedence_and_intelligent_titles() {
    let f = Fixture::new();
    f.put("articles/2026/llm_survey/article.md", "Hello");
    f.put("articles/notes_on_ai.md", "Hello");
    f.put(
        "articles/2025/ignored/filename.md",
        "+++\nslug = 'A Better API'\n+++\nHello",
    );
    let articles = f.articles();
    let titles: Vec<_> = articles
        .iter()
        .map(|a| (a.slug.as_str(), a.title.as_str()))
        .collect();
    assert_eq!(
        titles,
        [
            ("a-better-api", "A Better API"),
            ("llm-survey", "LLM Survey"),
            ("notes-on-ai", "Notes on AI")
        ]
    );
    assert_eq!(
        title_from_slug("typescript-and-rust-in-the-browser"),
        "TypeScript and Rust in the Browser"
    );
}

#[test]
fn titles_are_independent_and_escaped() {
    let f = Fixture::new();
    f.put("articles/example.md", "+++\nslug = 'permanent-url'\ntitle = 'A <B> & C'\nhtml_title = 'Browser title'\n+++\nA paragraph.");
    let articles = f.articles();
    let rendered = markdown::render(&articles[0], &HashMap::new()).unwrap();
    let config = Config::load(&f.root().join("config.toml")).unwrap();
    let html = render::article(&config.site, &articles[0], &rendered, &[]).unwrap();
    assert!(html.contains("<h1>A &lt;B&gt; &amp; C</h1>"));
    assert!(html.contains("<title>Browser title - brand</title>"));
    assert!(html.contains("https://brand.io/article/permanent-url"));
    assert!(!html.contains("<time"));
    assert!(!html.contains("Published"));
    assert!(!html.contains("Updated"));
}

#[test]
fn dates_sort_by_creation_then_update_then_undated_with_stable_ties() {
    let f = Fixture::new();
    f.put(
        "articles/older.md",
        "+++\ncreated_at = 2025-01-01\nupdated_at = 2026-09-01\n+++\nOld",
    );
    f.put(
        "articles/newer.md",
        "+++\ncreated_at = '2026-01-01T12:00:00-04:00'\n+++\nNew",
    );
    f.put(
        "articles/updated_only.md",
        "+++\nupdated_at = 2026-01-02\n+++\nUpdated",
    );
    f.put("articles/undated.md", "No dates");
    let articles = f.articles();
    assert_eq!(
        articles.iter().map(|a| a.slug.as_str()).collect::<Vec<_>>(),
        ["updated-only", "newer", "older", "undated"]
    );
    assert_eq!(
        articles[1].metadata.created_at.as_ref().unwrap().display,
        "January 1, 2026"
    );
}

#[test]
fn frontmatter_handles_bom_crlf_and_rejects_bad_metadata() {
    let (metadata, body) =
        split_frontmatter("\u{feff}+++\r\ntitle = 'Good'\r\n+++\r\nBody").unwrap();
    assert_eq!(metadata.title.as_deref(), Some("Good"));
    assert_eq!(body, "Body");
    for source in [
        "+++",
        "+++\n",
        "+++\ncreated_at = 'yesterday'\n+++",
        "+++\ncreated_at = 2026-02-30\n+++",
        "+++\ncreated_att = '2026-01-01'\n+++",
        "+++\nnofollow_external_links = 'true'\n+++",
    ] {
        assert!(
            split_frontmatter(source).is_err(),
            "Should reject {source:?}"
        );
    }
}

#[test]
fn duplicates_blank_titles_and_reverse_dates_are_actionable_errors() {
    let f = Fixture::new();
    f.put("articles/a.md", "+++\nslug = 'Same'\n+++\nA");
    f.put("articles/b.md", "+++\nslug = 'same'\n+++\nB");
    assert!(
        discover(&f.root().join("articles"), false)
            .unwrap_err()
            .to_string()
            .contains("Duplicate slug")
    );
    f.put("articles/b.md", "+++\ntitle = ' '\n+++\nB");
    assert!(
        discover(&f.root().join("articles"), false)
            .unwrap_err()
            .to_string()
            .contains("Blank title")
    );
    f.put(
        "articles/b.md",
        "+++\ncreated_at = 2026-02-02\nupdated_at = 2026-02-01\n+++\nB",
    );
    assert!(
        discover(&f.root().join("articles"), false)
            .unwrap_err()
            .to_string()
            .contains("precedes")
    );
}

#[test]
fn drafts_are_opt_in() {
    let f = Fixture::new();
    f.put("articles/a.md", "+++\ndraft = true\n+++\nDraft");
    assert!(f.articles().is_empty());
    assert_eq!(discover(&f.root().join("articles"), true).unwrap().len(), 1);
}

#[test]
fn markdown_and_raw_html_rewrite_media_and_article_links() {
    let f = Fixture::new();
    f.put("articles/one/article.md", "![A photo](media/a%20photo.jpg)\n\n<video poster=\"media/a%20photo.jpg\"><source src=\"media/clip.mp4\"></video>\n\n[Next](../two/article.md#section)\n\n[Mail](mailto:bt@brand.io)");
    f.put("articles/one/media/a photo.jpg", "image");
    f.put("articles/one/media/clip.mp4", "video");
    f.put(
        "articles/two/article.md",
        "+++\nslug = 'custom-url'\n+++\n## Section",
    );
    let articles = f.articles();
    let routes = articles
        .iter()
        .map(|a| (a.source.clone(), a.url()))
        .collect();
    let article = articles.iter().find(|a| a.slug == "one").unwrap();
    let html = markdown::render(article, &routes).unwrap().html;
    assert!(html.contains("/article/one/media/a%20photo.jpg"));
    assert!(html.contains("/article/one/media/clip.mp4"));
    assert!(html.contains("/article/custom-url#section"));
    assert!(html.contains("mailto:bt@brand.io"));
    assert!(html.contains("loading=\"lazy\""));
}

#[test]
fn missing_and_escaping_media_fail() {
    let f = Fixture::new();
    f.put("articles/one/article.md", "![Missing](missing.png)");
    let articles = f.articles();
    assert!(markdown::render(&articles[0], &HashMap::new()).is_err());
    f.put("articles/outside.png", "image");
    f.put("articles/one/article.md", "![Escape](../outside.png)");
    assert!(markdown::render(&f.articles()[0], &HashMap::new()).is_err());
}

#[test]
fn markdown_features_and_unique_heading_ids() {
    let f = Fixture::new();
    f.put("articles/a.md", "## Hello, *world*\n\n## Hello world\n\n> A quote\n\n```rust\nlet x = \"<script>\";\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n- [x] Done\n\nA note[^a].\n\n[^a]: Footnote");
    let result = markdown::render(&f.articles()[0], &HashMap::new()).unwrap();
    assert_eq!(
        result
            .headings
            .iter()
            .map(|h| h.id.as_str())
            .collect::<Vec<_>>(),
        ["hello-world", "hello-world-2"]
    );
    for expected in [
        "<blockquote>",
        "language-rust",
        "&lt;script&gt;",
        "table-scroll",
        "type=\"checkbox\"",
        "footnote-definition",
    ] {
        assert!(result.html.contains(expected), "Missing {expected}");
    }
}

#[test]
fn embed_metadata_produces_build_entries_and_accessible_fallbacks() {
    let f = Fixture::new();
    f.put("articles/demo/app.ts", "export default () => {}");
    f.put("articles/demo/game/index.html", "<p>Game</p>");
    f.put("articles/demo/article.md", "```embed\nsrc = 'app.ts'\ntitle = 'A <figure>'\nfallback = 'Useful without JS'\n```\n\n```embed\nkind = 'iframe'\nsrc = 'game/index.html'\ntitle = 'Game'\n```");
    let result = markdown::render(&f.articles()[0], &HashMap::new()).unwrap();
    assert_eq!(result.entries.len(), 1);
    assert!(result.html.contains("A &lt;figure&gt;"));
    assert!(result.html.contains("Useful without JS"));
    assert!(result.html.contains("/article/demo/_embeds/1.js"));
    assert!(
        result
            .html
            .contains("src=\"/article/demo/game/index.html\"")
    );
}

#[test]
fn app_embed_titles_can_be_omitted_without_empty_captions() {
    let f = Fixture::new();
    f.put("articles/demo/app.ts", "export default () => {}");
    f.put("articles/demo/game/index.html", "<p>Game</p>");
    f.put(
        "articles/demo/article.md",
        "```embed\nsrc = 'app.ts'\nfallback = 'A useful description'\n```",
    );
    let result = markdown::render(&f.articles()[0], &HashMap::new()).unwrap();
    assert_eq!(result.entries.len(), 1);
    assert!(!result.html.contains("figcaption"));
    assert!(result.html.contains("A useful description"));
    assert!(result.html.contains("/article/demo/_embeds/1.js"));
    for metadata in [
        "src = 'app.ts'\ntitle = ' '",
        "src = 'game/index.html'\nkind = 'iframe'",
    ] {
        f.put(
            "articles/demo/article.md",
            &format!("```embed\n{metadata}\n```"),
        );
        assert!(markdown::render(&f.articles()[0], &HashMap::new()).is_err());
    }
}

#[test]
fn outbound_link_policy_is_opt_in_preserves_rels_and_handles_markdown_and_html() {
    let f = Fixture::new();
    let config = Config::load(&f.root().join("config.toml")).unwrap();
    let body = r##"
[Markdown](https://remote.test/post)

<a href="//remote.test/protocol" rel="ugc sponsored">Protocol-relative</a>
<a href="https://remote.test/existing" rel="NOFOLLOW noreferrer noopener">Existing</a>
<a href="https://brand.io.evil.test/">Lookalike domain</a>
<a href="https://brand.io@remote.test/">Credentials</a>
<a href="HTTP://REMOTE.TEST/">Uppercase scheme</a>
<map name="demo"><area href="https://remote.test/map" alt="Map"></map>
<a href="https://brand.io:443/article/another">Same origin</a>
<a href="//brand.io/article/another">Same origin, protocol-relative</a>
<a href="/articles">Local route</a>
<a href="#section">Anchor</a>
<a href="?page=2">Query</a>
<a href="mailto:reader@example.com">Email</a>
<a href="tel:+1234567890">Telephone</a>
<link rel="stylesheet" href="https://remote.test/style.css">
"##;
    for setting in [None, Some(false), Some(true)] {
        let metadata = setting
            .map(|value| format!("+++\nnofollow_external_links = {value}\n+++\n"))
            .unwrap_or_default();
        f.put("articles/example.md", &format!("{metadata}{body}"));
        let articles = f.articles();
        assert_eq!(
            articles[0].metadata.nofollow_external_links,
            setting.unwrap_or(false)
        );
        let rendered = markdown::render(&articles[0], &HashMap::new()).unwrap();
        let html = render::article(&config.site, &articles[0], &rendered, &[]).unwrap();
        let mut links = HashMap::new();
        lol_html::rewrite_str(
            &html,
            lol_html::RewriteStrSettings {
                element_content_handlers: vec![lol_html::element!("a[href], area[href]", |el| {
                    links.insert(el.get_attribute("href").unwrap(), el.get_attribute("rel"));
                    Ok(())
                })],
                ..Default::default()
            },
        )
        .unwrap();
        for href in [
            "https://remote.test/post",
            "https://brand.io.evil.test/",
            "https://brand.io@remote.test/",
            "HTTP://REMOTE.TEST/",
            "https://remote.test/map",
        ] {
            assert_eq!(
                links[href].as_deref(),
                if setting == Some(true) {
                    Some("nofollow noreferrer")
                } else {
                    None
                },
                "{href}"
            );
        }
        assert_eq!(
            links["//remote.test/protocol"].as_deref(),
            Some(if setting == Some(true) {
                "ugc sponsored nofollow noreferrer"
            } else {
                "ugc sponsored"
            })
        );
        assert_eq!(
            links["https://remote.test/existing"].as_deref(),
            Some("NOFOLLOW noreferrer noopener")
        );
        for href in [
            "https://brand.io:443/article/another",
            "//brand.io/article/another",
            "/articles",
            "#section",
            "?page=2",
            "mailto:reader@example.com",
            "tel:+1234567890",
        ] {
            assert_eq!(links[href], None, "{href}");
        }
        assert!(html.contains("<link rel=\"stylesheet\" href=\"https://remote.test/style.css\">"));
        assert_eq!(
            html.contains("data-nofollow-external-links=\"https://brand.io\""),
            setting == Some(true)
        );
    }
}

#[test]
fn config_cannot_overwrite_source_or_escape_the_project() {
    let f = Fixture::new();
    for output in [
        ".",
        "../elsewhere",
        "/tmp/escape",
        "articles",
        "articles/output",
        "frontend",
        "crates",
        ".git",
        ".git/output",
    ] {
        f.config(output, "frontend");
        assert!(
            Config::load(&f.root().join("config.toml")).is_err(),
            "Should reject {output}"
        );
    }
}

#[test]
fn real_build_compiles_embeds_copies_media_and_preserves_previous_output_on_failure() {
    // This end-to-end test needs the documented Node dependencies: npm ci --prefix frontend.
    let f = Fixture::new();
    let frontend = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../frontend")
        .canonicalize()
        .unwrap();
    f.config("public", frontend.to_str().unwrap());
    f.put("articles/demo/article.md", "+++\ntitle = 'First'\n+++\n```embed\nsrc = 'app.ts'\ntitle = 'Test'\n```\n\n![image](media/image.jpg)");
    f.put("articles/demo/app.ts", "import './style.css'; export default (root: HTMLElement) => { root.textContent = 'Mounted'; };");
    f.put("articles/demo/style.css", ".example { color: red; }");
    f.put("articles/demo/media/image.jpg", "a fixture");
    f.put("articles/draft/article.md", "+++\ndraft = true\n+++\nDraft");
    f.put("articles/draft/private.jpg", "private media");
    let config = f.root().join("config.toml");
    sitegen::build(&config, false).unwrap();
    let page_path = f.root().join("public/article/demo/index.html");
    let first_page = fs::read_to_string(&page_path).unwrap();
    let theme_script = "<script src=\"/assets/theme-init.js\"></script>";
    for page in [
        "index.html",
        "articles/index.html",
        "404.html",
        "article/demo/index.html",
    ] {
        let html = fs::read_to_string(f.root().join("public").join(page)).unwrap();
        assert!(html.find(theme_script).unwrap() < html.find("<link rel=\"stylesheet\"").unwrap());
        assert!(!html.contains("<script>"));
        assert!(!html.contains("src=\"/assets/theme-init.ts\""));
    }
    assert!(f.root().join("public/assets/theme-init.js").is_file());
    assert!(first_page.contains("/article/demo/_embeds/1.css"));
    assert!(f.root().join("public/article/demo/_embeds/1.js").is_file());
    assert!(
        f.root()
            .join("public/article/demo/media/image.jpg")
            .is_file()
    );
    assert!(!f.root().join("public/article/draft").exists());
    f.put("public/stale.html", "old generated file");
    f.put("articles/demo/app.ts", "this is not valid TypeScript !!!");
    assert!(sitegen::build(&config, false).is_err());
    assert_eq!(fs::read_to_string(&page_path).unwrap(), first_page);
    assert!(f.root().join("public/stale.html").exists());
    // esbuild would silently transpile this valid syntax. The Rust build must
    // run the type checker, including entries outside the default articles root.
    f.put(
        "articles/demo/app.ts",
        "const message: number = 'wrong type'; export default () => message;",
    );
    assert!(sitegen::build(&config, false).is_err());
    assert_eq!(fs::read_to_string(&page_path).unwrap(), first_page);
    assert!(f.root().join("public/stale.html").exists());
    f.put("articles/demo/app.ts", "export const missingDefault = 1;");
    assert!(sitegen::build(&config, false).is_err());
    assert_eq!(fs::read_to_string(&page_path).unwrap(), first_page);
    f.put("articles/demo/app.ts", "export default () => {}; ");
    sitegen::build(&config, false).unwrap();
    assert!(!f.root().join("public/stale.html").exists());
    assert!(!f.root().join("public/article/demo/_embeds/1.css").exists());
    assert!(
        !fs::read_to_string(page_path)
            .unwrap()
            .contains("/article/demo/_embeds/1.css")
    );
}

#[test]
fn nonempty_unmanaged_output_is_preserved() {
    let f = Fixture::new();
    f.put("build/important.txt", "Do not remove");
    let error = sitegen::build(&f.root().join("config.toml"), false).unwrap_err();
    assert!(error.to_string().contains("unmanaged"));
    assert_eq!(
        fs::read_to_string(f.root().join("build/important.txt")).unwrap(),
        "Do not remove"
    );
}

#[test]
fn optional_dates_accept_local_times_and_offsets() {
    for field in ["created_at", "published_at", "updated_at"] {
        for value in [
            "2026-09-20",
            "2026-09-20 09:30",
            "2026-09-20 09:30:15",
            "2026-09-20T09:30",
            "2026-09-20T09:30:15",
            "2026-09-20 09:30Z",
            "2026-09-20 09:30-04:00",
            "2026-09-20T09:30:15+05:30",
        ] {
            let source = format!("+++\n{field} = '{value}'\n+++\nBody");
            assert!(split_frontmatter(&source).is_ok(), "{source}");
        }
        for value in [
            "2026-02-30",
            "2026-09-20 24:01",
            "2026-09-20 09:99",
            "2026-09-20 09:30:99",
            "2026-09-20Z",
        ] {
            assert!(
                split_frontmatter(&format!("+++\n{field} = '{value}'\n+++\n")).is_err(),
                "{value}"
            );
        }
    }
}

#[test]
fn public_dates_are_independent_and_creation_stays_private() {
    let f = Fixture::new();
    let config = Config::load(&f.root().join("config.toml")).unwrap();
    for public_fields in [
        "",
        "published_at = '2026-09-20 09:30'",
        "updated_at = 2026-09-21",
        "published_at = 2026-09-20\nupdated_at = 2026-09-21",
    ] {
        f.put(
            "articles/example.md",
            &format!("+++\ncreated_at = 2001-02-03\n{public_fields}\n+++\nBody"),
        );
        let articles = f.articles();
        let rendered = markdown::render(&articles[0], &HashMap::new()).unwrap();
        let html = render::article(&config.site, &articles[0], &rendered, &[]).unwrap();
        assert!(!html.contains("2001"));
        assert!(!render::archive(&config.site, &articles).contains("2001"));
        assert_eq!(
            html.contains("Published <time"),
            public_fields.contains("published_at")
        );
        assert_eq!(
            html.contains("Updated <time"),
            public_fields.contains("updated_at")
        );
        if public_fields.contains("09:30") {
            assert!(html.contains("datetime=\"2026-09-20T09:30:00\""));
        }
    }
}

#[test]
fn publication_date_takes_sorting_priority() {
    let f = Fixture::new();
    f.put(
        "articles/a.md",
        "+++\ncreated_at = 2020-01-01\npublished_at = 2026-09-20\n+++\nA",
    );
    f.put(
        "articles/b.md",
        "+++\ncreated_at = 2025-01-01\npublished_at = 2026-09-19\n+++\nB",
    );
    assert_eq!(f.articles()[0].slug, "a");
}
