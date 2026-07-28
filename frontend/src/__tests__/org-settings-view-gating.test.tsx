import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { OrgSettingsView } from '@/components/org/OrgSettingsView';
import { useOrgStore } from '@/store/orgStore';

function setActiveOrg(role: 'ADMIN' | 'VIEWER') {
  useOrgStore.setState({
    activeOrgId: 1,
    currentRole: role,
    organizations: [
      {
        id: 1,
        name: 'Test Org',
        slug: 'test-org',
        personal: false,
        created_at: '2026-01-01T00:00:00Z',
        quality_threshold: 70,
      } as any,
    ],
  });
}

describe('OrgSettingsView capability gating', () => {
  beforeEach(() => {
    useOrgStore.setState({ activeOrgId: null, currentRole: null, organizations: [] });
  });

  it('hides edit affordances for a Viewer', () => {
    setActiveOrg('VIEWER');
    render(<OrgSettingsView />);

    expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save threshold/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/documentation quality threshold/i)).toBeDisabled();
  });

  it('shows edit affordances for an Admin', () => {
    setActiveOrg('ADMIN');
    render(<OrgSettingsView />);

    expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/documentation quality threshold/i)).not.toBeDisabled();
  });
});
