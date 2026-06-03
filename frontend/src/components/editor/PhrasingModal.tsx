import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles } from 'lucide-react';

interface PhrasingModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  isLoading: boolean;
}

export function PhrasingModal({ isOpen, onClose, suggestions, onSelect, isLoading }: PhrasingModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Phrasing Suggestions
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Generating alternatives...</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {suggestions.map((s, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="text-left justify-start h-auto p-3 hover:bg-primary/5"
                  onClick={() => onSelect(s)}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="text-xs font-bold text-muted-foreground uppercase">
                      {i === 0 ? 'Professional' : i === 1 ? 'Academic' : 'Concise'}
                    </div>
                    <span className="text-sm flex-1">{s}</span>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
