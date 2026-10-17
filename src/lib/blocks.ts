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
      case 'drawing':
        return {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: `[çizim:${String(b.props.sceneId || b.id)}]`,
            },
          ],
        };
      default:
        return {
          type: 'paragraph',
          content: text ? [{ type: 'text', text }] : undefined,
        };
    }
  });
  // Always keep a trailing empty paragraph for click-to-write
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
    }
  }

  // Drop final empty trailing paragraphs beyond one
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
