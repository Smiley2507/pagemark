import { useEffect, useState } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';
import { adminApi } from '@/api/admin';
import type { AdminOrganization } from '@/api/admin';

export function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  const fetchOrgs = () => {
    setLoading(true);
    adminApi.listOrganizations({ search: search || undefined, page, page_size: pageSize })
      .then((res) => {
        setOrgs(res.organizations);
        setTotal(res.total);
      })
      .catch(() => toast.error('Failed to load organizations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrgs(); }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrgs();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Organizations</h1>
        <span className="text-xs text-text-muted">{total} total</span>
      </div>

      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug..."
            className="w-full rounded-lg border border-border bg-panel py-2 pl-10 pr-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
          />
        </div>
      </form>

      <Surface padding="none">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-panel-muted">
              <th className="px-4 py-2 text-xs font-medium text-text-muted">ID</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Name</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Slug</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Type</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Members</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Projects</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Quality</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">Loading...</td>
              </tr>
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">No organizations found</td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr key={org.id} className="border-b border-border last:border-0 hover:bg-panel-muted/50">
                  <td className="px-4 py-2.5 text-xs text-text-muted">{org.id}</td>
                  <td className="px-4 py-2.5 text-text-primary">{org.name}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted font-mono">{org.slug}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={org.personal ? 'info' : 'generation'} showIcon={false}>
                      {org.personal ? 'Personal' : 'Team'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">{org.member_count}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">{org.project_count}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">{org.quality_threshold}%</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Surface>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-xs text-text-muted">Page {page} of {totalPages}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
