import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState } from 'react';
import { DrawingBlock } from '@/components/DrawingBlock';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawing: {
      insertDrawing: (attrs?: { sceneId?: string }) => ReturnType;
    };
    callout: {
      insertCallout: () => ReturnType;
    };
    toggleBlock: {
      insertToggle: () => ReturnType;
    };
    columns: {
      insertColumns: () => ReturnType;
    };
    mathBlock: {
      insertMath: (tex?: string) => ReturnType;
    };
    bookmark: {
      insertBookmark: (url?: string) => ReturnType;
    };
  }
}

function DrawingView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const [open, setOpen] = useState(false);
  const sceneId = String(node.attrs.sceneId || '');
  let initial: unknown;
  try {
    initial = node.attrs.sceneJson ? JSON.parse(String(node.attrs.sceneJson)) : undefined;
  } catch {
    initial = undefined;
  }

  return (
    <NodeViewWrapper
      className={`my-3 rounded-xl border ${selected ? 'border-accent ring-2 ring-accent/20' : 'border-slate-200'}`}
      data-drawing={sceneId}
    >
      {!open ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 bg-panel/60 px-3 py-3 text-left text-sm"
          onClick={() => setOpen(true)}
        >
          <span>
            ✏️ Çizim bloğu{' '}
            <span className="text-[11px] text-slate-400">{sceneId.slice(0, 8)}</span>
          </span>
          <span className="text-xs text-accent">Aç</span>
        </button>
      ) : (
        <DrawingBlock
          title="Çizim"
          initialData={initial}
          onSave={(data) => {
            updateAttributes({ sceneJson: JSON.stringify(data) });
          }}
          onRemove={() => deleteNode()}
        />
      )}
    </NodeViewWrapper>
  );
}

export const DrawingNode = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      sceneId: { default: null },
      sceneJson: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-drawing]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-drawing': HTMLAttributes.sceneId || '' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DrawingView);
  },
  addCommands() {
    return {
      insertDrawing:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              sceneId: attrs?.sceneId || crypto.randomUUID(),
              sceneJson: null,
            },
          }),
    };
  },
});

export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  addAttributes() {
    return { emoji: { default: '💡' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': HTMLAttributes.emoji || '💡',
        class: 'nf-callout my-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2',
      }),
      0,
    ];
  },
  addCommands() {
    return {
      insertCallout:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { emoji: '💡' },
            content: [{ type: 'paragraph' }],
          }),
    };
  },
});

export const ToggleNode = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  addAttributes() {
    return { open: { default: true } };
  },
  parseHTML() {
    return [{ tag: 'details[data-toggle]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, {
        'data-toggle': '',
        open: HTMLAttributes.open ? 'true' : undefined,
        class: 'nf-toggle my-2 rounded-lg border border-slate-200 px-3 py-2',
      }),
      ['summary', { class: 'cursor-pointer font-medium text-sm' }, '▸ Toggle'],
      ['div', 0],
    ];
  },
  addCommands() {
    return {
      insertToggle:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { open: true },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Toggle içeriği' }] }],
          }),
    };
  },
});

export const ColumnNode = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-column]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-column': '',
        class: 'nf-column min-w-0 flex-1 rounded border border-dashed border-slate-200 p-2',
      }),
      0,
    ];
  },
});

export const ColumnsNode = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column column+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-columns]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-columns': '',
        class: 'nf-columns my-3 flex gap-2',
      }),
      0,
    ];
  },
  addCommands() {
    return {
      insertColumns:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sol kolon' }] }],
              },
              {
                type: 'column',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sağ kolon' }] }],
              },
            ],
          }),
    };
  },
});

function MathView({ node, updateAttributes, selected }: NodeViewProps) {
  const tex = String(node.attrs.tex || '');
  return (
    <NodeViewWrapper
      className={`my-2 rounded-lg border bg-slate-50 px-3 py-2 font-mono text-sm ${
        selected ? 'border-accent' : 'border-slate-200'
      }`}
      data-math=""
    >
      <label className="block text-[10px] uppercase text-slate-400">KaTeX / math</label>
      <input
        className="mt-1 w-full bg-transparent outline-none"
        value={tex}
        onChange={(e) => updateAttributes({ tex: e.target.value })}
        placeholder="E = mc^2"
      />
      <p className="mt-1 text-center text-base" aria-hidden>
        {tex ? `$$ ${tex} $$` : '∅'}
      </p>
    </NodeViewWrapper>
  );
}

export const MathNode = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { tex: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-math]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math': '' }), HTMLAttributes.tex || ''];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },
  addCommands() {
    return {
      insertMath:
        (tex) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { tex: tex || '' } }),
    };
  },
});

export const BookmarkNode = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-bookmark]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-bookmark': '',
        class: 'my-2 rounded-lg border border-slate-200 px-3 py-2 text-sm',
      }),
      ['a', { href: HTMLAttributes.url, target: '_blank', rel: 'noreferrer' }, HTMLAttributes.title || HTMLAttributes.url || 'Bookmark'],
    ];
  },
  addCommands() {
    return {
      insertBookmark:
        (url) =>
        ({ commands }) => {
          const u = url || window.prompt('URL') || '';
          if (!u) return false;
          return commands.insertContent({
            type: this.name,
            attrs: { url: u, title: u.replace(/^https?:\/\//, '').slice(0, 48) },
          });
        },
    };
  },
});
