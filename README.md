# brand.io

A small Rust static-site generator for a personal homepage and occasional articles. All pages are rendered to HTML at build time. There is no application server, React runtime, or hydration requirement. TypeScript adds a five-theme selector and loads interactive figures only when they approach the viewport.

## Quick start

Install Rust through rustup and Node.js 22.18+ or 24+ (24 is used in CI and Netlify). Node runs the TypeScript tools and tests directly using native type stripping; no separate script runner is needed. The Rust toolchain is pinned in `rust-toolchain.toml`.

```sh
npm ci --prefix frontend
./dev.sh
```

Open the **Dev:** URL printed in the terminal. `./dev.sh` starts at **http://127.0.0.1:4173** and tries subsequent ports if one is already in use. It starts both the Rust watcher/builds and the frontend server with automatic browser refresh. Press **Ctrl-C** to stop both. The existing `npm run dev --prefix frontend` command starts the same dev launcher.

Saving Markdown, article media, frontend code, or generator sources rebuilds the site and automatically reloads connected browsers after a successful build. Drafts are included in local development. Invalid edits leave the last successful preview on screen; saving a fix resumes updates. Saves are debounced and builds run one at a time, with edits during a build queued for another build.

`PORT=4000 ./dev.sh` changes the starting port; busy ports are skipped automatically. `PORT=0 ./dev.sh` lets the operating system choose an available port. A custom configuration works with `./dev.sh --config /path/to/config.toml`; changes to its source and output paths are picked up on save. You can invoke the script by its full path from another directory; relative config paths are resolved from the repository root. The Rust watcher is enabled only by the optional `dev` Cargo feature. The dev server injects its reload script into HTTP responses, so production HTML and browser bundles contain no reload client, watcher, or event connection. `npm run preview --prefix frontend` remains a plain static preview without watching or injection.

The production build can also run through Nx. Both commands run the TypeScript checker before bundling browser assets:

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
  tools/                     esbuild compiler, dev server, shared tests and test runner
articles/                    Markdown plus colocated applets, styles, tests and public media
config.toml                  Site identity and build settings
build/                       Generated static site (ignored by Git)
netlify.toml                 Build command, publish directory, response headers
```

The generator and file watcher are written in Rust. Browser code, frontend build/preview tools, the dev launcher, and Node tests are authored in TypeScript. Browser code uses `frontend/tsconfig.json`; Node tooling and tests use `frontend/tsconfig.tools.json`. Only generated browser bundles and prebuilt third-party/Wasm app artifacts use JavaScript.

## Writing an article

Use one directory per article when it has assets. Years and other parent directories are organizational and do not enter the URL.

```text
articles/2026/llm_survey/
  article.md
  typescript_mini_embed_animation.ts
  styles.css
  .tests/
    animation.test.mts
    fixtures/
      sample.json
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
published_at = 2026-09-11
updated_at = "2026-09-11T09:30:00-04:00"
draft = false
nofollow_external_links = false
+++

Start with the introduction. The renderer supplies the page's h1.

## A section

