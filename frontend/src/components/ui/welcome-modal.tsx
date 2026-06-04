import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, BookOpen, Users } from 'lucide-react';

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

const steps = [
  {
    icon: BookOpen,
    title: 'Create a project',
    description: 'Import your codebase from Git or ZIP, then let AI generate the initial documentation outline.',
  },
  {
    icon: Sparkles,
    title: 'Refine with AI',
    description: 'Use the AI panel to improve sections, fix tone, or expand content — all inline.',
  },
  {
    icon: Users,
    title: 'Review & publish',
    description: 'Submit for review, track quality scores, and finalize when ready.',
  },
];

export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      onClose();
      navigate('/new-project');
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card rounded-xl border border-border p-8 w-full max-w-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-medium text-muted-foreground">
                Step {step + 1} of {steps.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center text-center"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  {(() => {
                    const Icon = steps[step].icon;
                    return <Icon className="h-7 w-7 text-primary" />;
                  })()}
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {steps[step].title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {steps[step].description}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex gap-2">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i === step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleSkip}>
                Skip tour
              </Button>
              <Button onClick={handleNext}>
                {step < steps.length - 1 ? 'Next' : 'Create first project'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
