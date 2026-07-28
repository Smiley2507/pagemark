import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { WikiLink } from './extensions/WikiLink'
import { Callout } from './extensions/Callout'
import { Figure } from './extensions/Figure'
import { MermaidDiagram } from './extensions/MermaidDiagram'
const lowlight = createLowlight(common)

export function createExtensions(placeholderText?: string, collaborationExtension?: any) {
  return [
    collaborationExtension,
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: false,
      link: false,
      undoRedo: collaborationExtension ? false : undefined,
    }),
    Markdown.configure({
      indentation: { style: 'space', size: 2 },
    }),
    Link.configure({
      openOnClick: true,
      HTMLAttributes: { class: 'cm-lp-link' },
    }),
    Image.configure({
      allowBase64: false,
      HTMLAttributes: { class: 'cm-lp-image' },
    }),
    Figure,
    MermaidDiagram,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    CodeBlockLowlight.configure({ lowlight }),
    WikiLink,
    Callout,
    Placeholder.configure({
      placeholder: placeholderText ?? "Type '/' for commands",
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
    }),
  ].filter(Boolean)
}
