# Repository Guidelines

## Project Structure & Module Organization

- src: TypeScript source. Entry `src/index.ts` boots the addon; `src/addon.ts` holds runtime state; `src/hooks.ts` registers lifecycle/UI hooks. Helpers live under `src/utils/*` (e.g., `taskPool.ts`, `fileLogger.ts`, `eagleApi.ts`). Feature modules live in `src/modules/*`.
- addon: Static assets packaged into the XPI (manifest, locales, CSS, preferences UI, default prefs in `prefs.js`).
- test: Mocha/Chai tests run via the scaffold harness (see scripts).
- doc, typings, .scaffold: Docs, ambient types, and build output respectively.

## Build, Test, and Development Commands

- `npm start`: Launches Zotero with the plugin in serve mode (uses `.env`).
- `npm run build`: Bundle addon and type‑check (`esbuild` via scaffold + `tsc --noEmit`).
- `npm test`: Run scaffolded tests inside a Zotero runtime.
- `npm run lint:check` / `npm run lint:fix`: Check/format with Prettier and ESLint.
- `npm run release`: Produce release artifacts (see `zotero-plugin.config.ts`).

## Coding Style & Naming Conventions

- Language: TypeScript (ES modules). Indent 2 spaces; LF endings; Prettier enforces formatting.
- Linting: `@zotero-plugin/eslint-config`; unused‑vars is relaxed for template examples.
- Names: files camelCase (`fileLogger.ts`), classes PascalCase (`Addon`, `TaskPool`), constants UPPER_SNAKE.
- Paths: keep utilities in `src/utils`, UI/features in `src/modules`, entry wiring in `src/index.ts` and `src/hooks.ts`.

## Testing Guidelines

- Frameworks: Mocha + Chai via `zotero-plugin test`.
- Location/patterns: place tests in `test/*.test.ts`; name with the unit under test (e.g., `taskPool.test.ts`).
- Scope: prioritize pure units (`utils/*`) and lifecycle smoke checks. Avoid real network/filesystem; stub Eagle requests and file I/O where practical.
- Run: `npm test`. Keep tests deterministic and independent.

## Commit & Pull Request Guidelines

- Commits: imperative, concise, scope optional (e.g., "Fix PNG copying", "Refactor output directory logic"). Group related changes.
- PRs: include description, rationale, and linked issues. Add screenshots/GIFs for UI changes (PDF reader button, Preferences). Note config/logging changes and update `LOGGING.md`, `.env.example`, and docs under `doc/` when applicable.

## Security & Configuration

- Do not commit secrets. Configure Zotero paths in `.env` (`ZOTERO_PLUGIN_ZOTERO_BIN_PATH`, `ZOTERO_PLUGIN_PROFILE_PATH`).
- Default Eagle API runs on `http://localhost:41595`; update via Preferences or `addon/prefs.js`. Avoid hitting external services in tests.
