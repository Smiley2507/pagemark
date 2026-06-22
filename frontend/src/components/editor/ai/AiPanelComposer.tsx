import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Paperclip, ChevronDown, FileText, Book, FileCode, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiStore } from '@/store/aiStore';
import type { AiAttachment } from '@/store/aiStore';

type ReferenceKind = 'section' | 'document' | 'source' | 'template';

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
  activeModelLabel: string;
  hasActiveProvider: boolean;
  models: { id: string; label?: string }[];
  selectedModel: string | null;
  onModelChange: (modelId: string) => void;
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
  activeModelLabel,
  hasActiveProvider,
  models,
  selectedModel,
  onModelChange,
}: AiPanelComposerProps) {
  const { addAttachment } = useAiStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionKind, setMentionKind] = useState<ReferenceKind>('section');
  const mentionTriggerPos = useRef<number | null>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  const [showModelMenu, setShowModelMenu] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelRef.current && !modelRef.current.contains(target)) setShowModelMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  const insertMention = (label: string, id?: string) => {
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

    addAttachment({
      id: `ref-${mentionKind}-${id || label}`,
      type: mentionKind,
      label,
      reference: label,
      referenceId: id && /^\d+$/.test(id) ? Number(id) : undefined,
    });
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
    <div className="rounded-xl border border-input focus-within:border-interaction transition-colors">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Message Mark... (type @ to reference)"
        className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        rows={1}
        data-ai-input="true"
        aria-label="Message Mark"
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
                  onClick={() => insertMention(item.label, item.id)}
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
        <div className="flex items-center gap-0.5">
          <button
            onClick={onAttachClick}
            className="rounded p-1 text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
            aria-label="Attach resource"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>

          <div ref={modelRef} className="relative">
            <button
              onClick={() => setShowModelMenu((v) => !v)}
              className={cn(
                'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors',
                showModelMenu
                  ? 'bg-interaction-muted text-interaction-hover'
                  : 'text-text-muted hover:bg-panel-muted hover:text-text-primary',
              )}
              title={activeModelLabel}
            >
              <span className={hasActiveProvider ? 'text-text-secondary' : 'text-warning'}>
                {hasActiveProvider ? selectedModel || 'Select model' : 'No provider'}
              </span>
              <ChevronDown className={`h-2.5 w-2.5 transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
            </button>
            {showModelMenu && hasActiveProvider && (
              <div className="absolute bottom-full left-0 z-50 mb-1 w-44 rounded-lg border border-separator bg-panel py-1 shadow-lg">
                {models.length > 0 ? (
                  models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => { onModelChange(model.id); setShowModelMenu(false); }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
                        model.id === selectedModel
                          ? 'bg-interaction-muted text-interaction-hover'
                          : 'text-text-muted hover:bg-panel-muted hover:text-text-primary',
                      )}
                    >
                      {model.label || model.id}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-1.5 text-[11px] text-text-muted">No models available</p>
                )}
              </div>
            )}
          </div>
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
