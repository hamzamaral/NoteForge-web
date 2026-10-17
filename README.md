# NoteForge Web

[![CI](https://github.com/hamzamaral/NoteForge-web/actions/workflows/ci.yml/badge.svg)](https://github.com/hamzamaral/NoteForge-web/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![TipTap](https://img.shields.io/badge/TipTap-editor-0D9488)
![Yjs](https://img.shields.io/badge/Yjs-collab-FACC15)

**NoteForge** arayüzü — Notion benzeri blok editör, görev paneli, çizim, veritabanı, paylaşım, canlı birlikte yazma ve arama.

API: [NoteForge-api](https://github.com/hamzamaral/NoteForge-api)

## Docs

- [PRODUCT](docs/PRODUCT.md) · [INTERVIEW](docs/INTERVIEW.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [ROADMAP](docs/ROADMAP.md) · [BLOCK_SCHEMA](docs/BLOCK_SCHEMA.md)
- ADRs: [TipTap](docs/adr/0001-editor-tiptap.md) · [Tasks before DB](docs/adr/0002-tasks-before-db.md) · [Search ILIKE](docs/adr/0003-search-ilike.md)

## Ekranlar

| | |
|---|---|
| ![Giriş](docs/screenshots/login.png) | ![Workspace](docs/screenshots/workspace.png) |
| **Giriş:** demo hesap, JWT | **Workspace:** ağaç, TipTap, görevler, canlı sync |
| ![Arama](docs/screenshots/search.png) | |
| **Ctrl+K:** başlık / içerik / görev + snippet | |

## Özellik matrisi

| Alan | Ne var |
|------|--------|
| Editör | TipTap, `/` slash, `@` mention, görsel, ↑↓ blok, boş satır tıkla |
| İlişkiler | Nested pages, backlink, görev paneli (due) |
| Çizim | Excalidraw bloğu, şablon galerisi, MD import/export |
| Database | Table + board, props CRUD, filter/sort, drag |
| Paylaşım | Token link, yorum (`blockId`), üye davet |
| Realtime | Socket `/sync` JWT, Yjs, remote caret, “Canlı” durumu |
| Arama | Sidebar + **Ctrl+K** palet, snippet / match tipi |

## Quick start

```bash
npm install
npm run dev
```

http://localhost:5174 — proxy `/api` → `:3001`

Demo: `admin@noteforge.local` / `Admin123!`
