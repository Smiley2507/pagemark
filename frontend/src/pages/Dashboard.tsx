import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { QualityModal } from '@/components/editor/QualityModal';

export const Dashboard: React.FC = () => {
  const [qualityProjectId, setQualityProjectId] = useState<number | null>(null);

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
    </div>
  );
};
