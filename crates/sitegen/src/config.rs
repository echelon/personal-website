use std::{
    fs,
    path::{Component, Path, PathBuf},
};

use anyhow::{Context, Result, ensure};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub site: Site,
    pub build: Build,
    #[serde(skip)]
    pub root: PathBuf,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Site {
    pub name: String,
    pub email: String,
    pub base_url: String,
    pub title_append: String,
    pub home_title: String,
    pub articles_title: String,
    pub description: String,
    pub default_theme: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Build {
    pub articles_dir: PathBuf,
    pub frontend_dir: PathBuf,
    pub output_dir: PathBuf,
    #[serde(default)]
    pub include_drafts: bool,
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let path = path.canonicalize().context("Cannot open config file")?;
        let mut config: Self = toml::from_str(&fs::read_to_string(&path)?)
            .with_context(|| format!("Invalid config: {}", path.display()))?;
        config.root = path.parent().context("Config has no parent")?.to_owned();
        let url = url::Url::parse(&config.site.base_url).context("Invalid site.base_url")?;
        ensure!(
            matches!(url.scheme(), "http" | "https")
                && url.host_str().is_some()
                && url.path() == "/"
                && url.query().is_none()
                && url.fragment().is_none()
                && url.username().is_empty()
                && url.password().is_none(),
            "site.base_url must be an HTTP(S) origin without a path, query, or credentials"
        );
        config.site.base_url = config.site.base_url.trim_end_matches('/').to_owned();
        ensure!(
            ["day", "sunset", "forest", "rain", "night"]
                .contains(&config.site.default_theme.as_str()),
            "default_theme must be day, sunset, forest, rain, or night"
        );
        for (label, value) in [
            ("name", &config.site.name),
            ("title_append", &config.site.title_append),
            ("home_title", &config.site.home_title),
            ("articles_title", &config.site.articles_title),
        ] {
            ensure!(!value.trim().is_empty(), "site.{label} cannot be blank");
        }
        ensure!(
            config.site.email.contains('@')
                && !config.site.email.chars().any(char::is_whitespace)
                && !config.site.email.contains(['?', '#', '\"', '<', '>']),
            "Invalid site.email"
        );
        config.build.articles_dir = config
            .root
            .join(&config.build.articles_dir)
            .canonicalize()
            .context("articles_dir must exist")?;
        config.build.frontend_dir = config
            .root
            .join(&config.build.frontend_dir)
            .canonicalize()
            .context("frontend_dir must exist")?;
        ensure!(
            config.build.articles_dir.is_dir() && config.build.frontend_dir.is_dir(),
            "Source paths must be directories"
        );
        // Require a dedicated output directory in this project. Never delete a source tree.
        let output = &config.build.output_dir;
        ensure!(
            !output.is_absolute()
                && output
                    .components()
                    .all(|c| matches!(c, Component::Normal(_)))
                && output.components().next().is_some(),
            "output_dir must be a relative directory without . or .."
        );
        let mut resolved = config.root.clone();
        for component in output.components() {
            resolved.push(component);
            ensure!(
                !resolved.is_symlink(),
                "output_dir may not contain symlinks"
            );
        }
        for protected in [
            &config.build.articles_dir,
            &config.build.frontend_dir,
            &config.root.join("crates"),
            &config.root.join(".git"),
            &config.root.join(".codex"),
            &config.root.join(".agents"),
        ] {
            ensure!(
                !protected.starts_with(&resolved) && !resolved.starts_with(protected),
                "output_dir overlaps protected source directory {}",
                protected.display()
            );
        }
        config.build.output_dir = resolved;
        Ok(config)
    }
}
