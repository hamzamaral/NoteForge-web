# Architecture

```
Web (Vite React :5174)
  TipTap editor → PATCH /pages/:id/blocks (versioned)
  TaskPanel → /tasks
  DatabaseView → /databases
  Socket.IO → /sync (JWT, presence, Y.Doc room, awareness)
        │
API (NestJS :3001 /api/v1)
  Auth JWT · Workspaces · Pages/Blocks · Tasks
  Databases · Shares · Comments · SyncGateway
        │
PostgreSQL
```

## Key flows
1. Login → access/refresh tokens
2. List pages tree by workspace
3. Load page + blocks + backlinks
4. Debounced autosave replaces block set, increments `contentVersion`
5. Mentions create `PageLink` rows
6. Join page room → JWT socket → `yjsSync` state + live `yjsUpdate` / caret awareness
