import apiClient from './client';
import type { CollaborationNote, Section, SectionTreeResponse, DocumentShare, ShareListResponse } from '../types';
import type {
  TemplateRecommendation,
  OutlineProposal,
  ClarificationRequest,
  DocumentSetupStateResponse,
  SetupSectionSummary,
} from '@/types/document-setup';

export interface DocumentProgress {
  total_sections: number;
  reviewed_sections: number;
  generated_sections: number;
  pct: number;
}

export interface Document {
  id: number;
  project_id: number;
  title: string;
  setup_stage: string;
  status: string;
  freshness: string;
  progress: DocumentProgress;
  tags: string[];
  template?: {
    id: number;
    name: string;
    description?: string;
  };
  template_id?: number;
  purpose?: string;
  audience?: string;
  context?: string;
  print_profile?: Record<string, unknown>;
  export_settings?: Record<string, unknown>;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

function normalizeOutlineProposal(proposal: OutlineProposal): OutlineProposal {
  return {
    ...proposal,
    outline_json: Array.isArray(proposal.outline_json)
      ? proposal.outline_json
      : proposal.outline ?? [],
  };
}

function normalizeSection(section: Section): Section {
  return {
    ...section,
    title: section.title ?? section.heading,
    content_md: section.content_md ?? '',
    children: Array.isArray(section.children)
      ? section.children.map(normalizeSection)
      : [],
  };
}

function normalizeSectionTree(tree: SectionTreeResponse): SectionTreeResponse {
  return {
    ...tree,
    sections: tree.sections.map(normalizeSection),
  };
}

function toBackendGenerationMode(mode: 'on-demand' | 'complete') {
  return mode === 'on-demand' ? 'section_on_demand' : 'complete_document';
}

export const documentsApi = {
  async createDocument(
    projectId: number,
    payload: {
      title: string;
      template_id?: number;
      purpose?: string;
      audience?: string;
      context?: string;
      setup_stage: string;
      tags?: string[];
      print_profile?: Record<string, unknown>;
      export_settings?: Record<string, unknown>;
    }
  ): Promise<Document> {
    const { data } = await apiClient.post(`/projects/${projectId}/documents`, payload);
    return data;
  },

  async listDocuments(projectId: number): Promise<DocumentListResponse> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents`);
    return data;
  },

  async getDocument(projectId: number, documentId: number): Promise<Document> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents/${documentId}`);
    return data;
  },

  async updateDocument(
    projectId: number,
    documentId: number,
    payload: {
      title?: string;
      template_id?: number;
      purpose?: string;
      audience?: string;
      context?: string;
      setup_stage?: string;
      tags?: string[];
      export_settings?: Record<string, unknown>;
      print_profile?: Record<string, unknown>;
      custom_outline_metadata?: Record<string, unknown>;
    }
  ): Promise<Document> {
    const { data } = await apiClient.patch(`/projects/${projectId}/documents/${documentId}`, payload);
    return data;
  },

  async deleteDocument(projectId: number, documentId: number): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/documents/${documentId}`);
  },

  async getSetupState(
    projectId: number,
    documentId: number,
  ): Promise<DocumentSetupStateResponse> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents/${documentId}/setup`);
    return {
      ...data,
      outline_proposals: data.outline_proposals.map(normalizeOutlineProposal),
    };
  },

  async getTemplateRecommendations(projectId: number, documentId: number): Promise<{ recommendations: TemplateRecommendation[] }> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents/${documentId}/template-recommendations`);
    return data;
  },

  async createTemplateRecommendations(
    projectId: number,
    documentId: number,
    basis: 'rule_based' | 'ai_personalized',
    refresh: boolean = false
  ): Promise<{ recommendations: TemplateRecommendation[] }> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/template-recommendations`,
      { basis, refresh }
    );
    return data;
  },

  async getOutlineProposals(projectId: number, documentId: number): Promise<{ proposals: OutlineProposal[] }> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents/${documentId}/outline-proposals`);
    return {
      proposals: data.proposals.map(normalizeOutlineProposal),
    };
  },

  async approveOutlineProposal(projectId: number, documentId: number, proposalId: number): Promise<{ proposal: OutlineProposal }> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/outline-proposals/${proposalId}/approve`
    );
    return { proposal: normalizeOutlineProposal(data) };
  },

  async createOutlineProposal(
    projectId: number,
    documentId: number,
    proposal: {
      template_id?: number;
      outline?: SetupSectionSummary[];
      basis: string;
      explanation?: Record<string, unknown>;
    }
  ): Promise<{ proposal: OutlineProposal }> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/outline-proposals`,
      proposal
    );
    return { proposal: normalizeOutlineProposal(data) };
  },

  async updateOutlineProposal(
    projectId: number,
    documentId: number,
    proposalId: number,
    proposal: {
      outline: SetupSectionSummary[];
      explanation?: Record<string, unknown>;
    }
  ): Promise<{ proposal: OutlineProposal }> {
    const { data } = await apiClient.patch(
      `/projects/${projectId}/documents/${documentId}/outline-proposals/${proposalId}`,
      proposal
    );
    return { proposal: normalizeOutlineProposal(data) };
  },

  async listClarificationRequests(
    projectId: number,
    documentId: number,
    proposalId: number,
  ): Promise<{ clarification_requests: ClarificationRequest[] }> {
    const { data } = await apiClient.get(
      `/projects/${projectId}/documents/${documentId}/outline-proposals/${proposalId}/clarification-requests`
    );
    return data;
  },

  async skipClarificationRequest(
    projectId: number,
    documentId: number,
    requestId: number,
  ): Promise<ClarificationRequest> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/clarification-requests/${requestId}/skip`
    );
    return data;
  },

  async estimateGeneration(
    projectId: number,
    documentId: number,
    mode: 'on-demand' | 'complete',
    section_ids?: number[]
  ): Promise<{
    mode: string;
    provider: string | null;
    model: string | null;
    relative_usage: string;
    estimated_prompt_tokens: number;
    estimated_completion_tokens: number;
    estimated_cost: number;
    uncertainty: string;
    section_breakdown: Array<{
      section_id: number;
      heading: string;
      estimated_prompt_tokens: number;
      estimated_completion_tokens: number;
      estimated_cost: number;
      uncertainty: string;
    }>;
    pricing_note: string;
    model_guidance: string;
    }> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/generation-estimate`,
      { mode: toBackendGenerationMode(mode), section_ids }
    );
    return data;
  },

  async createGenerationRun(
    projectId: number,
    documentId: number,
    mode: 'on-demand' | 'complete',
    section_ids?: number[],
    execute = true
  ): Promise<any> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/generation-runs`,
      { mode: toBackendGenerationMode(mode), section_ids, execute }
    );
    return data;
  },

  async listGenerationRuns(projectId: number, documentId: number): Promise<any> {
    const { data } = await apiClient.get(
      `/projects/${projectId}/documents/${documentId}/generation-runs`
    );
    return data;
  },

  async getGenerationRun(projectId: number, documentId: number, runId: number): Promise<any> {
    const { data } = await apiClient.get(
      `/projects/${projectId}/documents/${documentId}/generation-runs/${runId}`
    );
    return data;
  },

  async acceptSectionReview(sectionId: number): Promise<any> {
    const { data } = await apiClient.post(
      `/sections/${sectionId}/accept-review`
    );
    return data;
  },

  async getSections(projectId: number, documentId: number): Promise<SectionTreeResponse> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents/${documentId}/sections`);
    return normalizeSectionTree(data);
  },

  async createSection(projectId: number, documentId: number, title: string): Promise<Section> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/sections`,
      { title }
    );
    return normalizeSection(data);
  },

  async updateDocumentSection(
    projectId: number,
    documentId: number,
    sectionId: number,
    payload: { content_md?: string; status?: Section['status'] }
  ): Promise<Section> {
    const { data } = await apiClient.patch(
      `/projects/${projectId}/documents/${documentId}/sections/${sectionId}`,
      payload
    );
    return normalizeSection(data);
  },

  async autosaveDocumentSection(
    projectId: number,
    documentId: number,
    sectionId: number,
    content_md: string
  ): Promise<{ saved: boolean; updated_at: string }> {
    const { data } = await apiClient.patch(
      `/projects/${projectId}/documents/${documentId}/sections/${sectionId}/autosave`,
      { content_md }
    );
    return data;
  },

  async updateDocumentSectionTitle(
    projectId: number,
    documentId: number,
    sectionId: number,
    title: string
  ): Promise<Section> {
    const { data } = await apiClient.put(
      `/projects/${projectId}/documents/${documentId}/sections/${sectionId}/title`,
      { title }
    );
    return normalizeSection(data);
  },

  async reorderDocumentSections(
    projectId: number,
    documentId: number,
    sectionIds: number[]
  ): Promise<{ message: string }> {
    const { data } = await apiClient.put(
      `/projects/${projectId}/documents/${documentId}/sections/reorder`,
      { section_ids: sectionIds }
    );
    return data;
  },

  async deleteDocumentSection(
    projectId: number,
    documentId: number,
    sectionId: number
  ): Promise<{ message: string }> {
    const { data } = await apiClient.delete(
      `/projects/${projectId}/documents/${documentId}/sections/${sectionId}`
    );
    return data;
  },

  async submitForReview(projectId: number, reviewerId: number): Promise<{ status: string; reviewer_id: number }> {
    const { data } = await apiClient.post(`/projects/${projectId}/document/submit-review`, { reviewer_id: reviewerId });
    return data;
  },

  async approveDocument(projectId: number): Promise<{ status: string; approved_at: string }> {
    const { data } = await apiClient.post(`/projects/${projectId}/document/approve`);
    return data;
  },

  async requestChanges(projectId: number): Promise<{ status: string }> {
    const { data } = await apiClient.post(`/projects/${projectId}/document/request-changes`);
    return data;
  },

  async getNotes(projectId: number, documentId: number, sectionId?: number): Promise<CollaborationNote[]> {
    const params = sectionId ? { section_id: sectionId } : {};
    const { data } = await apiClient.get(`/projects/${projectId}/documents/${documentId}/notes`, { params });
    return data;
  },

  async addNote(projectId: number, documentId: number, content: string, sectionId?: number): Promise<CollaborationNote> {
    const { data } = await apiClient.post(`/projects/${projectId}/documents/${documentId}/notes`, { content, section_id: sectionId });
    return data;
  },

  async getFreshness(projectId: number, documentId: number): Promise<{
    document_id: number;
    freshness: string;
    stale_sections: Array<{ id: number; heading: string; reviewed_at: string | null }>;
    total_sections: number;
    stale_count: number;
  }> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents/${documentId}/freshness`);
    return data;
  },

  async acceptFreshnessUpdate(projectId: number, documentId: number, sectionId: number): Promise<void> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/sections/${sectionId}/freshness/accept`
    );
    return data;
  },

  async rejectFreshnessUpdate(projectId: number, documentId: number, sectionId: number): Promise<void> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/sections/${sectionId}/freshness/reject`
    );
    return data;
  },

  async listShares(projectId: number, documentId: number): Promise<ShareListResponse> {
    const { data } = await apiClient.get(
      `/projects/${projectId}/documents/${documentId}/shares`
    );
    return data;
  },

  async addShare(projectId: number, documentId: number, userId: number, permission: 'view' | 'comment' | 'edit'): Promise<DocumentShare> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/shares`,
      { user_id: userId, permission }
    );
    return data;
  },

  async revokeShare(projectId: number, documentId: number, shareId: number): Promise<void> {
    await apiClient.delete(
      `/projects/${projectId}/documents/${documentId}/shares/${shareId}`
    );
  },
};
