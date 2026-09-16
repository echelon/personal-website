use std::path::PathBuf;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(version, about = "A small, static home for your writing")]
struct Cli {
    #[arg(long, default_value = "config.toml", global = true)]
    config: PathBuf,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Rebuild on local source changes, including draft articles (dev feature only).
    #[cfg(feature = "dev")]
    Watch {
        /// Emit JSON status lines for the local development server.
        #[arg(long)]
        events: bool,
    },
    /// Render articles, bundle the frontend, and safely replace the output.
    Build {
        /// Include articles marked draft = true.
        #[arg(long)]
        drafts: bool,
    },
    /// Validate config, metadata, Markdown, and local references without writing.
    Check {
        #[arg(long)]
        drafts: bool,
    },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    match cli.command {
        #[cfg(feature = "dev")]
        Command::Watch { events } => sitegen::watch::run(&cli.config, events),
        Command::Build { drafts } => sitegen::build(&cli.config, drafts),
        Command::Check { drafts } => sitegen::check(&cli.config, drafts),
    }
}
