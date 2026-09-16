//! Local-only watching and rebuilds. Not compiled into normal sitegen builds.

use std::{
    collections::BTreeMap,
    io::{self, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::mpsc::{self, Receiver, RecvTimeoutError},
    time::{Duration, Instant},
};

use anyhow::{Context, Result};
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde_json::json;

use crate::config::Config;

const DEBOUNCE: Duration = Duration::from_millis(180);

struct Inputs {
    trees: Vec<PathBuf>,
    files: Vec<PathBuf>,
}

impl Inputs {
    fn new(config: &Config, config_path: &Path, repository: &Path) -> Self {
        let frontend = &config.build.frontend_dir;
        Self {
            trees: vec![
                config.build.articles_dir.clone(),
                frontend.join("libs"),
                frontend.join("tools"),
                repository.join("crates"),
            ],
            files: vec![
                config_path.to_owned(),
                repository.join("Cargo.toml"),
                repository.join("Cargo.lock"),
                repository.join("rust-toolchain.toml"),
                frontend.join("package.json"),
                frontend.join("package-lock.json"),
                frontend.join("tsconfig.json"),
                frontend.join("tsconfig.tools.json"),
                frontend.join("nx.json"),
            ],
        }
    }

    fn relevant(&self, event: &Event) -> bool {
        if event.kind.is_access() {
            return false;
        }
        event.need_rescan()
            || event.paths.iter().any(|path| {
                self.files.contains(path)
                    || self.trees.iter().any(|tree| {
                        path == tree
                            || tree.starts_with(path)
                            || path.strip_prefix(tree).is_ok_and(|relative| {
                                !relative.components().any(|part| {
                                    let name = part.as_os_str().to_string_lossy();
                                    name.starts_with('.')
                                        || name.starts_with('#')
                                        || name.ends_with('~')
                                        || name.ends_with(".swp")
                                        || name.ends_with(".swx")
                                })
                            })
                    })
            })
    }

    fn install(&self, watcher: &mut RecommendedWatcher, previous: &mut Vec<PathBuf>) -> Result<()> {
        // Watch directories, not individual files: editors often save by renaming
        // a temporary file over the original. Parents also catch directory replacement.
        let mut targets = BTreeMap::new();
        for tree in &self.trees {
            if tree.is_dir() {
                targets.insert(tree.clone(), RecursiveMode::Recursive);
            }
        }
        for path in self.files.iter().chain(&self.trees) {
            if let Some(parent) = path.ancestors().skip(1).find(|p| p.is_dir()) {
                targets
                    .entry(parent.to_owned())
                    .or_insert(RecursiveMode::NonRecursive);
            }
        }
        // Re-arm after replacement of a watched directory, even if its path is unchanged.
        for path in previous.drain(..) {
            let _ = watcher.unwatch(&path);
        }
        for (path, mode) in targets {
            watcher
                .watch(&path, mode)
                .with_context(|| format!("Cannot watch {}", path.display()))?;
            previous.push(path);
        }
        Ok(())
    }
}

fn wait_for_changes(receiver: &Receiver<notify::Result<Event>>, inputs: &Inputs) -> Result<()> {
    let mut deadline: Option<Instant> = None;
    loop {
        let result = if let Some(deadline) = deadline {
            if Instant::now() >= deadline {
                return Ok(());
            }
            receiver.recv_timeout(deadline.saturating_duration_since(Instant::now()))
        } else {
            receiver.recv().map_err(|_| RecvTimeoutError::Disconnected)
        };
        match result {
            Ok(Ok(event)) if inputs.relevant(&event) => {
                deadline = Some(Instant::now() + DEBOUNCE);
            }
            Ok(Ok(_)) => {}
            Ok(Err(error)) => {
                eprintln!("Watch notification error: {error}; rebuilding to resynchronize.");
                deadline = Some(Instant::now() + DEBOUNCE);
            }
            Err(RecvTimeoutError::Timeout) => return Ok(()),
            Err(RecvTimeoutError::Disconnected) => anyhow::bail!("File watcher disconnected"),
        }
    }
}

fn report(events: bool, event: &str, output: &Path) -> Result<()> {
    if events {
        println!("{}", json!({ "event": event, "output": output }));
        io::stdout().flush()?;
    }
    Ok(())
}

pub fn run(config_path: &Path, events: bool) -> Result<()> {
    let config_path = config_path
        .canonicalize()
        .context("Cannot open config file")?;
    let repository = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .context("Cannot locate sitegen repository")?;
    let mut config = Config::load(&config_path)?;
    let mut inputs = Inputs::new(&config, &config_path, repository);
    let (sender, receiver) = mpsc::channel();
    let mut watcher = notify::recommended_watcher(sender)?;
    let mut watched = Vec::new();
    inputs.install(&mut watcher, &mut watched)?;
    report(events, "ready", &config.build.output_dir)?;
    eprintln!("Watching article, frontend, config, and Rust sources (drafts included).");

    loop {
        match Config::load(&config_path) {
            Ok(current) => {
                config = current;
                inputs = Inputs::new(&config, &config_path, repository);
                inputs.install(&mut watcher, &mut watched)?;
                report(events, "building", &config.build.output_dir)?;
                // Cargo picks up changes to the generator too. Using a child process
                // keeps builds serial while notifications during a build remain queued.
                let result = Command::new("cargo")
                    .args([
                        "run",
                        "--locked",
                        "--quiet",
                        "--features",
                        "dev",
                        "--",
                        "build",
                        "--drafts",
                        "--config",
                    ])
                    .arg(&config_path)
                    .current_dir(repository)
                    .stdout(Stdio::from(io::stderr()))
                    .stderr(Stdio::inherit())
                    .status();
                match result {
                    Ok(status) if status.success() => {
                        report(events, "built", &config.build.output_dir)?
                    }
                    result => {
                        eprintln!(
                            "Build failed ({result:?}). The last successful preview is preserved."
                        );
                        report(events, "failed", &config.build.output_dir)?;
                    }
                }
            }
            Err(error) => {
                eprintln!(
                    "{error:#}\nThe last successful preview is preserved. Waiting for a fix."
                );
                report(events, "failed", &config.build.output_dir)?;
            }
        }
        wait_for_changes(&receiver, &inputs)?;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{AccessKind, CreateKind, ModifyKind, RenameMode};

    fn inputs() -> Inputs {
        Inputs {
            trees: vec![PathBuf::from("/project/articles")],
            files: vec![PathBuf::from("/project/config.toml")],
        }
    }

    #[test]
    fn saves_creates_deletes_and_atomic_renames_trigger_but_outputs_and_reads_do_not() {
        let inputs = inputs();
        for kind in [
            notify::EventKind::Create(CreateKind::File),
            notify::EventKind::Modify(ModifyKind::Any),
            notify::EventKind::Remove(notify::event::RemoveKind::File),
        ] {
            assert!(
                inputs.relevant(
                    &Event::new(kind).add_path("/project/articles/new/article.md".into())
                )
            );
        }
        let rename = Event::new(notify::EventKind::Modify(ModifyKind::Name(
            RenameMode::Both,
        )))
        .add_path("/project/.config.tmp".into())
        .add_path("/project/config.toml".into());
        assert!(inputs.relevant(&rename));
        for path in [
            "/project/build/article/demo/index.html",
            "/project/target/debug/sitegen",
            "/project/articles/.article.md.swp",
            "/project/articles/article.md~",
        ] {
            assert!(!inputs.relevant(&Event::new(notify::EventKind::Any).add_path(path.into())));
        }
        assert!(
            !inputs.relevant(
                &Event::new(notify::EventKind::Access(AccessKind::Read))
                    .add_path("/project/articles/article.md".into())
            )
        );
    }

    #[test]
    fn edits_queued_during_a_build_are_not_lost() {
        let (sender, receiver) = mpsc::channel();
        sender
            .send(Ok(
                Event::new(notify::EventKind::Any).add_path("/project/articles/article.md".into())
            ))
            .unwrap();
        sender
            .send(Ok(
                Event::new(notify::EventKind::Any).add_path("/project/articles/other.md".into())
            ))
            .unwrap();
        wait_for_changes(&receiver, &inputs()).unwrap();
        assert!(receiver.try_recv().is_err());
    }
}
