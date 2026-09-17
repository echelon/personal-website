use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, bail, ensure};
use chrono::{DateTime, NaiveDate};
use serde::{Deserialize, Deserializer};
use walkdir::WalkDir;

#[derive(Clone, Debug)]
pub struct Date {
    pub raw: String,
    pub display: String,
    pub timestamp: i64,
}

impl<'de> Deserialize<'de> for Date {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Input {
            Text(String),
            Native(toml::value::Datetime),
        }
        let raw = match Input::deserialize(deserializer)? {
            Input::Text(s) => s,
            Input::Native(d) => d.to_string(),
        };
        let parsed = if let Ok(date) = NaiveDate::parse_from_str(&raw, "%Y-%m-%d") {
            Some((
                date,
                date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp(),
            ))
        } else if let Ok(date) = DateTime::parse_from_rfc3339(&raw) {
            Some((date.date_naive(), date.timestamp()))
        } else {
            None
        };
        let (date, timestamp) = parsed.ok_or_else(|| {
            serde::de::Error::custom("Dates must be YYYY-MM-DD or RFC 3339 with a timezone")
        })?;
        Ok(Self {
            raw,
            display: date.format("%B %-d, %Y").to_string(),
            timestamp,
        })
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Metadata {
    pub slug: Option<String>,
    pub title: Option<String>,
    pub html_title: Option<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created_at: Option<Date>,
    pub updated_at: Option<Date>,
    #[serde(default)]
    pub draft: bool,
    #[serde(default)]
    pub nofollow_external_links: bool,
}

#[derive(Debug)]
pub struct Article {
    pub source: PathBuf,
    pub slug: String,
    pub title: String,
    pub metadata: Metadata,
    pub markdown: String,
}

impl Article {
    pub fn url(&self) -> String {
        format!("/article/{}", self.slug)
    }
    pub fn directory(&self) -> &Path {
        self.source.parent().unwrap()
    }
    pub fn sort_date(&self) -> Option<i64> {
        self.metadata
            .created_at
            .as_ref()
            .or(self.metadata.updated_at.as_ref())
            .map(|d| d.timestamp)
    }
}

pub fn split_frontmatter(source: &str) -> Result<(Metadata, String)> {
    let source = source.trim_start_matches('\u{feff}').replace("\r\n", "\n");
    if source.lines().next() != Some("+++") {
        return Ok((Metadata::default(), source));
    }
    let rest = source
        .strip_prefix("+++\n")
        .context("Unclosed front matter: expected a closing +++ line")?;
    let mut offset = 0;
    for line in rest.split_inclusive('\n') {
        if line.trim_end_matches('\n') == "+++" {
            return Ok((
                toml::from_str(&rest[..offset]).context("Invalid TOML front matter")?,
                rest[offset + line.len()..].to_owned(),
            ));
        }
        offset += line.len();
    }
    bail!("Unclosed front matter: expected a closing +++ line")
}

pub fn title_from_slug(slug: &str) -> String {
    let words: Vec<_> = slug.split('-').filter(|s| !s.is_empty()).collect();
    words
        .iter()
        .enumerate()
        .map(|(index, word)| match *word {
            "ai" | "api" | "apis" | "cli" | "cpu" | "css" | "gpu" | "html" | "http" | "https"
            | "id" | "io" | "js" | "json" | "llm" | "llms" | "ml" | "sql" | "ui" | "url" | "ux" => {
                word.to_uppercase()
            }
            "wasm" => "Wasm".into(),
            "typescript" => "TypeScript".into(),
            "javascript" => "JavaScript".into(),
            "github" => "GitHub".into(),
            "webgl" => "WebGL".into(),
            "a" | "an" | "and" | "at" | "by" | "for" | "in" | "of" | "on" | "or" | "the" | "to"
            | "with"
                if index > 0 && index + 1 < words.len() =>
            {
                word.to_string()
            }
            _ => {
                let mut chars = word.chars();
                chars.next().unwrap().to_uppercase().collect::<String>() + chars.as_str()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn discover(root: &Path, include_drafts: bool) -> Result<Vec<Article>> {
    let mut articles = Vec::new();
    let mut slugs = HashMap::new();
    for entry in WalkDir::new(root)
        .sort_by_file_name()
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !e.file_name().to_string_lossy().starts_with('.'))
    {
        let entry = entry?;
        ensure!(
            !entry.file_type().is_symlink(),
            "Symlinks are not supported in articles: {}",
            entry.path().display()
        );
        if !entry.file_type().is_file()
            || entry.path().extension().and_then(|e| e.to_str()) != Some("md")
        {
            continue;
        }
        let source = entry.path().canonicalize()?;
        let (mut metadata, markdown) = split_frontmatter(&fs::read_to_string(&source)?)
            .with_context(|| format!("In {}", source.display()))?;
        if metadata.draft && !include_drafts {
            continue;
        }
        for (label, value) in [
            ("slug", &metadata.slug),
            ("title", &metadata.title),
            ("html_title", &metadata.html_title),
        ] {
            if let Some(value) = value {
                ensure!(
                    !value.trim().is_empty(),
                    "Blank {label} in {}",
                    source.display()
                );
            }
        }
        let parent = source.parent().unwrap();
        let inferred = if parent != root {
            parent.file_name()
        } else {
            source.file_stem()
        }
        .and_then(|s| s.to_str())
        .context("Article path must be UTF-8")?;
        let slug = slug::slugify(metadata.slug.as_deref().unwrap_or(inferred));
        ensure!(
            !slug.is_empty(),
            "Cannot derive a slug for {}",
            source.display()
        );
        if let Some(previous) = slugs.insert(slug.clone(), source.clone()) {
            bail!(
                "Duplicate slug '{slug}': {} and {}. Set an explicit slug in front matter.",
                previous.display(),
                source.display()
            );
        }
        if let (Some(created), Some(updated)) = (&metadata.created_at, &metadata.updated_at) {
            ensure!(
                updated.timestamp >= created.timestamp,
                "updated_at precedes created_at in {}",
                source.display()
            );
        }
        let mut tags = HashSet::new();
        metadata
            .tags
            .retain(|tag| !tag.trim().is_empty() && tags.insert(tag.to_lowercase()));
        let title = metadata
            .title
            .clone()
            .unwrap_or_else(|| title_from_slug(&slug));
        articles.push(Article {
            source,
            slug,
            title,
            metadata,
            markdown,
        });
    }
    articles.sort_by(|a, b| {
        b.sort_date()
            .cmp(&a.sort_date())
            .then_with(|| a.slug.cmp(&b.slug))
    });
    Ok(articles)
}
