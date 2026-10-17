# Block schema

| type | props |
|------|-------|
| paragraph | `{ text }` |
| heading | `{ level, text }` |
| bullet | `{ text, ordered? }` |
| todo | `{ text, checked }` |
| quote | `{ text }` |
| code | `{ text }` |
| divider | `{}` |
| drawing | `{ sceneId, scene?, elements? }` |

New type checklist: update this file + TipTap mapping in `blocks.ts` + optional renderer.
