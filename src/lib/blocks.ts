import type { JSONContent } from '@tiptap/react';
import type { Block } from './api';

/** TipTap doc <-> NoteForge block rows */

export function blocksToDoc(blocks: Block[]): JSONContent {
  if (!blocks.length) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  const content = blocks.map((b) => {
    const text = String(b.props.text ?? '');
    switch (b.type) {
      case 'heading':
        return {
          type: 'heading',
          attrs: { level: Number(b.props.level) || 1 },
          content: text ? [{ type: 'text', text }] : undefined,
        };
      case 'bullet':
        return {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined }],
            },
          ],
        };
      case 'todo':
        return {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: Boolean(b.props.checked) },
              content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined }],
            },
          ],
        };
      case 'quote':
        return {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined }],
        };
      case 'code':
        return {
          type: 'codeBlock',
          content: text ? [{ type: 'text', text }] : undefined,
        };
      case 'divider':
        return { type: 'horizontalRule' };
      case 'image':
        return {
          type: 'image',
          attrs: {
            src: String(b.props.src || ''),
            alt: String(b.props.alt || ''),
          },
        };
      case 'drawing':
        return {
          type: 'drawing',
          attrs: {
            sceneId: String(b.props.sceneId || b.id),
            sceneJson: b.props.elements || b.props.scene
              ? JSON.stringify({
                  elements: b.props.elements || [],
                  appState: b.props.appState,
                  files: b.props.files,
                  ...(typeof b.props.scene === 'object' && b.props.scene ? (b.props.scene as object) : {}),
                })
              : b.props.sceneJson
                ? String(b.props.sceneJson)
                : null,
          },
        };
      case 'callout':
        return {
          type: 'callout',
          attrs: { emoji: String(b.props.emoji || '💡') },
          content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined }],
        };
      case 'toggle':
        return {
          type: 'toggleBlock',
          attrs: { open: b.props.open !== false },
          content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined }],
        };
      case 'columns': {
        const cols = Array.isArray(b.props.columns) ? (b.props.columns as string[]) : [text, ''];
        return {
          type: 'columns',
          content: cols.map((c) => ({
            type: 'column',
            content: [
              {
                type: 'paragraph',
                content: c ? [{ type: 'text', text: String(c) }] : undefined,
              },
            ],
          })),
        };
      }
      case 'math':
        return {
          type: 'mathBlock',
          attrs: { tex: String(b.props.tex || text) },
        };
      case 'bookmark':
        return {
          type: 'bookmark',
          attrs: {
            url: String(b.props.url || ''),
            title: String(b.props.title || b.props.url || ''),
          },
        };
      default:
        return {
          type: 'paragraph',
          content: text ? [{ type: 'text', text }] : undefined,
        };
    }
  });
  content.push({ type: 'paragraph' });
  return { type: 'doc', content };
}

export function docToBlocks(doc: JSONContent): {
  blocks: Omit<Block, 'id'>[] & { id?: string }[];
  links: { toPageId: string }[];
} {
  const blocks: { type: string; props: Record<string, unknown>; sortOrder: number }[] = [];
  const links: { toPageId: string }[] = [];
  let order = 1;

  const pushTextLinks = (text: string) => {
    const re = /@\[([^\]]+)\]\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      links.push({ toPageId: m[2] });
    }
    const wiki = /\[\[page:([a-f0-9-]{36})\]\]/gi;
    while ((m = wiki.exec(text))) {
      links.push({ toPageId: m[1] });
    }
  };

  const nodes = doc.content || [];
  for (const node of nodes) {
    if (node.type === 'paragraph') {
      const text = inlineText(node);
      if (text.startsWith('[çizim:')) {
        const sceneId = text.slice(7, -1);
        blocks.push({ type: 'drawing', props: { sceneId, elements: [] }, sortOrder: order++ });
        continue;
      }
      pushTextLinks(text);
      blocks.push({ type: 'paragraph', props: { text }, sortOrder: order++ });
    } else if (node.type === 'heading') {
      const text = inlineText(node);
      pushTextLinks(text);
      blocks.push({
        type: 'heading',
        props: { level: node.attrs?.level || 1, text },
        sortOrder: order++,
      });
    } else if (node.type === 'bulletList') {
      for (const item of node.content || []) {
        const text = inlineText(item);
        pushTextLinks(text);
        blocks.push({ type: 'bullet', props: { text }, sortOrder: order++ });
      }
    } else if (node.type === 'orderedList') {
      for (const item of node.content || []) {
        const text = inlineText(item);
        pushTextLinks(text);
        blocks.push({ type: 'bullet', props: { text, ordered: true }, sortOrder: order++ });
      }
    } else if (node.type === 'taskList') {
      for (const item of node.content || []) {
        const text = inlineText(item);
        pushTextLinks(text);
        blocks.push({
          type: 'todo',
          props: { text, checked: Boolean(item.attrs?.checked) },
          sortOrder: order++,
        });
      }
    } else if (node.type === 'blockquote') {
      const text = inlineText(node);
      blocks.push({ type: 'quote', props: { text }, sortOrder: order++ });
    } else if (node.type === 'codeBlock') {
      const text = inlineText(node);
      blocks.push({ type: 'code', props: { text }, sortOrder: order++ });
    } else if (node.type === 'horizontalRule') {
      blocks.push({ type: 'divider', props: {}, sortOrder: order++ });
    } else if (node.type === 'image') {
      blocks.push({
        type: 'image',
        props: {
          src: String(node.attrs?.src || ''),
          alt: String(node.attrs?.alt || ''),
        },
        sortOrder: order++,
      });
    } else if (node.type === 'drawing') {
      let scene: Record<string, unknown> = {};
      try {
        scene = node.attrs?.sceneJson ? JSON.parse(String(node.attrs.sceneJson)) : {};
      } catch {
        scene = {};
      }
      blocks.push({
        type: 'drawing',
        props: {
          sceneId: String(node.attrs?.sceneId || crypto.randomUUID()),
          sceneJson: node.attrs?.sceneJson || null,
          elements: scene.elements || [],
          appState: scene.appState,
          files: scene.files,
        },
        sortOrder: order++,
      });
    } else if (node.type === 'callout') {
      const text = inlineText(node);
      blocks.push({
        type: 'callout',
        props: { text, emoji: String(node.attrs?.emoji || '💡') },
        sortOrder: order++,
      });
    } else if (node.type === 'toggleBlock') {
      const text = inlineText(node);
      blocks.push({
        type: 'toggle',
        props: { text, open: node.attrs?.open !== false },
        sortOrder: order++,
      });
    } else if (node.type === 'columns') {
      const columns = (node.content || []).map((col) => inlineText(col));
      blocks.push({
        type: 'columns',
        props: { columns, text: columns.join(' | ') },
        sortOrder: order++,
      });
    } else if (node.type === 'mathBlock') {
      blocks.push({
        type: 'math',
        props: { tex: String(node.attrs?.tex || '') },
        sortOrder: order++,
      });
    } else if (node.type === 'bookmark') {
      blocks.push({
        type: 'bookmark',
        props: {
          url: String(node.attrs?.url || ''),
          title: String(node.attrs?.title || ''),
        },
        sortOrder: order++,
      });
    }
  }

  while (
    blocks.length > 1 &&
    blocks[blocks.length - 1].type === 'paragraph' &&
    !(blocks[blocks.length - 1].props.text as string)
  ) {
    blocks.pop();
  }

  return { blocks, links };
}

function inlineText(node: JSONContent | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  return (node.content || []).map(inlineText).join('');
}
