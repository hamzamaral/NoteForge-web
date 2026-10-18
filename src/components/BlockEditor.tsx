import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { TextSelection } from '@tiptap/pm/state';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Block, type PageNode } from '@/lib/api';
import { blocksToDoc, docToBlocks } from '@/lib/blocks';
import type { NoteForgeProvider } from '@/lib/sync';
import {
  BookmarkNode,
  CalloutNode,
  ColumnNode,
  ColumnsNode,
  DrawingNode,
  MathNode,
  ToggleNode,
} from '@/components/editor/extensions';

const YJS_FIELD = 'default';

function blocksHaveContent(blocks: Block[]) {
  return blocks.some((b) => {
    if (b.type === 'divider' || b.type === 'drawing' || b.type === 'columns') return true;
    if (b.type === 'image' || b.type === 'bookmark') return Boolean(b.props.src || b.props.url);
    if (b.type === 'math') return Boolean(b.props.tex);
    return String(b.props.text ?? '').trim().length > 0;
  });
}

function payloadHasContent(payload: ReturnType<typeof docToBlocks>) {
  return payload.blocks.some((b) => {
    if (b.type === 'divider') return true;
    if (b.type === 'image') return Boolean(b.props.src);
    return String(b.props.text ?? '').trim().length > 0;
  });
}

function isYFragmentEmpty(doc: NoteForgeProvider['doc']) {
  return doc.getXmlFragment(YJS_FIELD).length === 0;
}

type SlashItem = {
  key: string;
  label: string;
  hint: string;
  run: (ed: Editor) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  { key: 'paragraph', label: 'Paragraf', hint: 'Metin', run: (ed) => ed.chain().focus().setParagraph().run() },
  { key: 'h1', label: 'Başlık 1', hint: '#', run: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run() },
  { key: 'h2', label: 'Başlık 2', hint: '##', run: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: 'h3', label: 'Başlık 3', hint: '###', run: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run() },
  { key: 'bullet', label: 'Madde', hint: 'Liste', run: (ed) => ed.chain().focus().toggleBulletList().run() },
  { key: 'todo', label: 'Yapılacak', hint: 'Checkbox', run: (ed) => ed.chain().focus().toggleTaskList().run() },
  { key: 'quote', label: 'Alıntı', hint: '>', run: (ed) => ed.chain().focus().toggleBlockquote().run() },
  { key: 'code', label: 'Kod', hint: '```', run: (ed) => ed.chain().focus().toggleCodeBlock().run() },
  {
    key: 'callout',
    label: 'Callout',
    hint: '!',
    run: (ed) => ed.chain().focus().insertCallout().run(),
  },
  {
    key: 'toggle',
    label: 'Toggle',
    hint: '▸',
    run: (ed) => ed.chain().focus().insertToggle().run(),
  },
  {
    key: 'columns',
    label: 'Kolonlar',
    hint: '2',
    run: (ed) => ed.chain().focus().insertColumns().run(),
  },
  {
    key: 'math',
    label: 'Math',
    hint: '∑',
    run: (ed) => ed.chain().focus().insertMath('').run(),
  },
  {
    key: 'bookmark',
    label: 'Bookmark',
    hint: 'URL',
    run: (ed) => ed.chain().focus().insertBookmark().run(),
  },
  { key: 'hr', label: 'Ayırıcı', hint: '---', run: (ed) => ed.chain().focus().setHorizontalRule().run() },
  {
    key: 'image',
    label: 'Görsel',
    hint: 'Dosya',
    run: (ed) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        void insertImageIntoEditor(ed, file, (window as unknown as { __nfWorkspaceId?: string }).__nfWorkspaceId);
      };
      input.click();
    },
  },
  {
    key: 'drawing',
    label: 'Çizim',
    hint: 'Excalidraw',
    run: (ed) => ed.chain().focus().insertDrawing().run(),
  },
];

type Props = {
  blocks: Block[];
  pages?: PageNode[];
  currentPageId?: string;
  workspaceId?: string;
  /** Yjs + Awareness provider from usePageSync; null = REST-only editor */
  provider?: NoteForgeProvider | null;
  /** When true, editor is not editable (e.g. workspace VIEWER) */
  readOnly?: boolean;
  /** Called after debounce; should return a Promise so UI waits for real save */
  onChange: (payload: ReturnType<typeof docToBlocks>) => void | Promise<unknown>;
  onSaveState?: (state: 'idle' | 'saving' | 'saved' | 'error') => void;
};

