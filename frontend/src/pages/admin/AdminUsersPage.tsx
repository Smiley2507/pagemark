import { useEffect, useState } from 'react';
import { Search, Shield, ShieldOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Surface } from '@/components/ui/surface';
import { adminApi } from '@/api/admin';
import type { AdminUser } from '@/api/admin';

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  const fetchUsers = () => {
    setLoading(true);
    adminApi.listUsers({ search: search || undefined, page, page_size: pageSize })
      .then((res) => {
        setUsers(res.users);
        setTotal(res.total);
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const toggleSuspend = async (user: AdminUser) => {
    try {
      await adminApi.updateUser(user.id, { is_suspended: !user.is_suspended });
      toast.success(user.is_suspended ? 'User reactivated' : 'User suspended');
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update user');
    }
  };

  const toggleSuperuser = async (user: AdminUser) => {
    try {
      await adminApi.updateUser(user.id, { is_superuser: !user.is_superuser });
      toast.success(user.is_superuser ? 'Admin privileges removed' : 'Admin privileges granted');
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update user');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Users</h1>
        <span className="text-xs text-text-muted">{total} total</span>
      </div>

      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full rounded-lg border border-border bg-panel py-2 pl-10 pr-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
          />
        </div>
      </form>

      <Surface padding="none">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-panel-muted">
              <th className="px-4 py-2 text-xs font-medium text-text-muted">ID</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Email</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Name</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Verified</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Admin</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Status</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Orgs</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Logins</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Joined</th>
              <th className="px-4 py-2 text-xs font-medium text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-text-muted">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-panel-muted/50">
                  <td className="px-4 py-2.5 text-xs text-text-muted">{user.id}</td>
                  <td className="px-4 py-2.5 text-text-primary">{user.email}</td>
                  <td className="px-4 py-2.5 text-text-muted">{user.name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={user.is_verified ? 'success' : 'warning'} showIcon={false}>
                      {user.is_verified ? 'Verified' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={user.is_superuser ? 'info' : 'neutral'} showIcon={false}>
                      {user.is_superuser ? 'Admin' : 'User'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={user.is_suspended ? 'danger' : 'success'}>
                      {user.is_suspended ? 'Suspended' : 'Active'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">{user.organization_count}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">{user.login_count}</td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleSuperuser(user)}
                        title={user.is_superuser ? 'Remove admin' : 'Make admin'}
                      >
                        {user.is_superuser ? <ShieldOff size={14} /> : <Shield size={14} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleSuspend(user)}
                        title={user.is_suspended ? 'Reactivate' : 'Suspend'}
                      >
                        <AlertCircle size={14} />
                      </Button>
                    </div>
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
          <span className="text-xs text-text-muted">
            Page {page} of {totalPages}
          </span>
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
