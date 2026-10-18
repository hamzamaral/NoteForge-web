# NoteForge — yerel demo

Canlıya alma yok. İki repo: `NoteForge-api` + `NoteForge-web`.

## Portlar

| Servis | URL |
|--------|-----|
| Web | http://127.0.0.1:5174 |
| API | http://127.0.0.1:3001/api/v1 |
| Health | http://127.0.0.1:3001/api/v1/health |
| Postgres | localhost:5434 |
| Meilisearch | http://127.0.0.1:7700 |
| Mailhog (opsiyonel) | http://127.0.0.1:8025 |
| MinIO (profile) | `docker compose --profile minio up -d` + `MINIO_ENABLED=1` |

## Başlat

```bash
# API
cd NoteForge-api
docker compose up -d postgres meilisearch
cp .env.example .env   # gerekirse
npx prisma migrate deploy
npx prisma db seed
npm run build && node dist/main

# Web (ayrı terminal)
cd NoteForge-web
npm run dev -- --host 127.0.0.1 --port 5174
```

veya `NoteForge-api/scripts/dev.sh` (compose + migrate + seed).

## Hesaplar (seed)

| Rol | E-posta | Şifre |
|-----|---------|-------|
| OWNER | admin@noteforge.local | Admin123! |
| EDITOR | editor@noteforge.local | Admin123! |
| VIEWER | viewer@noteforge.local | Admin123! |

Sabit paylaşım: `/share/00000000-0000-4000-8000-0000000000de`

## 5 dakika script

1. Admin ile giriş → Hoş geldin / Collab sayfası
2. `/` slash → callout, çizim; yaz → “Kaydedildi”
3. Incognito: editor@ aynı collab sayfası → caret
4. Ctrl+K → “Meilisearch” / yorum
5. Share linki yeni sekmede (COMMENT)
6. Viewer@ → salt okuma badge
7. Owner → ZIP export / Denetim kaydı

## SoT

Postgres `Block` kalıcı kaynak. Yjs canlı taşıma; sayfa terk / F5 öncesi REST flush.
