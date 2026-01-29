# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the core TypeScript codebase; Orbit-specific features live under `src/vs/workbench/contrib/orbit/`.
- `extensions/` holds built-in extensions (one folder per extension).
- `build/` and `scripts/` contain build tooling and helper scripts.
- `resources/` stores static assets used by the app.
- `out/` and `.build/` are generated build outputs.
- `test/` contains test runners and suites (`unit`, `integration`, `smoke`).

## Build, Test, and Development Commands
- `npm install`: installs dependencies and runs repo/extension postinstall steps.
- `npm run compile-client`: compiles the main client TypeScript bundle.
- `npm run compile`: full compile for core + extensions.
- `npm run buildreact`: builds the React UI in `src/vs/workbench/contrib/orbit/browser/react/`.
- `npm run watch`: continuous compilation for local development.
- Developer Mode: `./scripts/code.bat` (Windows) or `./scripts/code.sh` (macOS/Linux).

## Coding Style & Naming Conventions
- Indentation: tabs by default; spaces for `package.json`, `*.yml`, and `*.yaml` (see `.editorconfig`).
- Keep names and module layout consistent with existing `src/vs/...` patterns.
- Linting tools: `npm run eslint` for JS/TS and `npm run stylelint` for styles.

## Testing Guidelines
- Test suites live in `test/` (see `test/README.md` and subfolder READMEs).
- Key runners: `npm run test-node` (Mocha), `npm run test-browser` (Playwright), `npm run test-extension` (vscode-test).
- Match existing test naming and structure in the target suite.

## Commit & Pull Request Guidelines
- No strict commit format observed; keep messages short and imperative (e.g., `fix build on windows`).
- Open a PR for changes; issues are optional unless proposing a larger feature.
- Include a clear description, test results, and screenshots for UI changes.
- Do not use AI to write PR descriptions (per project guidance).

## Environment & Prerequisites
- Node version is pinned in `.nvmrc` (`20.18.2`); use `nvm use` if available.
- Windows builds require VS 2022 build tools (see `HOW_TO_CONTRIBUTE.md`).
