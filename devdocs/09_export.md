# Export Pipeline

## Overview

The export pipeline converts document content (sections with markdown content) into downloadable files in three formats: **Markdown**, **HTML**, and **PDF**. The export system is configurable with extensive styling options for HTML and PDF outputs.

## Supported Formats

| Format | Extension | MIME Type | Description |
|--------|-----------|-----------|-------------|
| Markdown | `.md` | `text/markdown` | Concatenated markdown from all sections |
| HTML | `.html` | `text/html` | Styled HTML document with CSS |
| PDF | `.pdf` | `application/pdf` | PDF generated from HTML via WeasyPrint |

## Architecture

### Backend Module: `backend/app/services/export_service.py` (698 lines)

The service provides three main export functions:

- `export_markdown(sections, settings) -> str`
- `export_html(sections, document, project, settings) -> str`
- `export_pdf(sections, document, project, settings) -> bytes`

All three share a common flow:
1. Load sections sorted by `order_index`
2. Build section content with headings
3. Apply export settings (format-specific)
4. Return the file content

### Settings Schema: `backend/app/schemas/export_settings.py`

The `ExportSettings` Pydantic model defines all configurable options:

#### Page Settings
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `paper_size` | `str` | `"A4"` | A3, A4, A5, Letter, Legal |
| `margin_top` | `float` | 20 | Top margin in mm |
| `margin_bottom` | `float` | 20 | Bottom margin in mm |
| `margin_left` | `float` | 25 | Left margin in mm |
| `margin_right` | `float` | 25 | Right margin in mm |

#### Typography
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `font_family` | `str` | `"Inter"` | Body font |
| `font_size` | `str` | `"11pt"` | Body font size |
| `heading_font` | `str` | `"Inter"` | Heading font family |
| `line_height` | `float` | 1.6 | Line height ratio |
| `max_width` | `str` | `"800px"` | Content max width (HTML only, not PDF) |

#### Colors
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `primary_color` | `str` | `"#2563eb"` | Primary accent color |
| `secondary_color` | `str` | `"#64748b"` | Secondary accent color |
| `background_color` | `str` | `"#ffffff"` | Page background |
| `text_color` | `str` | `"#1e293b"` | Body text color |
| `heading_color` | `str` | `"#0f172a"` | Heading text color |
| `link_color` | `str` | `"#2563eb"` | Link color |

#### Code Styling
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `code_theme` | `str` | `"github"` | Syntax highlighting theme (github, monokai, dracula, etc.) |

#### Header & Footer
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `show_header` | `bool` | false | Show header on each page |
| `header_text` | `str` | `""` | Header content |
| `show_footer` | `bool` | false | Show footer on each page |
| `footer_text` | `str` | `""` | Footer content |
| `show_page_numbers` | `bool` | false | Show page numbers |
| `page_number_format` | `str` | `"Page {page} of {total}"` | Page number format |

#### Logo
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `logo_url` | `str` | `""` | Logo image URL |
| `logo_position` | `str` | `"left"` | left/center/right |
| `logo_max_width` | `str` | `"200px"` | Maximum logo width |

#### Other
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `table_style` | `str` | `"clean"` | Table style (clean/bordered/striped) |
| `watermark_text` | `str` | `""` | Watermark text |
| `watermark_opacity` | `float` | 0.1 | Watermark opacity (0-1) |
| `include_diagrams` | `bool` | true | Include mermaid diagrams |
| `cover_page` | `bool` | false | Add cover page |
| `page_break_between_sections` | `bool` | false | Page break before each section |
| `toc_depth` | `int` | 3 | Table of contents depth (0 = disabled) |
| `toc` | `bool` | true | Include table of contents |

## Format Generation Details

### Markdown Export (`export_markdown`)

1. Iterates sections in order
2. For each section, prepends `#` heading markers based on nesting level (`#` for top-level, `##` for children, etc.)
3. Concatenates with double newlines
4. Returns raw markdown string
5. **No styling or formatting applied** — pure markdown

### HTML Export (`export_html`)

1. Builds complete HTML document with:
   - `<!DOCTYPE html>` declaration
   - `<html>` with lang attribute
   - `<head>` with meta tags, title, and inline CSS
   - `<body>` with document content
2. **CSS Generation**: The function `generate_css(settings)` creates a comprehensive stylesheet:
   - Page-level styles (background, text color, font family, font size, line height, max width)
   - Heading styles (font family, color, margins)
   - Link styles (color, hover)
   - Code block styles (background, border, syntax highlighting via theme)
   - Table styles (based on `table_style`: clean/bordered/striped)
   - Watermark (positioned absolute with opacity)
   - Header/footer (positioned fixed for PDF)
   - Cover page (centered content with logo, title, date)
   - Table of contents (styled list with links)
   - Page break rules (for `page_break_between_sections`)
3. **Content rendering**: Each section is rendered as:
   - `<h1>` through `<h6>` for headings (controlled by `toc_depth`)
   - `<div class="section-content">` containing the markdown rendered as HTML
   - Individual sections are wrapped in `<article>` tags
