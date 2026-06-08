import { useRef, useState, useEffect } from 'react';
import { Sparkles, ChevronDown, Settings, X, FlaskConical, PenLine, Expand, WandSparkles, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAiStore, AVAILABLE_MODELS, MODE_LABELS, MODE_DESCRIPTIONS, type AiMode, type AiModelId } from '@/store/aiStore';

const MODE_ICONS: Record<AiMode, typeof MessageSquare> = {
  chat: MessageSquare,
  generate: FlaskConical,
  refine: PenLine,
  expand: Expand,
  auto: WandSparkles,
};

interface AiPanelHeaderProps {
  activeSectionHeading: string | null;
  activeModelLabel: string;
  temperature: number;
  maxTokens: number;
  onTemperatureChange: (t: number) => void;
  onMaxTokensChange: (t: number) => void;
}

export function AiPanelHeader({
  activeSectionHeading,
  activeModelLabel,
  temperature,
  maxTokens,
  onTemperatureChange,
  onMaxTokensChange,
}: AiPanelHeaderProps) {
  const { activeModelId, activeMode, setActiveModelId, setActiveMode } = useAiStore();
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelRef.current && !modelRef.current.contains(target)) setShowModelDropdown(false);
      if (settingsRef.current && !settingsRef.current.contains(target)) setShowSettings(false);
      if (modeRef.current && !modeRef.current.contains(target)) setShowModeMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === activeModelId);
  const ModeIcon = MODE_ICONS[activeMode];

  return (
    <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-separator px-3">
      <Sparkles className="h-4 w-4 shrink-0 text-indigo-500" />
      <span className="text-sm font-semibold text-text-primary">Mark</span>

      <div className="ml-2 flex items-center gap-1">
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
            <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-separator bg-panel py-1 shadow-lg">
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
            <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-separator bg-panel py-1 shadow-lg">
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

      <div className="ml-auto flex items-center gap-1">
        <div ref={settingsRef} className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
            aria-label="AI settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
          {showSettings && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-separator bg-panel p-3 shadow-lg">
              <div className="mb-2 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-text-muted">Temperature</label>
                  <span className="text-[11px] tabular-nums text-text-muted">{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={temperature}
                  onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-text-muted">Max tokens</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => onMaxTokensChange(Math.max(100, parseInt(e.target.value) || 2000))}
                  className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                  min={100}
                  step={100}
                />
              </div>
            </div>
          )}
        </div>

        {activeSectionHeading && (
          <span className="max-w-[100px] truncate text-[11px] text-text-muted">
            @{activeSectionHeading}
          </span>
        )}
      </div>
    </div>
  );
}
