# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the core TypeScript codebase; Orbit-specific features live under `src/vs/workbench/contrib/orbit/`.
- `extensions/` holds built-in extensions (one folder per extension).
- `build/` and `scripts/` contain build tooling and helper scripts.
- `resources/` stores static assets used by the app.
- `out/` and `.build/` are generated build outputs — never edit files there.
- `test/` contains test runners and suites (`unit`, `integration`, `smoke`).

## Build, Test, and Development Commands
- `npm install`: installs dependencies and runs repo/extension postinstall steps.
- `npm run compile-client`: compiles the main client TypeScript bundle (fastest full-path check).
- `npm run compile`: full compile for core + extensions (slow).
- `npm run buildreact`: builds the React UI in `src/vs/workbench/contrib/orbit/browser/react/`. Must run before `compile` if React source changed.
- `npm run watch`: continuous compilation for local development (uses `deemon` daemon).
- Developer Mode: `./scripts/code.bat` (Windows) or `./scripts/code.sh` (macOS/Linux).
- Lint: `npm run eslint` (JS/TS) and `npm run stylelint` (styles).
- Pre-commit hygiene: `npm run precommit` runs `build/hygiene.js`.

## React UI (Separate Build Pipeline)
- Lives at `src/vs/workbench/contrib/orbit/browser/react/`.
- Source in `src/` → scoped output in `src2/` (via `scope-tailwind`) → bundled in `out/` (via `tsup`).
- **All external imports must end with `.js` extension** (e.g., `../../../../../file.js`). Missing `.js` causes untraceable build errors.
- `src/` must stay shallow (1 folder deep) for tsup externals detection.
- Tailwind uses `void-` prefix and VS Code CSS custom properties. Dark mode via `selector` strategy.

## Coding Style & Naming Conventions
- Indentation: tabs by default; spaces for `package.json`, `*.yml`, and `*.yaml` (see `.editorconfig`).
- Keep names and module layout consistent with existing `src/vs/...` patterns.

## Testing Guidelines
- Test suites live in `test/` (see `test/README.md` and subfolder READMEs).
- Key runners: `npm run test-node` (Mocha), `npm run test-browser` (Playwright), `npm run test-extension` (vscode-test).
- Match existing test naming and structure in the target suite.

## Commit & Pull Request Guidelines
- No strict commit format; keep messages short and imperative.
- Do not use AI to write PR descriptions.
- Protected branches: `main`, `distro`, `release/*`.

## Environment & Prerequisites
- Node version is pinned in `.nvmrc` (`20.18.2`); use `nvm use` if available.
- Windows builds require VS 2022 build tools (see `HOW_TO_CONTRIBUTE.md`).

## Architecture Gotchas
- `cli/` contains a Rust CLI (`Cargo.toml`) — separate from the TypeScript build.
- `build/` contains Gulp tasks and CI configs, not application code.
- `product.json` at repo root defines product identity (name, extensions, quality, update channel).
- Watch daemon management: `deemon npm run watch` / `deemon --kill npm run watch` / `deemon --restart npm run watch`.
