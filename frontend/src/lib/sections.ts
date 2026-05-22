import type { Section } from '@/types';

export function flattenSections(sections: Section[]): Section[] {
  const result: Section[] = [];
  const walk = (nodes: Section[]) => {
    for (const node of nodes) {
      result.push({ ...node, children: undefined });
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(sections);
  return result;
}

export function countSectionProgress(sections: Section[]) {
  const flat = flattenSections(sections);
  const total = flat.length;
  const finalized = flat.filter((s) => s.status === 'finalized').length;
  return { total, finalized, pct: total ? Math.round((finalized / total) * 100) : 0 };
}

export function findSectionInTree(sections: Section[], id: number): Section | undefined {
  for (const s of sections) {
    if (s.id === id) return s;
    if (s.children?.length) {
      const found = findSectionInTree(s.children, id);
      if (found) return found;
    }
  }
  return undefined;
}
