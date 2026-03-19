# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the application code, organized by concern: `screens/` for UI flows, `components/` for reusable UI, `hooks/` for shared state and effects, `services/` for downloads, updates, backup, and integrations, and `database/` for Drizzle-backed persistence. Platform-specific code lives in `android/`, `ios/`, `shared/`, and `specs/`. Tests are colocated in `__tests__` directories or `*.test.ts(x)` files, with shared helpers in `__tests-modules__/` and global mocks in `__mocks__/`. Localized strings live under `strings/`.

## Build, Test, and Development Commands
Use `pnpm install` with Node 20+.

- `pnpm run dev:start`: start Metro.
- `pnpm run dev:android`: generate debug env and launch Android.
- `pnpm run dev:ios`: launch the iOS app.
- `pnpm run build:release:android`: create a release APK.
- `pnpm run lint` / `pnpm run lint:fix`: check or fix ESLint issues.
- `pnpm run format` / `pnpm run format:check`: apply or verify Prettier formatting.
- `pnpm run type-check`: run TypeScript checks.
- `pnpm test`, `pnpm test:rn`, `pnpm test:db`, `pnpm test:coverage`: run Jest suites.

## Coding Style & Naming Conventions
This is a TypeScript React Native codebase. Prettier enforces 2-space indentation, single quotes, trailing commas, and no tabs. ESLint extends `@react-native`; `console` usage is disallowed, `prefer-const` is enforced, and React hook dependency warnings should be resolved rather than suppressed. Use `PascalCase` for React components and screen files, `camelCase` for hooks and utilities, and keep tests beside the code they cover when practical.

## Testing Guidelines
Jest and React Native Testing Library are the primary tools. Prefer `@test-utils` from `__tests-modules__/test-utils.tsx` for provider-aware rendering. Reuse module-level mocks from `__mocks__/` and `src/hooks/__mocks__/` instead of rebuilding native stubs per test. Name tests `*.test.ts` or `*.test.tsx`, and run targeted suites with `pnpm run test:rn` or `pnpm run test:db` before opening a PR.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit prefixes such as `feat:`, `fix:`, `refactor:`, and `chore:`. Keep commit subjects imperative and concise, for example `fix: handle tracker migration failure`. PRs should describe the user-facing change, link related issues, note platform impact (`android`, `ios`, `db`, `translations`), and include screenshots or recordings for UI changes.

## Security & Configuration Tips
Generate environment files through the provided scripts rather than committing ad hoc secrets. Treat platform credentials and service config files as sensitive, and avoid unrelated edits to generated assets or migration snapshots unless the feature requires them.

## AI Backend Reference
Current tested remote model stack for the spoiler-safe novel AI flow:

- Embeddings: `openai/text-embedding-3-small`
- Reranker: `qwen/qwen3-14b`
- Answer model: `qwen/qwen3-235b-a22b-2507`

Current retrieval strategy:

- hybrid retrieval: local vector similarity + BM25
- rerank after fusion
- spoiler boundary filtering before retrieval/answer

Cost reference from testing:

- indexing about `506` chapters with `openai/text-embedding-3-small`
- observed OpenRouter embedding spend: about `$0.0252`
- observed requests: about `4.59K`
- observed embedding tokens: about `1.37M`

Treat that as an example benchmark, not a guaranteed fixed cost. Actual cost depends on chapter length, chunking, retries, and whether re-indexing occurs.
