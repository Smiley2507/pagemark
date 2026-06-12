import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PhrasingModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  isLoading?: boolean;
}

export function PhrasingModal({
  isOpen,
  onClose,
  suggestions,
  onSelect,
  isLoading = false,
}: PhrasingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-backdrop px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-overlay shadow-overlay"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-body font-semibold text-text-primary">Phrasing Suggestions</h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-body text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading suggestions...
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion}-${index}`}
                  type="button"
                  className="w-full rounded-md border border-border bg-panel px-3 py-2 text-left text-body text-text-primary transition-colors hover:bg-panel-muted"
                  onClick={() => {
                    onSelect(suggestion);
                    onClose();
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-body text-text-secondary">No suggestions available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
