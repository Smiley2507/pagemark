# Pagemark Master Roadmap (Revised with Claude Session Tasklist)

This roadmap has been fully restructured to incorporate the strict Priority 1 (Must Do) and Priority 2 (Do Before Final Submission) tasklist generated in the Claude code session, while maintaining our 1-month timeline and workshop architectural decisions.

## Phase 1: Foundation, Auth & Registration (Priority 1)
**Objective:** Lock in multi-tenancy and the required trust signals.
- **Tasks:**
  - Org-based Multi-tenancy (Organizations, Memberships, Personal Orgs).
  - Add organization and role fields to registration form.
  - Implement Email Verification flow (block login until verified).
  - Build Account Activity Log viewer.
  - Build Role-Based Dashboards (Developer, Tech Writer, Admin views).
  - API Key generation in settings.

## Phase 2: Upload, Analysis & Context (Priority 1 & 2)
**Objective:** Bulletproof repository ingestion and replace the static questionnaire with our Agentic Loop.
- **Tasks:**
  - File Exclusion UI on upload (ignore `node_modules`, `vendor`, etc.).
  - Dependency Graph Visualizer (visualize relationships instead of just text).
  - Expand Complexity Metrics display.
  - **Agentic Clarification Loop:** Implement the human-in-the-loop chat (satisfies Module 4's goal of gathering business context dynamically instead of a static wizard).

## Phase 3: Dynamic Editor & Generation Polish (Priority 2)
**Objective:** The Notion-like writing experience and advanced AI features.
- **Tasks:**
  - Notion-like Editor (Editable headings, continuous scroll, drag-and-drop sections).
  - AI Confidence Scores per section.
  - Alternative Phrasing Suggestions & Terminology Consistency Checker.

## Phase 4: Documentation Management & Quality (Priority 2)
**Objective:** Make Pagemark a real team tool.
- **Tasks:**
  - Tagging, Categorization, and Full-Text Search.
  - Approval Workflow (Draft → In Review → Approved).
  - Quality Thresholds (Set minimum scores to trigger warnings).
  - Collaboration notes (Team notes on a document).

## Phase 5: Dashboards, Export & Notifications (Priority 2)
**Objective:** The final academic modules and polish.
- **Tasks:**
  - NLP Dashboard (Module 5: Readability, entity extraction, style analysis).
  - Export Customization (Branding, Logo, batch export).
  - Simplified BYOK (Premium UI, 1:1 key mapping).
  - Email Notifications (Reviews assigned, comments made).

## Phase 6: System Testing & Release Readiness
**Objective:** Ensure the system passes all security and operational checks.
- **Tasks:** IDOR testing, Docker bulletproofing, Evaluator README.
