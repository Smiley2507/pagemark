import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Paperclip, FileText, Book, FileCode, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiStore, MODE_LABELS } from '@/store/aiStore';
import type { AiAttachment, AiMode } from '@/store/aiStore';

type ReferenceKind = 'section' | 'document' | 'source' | 'template';

const MODE_PLACEHOLDERS: Record<AiMode, string> = {
  chat: 'Message Mark... (type @ to reference)',
  generate: 'Describe what to generate...',
  refine: 'How should this be improved?',
  expand: 'What detail should be added?',
  auto: 'Ask Mark anything...',
};

const REFERENCE_OPTIONS: { kind: ReferenceKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: 'section', label: 'Section', icon: FileText },
  { kind: 'document', label: 'Document', icon: Book },
  { kind: 'source', label: 'Source', icon: FileCode },
  { kind: 'template', label: 'Template', icon: Layout },
];

interface AiPanelComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  disabled: boolean;
  activeSectionId: number | null;
  sections: { id: number; heading: string }[];
  onAttachClick?: () => void;
}

export function AiPanelComposer({
  value,
  onChange,
  onSend,
  isStreaming,
  disabled,
  activeSectionId,
  sections,
  onAttachClick,
}: AiPanelComposerProps) {
  const { activeMode, addAttachment } = useAiStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionKind, setMentionKind] = useState<ReferenceKind>('section');
  const mentionTriggerPos = useRef<number | null>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const parseMentions = useCallback((text: string): { cleanText: string; references: string[] } => {
    const refs: string[] = [];
    const clean = text.replace(/@(\w+)/g, (_match, name) => {
      refs.push(name);
      return `@${name}`;
    });
    return { cleanText: clean, references: refs };
  }, []);

  const getSendPayload = useCallback((): string => {
    const { cleanText, references } = parseMentions(value);
    return references.length > 0
      ? `${cleanText}\n\n(referencing: ${references.join(', ')})`
      : cleanText;
  }, [value, parseMentions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      mentionTriggerPos.current = cursorPos;
      setMentionSearch(atMatch[1].toLowerCase());
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSend();
    }
    if (e.key === 'Enter' && !e.shiftKey && !showMentionDropdown) {
      e.preventDefault();
      onSend();
    }
  };

  const insertMention = (label: string) => {
    if (mentionTriggerPos.current === null || !textareaRef.current) return;
    const cursorPos = mentionTriggerPos.current;
    const currentVal = value;
    const textBefore = currentVal.slice(0, cursorPos);
    const textAfter = currentVal.slice(cursorPos);
    const atIndex = textBefore.lastIndexOf('@');
    const referencePrefix =
      mentionKind === 'section' ? '@section:' :
      mentionKind === 'document' ? '@document:' :
      mentionKind === 'source' ? '@source:' : '@template:';
    const newValue = textBefore.slice(0, atIndex) + `${referencePrefix}${label} ` + textAfter;

    onChange(newValue);
    setShowMentionDropdown(false);
    mentionTriggerPos.current = null;
    textareaRef.current.focus();
    const newCursor = atIndex + referencePrefix.length + label.length + 1;
    textareaRef.current.setSelectionRange(newCursor, newCursor);

    addAttachment({ id: `ref-${label}`, type: mentionKind, label, reference: label });
  };

  const filteredMentions = mentionKind === 'section'
    ? sections.filter((s) => s.heading.toLowerCase().includes(mentionSearch)).slice(0, 8)
    : [];

  const referenceItems = mentionKind === 'section'
    ? filteredMentions.map((s) => ({ id: s.id.toString(), label: s.heading }))
    : mentionKind === 'document'
    ? [{ id: 'current', label: 'Current Document' }]
    : mentionKind === 'source'
    ? [{ id: 'repo', label: 'Repository source' }]
    : [{ id: 'template', label: 'Document template' }];

  return (
    <div className="rounded-xl border border-input bg-panel focus-within:border-interaction transition-colors">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={MODE_PLACEHOLDERS[activeMode]}
        className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        rows={1}
        data-ai-input="true"
        aria-label={MODE_PLACEHOLDERS[activeMode]}
      />

      {showMentionDropdown && (
        <div ref={mentionDropdownRef} className="border-t border-separator px-2 py-1">
          <div className="mb-1 flex gap-1 border-b border-separator pb-1">
            {REFERENCE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.kind}
                  onClick={(e) => { e.stopPropagation(); setMentionKind(opt.kind); }}
                  className={cn(
                    'flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors',
                    mentionKind === opt.kind
                      ? 'bg-interaction-muted text-interaction-hover'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {referenceItems.length === 0 ? (
            <p className="px-2 py-1 text-[10px] text-text-muted">
              {mentionKind === 'section' ? 'No matching sections' :
               mentionKind === 'document' ? 'Reference current document context' :
               mentionKind === 'source' ? 'Reference repository source' :
               'Reference document template'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {referenceItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => insertMention(item.label)}
                  className="w-full rounded px-2 py-1 text-left text-xs text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
                >
                  @{mentionKind}:{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-2 pb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onAttachClick}
            className="rounded p-1 text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
            aria-label="Attach resource"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-text-muted">
            {activeMode === 'auto' ? '' : MODE_LABELS[activeMode] + ' mode'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">
            {isStreaming ? 'Generating...' : disabled ? 'Select a section' : ''}
          </span>
          <button
            disabled={!value.trim() || isStreaming || disabled}
            onClick={onSend}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-30"
            aria-label="Send message"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
