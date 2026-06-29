import apiClient from './client';

export interface GrammarReplacement {
  value: string;
}

export interface GrammarMatch {
  message: string;
  short_message: string;
  offset: number;
  length: number;
  rule_id: string;
  rule_issue_type: string;
  replacements: GrammarReplacement[];
}

export interface GrammarCheckResponse {
  matches: GrammarMatch[];
  text: string;
}

export const grammarApi = {
  async checkGrammar(
    projectId: number,
    text: string,
    language = 'en-US',
    documentId?: number,
    sectionId?: number,
  ): Promise<GrammarCheckResponse> {
    const { data } = await apiClient.post(`/projects/${projectId}/grammar/check`, {
      text,
      language,
      document_id: documentId,
      section_id: sectionId,
    });
    return data;
  },
};
