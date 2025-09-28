# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the TypeScript sources: lifecycle hooks live in `hooks.ts`, UI integrations under `modules/`, and shared helpers under `utils/`.
- `addon/` hosts packaged assets (manifest, locale strings, XUL/XHTML views); changes here reflect what ships inside the XPI.
- `test/` holds mocha specs mirroring `src/` concerns (e.g., `eagleApi.test.ts` exercises `src/utils/eagleApi.ts`).
- `doc/` captures contributor-facing documentation; update both English and Chinese variants when process changes.

## Build, Test, and Development Commands
- `npm start` launches `zotero-plugin serve` for live development against a local Zotero profile.
- `npm run build` runs the scaffold build then `tsc --noEmit` for type enforcement; required before tagging a release.
- `npm test` executes the mocha suite via `zotero-plugin test`.
- `npm run lint:check` / `npm run lint:fix` validate or auto-fix formatting and lint issues.
- `npm run release` bundles and version-bumps the add-on; use only from a clean mainline branch.

## Coding Style & Naming Conventions
- TypeScript with ES modules; prefer explicit typings on public functions and async/await for async flows.
- Prettier (print width 80, two-space indentation) and ESLint enforce style—run `npm run lint:fix` before commits.
- Filenames mirror exported symbols (`pdfButton.ts` → `registerPdfButton`). Keep selectors and localization keys snake-case to match Zotero conventions.

## Testing Guidelines
- Place unit specs beside logical domains in `test/`, naming files `<feature>.test.ts`.
- Use mocha + chai (`describe/it`, `expect`) and stub Zotero APIs via toolkit helpers.
- Keep happy-path and error-path coverage; add regression tests when touching bug fixes.
- Run `npm test` locally; CI expects zero failing cases.

## Commit & Pull Request Guidelines
- Follow Conventional Commit prefixes (`feat:`, `fix:`, `docs:`) as seen in history (`docs: rewrite Chinese README`).
- Squash work-in-progress commits before opening a PR; ensure history stays readable.
- PRs should include: brief summary, linked issues, screenshots/GIFs for UI changes, and notes on macOS-only validation.
- Re-run lint, build, and tests before requesting review; attach output snippets if failures occur.

## Configuration & Environment Tips
- Duplicate `.env.example` into `.env` to point `zotero-plugin` at your Zotero installation.
- macOS 13.7.8 is the only verified platform; call out results when testing on other operating systems.
