import apiClient from './client';

export interface NotificationPreferences {
  member_activity: boolean;
  document_sharing: boolean;
  document_notes: boolean;
  generation: boolean;
  quality: boolean;
  stale_sections: boolean;
  source_sync: boolean;
  invites: boolean;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  member_activity: true,
  document_sharing: true,
  document_notes: true,
  generation: true,
  quality: true,
  stale_sections: true,
  source_sync: true,
  invites: true,
};

export const notificationsApi = {
  async getPreferences(): Promise<NotificationPreferences> {
    const { data } = await apiClient.get<{ preferences: NotificationPreferences }>(
      '/auth/me/notification-preferences'
    );
    return data.preferences;
  },

  async updatePreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
    const { data } = await apiClient.put<{ preferences: NotificationPreferences }>(
      '/auth/me/notification-preferences',
      { preferences }
    );
    return data.preferences;
  },
};
