# NoteForge — Interview Guide

## 60-second pitch
NoteForge is a Notion-inspired knowledge OS: block-based pages (not a Markdown blob), page-linked tasks, Excalidraw drawings, and later database views. NestJS + Prisma API, React + TipTap web, workspace ACL. Realtime (Yjs/Socket) is intentionally Phase 6 after single-user autosave is solid.

## Q&A

### Why not store the whole page as Markdown?
Markdown loses structure for todos, drawings, and database embeds. We persist a **block tree** (`type`, `props` JSON, `sortOrder`) so each feature can evolve independently and we can version/optimistic-lock the page.

### Why TipTap?
ProseMirror foundation, React bindings, slash menus, task lists, and a large extension ecosystem. Alternative was Plate; we ADRed TipTap for speed to demo.

### How do block reorder and images work?
Top-level nodes swap via ↑/↓ (transaction rewrite). Native HTML5 drop uses TipTap Dropcursor/Gapcursor. Images are TipTap Image nodes persisted as `{ type: image, props: { src, alt } }` — paste or file picker stores base64 for the demo (S3 comes later).

### How do page links / backlinks work?
Typing `@` opens a page picker; insert `@[Title](uuid)`. On save we parse mentions into `PageLink` rows. Target page shows a backlink panel. Moving a page updates `parentId` with cycle detection (cannot nest under own descendant).

### How do drawings and templates differ from Notion?
Drawing blocks embed Excalidraw JSON in block `props.scene`. Templates (`blank`, `meeting`, `project`, `brainstorm`, `weekly`) are server-side recipes. Markdown import parses headings/lists/todos into blocks via `POST /pages/import.md`.

### How do you handle concurrent edits?
Phase 1–5: **optimistic version** on `Page.contentVersion`. Conflicting PATCH returns 409. Phase 6: Yjs CRDT relay over Socket.IO for true multiplayer.

### How is multi-tenant isolation done?
Every page/task/db row belongs to a `workspaceId`. Guards resolve membership (`WorkspaceMember`) before any mutation. Share links are token-scoped read APIs without JWT.

### What’s unique vs Notion?
First-class **drawing block** (Excalidraw), explicit **task panel** before full databases, and **interview/docs-first** open repos (`docs/INTERVIEW.md`, ADRs, Cursor rules).

### Scaling story?
Postgres for source of truth; FTS via `props::text ILIKE` then Meilisearch; files to S3; sync room fan-out per `pageId`.

### Security
JWT access + hashed refresh tokens, helmet, validation pipes, membership checks, public share is read-only.

## English summary
Built as a portfolio-grade Notion-like system with deliberate phasing: editor → tasks/backlinks → drawing → databases → sharing → realtime → search/AI.