Ordinary Markdown, with **emphasis**, [links](https://example.com), and quotes.
```

All three dates are optional. Use native TOML dates or quoted `YYYY-MM-DD`. Times are optional: `"2026-09-11 09:30"` or `"2026-09-11 09:30:15"`, with an optional timezone (`Z` or `-04:00`); a `T` separator and RFC 3339 timestamps are also supported. Quote timestamps when using minutes without seconds. Timezone-free values use UTC for sorting and comparisons, without shifting the displayed calendar date.

`published_at` and `updated_at` appear beneath the article title when present; only calendar dates are displayed. `created_at` stays private and is never emitted in pages or the sitemap. The list sorts newest first by `published_at`, falling back to `created_at`, then `updated_at`. Undated posts follow dated posts; equal dates sort by slug. An update does not move an article with a publication or creation date to the top.

Unknown front-matter fields, invalid dates, blank explicit titles, dates in reverse order, duplicate slugs, and missing local references fail with source context. UTF-8, a BOM, and Windows line endings are supported.

Set `nofollow_external_links = true` to add `rel="nofollow noreferrer"` to outbound HTTP(S) links. The default is `false`. This covers Markdown and raw HTML links in the generated page, plus links created or updated by app embeds. Existing `rel` values are preserved. Same-origin links (relative to `site.base_url`), local links, anchors, and `mailto:` links are left alone. `nofollow` marks links as unendorsed; `noreferrer` suppresses the referring page when following them. Static links receive these attributes at build time and work without JavaScript.

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

The `title` is optional for app embeds; omit it to render without a visible caption. Label the applet's controls in its code and provide useful fallback text. Iframe embeds still require a title to identify the embedded document.

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

Author embeds in `.ts` or `.tsx`. Add any framework dependencies to `frontend/package.json` if you choose to use them; React is not required by the site. The alias `@brand/embeds` points to the shared Nx library. Every build type-checks browser code, tools, tests, and TypeScript embed entries, including those from an alternate article directory, before esbuild emits JavaScript. `npm run check --prefix frontend` runs type checking and the Node test suite independently of a site build.

Keep article-specific styles in the article directory. Import applet CSS from its TypeScript entry point; for static article content, use `<link rel="stylesheet" href="styles.css">` in the Markdown. Shared `frontend/libs/site/src/site.css` is only for site-wide styles.

Put applet tests and their fixtures in the article's `.tests/` directory. Use `*.test.mts` for Node ESM tests outside the frontend package; helper modules can use `.mts` too. `npm test --prefix frontend` automatically discovers tests under `frontend/tools/` and `articles/`, including nested `.tests/` directories. No per-article registration is needed. Article tests are checked with Node types, separately from browser source, and the static publisher excludes the entire hidden directory, including JSON fixtures. For browser modules that need compilation or bundling, tests can import `loadBrowserModule` from `frontend/tools/test-support.ts` using a relative path. It uses the production esbuild configuration's target and aliases without providing a DOM.

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
cargo run --features dev -- watch        # Rust watcher + rebuilds, without an HTTP server
```

The picker cycles **Day → Sunset → Forest → Rain → Night** (Light → R → G → B → Dark). A single button cycles on click, Enter, or Space. Its colored [Lucide](https://lucide.dev/) icon shows a sun, flower (`flower-2`), tree, windblown rain cloud, or moon, with five small position markers underneath. Rain is a subdued light blue-gray palette. Theme names appear only in the hover tooltip and accessible label. Five SVGs are included locally with their upstream license; no icon font or external request is needed.

The build compiles `theme-init.ts` into a self-contained classic script at `/assets/theme-init.js`. HTML loads it synchronously before the stylesheet, so it chooses the visitor's theme before the first paint, in this order:

1. A valid `brand-theme` cookie saved by a previous picker click.
2. Night if the browser explicitly reports a dark preference.
3. The visitor's local clock: Day from 07:00 until 19:00, otherwise Night.
4. Day if none of those signals are available.

Browsers commonly report light even when the visitor has not explicitly chosen a scheme; the platform does not distinguish that case. A reported light preference therefore falls through to the local clock. The clock uses the device's local timezone without requesting location access. See [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme).

Each picker click saves a first-party cookie for one year with `Path=/`, `SameSite=Lax`, and `Secure` on HTTPS. Automatic browser/time choices do not set a cookie. Returning to a tab reads any saved cookie change. If cookies are blocked, the picker still works for that page. The old localStorage preference is no longer used. Without JavaScript, writing and navigation work in `site.default_theme`, which defaults to Day.

The output directory must be a dedicated relative directory inside the config's project. The builder refuses source-directory overlaps, symlinks, and nonempty output it does not own. It renders into a temporary staging directory, then replaces output after compilation succeeds. Failed builds preserve the prior output; successful rebuilds remove stale generated files.

## Netlify

Connect this repository to the existing [brandon-website Netlify project](https://app.netlify.com/projects/brandon-website/overview). The base directory is the repository root (`.`), not `frontend/`. The checked-in `netlify.toml` sets:

- Build: `npm ci --prefix frontend --include=dev && cargo run --locked --release -p sitegen -- build`
- Publish directory: `build`
- Node 24; the Rust toolchain comes from `rust-toolchain.toml`
- Pretty URLs, response security headers, and browser cache revalidation for stable asset URLs
- Drafts excluded from production, branch deploys, and deploy previews

This follows Netlify's [Rust dependency setup](https://docs.netlify.com/build/configure-builds/manage-dependencies/#rust). The generated directory is the complete deployment artifact. Real HTML files back `/`, `/articles`, and `/article/{slug}`, with a `404.html`, sitemap, and robots file. There is no SPA fallback. Set up `brand.io` and HTTPS in Netlify when deploying; this repository does not change DNS or publish automatically from the local workspace.

If you change `build.output_dir`, update Netlify's publish directory too. Spymarks currently has `draft = true`; change it to `false` when the article is ready to publish.

Choose the linked repository and production branch in Netlify. Add `brand.io` in Domain management and follow Netlify’s DNS instructions at the current DNS provider (DreamHost). Domain ownership, DNS records, TLS certificates, and the project association cannot be established by this TOML file. File-based build settings override their corresponding dashboard settings. No credentials or site ID are required in `netlify.toml`.

## Verification

After installing frontend dependencies:

```sh
cargo fmt --check
cargo clippy --workspace --all-targets --all-features --locked -- -D warnings
cargo test --workspace --all-features --locked
npm run check --prefix frontend
npm run build --prefix frontend
```

Rust tests cover metadata, title inference, date ordering, URLs, media, Markdown features, drafts, output safety, theme script loading order, and real compilation with syntax/type error recovery. TypeScript tests cover the compiler manifest, executable production bundles, the absence of bare JavaScript source, theme ordering, cookie/browser/time precedence, all five palettes' contrast, clean preview routes, HTTP video ranges, and Wasm MIME types. Run just these tests with `npm test --prefix frontend`. CI runs all checks and the production build.

Dev tests cover atomic saves, newly created/deleted articles, failed-build recovery, config changes, reload events, browser reconnects, and keeping generated files free of dev scripts. Tests generate temporary content outside the article directory and remove it afterward. Watcher implementation or dev-server changes require restarting `npm run dev`; generator and site-asset changes are rebuilt automatically.
