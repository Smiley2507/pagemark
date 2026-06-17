import { describe, expect, it } from 'vitest';
import type { AIProposedChange } from '@/api/ai';
import { proposedChangeDiffText, proposedChangePreviewText } from '@/lib/ai-proposed-change-preview';

function change(overrides: Partial<AIProposedChange>): AIProposedChange {
  return {
    id: 1,
    work_run_id: 2,
    document_id: 3,
    change_type: 'rewrite_selection',
    status: 'proposed',
    title: 'Change',
    after: {},
    created_at: '2026-06-17T00:00:00Z',
    ...overrides,
  };
}

describe('AI proposed change previews', () => {
  it('keeps section prose changes in diff mode', () => {
    const result = proposedChangeDiffText(change({
      change_type: 'rewrite_selection',
      before: { content_md: 'Old' },
      after: { content_md: 'New' },
    }));

    expect(result).toEqual({
      beforeText: 'Old',
      afterText: 'New',
      isTextChange: true,
    });
  });

  it('formats rename section changes without raw JSON', () => {
    const result = proposedChangePreviewText(change({
      change_type: 'rename_section',
      before: { heading: 'Overview' },
      after: { heading: 'Operations Overview' },
    }));

    expect(result).toContain('Rename section');
    expect(result).toContain('Before: Overview');
    expect(result).toContain('After: Operations Overview');
    expect(result).not.toContain('{');
  });

  it('formats add section changes with placement and initial content', () => {
    const result = proposedChangePreviewText(change({
      change_type: 'add_section',
      after: {
        heading: 'Runbook',
        parent_heading: 'Operations',
        order_index: 2,
        content_md: 'Initial draft',
      },
    }));

    expect(result).toContain('Add section');
    expect(result).toContain('Heading: Runbook');
    expect(result).toContain('Placement: Operations, position 3');
    expect(result).toContain('Initial draft');
  });

  it('formats reorder section changes as an ordered list', () => {
    const result = proposedChangePreviewText(change({
      change_type: 'reorder_sections',
      after: {
        order: [
          { section_id: 20, heading: 'Endpoints', order_index: 0 },
          { section_id: 10, heading: 'Overview', order_index: 1 },
        ],
      },
    }));

    expect(result).toContain('Reorder sections');
    expect(result).toContain('1. Endpoints');
    expect(result).toContain('2. Overview');
  });

  it('formats outline diffs by operation group', () => {
    const result = proposedChangePreviewText(change({
      change_type: 'apply_outline_diff',
      after: {
        added_sections: [{ heading: 'Troubleshooting', order_index: 3 }],
        renamed_sections: [
          { before_heading: 'API', after_heading: 'API Reference' },
        ],
        removed_section_ids: [42],
        order: [{ heading: 'Overview', order_index: 0 }],
      },
    }));

    expect(result).toContain('Apply outline diff');
    expect(result).toContain('Added sections:');
    expect(result).toContain('+ 4. Troubleshooting');
    expect(result).toContain('API -> API Reference');
    expect(result).toContain('Removed section IDs:');
    expect(result).toContain('- 42');
    expect(result).toContain('New order:');
  });
});
