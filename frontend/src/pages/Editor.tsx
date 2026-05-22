import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Editor three-panel layout will be implemented in a follow-up task. */
export const Editor = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 items-center gap-4 border-b border-border px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-meta text-muted-foreground">Project #{id}</span>
      </header>
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="max-w-md text-center text-meta text-muted-foreground">
          The three-panel editor layout is not built yet. Open the analysis page or return to the
          dashboard to continue.
        </p>
      </div>
    </div>
  );
};
