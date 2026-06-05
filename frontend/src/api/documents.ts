import apiClient from './client';
import type { CollaborationNote } from '../types';
import type { TemplateRecommendation, OutlineProposal } from '@/types/document-setup';

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
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export const documentsApi = {
  async listDocuments(projectId: number): Promise<DocumentListResponse> {
    const { data } = await apiClient.get(`/projects/${projectId}/documents`);
    return data;
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
    // Backend returns outline_json but frontend expects outline_json (same)
    return data;
  },

  async approveOutlineProposal(projectId: number, documentId: number, proposalId: number): Promise<{ proposal: OutlineProposal }> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/outline-proposals/${proposalId}/approve`
    );
    return { proposal: data };
  },

  async createOutlineProposal(
    projectId: number,
    documentId: number,
    proposal: {
      template_id?: number;
      outline?: any[];
      basis: string;
      explanation?: any;
    }
  ): Promise<{ proposal: OutlineProposal }> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/outline-proposals`,
      proposal
    );
    // Wrap in object to match expected response shape
    return { proposal: data };
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
  }> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/generation-estimate`,
      { mode, section_ids }
    );
    return data;
  },

  async createGenerationRun(
    projectId: number,
    documentId: number,
    mode: 'on-demand' | 'complete',
    section_ids?: number[]
  ): Promise<any> {
    const { data } = await apiClient.post(
      `/projects/${projectId}/documents/${documentId}/generation-runs`,
      { mode, section_ids }
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

  async getNotes(docId: number): Promise<CollaborationNote[]> {
    const { data } = await apiClient.get(`/documents/${docId}/notes`);
    return data;
  },

  async addNote(docId: number, content: string): Promise<CollaborationNote> {
    const { data } = await apiClient.post(`/documents/${docId}/notes`, { content });
    return data;
  },
};
