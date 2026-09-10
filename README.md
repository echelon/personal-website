# brand.io

A small Rust static-site generator for a personal homepage and occasional articles. All pages are rendered to HTML at build time. There is no application server, React runtime, or hydration requirement. TypeScript adds a four-theme selector and loads interactive figures only when they approach the viewport.

## Quick start

Install Rust through rustup and Node.js 22 or newer (24 is used in CI and Netlify). The Rust toolchain is pinned in `rust-toolchain.toml`.

```sh
npm ci --prefix frontend
cargo run -- build
npm run preview --prefix frontend
```

Open **http://127.0.0.1:4173**. For rebuilds when articles, Rust, styles, or scripts change:

```sh
npm run dev --prefix frontend
```

Refresh the page after a successful rebuild. The preview stays on the last successful build if an edit fails. `PORT=4000` changes the preview port. The dev helper uses this repository's default paths; for a custom output folder, build with your config and pass the output to `node frontend/tools/serve.mjs path/to/output`.

The production build can also run through Nx:

```sh
npm run build --prefix frontend
```

## Repository layout

```text
Cargo.toml                   Rust workspace
crates/sitegen/              CLI, discovery, metadata, Markdown, rendering, build
frontend/                    Nx workspace
  libs/site/                 Shared CSS, theme control, lazy embed loader
  libs/embeds/               Typed embed contract and small reusable controls
  tools/                     esbuild compiler, dev server, tests
articles/                    Markdown plus colocated source and public media
config.toml                  Site identity and build settings
build/                       Generated static site (ignored by Git)
netlify.toml                 Build command, publish directory, response headers
```

## Writing an article

Use one directory per article when it has assets. Years and other parent directories are organizational and do not enter the URL.

```text
articles/2026/llm_survey/
  article.md
  typescript_mini_embed_animation.ts
  media/
    foo.jpg
    video.mp4
```

Front matter is an optional TOML block delimited by `+++`. Every metadata field is optional:

```markdown
+++
slug = "llm-survey"
title = "LLM Survey"
html_title = "A Practical Survey of LLMs"
description = "A short introduction for the article list and page metadata."
tags = ["AI", "Engineering"]
created_at = 2026-09-10
updated_at = "2026-09-11T09:30:00-04:00"
draft = false
+++

Start with the introduction. The renderer supplies the page's h1.

## A section

Ordinary Markdown, with **emphasis**, [links](https://example.com), and quotes.
```

Dates accept native TOML dates, quoted `YYYY-MM-DD`, or RFC 3339 timestamps **with a timezone**. Omitted dates produce no date label. The list sorts newest first by `created_at`, falling back to `updated_at` only when creation is absent. Undated posts follow dated posts; equal dates sort by slug for deterministic output. An update does not move an old article to the top.

Unknown front-matter fields, invalid dates, blank explicit titles, dates in reverse order, duplicate slugs, and missing local references fail with source context. UTF-8, a BOM, and Windows line endings are supported.

### Slugs and titles

Slug precedence is:

1. The front-matter `slug`.
2. The immediate containing directory for a nested Markdown file.
3. The filename without `.md` for a file directly in `articles/`.

Slugs are normalized to lowercase, transliterated, and hyphenated. `articles/2026/llm_survey/article.md` becomes `/article/llm-survey`. `articles/notes_on_attention.md` becomes `/article/notes-on-attention`. Multiple Markdown files in one nested directory need explicit, distinct slugs.

Without `title`, Rust derives one from the slug with a small acronym and capitalization dictionary: `llm-survey` → **LLM Survey**, `typescript-and-rust` → **TypeScript and Rust**. Use `title` for exact h1 wording and `html_title` for a separate browser/search title.

Every HTML title is `{html_title or page title} - {site.title_append}`. Home and article-list titles are also configurable.

### Markdown and local media

