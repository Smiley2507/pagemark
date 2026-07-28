export interface GrammarIssue {
  offset: number;
  length: number;
  message: string;
  short_message: string;
  rule_id: string;
  replacements: string[];
}
