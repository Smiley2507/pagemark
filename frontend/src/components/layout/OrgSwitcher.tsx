import { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, PlusCircle, Building2 } from 'lucide-react';
import { useOrgStore } from '@/store/orgStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function OrgSwitcher() {
  const { organizations, activeOrgId, setActiveOrgId } = useOrgStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <div className="relative w-full" ref={menuRef}>
      <Button
        variant="ghost"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="w-full justify-between px-2 hover:bg-accent hover:text-accent-foreground"
      >
        <div className="flex items-center gap-2 truncate">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
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
                <span className="truncate">{org.name}</span>
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
              // Trigger create org modal or navigate to create org page
              alert("Create Organization coming soon!");
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            <span>Create Organization</span>
          </div>
        </div>
      )}
    </div>
  );
}
