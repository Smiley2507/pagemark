import React from 'react';
import { useParams } from 'react-router-dom';
import { Activity, GitCommit, FileText, Check, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Mock activity event type
interface ActivityEvent {
  id: number;
  type: 'source_sync' | 'analysis_complete' | 'document_created' | 'section_reviewed' | 'generation_complete';
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function ProjectActivityPage() {
  const { projectId } = useParams<{ projectId: string }>();
  
  // Mock activity data
  const activities: ActivityEvent[] = [
    {
      id: 1,
      type: 'section_reviewed',
      description: 'Section "API Reference" reviewed',
      timestamp: '2026-06-05T10:30:00Z',
    },
    {
      id: 2,
      type: 'generation_complete',
      description: 'Generated 3 sections',
      timestamp: '2026-06-05T09:15:00Z',
    },
    {
      id: 3,
      type: 'document_created',
      description: 'Created document "User Guide"',
      timestamp: '2026-06-04T14:20:00Z',
    },
    {
      id: 4,
      type: 'analysis_complete',
      description: 'Repository analysis completed',
      timestamp: '2026-06-04T13:45:00Z',
    },
    {
      id: 5,
      type: 'source_sync',
      description: 'Synchronized with GitHub',
      timestamp: '2026-06-04T13:40:00Z',
    },
  ];
  
  return (
    <div className="space-y-8">
      {/* Activity Heatmap Placeholder */}
      <section className="space-y-4">
        <h2 className="text-section font-semibold text-text-primary">Activity Overview</h2>
        <div className="rounded-lg border border-separator bg-panel p-6">
          <div className="flex items-center gap-3 text-text-muted">
            <Activity className="h-5 w-5" />
            <span className="text-body">Activity heatmap coming soon</span>
          </div>
        </div>
      </section>
      
      {/* Activity Timeline */}
      <section className="space-y-4">
        <h2 className="text-section font-semibold text-text-primary">Recent Activity</h2>
        
        <div className="space-y-3">
          {activities.map((activity, index) => (
            <ActivityItem key={activity.id} activity={activity} isLast={index === activities.length - 1} />
          ))}
        </div>
      </section>
    </div>
  );
}

interface ActivityItemProps {
  activity: ActivityEvent;
  isLast: boolean;
}

function ActivityItem({ activity, isLast }: ActivityItemProps) {
  const config = {
    source_sync: { icon: GitCommit, color: 'text-status-info-foreground', bg: 'bg-status-info' },
    analysis_complete: { icon: Check, color: 'text-status-success-foreground', bg: 'bg-status-success' },
    document_created: { icon: FileText, color: 'text-status-info-foreground', bg: 'bg-status-info' },
    section_reviewed: { icon: Check, color: 'text-status-success-foreground', bg: 'bg-status-success' },
    generation_complete: { icon: Check, color: 'text-status-generation-foreground', bg: 'bg-status-generation' },
  };
  
  const Icon = config[activity.type]?.icon || AlertCircle;
  const colorClass = config[activity.type]?.color || 'text-text-muted';
  const bgClass = config[activity.type]?.bg || 'bg-panel-muted';
  
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bgClass}`}>
          <Icon className={`h-4 w-4 ${colorClass}`} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-separator mt-2" />}
      </div>
      
      <div className="flex-1 pb-6">
        <div className="rounded-lg border border-separator bg-panel p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-body text-text-primary">{activity.description}</p>
              <p className="text-meta text-text-muted mt-1">
                {new Date(activity.timestamp).toLocaleString()}
              </p>
            </div>
            
            <Badge variant="neutral" showIcon={false}>
              {activity.type.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
