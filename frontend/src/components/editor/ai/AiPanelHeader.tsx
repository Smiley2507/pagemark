import { useRef, useState, useEffect } from 'react';
import { Sparkles, Settings } from 'lucide-react';

interface AiPanelHeaderProps {
  temperature: number;
  maxTokens: number;
  onTemperatureChange: (t: number) => void;
  onMaxTokensChange: (t: number) => void;
}

export function AiPanelHeader({
  temperature,
  maxTokens,
  onTemperatureChange,
  onMaxTokensChange,
}: AiPanelHeaderProps) {
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (settingsRef.current && !settingsRef.current.contains(target)) setShowSettings(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-separator px-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 shrink-0 text-indigo-500" />
        <span className="text-sm font-semibold text-text-primary">Mark</span>
      </div>

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
    </div>
  );
}
