# Repository Guidelines

Welcome! Follow this guide to keep contributions consistent and high-quality.

## Project Structure & Module Organization
- Source modules live in `src/`, grouped by stream type (`XMLStream.ts`, `XMLTokenStream.ts`) and helpers in `src/utils/` and `src/transforms/`.
- Tests sit in `src/*.spec.ts` for unit coverage and reusable mocks/fixtures in `test/`.
- Built artifacts are emitted to `dist/` (`esm/` and `commonjs/`), and temporary scratch work should stay inside `tmp/`.

## Build, Test, and Development Commands
- `npm run build` — Runs `tshy` to compile TypeScript into `dist/` outputs.
- `npm test` — Executes the Vitest suite in run mode.
- `npm install` — Restores dependencies before building or testing.

## Coding Style & Naming Conventions
- Use TypeScript with ES module syntax and 2-space indentation (inherit existing file formatting).
- Favor descriptive camelCase for variables/functions, PascalCase for classes and exported types, and kebab-case for filenames mirroring module intent.
- Run Prettier (`npx prettier --check src test`) before submitting significant changes; fix formatting with `--write` if needed.

## Testing Guidelines
- Write Vitest specs alongside implementation (`src/Foo.spec.ts`) and mirror the unit under test.
- Cover streaming edge cases (partial tags, SSE chunks) and assert both `data` and `messages` outputs.
- When adding fixtures, place them under `test/fixtures/` and reference them via relative imports.

## Commit & Pull Request Guidelines
- Follow semantic commit prefixes observed in history (`feat:`, `fix:`, `chore:`) with a succinct summary.
- Keep PRs focused, describe behavioral changes, reference issues when applicable, and include test evidence (`npm test`) or examples of parsed output.
- Avoid committing generated files (`dist/`, `tmp/`) unless the release pipeline requires them.

## Security & Configuration Notes
- Never commit API keys; load environment variables via `.env` and guard usage with optional chaining.
- Review `tshy` config when exposing new entry points to ensure only intended modules are exported.