The renderer uses [pulldown-cmark](https://docs.rs/pulldown-cmark/latest/pulldown_cmark/) with tables, footnotes, task lists, strikethrough, fenced code, and smart punctuation. Code is escaped and rendered in readable, horizontally scrollable blocks. It is not syntax highlighted. Section headings receive unique IDs and a desktop table of contents.

```markdown
![A useful description](media/foo.jpg)

[Another article](../different_article/article.md#section-title)

> A block quote.
```

Relative Markdown links to discovered articles are rewritten to their final URLs. Relative media URLs are rewritten to root-relative paths, so they work with or without a trailing slash. Raw HTML `href`, `src`, and `poster` use the same rewriting. Use explicit root-relative or external URLs for `srcset` candidates. Root-relative and external URLs are kept as written; the generator does not check remote availability.

Use raw HTML for video, captions, and richer figures:

```html
<figure>
  <video controls playsinline preload="metadata" poster="media/poster.jpg"
         width="960" height="540" aria-label="Description of this video">
    <source src="media/video.mp4" type="video/mp4">
    <track kind="captions" src="media/captions.vtt" srclang="en" label="English">
    <a href="media/video.mp4">Download the video.</a>
  </video>
  <figcaption>A caption with useful context.</figcaption>
</figure>
```

Media must be inside the article's directory. Public image, video, audio, font, PDF, HTML, CSS, JS, JSON, text, 3D, and Wasm assets are copied with their relative directory structure. The exact extension allowlist lives in `markdown::asset_allowed`. Markdown, TypeScript, dotfiles, and unrelated files are not copied. Nested articles own their own assets, including drafts. Symlinks are rejected. `index.html` at the article root and the `_embeds/` directory are reserved for generated output.

Article HTML and JavaScript are **trusted author code**; this is not a renderer for untrusted submissions. Keep only intended public assets in article directories.

## Interactive TypeScript and JavaScript

Add an `embed` fence. Its contents are TOML, just like front matter:

````markdown
```embed
src = "experiment.ts"
title = "A descriptive figure title"
height = 360
fallback = "A textual explanation of the figure when JavaScript is unavailable."
```
````

Export a mount function from that local entry point:

```ts
import type { EmbedMount } from '@brand/embeds';

const mount: EmbedMount = (root, { reducedMotion }) => {
  const button = document.createElement('button');
  button.textContent = 'Try the experiment';
  button.addEventListener('click', () => { button.textContent = 'It works.'; });
  root.append(button);

  // Honor reducedMotion.matches before starting an animation.
  // Return a callback to stop timers, observers, or rendering loops.
  return () => {};
};
export default mount;
```

The default export may be async. It receives an isolated root element and a live reduced-motion `MediaQueryList`. The example library provides a labeled slider. Entries are bundled by [esbuild](https://esbuild.github.io/api/), with ESM splitting and local npm imports. Imported CSS is emitted and linked only on the owning article. A missing default export or compilation error fails the build. Runtime errors restore the textual fallback and leave the article readable.

Embeds may use `.ts`, `.tsx`, `.js`, `.jsx`, or `.mjs`. Add any framework dependencies to `frontend/package.json` if you choose to use them; React is not required by the site. The alias `@brand/embeds` points to the shared Nx library. `npm run check --prefix frontend` type-checks the repository's TypeScript articles; esbuild itself transpiles without type-checking.

### Standalone apps and future Rust/Wasm

Build a standalone app into an article subdirectory, retaining the app's relative asset URLs:

```text
articles/2026/my_game/
  article.md
  game/
    index.html
    app.js
    app_bg.wasm
    assets/...
```

````markdown
```embed
kind = "iframe"
src = "game/index.html"
title = "An interactive game"
height = 600
```
````

The generator copies the app and embeds its HTML. It does **not** invoke wasm-pack, Trunk, or compile Bevy automatically. Build those outputs first and use relative app asset paths. Single-threaded Wasm works with ordinary static hosting. If a later app needs threads/SharedArrayBuffer, configure its required cross-origin isolation headers then. Same-origin iframe apps are trusted and can access their parent page.

## Configuration and commands

`config.toml` controls identity, email, the origin used for canonical URLs, title suffix, description, initial theme, input paths, output path, and draft inclusion. Paths are resolved relative to the config file. The site targets a domain root rather than a URL subpath.

```sh
cargo run -- check                       # Validate without emitting files
cargo run -- build                       # Build published articles
cargo run -- build --drafts              # Include drafts for local review
cargo run -- --config other.toml build   # Alternate configuration
```

The default theme is `day`; choices are `day`, `night`, `forest`, and `sunset`. The single native select near the top shows the current label and a four-dot state indicator. Preferences persist locally and synchronize across tabs when browser storage is available. Without JavaScript, all writing and navigation still work in the configured theme.

The output directory must be a dedicated relative directory inside the config's project. The builder refuses source-directory overlaps, symlinks, and nonempty output it does not own. It renders into a temporary staging directory, then replaces output after compilation succeeds. Failed builds preserve the prior output; successful rebuilds remove stale generated files.

## Netlify

Connect this repository to Netlify with the repository root as the base directory. The checked-in `netlify.toml` sets:

- Build: `npm ci --prefix frontend && cargo run --locked --release -- build`
- Publish directory: `build`
- Node 24; the Rust toolchain comes from `rust-toolchain.toml`

This follows Netlify's [Rust dependency setup](https://docs.netlify.com/build/configure-builds/manage-dependencies/#rust). The generated directory is the complete deployment artifact. Real HTML files back `/`, `/articles`, and `/article/{slug}`, with a `404.html`, sitemap, and robots file. There is no SPA fallback. Set up `brand.io` and HTTPS in Netlify when deploying; this repository does not change DNS or publish automatically from the local workspace.

If you change `build.output_dir`, update Netlify's publish directory too. The `articles/` directory starts empty; add your first Markdown article when you are ready to publish.

## Verification

After installing frontend dependencies:

```sh
cargo fmt --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
npm run check --prefix frontend
npm run build --prefix frontend
```

Rust tests cover metadata, title inference, date ordering, URLs, media, Markdown features, drafts, output safety, and real esbuild compilation with failure recovery. Node tests cover theme behavior, all four palettes' text contrast, clean preview routes, HTTP video ranges, and Wasm MIME types. CI runs these checks and the production build.

Tests generate temporary content outside the article directory and remove it afterward. No demo articles or media are included in the repository or production output.
