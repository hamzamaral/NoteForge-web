# NoteForge — Interview Guide

## 60-second pitch
NoteForge is a Notion-inspired knowledge OS: **block-based pages** (not a Markdown blob), page-linked **tasks**, **Excalidraw** drawings, **database** table/board, share links, comments, and **Yjs realtime** over Socket.IO. NestJS + Prisma API, React + TipTap web, workspace ACL. Built in deliberate phases so each layer is demoable alone.

## Demo walkthrough (5 min)
1. Login `admin@noteforge.local` / `Admin123!`
2. Open a page → `/` slash → heading, todo, image; empty-line click to keep writing
3. `@` mention another page → open target → show **backlinks**
4. Right panel: create task with due date; mark DOING/DONE
5. Insert drawing block → sketch → autosave scene JSON
6. Create database → table filter/sort → board drag
7. Share link → open `/share/:token` logged out
8. Second browser (or incognito) same page → **Canlı** + remote caret
9. `Ctrl+K` search → title / content / task hits with snippets

## Q&A

### Why not store the whole page as Markdown?
Markdown loses structure for todos, drawings, and database embeds. We persist a **block tree** (`type`, `props` JSON, `sortOrder`) so each feature can evolve independently and we can version/optimistic-lock the page.

### Why TipTap?
ProseMirror foundation, React bindings, slash menus, task lists, Collaboration/CollaborationCaret for Yjs, and a large extension ecosystem. Alternative was Plate; we ADRed TipTap for speed to demo (`docs/adr/0001-editor-tiptap.md`).

### How do block reorder and images work?
Top-level nodes swap via ↑/↓ (transaction rewrite). Native HTML5 drop uses TipTap Dropcursor/Gapcursor. Images are TipTap Image nodes persisted as `{ type: image, props: { src, alt } }` — paste or file picker stores base64 for the demo (S3 comes later).

### How do page links / backlinks work?
Typing `@` opens a page picker; insert `@[Title](uuid)`. On save we parse mentions into `PageLink` rows. Target page shows a backlink panel. Moving a page updates `parentId` with cycle detection (cannot nest under own descendant).

### How do drawings and templates differ from Notion?
Drawing blocks embed Excalidraw JSON in block `props.scene`. Templates (`blank`, `meeting`, `project`, `brainstorm`, `weekly`) are server-side recipes. Markdown import parses headings/lists/todos into blocks via `POST /pages/import.md`.

### How are databases modeled?
A Database is linked 1:1 to a Page. Properties (`text|number|select|date`) and Views (`table|board` + JSON config) are first-class. Rows store a JSON `values` map keyed by property name. Board drag updates the group-by select field; table filter/sort can be persisted on the view.

### How does sharing and membership work?
Page shares are token URLs (`/share/:token`) with READ/COMMENT permission — no JWT. Workspace members use OWNER/EDITOR/VIEWER; invite by existing user email; only OWNER removes members. Comments can optionally attach to a `blockId`.

### How do you handle concurrent edits?
Optimistic `Page.contentVersion` on PATCH (409 on conflict) remains the durable lock. Live multiplayer: Socket.IO `/sync` requires JWT; each page room keeps an in-memory `Y.Doc`; clients exchange `yjsSync` / `yjsUpdate` + `awarenessUpdate`. TipTap Collaboration + CollaborationCaret show remote carets; REST autosave persists when peers leave.

### How does search work?
`GET /workspaces/:id/search?q=` ranks **title** matches highest, then **task** titles, then **block props** via `props::text ILIKE`. Hits return `match`, `snippet`, `score`. UI: sidebar filter + `Ctrl+K` palette with highlight. Meilisearch deferred (ADR 0003).

### How is multi-tenant isolation done?
Every page/task/db row belongs to a `workspaceId`. Guards resolve membership (`WorkspaceMember`) before any mutation. Share links are token-scoped read APIs without JWT.

### What’s unique vs Notion?
First-class **drawing block** (Excalidraw), explicit **task panel** before full databases (`docs/adr/0002-tasks-before-db.md`), and **interview/docs-first** open repos (`docs/INTERVIEW.md`, ADRs, Cursor rules).

### Scaling story?
Postgres for source of truth; FTS via ILIKE → Meilisearch; files to S3; sync room fan-out per `pageId`; optional Redis adapter for Socket.IO across instances.

### Security
JWT access + hashed refresh tokens, helmet, validation pipes, membership checks, sync handshake JWT, public share is read-only.

## English summary
Portfolio-grade Notion-like system with deliberate phasing: editor → tasks/backlinks → drawing → databases → sharing → realtime → search/showcase.
