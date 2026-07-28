# Projects contain multiple Documents

Pagemark models a Project as the source-connected workspace for one software project, and allows it to contain multiple Documents for different documentation purposes. One shared Project-level Analysis is reused across those Documents, while each Document owns its Template or Custom Outline, generation lifecycle, review state, freshness, and relevant source evidence. This avoids duplicating repository processing and matches how maintainers organize related documentation better than either one-Document-per-Project or one oversized combined Document.

The new model will replace the current development schema directly rather than maintain legacy compatibility or migrate existing Projects, because no Project data exists when this decision is adopted.

Backend APIs should use explicit nested Document routes such as `/projects/{project_id}/documents/{document_id}/...`. Legacy singular document routes are not extended because they obscure ownership and become ambiguous once a Project can contain multiple Documents.