4. Returns complete HTML string

### PDF Export (`export_pdf`)

1. Generates HTML content using `export_html()`
2. Converts HTML to PDF using **WeasyPrint**:
   ```python
   from weasyprint import HTML
   pdf_bytes = HTML(string=html_content).write_pdf()
   ```
3. WeasyPrint handles:
   - CSS page margins (`@page` rules)
   - Header/footer positioning
   - Page numbers via CSS `counter(page)`
   - Font embedding
   - Image resolution
   - Page breaks
4. Returns PDF bytes

## API Endpoints

### `GET /projects/{project_id}/documents/{document_id}/export`

Primary export endpoint. Accepts all `ExportSettings` fields as query parameters (overriding document's stored settings).

**Request**: Query parameters for all settings + `format` (required): `markdown`, `html`, or `pdf`

**Response**:
- `Content-Disposition: attachment; filename="Documentation.md"` (or `.html`, `.pdf`)
- `Content-Type: text/markdown`, `text/html`, or `application/pdf`

### `GET /projects/{project_id}/documents/{document_id}/export-preview`

Returns HTML content without attachment headers, for iframe embedding. Same parameters as the export endpoint.

**Response**: `Content-Type: text/html` — HTML content displayed directly in browser.

### `POST /projects/batch-export`

Batch export multiple projects as PDFs.

**Request**:
```json
{
  "project_ids": [1, 2, 3]
}
```

**Response**: A ZIP file containing individual PDFs named `{project_name}.pdf`. Limited to 50 projects.

### `GET /projects/{project_id}/export`
Legacy endpoint that exports the first document in a project.

## Frontend Export UI

### `ExportModal.tsx` (623 lines)

Located in `components/editor/ExportModal.tsx`. Provides a comprehensive export configuration dialog:

- **Format selector**: Tab buttons for Markdown, HTML, PDF
- **Layout tab**: Paper size, margins (4 inputs), orientation
- **Typography tab**: Font family, font size, heading font, line height, max width readers
- **Colors tab**: 7 color pickers (primary, secondary, background, text, heading, link)
- **Header/Footer tab**: Show/hide toggles, text inputs, page number format
- **Logo tab**: URL input, position selector, max width
- **Code tab**: Theme selector dropdown
- **Advanced tab**: Watermark text/opacity, table style, TOC depth, cover page toggle, page breaks toggle
- **Live preview**: Iframe rendering HTML preview that updates in real-time as settings change
- **Export button**: Triggers download via `GET /export?format=X&...`
- **Presets**: "Save as default" button sets the export_settings on the document

### `ExportPage.tsx` (359 lines)

Dedicated full-page export configuration:
- Same controls as the modal but in a full-page layout
- Larger live preview
- Focus on production export with fine-tuning
- Accessible from the project workspace

## Logo Upload

### `POST /upload/logo`

Accepts image file uploads for logo placement in exports.

**Constraints**: PNG, JPEG, WebP, or SVG; max 5MB.

**Response**: JSON `{"url": "/static/uploads/logo_xxx.png"}` — the URL to use in export settings.

## Diagram Support

The `include_diagrams` setting controls whether Mermaid diagrams in section markdown are rendered during export:

- **For HTML/PDF**: Diagrams are rendered by WeasyPrint as part of the HTML. Mermaid diagram definitions in the markdown become SVG images in the PDF.
- **For Markdown**: Mermaid diagram source code is included verbatim (the markdown consumer handles rendering).
- The frontend preview uses the `mermaid` library to render diagrams in the live preview iframe.

## Export Defaults

Export settings can be set at multiple levels (order of precedence):

1. **Endpoint query parameters** (highest — per-export overrides)
2. **Document export_settings** (stored in `documents.export_settings` JSON)
3. **Project export_settings** (stored in `projects.export_settings` JSON)
4. **Hardcoded defaults** (from `ExportSettings` model defaults)

## Missing or Incomplete Features

1. **No DOCX export**: Despite `python-docx` being in requirements.txt for reading DOCX resources, there is no DOCX export option.
2. **No ePub export**: Not supported.
3. **Markdown export is plain**: No TOC, no cover page, no styling — just concatenated markdown.
4. **No diagram rendering in export**: The Mermaid diagram source is included in the HTML but WeasyPrint may not execute JavaScript to render them. Static SVG rendering of diagrams is not implemented.
5. **Batch export is PDF-only**: Cannot batch-export as Markdown or HTML.
6. **No export scheduling**: No cron-based or webhook-triggered export capability.
7. **No export history**: Past exports are not tracked or logged.
8. **Logo URL is not validated**: The system accepts any URL for logo but does not verify it resolves or is an image.
9. **Preview may differ from PDF**: The HTML preview uses browser rendering; the PDF via WeasyPrint may have subtle differences (especially with complex CSS features like flexbox, grid, or modern CSS properties).
