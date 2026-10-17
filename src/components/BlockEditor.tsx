import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import { TextSelection } from '@tiptap/pm/state';
import { useEffect, useRef, useState } from 'react';
import type { Block } from '@/lib/api';
import { blocksToDoc, docToBlocks } from '@/lib/blocks';

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
        const reader = new FileReader();
        reader.onload = () => ed.chain().focus().setImage({ src: String(reader.result), alt: file.name }).run();
        reader.readAsDataURL(file);
      };
      input.click();
    },
  },
  {
    key: 'drawing',
    label: 'Çizim',
    hint: 'Excalidraw',
    run: (ed) => ed.chain().focus().insertContent(`[çizim:${crypto.randomUUID()}]`).run(),
  },
];

type Props = {
  blocks: Block[];
  onChange: (payload: ReturnType<typeof docToBlocks>) => void;
  onSaveState?: (state: 'idle' | 'saving' | 'saved') => void;
};

export function BlockEditor({ blocks, onChange, onSaveState }: Props) {
  const [slash, setSlash] = useState<{
    top: number;
    left: number;
    filter: string;
    index: number;
  } | null>(null);
  const savingRef = useRef(false);
  const debounce = useRef<number>();
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const slashRef = useRef(slash);
  slashRef.current = slash;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Dropcursor.configure({ color: '#0f766e', width: 2 }),
      Gapcursor,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: 'nf-image rounded-lg max-w-full my-3' },
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading'
            ? 'Başlık…'
            : 'Boş satıra tıkla ve yaz, veya / ile komut…',
        showOnlyCurrent: false,
        includeChildren: true,
      }),
    ],
    content: blocksToDoc(blocks),
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
          const reader = new FileReader();
          reader.onload = () => ed.chain().focus().setImage({ src: String(reader.result) }).run();
          reader.readAsDataURL(file);
          return true;
        }
        return false;
      },
      handleKeyDown: (_view, event) => {
        const current = slashRef.current;
        if (!current) return false;
        if (event.key === 'Escape') {
          setSlash(null);
          return true;
        }
        const filtered = filterSlash(current.filter);
        if (!filtered.length) return false;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSlash((s) => (s ? { ...s, index: (s.index + 1) % filtered.length } : s));
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSlash((s) =>
            s ? { ...s, index: (s.index - 1 + filtered.length) % filtered.length } : s,
          );
          return true;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          const item = filtered[current.index];
          if (item && editorRef.current) {
            const ed = editorRef.current;
            const { from } = ed.state.selection;
            const textBefore = ed.state.doc.textBetween(Math.max(0, from - 24), from, '\n');
            const match = textBefore.match(/(?:^|\s)\/([^\s]*)$/);
            if (match) {
              const token = match[0].trimStart();
              ed.chain().focus().deleteRange({ from: from - token.length, to: from }).run();
            }
            item.run(ed);
            setSlash(null);
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
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 24), from, '\n');
      const match = textBefore.match(/(?:^|\s)\/([^\s]*)$/);
      if (match) {
        const coords = ed.view.coordsAtPos(from);
        setSlash({
          top: coords.bottom + 6,
          left: coords.left,
          filter: match[1] || '',
          index: 0,
        });
      } else {
        setSlash(null);
      }
      onSaveState?.('saving');
      window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => {
        if (savingRef.current) return;
        onChange(docToBlocks(ed.getJSON()));
        onSaveState?.('saved');
        window.setTimeout(() => onSaveState?.('idle'), 1200);
      }, 450);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    savingRef.current = true;
    editor.commands.setContent(blocksToDoc(blocks), { emitUpdate: false });
    savingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks.map((b) => `${b.id}:${b.type}`).join('|')]);

  function filterSlash(filter: string) {
    const f = filter.toLowerCase();
    return SLASH_ITEMS.filter(
      (i) =>
        i.label.toLowerCase().includes(f) ||
        i.key.includes(f) ||
        i.hint.toLowerCase().includes(f),
    );
  }

  function applySlash(item: SlashItem) {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 24), from, '\n');
    const match = textBefore.match(/(?:^|\s)\/([^\s]*)$/);
    if (match) {
      const token = match[0].trimStart();
      editor.chain().focus().deleteRange({ from: from - token.length, to: from }).run();
    }
    item.run(editor);
    setSlash(null);
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

  const filtered = slash ? filterSlash(slash.filter) : [];

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs hover:bg-panel"
          title="Bloğu yukarı taşı"
          onMouseDown={(e) => {
            e.preventDefault();
            moveBlock(-1);
          }}
        >
          ↑ Blok
        </button>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs hover:bg-panel"
          title="Bloğu aşağı taşı"
          onMouseDown={(e) => {
            e.preventDefault();
            moveBlock(1);
          }}
        >
          ↓ Blok
        </button>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs hover:bg-panel"
          onMouseDown={(e) => {
            e.preventDefault();
            fileRef.current?.click();
          }}
        >
          Görsel ekle
        </button>
        <span className="text-[11px] text-slate-400">
          Dropcursor · görsel yapıştır · / menü (↑↓ Enter)
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || !editor) return;
            const reader = new FileReader();
            reader.onload = () =>
              editor.chain().focus().setImage({ src: String(reader.result), alt: file.name }).run();
            reader.readAsDataURL(file);
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
      {slash && filtered.length > 0 && (
        <div
          className="fixed z-50 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: slash.top, left: slash.left }}
        >
          {filtered.map((item, i) => (
            <button
              key={item.key}
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                i === slash.index ? 'bg-accent/10 text-accent' : 'hover:bg-panel'
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
    </div>
  );
}
