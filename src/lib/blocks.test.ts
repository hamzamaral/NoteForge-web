import { describe, expect, it } from 'vitest';
import { blocksToDoc, docToBlocks } from './blocks';
import type { Block } from './api';

describe('blocks drawing node', () => {
  it('round-trips drawing as TipTap drawing node', () => {
    const blocks: Block[] = [
      {
        id: '1',
        type: 'drawing',
        props: { sceneId: 'abc', elements: [{ id: 'e1' }] },
        sortOrder: 1,
      },
    ];
    const doc = blocksToDoc(blocks);
    expect(doc.content?.[0]?.type).toBe('drawing');
    const back = docToBlocks(doc);
    expect(back.blocks[0].type).toBe('drawing');
    expect(back.blocks[0].props.sceneId).toBe('abc');
  });

  it('persists callout and toggle', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { emoji: '💡' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hey' }] }],
        },
        {
          type: 'toggleBlock',
          attrs: { open: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 't' }] }],
        },
      ],
    };
    const { blocks } = docToBlocks(doc);
    expect(blocks.map((b) => b.type)).toEqual(['callout', 'toggle']);
  });
});
