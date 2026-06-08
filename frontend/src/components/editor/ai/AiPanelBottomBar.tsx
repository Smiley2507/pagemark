import { useRef, useState, useEffect } from 'react';
import { ChevronDown, FlaskConical, PenLine, Expand, WandSparkles, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiStore, AVAILABLE_MODELS, MODE_LABELS, MODE_DESCRIPTIONS, type AiMode } from '@/store/aiStore';

const MODE_ICONS: Record<AiMode, typeof MessageSquare> = {
  chat: MessageSquare,
  generate: FlaskConical,
  refine: PenLine,
  expand: Expand,
  auto: WandSparkles,
};

interface AiPanelBottomBarProps {
  activeModelLabel: string;
}

export function AiPanelBottomBar({ activeModelLabel }: AiPanelBottomBarProps) {
  const { activeModelId, activeMode, setActiveModelId, setActiveMode } = useAiStore();
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelRef.current && !modelRef.current.contains(target)) setShowModelDropdown(false);
      if (modeRef.current && !modeRef.current.contains(target)) setShowModeMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === activeModelId);
  const ModeIcon = MODE_ICONS[activeMode];

  return (
    <div className="flex shrink-0 items-center gap-1 border-t border-separator px-3 py-1.5">
      <div ref={modeRef} className="relative">
        <button
          onClick={() => setShowModeMenu(!showModeMenu)}
          className={cn(
            'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors',
            showModeMenu
              ? 'bg-interaction-muted text-interaction-hover'
              : 'text-text-muted hover:bg-panel-muted hover:text-text-primary',
          )}
          aria-label="Select AI mode"
        >
          <ModeIcon className="h-3 w-3" />
          {MODE_LABELS[activeMode]}
        </button>
        {showModeMenu && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-44 rounded-lg border border-separator bg-panel py-1 shadow-lg">
            {(Object.keys(MODE_LABELS) as AiMode[]).map((mode) => {
              const Icon = MODE_ICONS[mode];
              return (
                <button
                  key={mode}
                  onClick={() => { setActiveMode(mode); setShowModeMenu(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
                    mode === activeMode
                      ? 'bg-interaction-muted text-interaction-hover'
                      : 'text-text-muted hover:bg-panel-muted hover:text-text-primary',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{MODE_LABELS[mode]}</div>
                    <div className="text-[10px] text-text-muted">{MODE_DESCRIPTIONS[mode]}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div ref={modelRef} className="relative">
        <button
          onClick={() => setShowModelDropdown(!showModelDropdown)}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-text-muted transition-colors hover:bg-panel-muted hover:text-text-primary"
          aria-label="Select AI model"
        >
          {currentModel?.label || activeModelLabel}
          <ChevronDown className="h-3 w-3" />
        </button>
        {showModelDropdown && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-48 rounded-lg border border-separator bg-panel py-1 shadow-lg">
            {AVAILABLE_MODELS.map((m) => {
              const isActive = m.id === activeModelId;
              return (
                <button
                  key={m.id}
                  onClick={() => { setActiveModelId(m.id); setShowModelDropdown(false); }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors',
                    isActive
                      ? 'bg-interaction-muted text-interaction-hover'
                      : 'text-text-muted hover:bg-panel-muted hover:text-text-primary',
                  )}
                >
                  <span>{m.label}</span>
                  <span className="text-[10px] text-text-muted">{m.provider}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
