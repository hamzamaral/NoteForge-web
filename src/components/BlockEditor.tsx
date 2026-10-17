import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useEffect, useRef, useState } from 'react';
import type { Block } from '@/lib/api';
import { blocksToDoc, docToBlocks } from '@/lib/blocks';

const SLASH_ITEMS = [
  { key: 'paragraph', label: 'Paragraf', run: (ed: ReturnType<typeof useEditor>) => ed?.chain().focus().setParagraph().run() },
  { key: 'h1', label: 'Başlık 1', run: (ed: ReturnType<typeof useEditor>) => ed?.chain().focus().toggleHeading({ level: 1 }).run() },
  { key: 'h2', label: 'Başlık 2', run: (ed: ReturnType<typeof useEditor>) => ed?.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: 'bullet', label: 'Madde', run: (ed: ReturnType<typeof useEditor>) => ed?.chain().focus().toggleBulletList().run() },
  { key: 'todo', label: 'Yapılacak', run: (ed: ReturnType<typeof useEditor>) => ed?.chain().focus().toggleTaskList().run() },
  { key: 'quote', label: 'Alıntı', run: (ed: ReturnType<typeof useEditor>) => ed?.chain().focus().toggleBlockquote().run() },
  { key: 'code', label: 'Kod', run: (ed: ReturnType<typeof useEditor>) => ed?.chain().focus().toggleCodeBlock().run() },
  { key: 'hr', label: 'Ayırıcı', run: (ed: ReturnType<typeof useEditor>) => ed?.chain().focus().setHorizontalRule().run() },
  {
    key: 'drawing',
    label: 'Çizim',
    run: (ed: ReturnType<typeof useEditor>) =>
      ed?.chain().focus().insertContent(`[çizim:${crypto.randomUUID()}]`).run(),
  },
];

type Props = {
  blocks: Block[];
  onChange: (payload: ReturnType<typeof docToBlocks>) => void;
};

export function BlockEditor({ blocks, onChange }: Props) {
  const [slash, setSlash] = useState<{ top: number; left: number; filter: string } | null>(null);
  const savingRef = useRef(false);
  const debounce = useRef<number>();

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: 'Yazmaya başla, veya / ile komut…',
      }),
    ],
    content: blocksToDoc(blocks),
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none px-1',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === '/') {
          // open slash after character inserted — handled in onUpdate
        }
        if (slash && event.key === 'Escape') {
          setSlash(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 20), from, '\n');
      const match = textBefore.match(/(?:^|\s)\/(\w*)$/);
      if (match) {
        const coords = ed.view.coordsAtPos(from);
        setSlash({ top: coords.bottom + 6, left: coords.left, filter: match[1] || '' });
      } else {
        setSlash(null);
      }
      window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => {
        if (savingRef.current) return;
        onChange(docToBlocks(ed.getJSON()));
      }, 500);
    },
  });

  useEffect(() => {
    if (!editor) return;
    savingRef.current = true;
    editor.commands.setContent(blocksToDoc(blocks), { emitUpdate: false });
    savingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks.map((b) => b.id).join(',')]);

  const filtered = SLASH_ITEMS.filter((i) =>
    i.label.toLowerCase().includes(slash?.filter.toLowerCase() || '') ||
    i.key.includes(slash?.filter.toLowerCase() || ''),
  );

  function pick(item: (typeof SLASH_ITEMS)[0]) {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 20), from, '\n');
    const match = textBefore.match(/(?:^|\s)\/(\w*)$/);
    if (match) {
      const delFrom = from - match[0].trimStart().length;
      editor.chain().focus().deleteRange({ from: delFrom, to: from }).run();
    }
    item.run(editor);
    setSlash(null);
  }

  return (
    <div className="relative">
      <EditorContent editor={editor} />
      {slash && filtered.length > 0 && (
        <div
          className="fixed z-50 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: slash.top, left: slash.left }}
        >
          {filtered.map((item) => (
            <button
              key={item.key}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-panel"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
