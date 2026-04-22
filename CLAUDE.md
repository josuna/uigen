# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Summary

UIGen is an AI-powered React component generator with live preview. Users chat with Claude; the assistant calls tools to create/edit React + Tailwind components in an in-memory virtual file system, which is then transformed in the browser and rendered in a preview iframe. No generated code is ever written to disk — everything lives in memory and (for logged-in users) is serialized into SQLite via Prisma.

## Commands

```bash
npm run setup        # install deps + prisma generate + prisma migrate dev (run once after clone)
npm run dev          # Next.js dev server w/ turbopack, Node 25 compat shim (port 3000)
npm run dev:daemon   # same, backgrounded, logs -> logs.txt
npm run build        # production build
npm run start        # production server
npm run lint         # next lint (eslint 9 + eslint-config-next)
npm test             # vitest (jsdom env, RTL)
npm run db:reset     # prisma migrate reset --force (wipes dev.db)
```

Run a single test file: `npx vitest run src/lib/__tests__/file-system.test.ts`
Run tests by name: `npx vitest run -t "creates a file"`

The `NODE_OPTIONS='--require ./node-compat.cjs'` prefix on dev/build/start is **required** — `node-compat.cjs` deletes `globalThis.localStorage`/`sessionStorage` on the server to work around Node 25+ exposing non-functional Web Storage globals that break SSR guard checks.

## Environment

Optional `.env` value: `ANTHROPIC_API_KEY=…`. If unset or empty, `getLanguageModel()` in `src/lib/provider.ts` returns a `MockLanguageModel` that emits a canned 4-step stream (counter/form/card heuristic from the user prompt) — the app still runs end-to-end without an API key. The real model ID is `claude-haiku-4-5`.

`JWT_SECRET` is read by `src/lib/auth.ts` (falls back to `"development-secret-key"`).

## Architecture

### Virtual file system (no disk I/O for generated code)

- `src/lib/file-system.ts` — `VirtualFileSystem` class holds a tree of `FileNode`s in memory. Methods: `createFile`, `createFileWithParents`, `replaceInFile`, `insertInFile`, `viewFile`, `rename`, `deleteFile`, plus `serialize()` / `deserializeFromNodes()` for persistence.
- The VFS is the single source of truth for generated components. The file tree, code editor, and preview all read from the same instance held in React context.

### Chat + tool-calling loop

- `src/app/api/chat/route.ts` (POST) is the Vercel AI SDK endpoint. It:
  1. Prepends the system prompt from `src/lib/prompts/generation.tsx` with `cacheControl: ephemeral`.
  2. Rehydrates a `VirtualFileSystem` from the `files` payload the client sends.
  3. Calls `streamText` with two tools — `str_replace_editor` (`src/lib/tools/str-replace.ts`) and `file_manager` (`src/lib/tools/file-manager.ts`) — bound to that VFS.
  4. On `onFinish`, if `projectId` + authenticated session, persists `messages` + `fileSystem.serialize()` to the `Project` row.
- `maxSteps` is 4 for the mock provider, 40 for the real one.

### Client-side context wiring

- `src/lib/contexts/file-system-context.tsx` — owns the `VirtualFileSystem` instance for the UI. Its `handleToolCall` mirrors each `str_replace_editor` / `file_manager` tool invocation into the local VFS so the UI updates live as the model streams tool calls.
- `src/lib/contexts/chat-context.tsx` — wraps `useChat` from `@ai-sdk/react`, sends `fileSystem.serialize()` + `projectId` in every request body, and forwards `onToolCall` into `handleToolCall`.
- These two providers are composed in `src/app/main-content.tsx` (FileSystemProvider wraps ChatProvider).

### JSX live preview pipeline

- `src/components/preview/PreviewFrame.tsx` drives the iframe preview.
- `src/lib/transform/jsx-transformer.ts` runs `@babel/standalone` **in the browser** with the `react` (automatic runtime) and `typescript` presets. It extracts imports, turns each VFS file into a `Blob` URL, and stitches them into an ES-module graph. Missing imports are stubbed with placeholder modules so partial code still renders. CSS imports are stripped (Tailwind handles styling).

### Auth + persistence

- `src/lib/auth.ts` — JWT in an `httpOnly` cookie (`auth-token`), signed/verified with `jose`. 7-day expiry. `getSession()` reads `cookies()` (server components / actions); `verifySession(request)` is for middleware.
- `src/middleware.ts` — gates `/api/projects` and `/api/filesystem` behind `verifySession`.
- **Database schema** is defined in `prisma/schema.prisma` — reference it any time you need to understand the structure of data stored in the database. SQLite at `prisma/dev.db`, two models: `User` and `Project`. `Project.messages` and `Project.data` are both stringified JSON columns (messages array and serialized VFS, respectively). **Prisma client is generated into `src/generated/prisma`** — not `node_modules/@prisma/client`. Import via `@/lib/prisma.ts`.
- Anonymous users: `src/lib/anon-work-tracker.ts` stashes messages + VFS data in `sessionStorage` so work isn't lost if the user signs up mid-session.
- `src/app/page.tsx` redirects authenticated users to their most recent project (creating one if none exist); anonymous users see `MainContent` with no `project` prop.

### UI

- Next.js 15 App Router, React 19, Tailwind CSS v4 (PostCSS via `@tailwindcss/postcss`), shadcn/ui (style `new-york`, base color `neutral`, components in `src/components/ui/`).
- Path alias `@/*` → `src/*` (see `tsconfig.json`). `components.json` sets alias conventions for shadcn.
- Layout is `ResizablePanelGroup` (react-resizable-panels): left = chat, right = tabs over Preview / (FileTree + CodeEditor).

## Testing notes

- Vitest uses `jsdom` + `@vitejs/plugin-react` + `vite-tsconfig-paths` (so `@/` aliases resolve).
- Tests live in `__tests__/` folders colocated with sources (e.g. `src/lib/__tests__/file-system.test.ts`, `src/components/chat/__tests__/*.test.tsx`).
- When touching the VFS, the tool definitions, or the JSX transformer, the existing tests in those folders cover the contract — extend them rather than mocking around them.

## Gotchas

- If you change `prisma/schema.prisma`, regenerate with `npx prisma generate` — the client is emitted to `src/generated/prisma`, not `node_modules`.
- `messages` and `data` on `Project` are `String` columns; always `JSON.stringify` when writing and `JSON.parse` when reading.
- The mock provider is triggered purely by `ANTHROPIC_API_KEY` being missing/blank. If you're debugging and getting canned Counter/Form/Card output, check your `.env`.
- All generated-component imports use the `@/` alias relative to the **virtual** FS root (see `src/lib/prompts/generation.tsx`), not the real `src/` tree.