type Popup = {
  kind: 'slash' | 'mention';
  top: number;
  left: number;
  filter: string;
  index: number;
};

async function uploadImageFile(workspaceId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('workspaceId', workspaceId);
  const { data } = await api.post<{ url: string }>('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}

async function insertImageIntoEditor(ed: Editor, file: File, workspaceId?: string) {
  if (workspaceId) {
    try {
      const url = await uploadImageFile(workspaceId, file);
      ed.chain().focus().setImage({ src: url, alt: file.name }).run();
      return;
    } catch {
      /* fall through to data URL */
    }
  }
  const reader = new FileReader();
  reader.onload = () =>
    ed.chain().focus().setImage({ src: String(reader.result), alt: file.name }).run();
  reader.readAsDataURL(file);
}

export function BlockEditor({
  blocks,
  pages = [],
  currentPageId,
  workspaceId,
  provider = null,
  readOnly = false,
  onChange,
  onSaveState,
}: Props) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [collabSynced, setCollabSynced] = useState(() => provider?.synced ?? false);
  const applyingRemote = useRef(false);
  const ignoreSave = useRef(false);
  const debounce = useRef<number>();
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const seededCollab = useRef(false);
  const restHadContent = useRef(blocksHaveContent(blocks));
  const popupRef = useRef(popup);
  popupRef.current = popup;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveStateRef = useRef(onSaveState);
  const workspaceIdRef = useRef(workspaceId);
  workspaceIdRef.current = workspaceId;
  useEffect(() => {
    (window as unknown as { __nfWorkspaceId?: string }).__nfWorkspaceId = workspaceId;
  }, [workspaceId]);
  onSaveStateRef.current = onSaveState;
  const dirtyRef = useRef(false);
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  const collabMode = Boolean(provider && collabSynced);

  useEffect(() => {
    restHadContent.current = blocksHaveContent(blocks);
  }, [blocks]);

  useEffect(() => {
    seededCollab.current = false;
  }, [currentPageId, provider?.pageId]);

  useEffect(() => {
    if (!provider) {
      setCollabSynced(false);
      return;
    }
    setCollabSynced(provider.synced);
    return provider.onSynced(() => setCollabSynced(true));
  }, [provider]);

  function flushSave(ed: Editor) {
    window.clearTimeout(debounce.current);
    if (applyingRemote.current || ignoreSave.current || !dirtyRef.current || readOnlyRef.current) return;
    dirtyRef.current = false;
    const payload = docToBlocks(ed.getJSON());
    if (!payloadHasContent(payload) && restHadContent.current) {
      dirtyRef.current = true;
      onSaveStateRef.current?.('idle');
      return;
    }
    onSaveStateRef.current?.('saving');
    return Promise.resolve(onChangeRef.current(payload))
      .then(() => {
        restHadContent.current = payloadHasContent(payload);
        onSaveStateRef.current?.('saved');
        window.setTimeout(() => onSaveStateRef.current?.('idle'), 1200);
      })
      .catch(() => {
        dirtyRef.current = true;
        onSaveStateRef.current?.('error');
      });
  }

  const extensions = useMemo(() => {
    const list = [
      StarterKit.configure({ undoRedo: collabMode ? false : undefined }),
      Dropcursor.configure({ color: '#0f766e', width: 2 }),
      Gapcursor,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: 'nf-image rounded-lg max-w-full my-3' },
      }),
      DrawingNode,
      CalloutNode,
      ToggleNode,
      ColumnNode,
      ColumnsNode,
      MathNode,
      BookmarkNode,
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading'
            ? 'Başlık…'
            : 'Yaz…  / komut  ·  @ sayfa linki',
        showOnlyCurrent: false,
        includeChildren: true,
      }),
    ];
    if (collabMode && provider) {
      const localUser = provider.awareness.getLocalState()?.user as
        | { name?: string; color?: string }
        | undefined;
      list.push(
        Collaboration.configure({
          document: provider.doc,
          field: YJS_FIELD,
        }),
        CollaborationCaret.configure({
          provider,
          user: {
            name: localUser?.name ?? 'Anon',
            color: localUser?.color ?? '#0f766e',
          },
        }),
      );
    }
    return list;
  }, [collabMode, provider]);

  const editor = useEditor(
    {
      extensions,
      content: collabMode ? undefined : blocksToDoc(blocks),
      editable: !readOnly,
      editorProps: {
        attributes: {
          class: 'prose prose-slate max-w-none focus:outline-none px-1 min-h-[55vh] cursor-text',
        },
        handlePaste: (_view, event) => {
          const ed = editorRef.current;
          const items = event.clipboardData?.items;
          if (!items || !ed) return false;
          for (const item of items) {
            if (!item.type.startsWith('image/')) continue;
            const file = item.getAsFile();
            if (!file) continue;
            event.preventDefault();
            void insertImageIntoEditor(ed, file, workspaceIdRef.current);
            return true;
          }
          return false;
        },
        handleKeyDown: (_view, event) => {
          const current = popupRef.current;
          if (!current) return false;
          if (event.key === 'Escape') {
            setPopup(null);
            return true;
          }
          const items =
            current.kind === 'slash'
              ? filterSlash(current.filter)
              : filterMentions(current.filter);
          if (!items.length) return false;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setPopup((s) => (s ? { ...s, index: (s.index + 1) % items.length } : s));
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setPopup((s) =>
              s ? { ...s, index: (s.index - 1 + items.length) % items.length } : s,
            );
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (current.kind === 'slash') {
              const item = (items as SlashItem[])[current.index];
              if (item) applySlash(item);
            } else {
              const page = (items as PageNode[])[current.index];
              if (page) applyMention(page);
            }
            return true;
          }
          return false;
        },
      },
      onCreate: ({ editor: ed }) => {
        editorRef.current = ed;
      },
      onUpdate: ({ editor: ed }) => {
        const { from } = ed.state.selection;
        const textBefore = ed.state.doc.textBetween(Math.max(0, from - 40), from, '\n');
        const slashMatch = textBefore.match(/(?:^|\s)\/([^\s@]*)$/);
        const mentionMatch = textBefore.match(/(?:^|\s)@([^\s]*)$/);
        const coords = ed.view.coordsAtPos(from);
        if (slashMatch) {
          setPopup({
            kind: 'slash',
            top: coords.bottom + 6,
            left: coords.left,
            filter: slashMatch[1] || '',
            index: 0,
          });
        } else if (mentionMatch) {
          setPopup({
            kind: 'mention',
            top: coords.bottom + 6,
            left: coords.left,
            filter: mentionMatch[1] || '',
            index: 0,
          });
        } else {
          setPopup(null);
        }
        if (applyingRemote.current || ignoreSave.current) return;
        dirtyRef.current = true;
        onSaveStateRef.current?.('saving');
        window.clearTimeout(debounce.current);
        debounce.current = window.setTimeout(() => {
          void flushSave(ed);
        }, 500);
      },
    },
    [collabMode, provider?.pageId, readOnly],
  );

  useEffect(() => {
    editorRef.current = editor;
    if (editor) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Seed REST blocks into empty Y.Doc once (after collab sync)
  useEffect(() => {
    if (!editor || !collabMode || !provider || seededCollab.current) return;
    if (!isYFragmentEmpty(provider.doc)) {
      seededCollab.current = true;
      return;
    }
    if (!blocksHaveContent(blocksRef.current)) {
      seededCollab.current = true;
      return;
    }
    seededCollab.current = true;
    ignoreSave.current = true;
    applyingRemote.current = true;
    editor.commands.setContent(blocksToDoc(blocksRef.current));
    applyingRemote.current = false;
    ignoreSave.current = false;
    dirtyRef.current = false;
    onSaveStateRef.current?.('idle');
  }, [editor, collabMode, provider]);

  // Flush pending debounce on leave / unmount
  useEffect(() => {
    function onLeave() {
      const ed = editorRef.current;
      if (ed) void flushSave(ed);
    }
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      onLeave();
    };
  }, []);

  // Do NOT re-setContent on every save: server assigns new block ids each PATCH
  // and would wipe in-progress typing. Remount via key={pageId} loads fresh content.

  function filterSlash(filter: string) {
    const f = filter.toLowerCase();
    return SLASH_ITEMS.filter(
      (i) =>
        i.label.toLowerCase().includes(f) ||
        i.key.includes(f) ||
        i.hint.toLowerCase().includes(f),
    );
  }

  function filterMentions(filter: string) {
    const f = filter.toLowerCase();
    return pagesRef.current
      .filter((p) => p.id !== currentPageId)
      .filter((p) => !f || p.title.toLowerCase().includes(f))
      .slice(0, 12);
  }

  function applySlash(item: SlashItem) {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 24), from, '\n');
    const match = textBefore.match(/(?:^|\s)\/([^\s@]*)$/);
    if (match) {
      const token = match[0].trimStart();
      editor.chain().focus().deleteRange({ from: from - token.length, to: from }).run();
    }
    item.run(editor);
    setPopup(null);
  }

  function applyMention(page: PageNode) {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 40), from, '\n');
    const match = textBefore.match(/(?:^|\s)@([^\s]*)$/);
    if (match) {
      const token = match[0].trimStart();
      editor.chain().focus().deleteRange({ from: from - token.length, to: from }).run();
    }
    editor
      .chain()
      .focus()
      .insertContent(`@[${page.title}](${page.id}) `)
      .run();
    setPopup(null);
  }

  function moveBlock(dir: -1 | 1) {
    if (!editor) return;
    const { state } = editor;
    const { $from } = state.selection;
    if ($from.depth < 1) return;
    const index = $from.index(0);
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= state.doc.childCount) return;

    editor
      .chain()
      .focus()
      .command(({ tr, state: st }) => {
        const nodes = [];
        for (let i = 0; i < st.doc.childCount; i++) {
          if (i === index) nodes.push(st.doc.child(swapWith));
          else if (i === swapWith) nodes.push(st.doc.child(index));
          else nodes.push(st.doc.child(i));
        }
        tr.replaceWith(0, st.doc.content.size, nodes);
        return true;
      })
      .run();
  }

  function focusEnd() {
    if (!editor) return;
    const end = editor.state.doc.content.size;
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(end), -1)),
    );
    editor.view.focus();
  }

  const slashItems = popup?.kind === 'slash' ? filterSlash(popup.filter) : [];
  const mentionItems = popup?.kind === 'mention' ? filterMentions(popup.filter) : [];

  if (provider && !collabSynced) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 px-4 py-8 text-center text-sm text-slate-500">
        Canlı işbirliği bağlanıyor…
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs hover:bg-panel disabled:opacity-40"
          title="Bloğu yukarı taşı"
          disabled={readOnly}
          onMouseDown={(e) => {
            e.preventDefault();
            moveBlock(-1);
          }}
        >
          ↑ Blok
        </button>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs hover:bg-panel disabled:opacity-40"
          title="Bloğu aşağı taşı"
          disabled={readOnly}
          onMouseDown={(e) => {
            e.preventDefault();
            moveBlock(1);
          }}
        >
          ↓ Blok
        </button>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs hover:bg-panel disabled:opacity-40"
          disabled={readOnly}
          onMouseDown={(e) => {
            e.preventDefault();
            fileRef.current?.click();
          }}
        >
          Görsel ekle
        </button>
        <span className="text-[11px] text-slate-400">
          / komut · @ sayfa · görsel yapıştır · ↑↓ blok
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || !editor) return;
            void insertImageIntoEditor(editor, file, workspaceIdRef.current);
            e.target.value = '';
          }}
        />
      </div>
      <div
        className="rounded-xl border border-transparent bg-white/50 px-2 py-3 hover:border-slate-200/80"
        onClick={(e) => {
          if (e.target === e.currentTarget) focusEnd();
        }}
      >
        <EditorContent editor={editor} />
        <button
          type="button"
          className="mt-2 w-full rounded-lg border border-dashed border-slate-200 py-3 text-left text-sm text-slate-400 hover:border-accent/40 hover:text-slate-600"
          onClick={focusEnd}
        >
          + Boş satıra tıkla ve yazmaya devam et
        </button>
      </div>
      {popup?.kind === 'slash' && slashItems.length > 0 && (
        <div
          className="fixed z-50 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: popup.top, left: popup.left }}
        >
          {slashItems.map((item, i) => (
            <button
              key={item.key}
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                i === popup.index ? 'bg-accent/10 text-accent' : 'hover:bg-panel'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                applySlash(item);
              }}
            >
              <span>{item.label}</span>
              <span className="text-[10px] text-slate-400">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
      {popup?.kind === 'mention' && (
        <div
          className="fixed z-50 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: popup.top, left: popup.left }}
        >
          <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-400">
            Sayfaya bağla
          </p>
          {mentionItems.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Eşleşen sayfa yok</p>
          ) : (
            mentionItems.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`block w-full truncate px-3 py-1.5 text-left text-sm ${
                  i === popup.index ? 'bg-accent/10 text-accent' : 'hover:bg-panel'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyMention(p);
                }}
              >
                {p.icon || '📄'} {p.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
