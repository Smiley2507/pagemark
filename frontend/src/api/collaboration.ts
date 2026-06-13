import apiClient from './client';

export interface CollaborationRoomParts {
  projectId: number;
  documentId: number;
  sectionId: number;
}

const ROOM_PATTERN = /^project:(\d+):document:(\d+):section:(\d+)$/;

export function sectionRoomId({ projectId, documentId, sectionId }: CollaborationRoomParts): string {
  return `project:${projectId}:document:${documentId}:section:${sectionId}`;
}

export function parseSectionRoomId(roomId: string): CollaborationRoomParts {
  const match = ROOM_PATTERN.exec(roomId);
  if (!match) {
    throw new Error(`Invalid collaboration room id: ${roomId}`);
  }
  return {
    projectId: Number(match[1]),
    documentId: Number(match[2]),
    sectionId: Number(match[3]),
  };
}

export const collaborationApi = {
  async authorize(roomId?: string): Promise<{ token: string }> {
    if (!roomId) throw new Error('Missing collaboration room id');
    const { projectId, documentId, sectionId } = parseSectionRoomId(roomId);
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/sections/${sectionId}/collaboration/auth`
    );
    return data;
  },

  async snapshotSection(
    projectId: number,
    documentId: number,
    sectionId: number,
    content_md: string,
  ): Promise<{ saved: boolean; updated_at: string }> {
    const { data } = await apiClient.patch(
      `/projects/${projectId}/documents/${documentId}/sections/${sectionId}/collaboration/snapshot`,
      { content_md }
    );
    return data;
  },
};
