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
        Command::Build { drafts } => sitegen::build(&cli.config, drafts),
        Command::Check { drafts } => sitegen::check(&cli.config, drafts),
    }
}
