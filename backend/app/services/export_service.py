"""
export_service.py — Markdown, HTML, and PDF export for project documentation.
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

import markdown as md_lib

if TYPE_CHECKING:
    from app.models.document import Section


# ── HTML template ─────────────────────────────────────────────────────────────

_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{title}</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                   Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: #1a202c;
      max-width: 860px;
      margin: 0 auto;
      padding: 2rem 2.5rem 4rem;
    }}
    h1 {{ font-size: 2.2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: .4rem; margin-top: 2rem; }}
    h2 {{ font-size: 1.6rem; border-bottom: 1px solid #e2e8f0; padding-bottom: .3rem; margin-top: 2rem; }}
    h3 {{ font-size: 1.25rem; margin-top: 1.5rem; }}
    h4, h5, h6 {{ margin-top: 1.25rem; }}
    p  {{ margin: .75rem 0; }}
    a  {{ color: #3182ce; text-decoration: underline; }}
    code {{
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: .88em;
      background: #edf2f7;
      padding: .15em .4em;
      border-radius: 3px;
    }}
    pre {{
      background: #2d3748;
      color: #e2e8f0;
      padding: 1rem 1.25rem;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1rem 0;
    }}
    pre code {{
      background: transparent;
      padding: 0;
      color: inherit;
      font-size: .85em;
    }}
    table {{
      border-collapse: collapse;
      width: 100%;
      margin: 1rem 0;
    }}
    th, td {{
      border: 1px solid #e2e8f0;
      padding: .5rem .75rem;
      text-align: left;
    }}
    th {{ background: #f7fafc; font-weight: 600; }}
    tr:nth-child(even) {{ background: #f7fafc; }}
    blockquote {{
      border-left: 4px solid #a0aec0;
      margin: 1rem 0;
      padding: .5rem 1rem;
      color: #4a5568;
      background: #f7fafc;
    }}
    hr {{ border: none; border-top: 1px solid #e2e8f0; margin: 2rem 0; }}
    img {{ max-width: 100%; border-radius: 4px; }}
    #toc {{ background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px;
            padding: 1rem 1.5rem; margin: 1.5rem 0; }}
    #toc ul {{ margin: .25rem 0; padding-left: 1.25rem; }}
    #toc li {{ margin: .2rem 0; }}
    @media print {{
      body {{ max-width: 100%; padding: 1cm; }}
      pre {{ white-space: pre-wrap; }}
    }}
  </style>
</head>
<body>
{body}
</body>
</html>
"""


# ── Public API ────────────────────────────────────────────────────────────────

def export_markdown(sections: list["Section"], doc_title: str = "Documentation") -> str:
    """Concatenate sections in order_index order into a single Markdown string."""
    parts: list[str] = [f"# {doc_title}\n"]
    for section in sorted(sections, key=lambda s: s.order_index):
        parts.append(f"\n## {section.heading}\n")
        content = (section.content_md or "").strip()
        if content:
            parts.append(f"\n{content}\n")
    return "\n".join(parts)


def export_html(
    sections: list["Section"],
    project_name: str,
    doc_title: str = "Documentation",
) -> bytes:
    """Convert sections → HTML using the markdown library."""
    md_text = export_markdown(sections, doc_title)
    body_html = md_lib.markdown(
        md_text,
        extensions=["fenced_code", "tables", "toc", "nl2br"],
    )
    html = _HTML_TEMPLATE.format(title=project_name, body=body_html)
    return html.encode("utf-8")


def export_pdf(
    sections: list["Section"],
    project_name: str,
    doc_title: str = "Documentation",
) -> bytes:
    """Convert sections → PDF via WeasyPrint."""
    from weasyprint import HTML as WeasyHTML  # local import – heavy dep

    html_bytes = export_html(sections, project_name, doc_title)
    html_str = html_bytes.decode("utf-8")
    return WeasyHTML(string=html_str).write_pdf()
