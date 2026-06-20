import type { AIProposedChange } from '@/api/ai';

function textValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatSectionLabel(value: unknown): string {
  if (!value || typeof value !== 'object') return 'Untitled section';
  const record = value as Record<string, unknown>;
  const heading = textValue(record.heading, textValue(record.title, 'Untitled section'));
  const order = numberValue(record.order_index);
  return order === null ? heading : `${order + 1}. ${heading}`;
}

export function proposedChangePreviewText(change: AIProposedChange): string {
  const before = change.before ?? {};
  const after = change.after ?? {};

  if (change.change_type === 'rename_section') {
    const beforeHeading = textValue(before.heading, textValue(before.title, 'Current section'));
    const afterHeading = textValue(after.heading, textValue(after.title, beforeHeading));
    return `Rename section\n\nBefore: ${beforeHeading}\nAfter: ${afterHeading}`;
  }

  if (change.change_type === 'add_section') {
    const heading = textValue(after.heading, textValue(after.title, 'Untitled section'));
    const parent = textValue(after.parent_heading, after.parent_id ? `Parent section ${after.parent_id}` : 'Top level');
    const order = numberValue(after.order_index);
    const content = textValue(after.content_md, textValue(after.content));
    return [
      'Add section',
      '',
      `Heading: ${heading}`,
      `Placement: ${parent}${order === null ? '' : `, position ${order + 1}`}`,
      content ? `Initial draft:\n${content}` : 'Initial draft: empty',
    ].join('\n');
  }

  if (change.change_type === 'reorder_sections') {
    const order = Array.isArray(after.order) ? after.order : [];
    if (order.length === 0) return 'Reorder sections\n\nNo section order details were provided.';
    return [
      'Reorder sections',
      '',
      ...order.map((item) => formatSectionLabel(item)),
    ].join('\n');
  }

  if (change.change_type === 'apply_outline_diff') {
    const added = Array.isArray(after.added_sections) ? after.added_sections : [];
    const removed = Array.isArray(after.removed_section_ids) ? after.removed_section_ids : [];
    const renamed = Array.isArray(after.renamed_sections) ? after.renamed_sections : [];
    const reordered = Array.isArray(after.order) ? after.order : [];
    const lines = ['Apply outline diff', ''];
    if (added.length > 0) {
      lines.push('Added sections:', ...added.map((item) => `+ ${formatSectionLabel(item)}`), '');
    }
    if (renamed.length > 0) {
      lines.push(
        'Renamed sections:',
        ...renamed.map((item) => {
          if (!item || typeof item !== 'object') return '- Unknown rename';
          const record = item as Record<string, unknown>;
          return `- ${textValue(record.before_heading, 'Current section')} -> ${textValue(record.after_heading, 'Updated section')}`;
        }),
        '',
      );
    }
    if (removed.length > 0) {
      lines.push('Removed section IDs:', ...removed.map((id) => `- ${String(id)}`), '');
    }
    if (reordered.length > 0) {
      lines.push('New order:', ...reordered.map((item) => formatSectionLabel(item)));
    }
    return lines.join('\n').trim() || 'Apply outline diff\n\nNo outline diff details were provided.';
  }

  return change.preview_markdown || JSON.stringify(after, null, 2);
}

export function proposedChangeDiffText(change: AIProposedChange): {
  beforeText: string;
  afterText: string;
  isTextChange: boolean;
} {
  const beforeText = typeof change.before?.content_md === 'string' ? change.before.content_md : '';
  const afterText = typeof change.after?.content_md === 'string'
    ? change.after.content_md
    : typeof change.after?.content === 'string'
      ? change.after.content
      : change.preview_markdown || '';

  return {
    beforeText,
    afterText,
    isTextChange: change.change_type === 'rewrite_selection'
      || change.change_type === 'generate_section'
      || change.change_type === 'insert_at_cursor'
      || change.change_type === 'replace_selection',
  };
}
