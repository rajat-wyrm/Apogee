import { Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/core';

export const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="mention"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'mention' }), `@${HTMLAttributes.label || HTMLAttributes.id}`];
  },
  renderText({ node }) {
    return `@${node.attrs.label || node.attrs.id}`;
  },
});
