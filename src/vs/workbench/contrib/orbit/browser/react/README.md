# Orbit React UI

The Orbit sidebar, settings, plan editor, and other React surfaces live here. This is a **separate build pipeline** from the main TypeScript compile.

## Build

From the repo root:

```bash
npm run buildreact
```

Or from this directory:

```bash
node build.js          # one-shot
node build.js --watch  # continuous
```

Output: `out/` (bundled React consumed by the workbench).

## Pipeline

```
src/  →  src2/  (scope-tailwind)  →  out/  (tsup)
```

1. **src/** — source files (keep shallow: one folder deep)
2. **src2/** — Tailwind-scoped output (generated, do not edit)
3. **out/** — final bundle (generated, do not edit)

## Rules

1. **`.js` extensions on imports** — Every external import must end with `.js`:

   ```ts
   import { foo } from '../../../../../common/foo.js'  // ✅
   import { foo } from '../../../../../common/foo'     // ❌ breaks at runtime
   ```

2. **Shallow `src/`** — Keep source one folder deep so tsup externals detection works (see `tsup.config.js`).

3. **Rebuild before compile** — After changing React source, run `npm run buildreact` then reload the dev window (`Cmd+R`).

4. **Theming** — Use CSS variables from `src/styles.css` (`--void-*`, `--vscode-*`). Avoid hardcoded colors.

5. **Reuse components** — Extend existing components under `src/sidebar-tsx/components/` before adding new ones.

## Key directories

| Path | Contents |
|------|----------|
| `src/sidebar-tsx/` | Chat sidebar, tool result cards, mode selector |
| `src/orbit-settings-tsx/` | Settings UI |
| `src/plan-editor-tsx/` | Plan markdown editor |
| `src/quick-edit-tsx/` | Ctrl+K quick edit overlay |
| `src/styles.css` | Global Orbit React styles and theme tokens |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Failed to fetch dynamically imported module` | Check all imports end with `.js` |
| Build OOM | `NODE_OPTIONS="--max-old-space-size=8192" npm run buildreact` |
| Missing styles after reload | Wait a few seconds, reload dev window |
| Minify error with emoji in regex | Use Unicode escapes (e.g. `\u26A1` instead of `⚡`) |

See [HOW_TO_CONTRIBUTE.md](../../../../../../../HOW_TO_CONTRIBUTE.md) for full dev setup.
