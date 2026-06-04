import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { QualityModal } from '@/components/editor/QualityModal';
import { WelcomeModal } from '@/components/ui/welcome-modal';
import { useAuthStore } from '@/store/authStore';

export const Dashboard: React.FC = () => {
  const [qualityProjectId, setQualityProjectId] = useState<number | null>(null);
  const showWelcome = useAuthStore(s => s.showWelcome);
  const setShowWelcome = useAuthStore(s => s.setShowWelcome);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 pt-6">
        <Outlet
          context={{
            setQualityProjectId
          }}
        />
      </div>

      {qualityProjectId !== null && (
        <QualityModal
          projectId={qualityProjectId}
          open={true}
          onClose={() => setQualityProjectId(null)}
        />
      )}

      <WelcomeModal
        open={showWelcome}
        onClose={() => setShowWelcome(false)}
      />
    </div>
  );
};
