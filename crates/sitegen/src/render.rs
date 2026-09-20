use anyhow::{Context, Result};
use lol_html::{RewriteStrSettings, element, rewrite_str};

use crate::{
    article::{Article, Date},
    config::Site,
    markdown::Rendered,
};

pub fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn theme_control() -> String {
    let icons = [
        (
            "day",
            include_str!("../../../frontend/libs/site/icons/sun.svg"),
        ),
        (
            "sunset",
            include_str!("../../../frontend/libs/site/icons/flower-2.svg"),
        ),
        (
            "forest",
            include_str!("../../../frontend/libs/site/icons/tree-pine.svg"),
        ),
        (
            "rain",
            include_str!("../../../frontend/libs/site/icons/cloud-rain-wind.svg"),
        ),
        (
            "night",
            include_str!("../../../frontend/libs/site/icons/moon.svg"),
        ),
    ]
    .into_iter()
    .map(|(theme, svg)| {
        format!(r#"<span class="theme-icon" data-theme-icon="{theme}">{svg}</span>"#)
    })
    .collect::<String>();
    format!(
        r#"<button class="theme-control" id="theme-cycle" type="button" aria-label="Change color theme" hidden><span class="theme-art" aria-hidden="true">{icons}</span><span class="theme-steps" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></button>"#
    )
}

fn shell(
    site: &Site,
    title: &str,
    description: &str,
    path: &str,
    class: &str,
    content: &str,
    extra_head: &str,
) -> String {
    let home = class == "home";
    let nav = if home {
        String::new()
    } else {
        format!(
            r#"<a class="wordmark" href="/" aria-label="{} home">{}</a><a class="header-articles" href="/articles"{}>Articles</a>"#,
            escape(&site.name),
            escape(&site.name),
            if class == "archive" {
                " aria-current=\"page\""
            } else {
                ""
            }
        )
    };
    let page_title = escape(&format!("{title} - {}", site.title_append));
    let canonical = escape(&format!("{}{path}", site.base_url));
    let description = escape(description);
    format!(
        r##"<!doctype html>
<html lang="en" data-theme="{theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{page_title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{page_title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{canonical}">
<meta property="og:site_name" content="{name}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{page_title}">
<meta name="twitter:description" content="{description}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<script src="/assets/theme-init.js"></script>
<link rel="stylesheet" href="/assets/site.css">
<script type="module" src="/assets/site.js"></script>
{extra_head}
</head>
<body class="{class}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">{nav}<div class="header-theme">{theme_control}</div></header>
{content}
</body>
</html>
"##,
        theme = site.default_theme,
        name = escape(&site.name),
        theme_control = theme_control(),
        og_type = if class == "article-page" {
            "article"
        } else {
            "website"
        }
    )
}

pub fn home(site: &Site) -> String {
    shell(
        site,
        &site.home_title,
        &site.description,
        "/",
        "home",
        &format!(
            r#"
<main id="main" class="home-main">
<h1>{}</h1>
<div class="home-links"><a href="mailto:{}">{}</a><a class="articles-link" href="/articles">Articles <span aria-hidden="true">↗</span></a></div>
</main>"#,
            escape(&site.name),
            escape(&site.email),
            escape(&site.email)
        ),
        "",
    )
}

fn time(date: &Date) -> String {
    format!(
        "<time datetime=\"{}\">{}</time>",
        escape(&date.raw),
        escape(&date.display)
    )
}

pub fn archive(site: &Site, articles: &[Article]) -> String {
    let mut rows = String::new();
    for article in articles {
        let date = article
            .metadata
            .published_at
            .as_ref()
            .map(time)
            .or_else(|| {
                article
                    .metadata
                    .updated_at
                    .as_ref()
                    .map(|d| format!("Updated {}", time(d)))
            })
            .unwrap_or_default();
        let description = article
            .metadata
            .description
            .as_ref()
            .map(|s| format!("<p>{}</p>", escape(s)))
            .unwrap_or_default();
        rows.push_str(&format!(r#"<li class="article-row"><div class="row-date">{date}</div><div class="row-content"><h2><a href="{}">{}{}</a></h2>{description}</div><span class="row-arrow" aria-hidden="true">↗</span></li>"#,
            article.url(), escape(&article.title), if article.metadata.draft { " <span class=\"draft-label\">Draft</span>" } else { "" }));
    }
    let list = if articles.is_empty() {
        "<p class=\"empty-state\">No articles yet.</p>".to_owned()
    } else {
        format!("<ol class=\"article-list\">{rows}</ol>")
    };
    shell(
        site,
        &site.articles_title,
        &site.description,
        "/articles",
        "archive",
        &format!(
            r#"
<main id="main" class="archive-main"><div class="archive-heading"><h1>{}</h1><span class="article-count">{:02}</span></div>{list}</main>"#,
            escape(&site.articles_title),
            articles.len()
        ),
        "",
    )
}

fn outbound_link_rels(html: &str, base_url: &str) -> Result<String> {
    let base = url::Url::parse(base_url)?;
    rewrite_str(
        html,
        RewriteStrSettings {
            element_content_handlers: vec![element!("a[href], area[href]", |el| {
                let href = el.get_attribute("href").unwrap_or_default();
                if base.join(&href).is_ok_and(|url| {
                    matches!(url.scheme(), "http" | "https") && url.origin() != base.origin()
                }) {
                    let existing = el.get_attribute("rel").unwrap_or_default();
                    let mut tokens: Vec<_> = existing.split_ascii_whitespace().collect();
                    for token in ["nofollow", "noreferrer"] {
                        if !tokens.iter().any(|value| value.eq_ignore_ascii_case(token)) {
                            tokens.push(token);
                        }
                    }
                    el.set_attribute("rel", &tokens.join(" "))?;
                }
                Ok(())
            })],
            ..RewriteStrSettings::default()
        },
    )
    .context("Could not apply outbound link attributes")
}

pub fn article(
    site: &Site,
    article: &Article,
    rendered: &Rendered,
    styles: &[String],
) -> Result<String> {
    let metadata = &article.metadata;
    let mut dates = String::new();
    let mut extra = String::new();
    for style in styles {
        extra.push_str(&format!(
            "<link rel=\"stylesheet\" href=\"{}\">\n",
            escape(style)
        ));
    }
    if let Some(date) = &metadata.published_at {
        dates.push_str(&format!("<span>Published {}</span>", time(date)));
        extra.push_str(&format!(
            "<meta property=\"article:published_time\" content=\"{}\">\n",
            escape(&date.raw)
        ));
    }
    if let Some(date) = &metadata.updated_at {
        dates.push_str(&format!("<span>Updated {}</span>", time(date)));
        extra.push_str(&format!(
            "<meta property=\"article:modified_time\" content=\"{}\">\n",
            escape(&date.raw)
        ));
    }
    if metadata.draft {
        extra.push_str("<meta name=\"robots\" content=\"noindex\">\n");
    }
    let toc = rendered
        .headings
        .iter()
        .filter(|h| h.level == 2 || h.level == 3)
        .map(|h| {
            format!(
                "<li class=\"toc-level-{}\"><a href=\"#{}\">{}</a></li>",
                h.level,
                h.id,
                escape(&h.title)
            )
        })
        .collect::<String>();
    let toc = if toc.is_empty() {
        String::new()
    } else {
        format!(
            "<nav class=\"toc\" aria-label=\"On this page\"><p>On this page</p><ol>{toc}</ol></nav>"
        )
    };
    let description = metadata
        .description
        .as_ref()
        .map(|s| format!("<p class=\"article-deck\">{}</p>", escape(s)))
        .unwrap_or_default();
    let content = format!(
        r#"<main id="main" class="article-layout">
<aside class="article-aside">{toc}</aside>
<article><header class="article-heading"><h1>{title}</h1>{description}<div class="article-meta">{dates}<span>{minutes} min read</span>{draft}</div></header>
<div class="prose"{link_policy}>{body}</div><footer class="article-footer"><a href="/articles">← All articles</a><a href="mailto:{email}">{email}</a></footer></article>
</main>"#,
        title = escape(&article.title),
        minutes = rendered.minutes,
        draft = if metadata.draft {
            "<span class=\"draft-label\">Draft</span>"
        } else {
            ""
        },
        body = rendered.html,
        link_policy = if metadata.nofollow_external_links {
            format!(
                " data-nofollow-external-links=\"{}\"",
                escape(&site.base_url)
            )
        } else {
            String::new()
        },
        email = escape(&site.email)
    );
    let html = shell(
        site,
        metadata.html_title.as_deref().unwrap_or(&article.title),
        metadata.description.as_deref().unwrap_or(&site.description),
        &article.url(),
        "article-page",
        &content,
        &extra,
    );
    if metadata.nofollow_external_links {
        outbound_link_rels(&html, &site.base_url)
    } else {
        Ok(html)
    }
}

pub fn not_found(site: &Site) -> String {
    shell(
        site,
        "Page not found",
        "This page could not be found.",
        "/404",
        "not-found",
        r#"<main id="main" class="archive-main"><p>404</p><h1>Page not found.</h1><p><a href="/">Home</a> · <a href="/articles">All articles</a></p></main>"#,
        "<meta name=\"robots\" content=\"noindex\">",
    )
}
