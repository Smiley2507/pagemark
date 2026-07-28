import { useEffect, useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { adminApi } from '@/api/admin';
import type { SuperuserRequest } from '@/api/admin';

export function AdminPendingPage() {
  const [requests, setRequests] = useState<SuperuserRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = () => {
    setLoading(true);
    adminApi.getPendingRequests()
      .then(setRequests)
      .catch(() => toast.error('Failed to load pending requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') {
        await adminApi.approveRequest(id);
        toast.success('Request approved');
      } else {
        await adminApi.rejectRequest(id);
        toast.success('Request rejected');
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Action failed');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Pending Admin Requests</h1>
        <p className="text-xs text-text-muted">
          Users requesting superuser access — review and approve or reject
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-muted">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <Clock size={32} className="mb-2 opacity-50" />
          <p>No pending requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Surface key={req.id} padding="default">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-text-primary">{req.email}</h3>
                  {req.name && (
                    <p className="text-sm text-text-muted">{req.name}</p>
                  )}
                  {req.justification && (
                    <p className="mt-2 text-sm text-text-muted italic">
                      "{req.justification}"
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text-muted">
                    Requested {new Date(req.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleAction(req.id, 'approve')}
                  >
                    <Check size={14} />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleAction(req.id, 'reject')}
                  >
                    <X size={14} />
                    Reject
                  </Button>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
