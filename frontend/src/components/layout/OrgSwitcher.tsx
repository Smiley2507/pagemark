import { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, PlusCircle, Building2, UserPlus, Loader2 } from 'lucide-react';
import { useOrgStore } from '@/store/orgStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { orgApi } from '@/api/org';
import { toast } from 'sonner';

export function OrgSwitcher() {
  const { organizations, activeOrgId, setActiveOrgId, setOrganizations } = useOrgStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);

  const refreshOrgs = () => {
    orgApi.listOrganizations().then(setOrganizations).catch(console.error);
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const org = await orgApi.createOrganization(createName.trim());
      toast.success(`Organization "${org.name}" created`);
      setCreateOpen(false);
      setCreateName('');
      setOpen(false);
      await refreshOrgs();
      setActiveOrgId(org.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!joinToken.trim()) return;
    setJoining(true);
    try {
      await orgApi.acceptInvite(joinToken.trim());
      toast.success('Joined organization successfully');
      setJoinOpen(false);
      setJoinToken('');
      setOpen(false);
      await refreshOrgs();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to join organization');
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const activeOrg = organizations.find(o => o.id === activeOrgId);

  return (
    <>
      <div className="relative w-full" ref={menuRef}>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="w-full justify-between px-2 hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-2 truncate">
            {activeOrg?.avatar_url ? (
              <img src={activeOrg.avatar_url} alt="" className="h-6 w-6 shrink-0 rounded-sm object-cover" />
            ) : (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </div>
            )}
            <span className="truncate text-sm font-medium">
              {activeOrg?.name || 'Select Workspace'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in fade-in-80 zoom-in-95">
            <div className="max-h-[300px] overflow-y-auto">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  role="option"
                  aria-selected={org.id === activeOrgId}
                  onClick={() => {
                    setActiveOrgId(org.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer",
                    org.id === activeOrgId ? "bg-accent/50" : ""
                  )}
                >
                  {org.id === activeOrgId && (
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  <div className="flex items-center gap-2 truncate pl-1">
                    {org.avatar_url ? (
                      <img src={org.avatar_url} alt="" className="h-5 w-5 shrink-0 rounded-sm object-cover" />
                    ) : (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                        <Building2 className="h-3 w-3" />
                      </div>
                    )}
                    <span className="truncate">{org.name}</span>
                  </div>
                  {org.personal && (
                    <span className="ml-auto text-xs text-muted-foreground">Personal</span>
                  )}
                </div>
              ))}
            </div>
            <div className="my-1 h-px bg-border" />
            <div
              className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onClick={() => {
                setOpen(false);
                setJoinOpen(true);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              <span>Join Organization</span>
            </div>
            <div
              className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              <span>Create Organization</span>
            </div>
          </div>
        )}
      </div>

      {/* Create Organization Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization name</label>
              <Input
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="My Organization"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!createName.trim() || creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Organization Dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Invite token</label>
              <Input
                value={joinToken}
                onChange={e => setJoinToken(e.target.value)}
                placeholder="Paste invite token here"
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setJoinOpen(false)} disabled={joining}>
                Cancel
              </Button>
              <Button onClick={handleJoin} disabled={!joinToken.trim() || joining}>
                {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Join
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
