from __future__ import annotations

from html import escape
from pathlib import Path
from typing import Optional, Any
import re

import weasyprint


try:
    import markdown
except ImportError:
    markdown = None


def _get_section_title(section: Any, fallback: str) -> str:
    return (
        getattr(section, "title", None)
        or getattr(section, "heading", None)
        or getattr(section, "name", None)
        or fallback
    )


def _get_section_content(section: Any) -> str:
    return (
        getattr(section, "content", None)
        or getattr(section, "body", None)
        or getattr(section, "text", None)
        or ""
    )


def _markdown_to_html(text: str) -> str:
    if not text:
        return ""

    if markdown:
        return markdown.markdown(
            text,
            extensions=[
                "extra",
                "tables",
                "fenced_code",
                "toc",
                "sane_lists",
            ],
            output_format="html5",
        )

    escaped = escape(text)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = escaped.replace("\n\n", "</p><p>").replace("\n", "<br/>")
    return f"<p>{escaped}</p>"


def _css_value(value: Optional[str], default: str) -> str:
    return str(value).strip() if value else default


def _safe_page_size(value: Optional[str]) -> str:
    value = (value or "A4").strip().lower()
    if value in {"a4", "letter"}:
        return value.upper()
    if value in {"a4 landscape", "letter landscape"}:
        return value.upper()
    return "A4"


def _safe_margin_box(position: Optional[str]) -> str:
    allowed = {
        "bottom-left",
        "bottom-center",
        "bottom-right",
        "top-left",
        "top-center",
        "top-right",
    }
    position = (position or "bottom-center").strip().lower()
    return position if position in allowed else "bottom-center"


def _build_logo_html(export_settings: dict) -> str:
    logo_url = export_settings.get("logo_url") or export_settings.get("logo_path")
    if not logo_url:
        return ""

    title = escape(export_settings.get("organization_name", "") or "")
    logo_url = escape(str(logo_url))

    return f"""
    <section class="title-page">
      <div class="title-page-logo">
        <img src="{logo_url}" alt="{title} logo"/>
      </div>
    </section>
    """


def export_html(
    sections: list[Any],
    project_name: str,
    doc_title: str = "Documentation",
    export_settings: Optional[dict] = None,
) -> str:
    settings = export_settings or {}

    organization_name = settings.get("organization_name") or project_name
    title = settings.get("title") or doc_title

    body_parts = [
        f"""
        <section class="cover">
          <div class="cover-inner">
            {_build_logo_html(settings)}
            <p class="eyebrow">{escape(organization_name)}</p>
            <h1>{escape(title)}</h1>
            <p class="subtitle">Technical Documentation</p>
          </div>
        </section>
        """
    ]

    if settings.get("include_toc", True):
        toc_items = []
        for index, section in enumerate(sections, start=1):
            heading = escape(_get_section_title(section, f"Section {index}"))
            toc_items.append(f'<li><a href="#section-{index}">{heading}</a></li>')

        body_parts.append(
            f"""
            <section class="toc page-break-after">
              <h1>Table of Contents</h1>
              <ol>
                {''.join(toc_items)}
              </ol>
            </section>
            """
        )

    for index, section in enumerate(sections, start=1):
        heading = escape(_get_section_title(section, f"Section {index}"))
        content = _markdown_to_html(_get_section_content(section))

        body_parts.append(
            f"""
            <section class="doc-section" id="section-{index}">
              <h1>{heading}</h1>
              <div class="section-content">
                {content}
              </div>
            </section>
            """
        )

    body = "\n".join(body_parts)

    page_number_position = _safe_margin_box(settings.get("page_number_position"))

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>{escape(title)}</title>

  <style>
    :root {{
      --primary-color: {_css_value(settings.get("primary_color"), "#4f46e5")};
      --h1-color: {_css_value(settings.get("h1_color"), "#111827")};
      --h2-color: {_css_value(settings.get("h2_color"), "#1f2937")};
      --text-color: {_css_value(settings.get("text_color"), "#1f2937")};
      --muted-color: {_css_value(settings.get("muted_color"), "#6b7280")};
      --border-color: {_css_value(settings.get("border_color"), "#e5e7eb")};
      --table-header-bg: {_css_value(settings.get("table_header_bg"), "#f9fafb")};
      --code-bg: {_css_value(settings.get("code_bg"), "#111827")};
      --code-color: {_css_value(settings.get("code_color"), "#f9fafb")};
      --font-family: {_css_value(settings.get("font_family"), "Inter")};
      --body-font-size: {_css_value(settings.get("body_font_size"), "10.5pt")};
      --h1-font-size: {_css_value(settings.get("h1_font_size"), "22pt")};
      --h2-font-size: {_css_value(settings.get("h2_font_size"), "16pt")};
      --logo-height: {_css_value(settings.get("logo_height"), "54px")};
    }}

    @page {{
      size: {_safe_page_size(settings.get("paper_size"))};
      margin-top: {_css_value(settings.get("margin_top"), "22mm")};
      margin-bottom: {_css_value(settings.get("margin_bottom"), "20mm")};
      margin-left: {_css_value(settings.get("margin_left"), "18mm")};
      margin-right: {_css_value(settings.get("margin_right"), "18mm")};

      @top-left {{
        content: "{escape(str(settings.get("header_left", organization_name)))}";
        font-family: var(--font-family), Arial, sans-serif;
        font-size: 8.5pt;
        color: #6b7280;
      }}

      @top-center {{
        content: "{escape(str(settings.get("header_center", title)))}";
        font-family: var(--font-family), Arial, sans-serif;
        font-size: 8.5pt;
        color: #6b7280;
      }}

      @top-right {{
        content: "{escape(str(settings.get("header_right", "")))}";
        font-family: var(--font-family), Arial, sans-serif;
        font-size: 8.5pt;
        color: #6b7280;
      }}

      @{page_number_position} {{
        content: "Page " counter(page) " of " counter(pages);
        font-family: var(--font-family), Arial, sans-serif;
        font-size: 8.5pt;
        color: #6b7280;
      }}
    }}

    * {{
      box-sizing: border-box;
    }}

    html, body {{
      margin: 0;
      padding: 0;
      font-family: var(--font-family), -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      font-size: var(--body-font-size);
      line-height: 1.62;
      color: var(--text-color);
      background: transparent;
    }}

    .cover {{
      min-height: 220mm;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      page-break-after: always;
    }}

    .cover-inner {{
      max-width: 140mm;
      margin: 0 auto;
    }}

    .title-page-logo img {{
      max-height: var(--logo-height);
      max-width: 180px;
      object-fit: contain;
      margin-bottom: 28px;
    }}

    .eyebrow {{
      color: var(--primary-color);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 9pt;
      font-weight: 700;
      margin-bottom: 12px;
    }}

    .cover h1 {{
      font-size: 30pt;
      line-height: 1.15;
      margin: 0;
      color: var(--h1-color);
    }}

    .subtitle {{
      color: var(--muted-color);
      font-size: 12pt;
      margin-top: 16px;
    }}

    .page-break-after {{
      page-break-after: always;
    }}

    .toc h1,
    .doc-section h1 {{
      font-size: var(--h1-font-size);
      color: var(--h1-color);
      border-bottom: 2px solid var(--primary-color);
      padding-bottom: 8px;
      margin: 0 0 18px 0;
      page-break-after: avoid;
      break-after: avoid;
    }}

    .toc ol {{
      padding-left: 20px;
      margin-top: 18px;
    }}

    .toc li {{
      margin: 8px 0;
      color: var(--text-color);
    }}

    .toc a {{
      color: var(--text-color);
      text-decoration: none;
    }}

    .doc-section {{
      margin-bottom: 24px;
    }}

    h2 {{
      font-size: var(--h2-font-size);
      color: var(--h2-color);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 5px;
      margin-top: 24px;
      page-break-after: avoid;
      break-after: avoid;
    }}

    h3, h4, h5, h6 {{
      color: var(--h2-color);
      margin-top: 18px;
      page-break-after: avoid;
      break-after: avoid;
    }}

    p {{
      margin: 8px 0;
      orphans: 3;
      widows: 3;
    }}

    a {{
      color: var(--primary-color);
      text-decoration: underline;
    }}

    ul, ol {{
      padding-left: 22px;
    }}

    li {{
      margin: 4px 0;
    }}

    code {{
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 0.88em;
      background: #f3f4f6;
      color: #111827;
      padding: 0.12em 0.35em;
      border-radius: 4px;
    }}

    pre {{
      background: var(--code-bg);
      color: var(--code-color);
      padding: 12px 14px;
      border-radius: 8px;
      margin: 12px 0;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    pre code {{
      background: transparent;
      color: inherit;
      padding: 0;
      font-size: 8.7pt;
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 9.5pt;
      page-break-inside: auto;
      break-inside: auto;
    }}

    thead {{
      display: table-header-group;
    }}

    tr {{
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    th, td {{
      border: 1px solid var(--border-color);
      padding: 7px 9px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }}

    th {{
      background: var(--table-header-bg);
      font-weight: 700;
    }}

    tr:nth-child(even) td {{
      background: #fafafa;
    }}

    img {{
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }}

    blockquote {{
      margin: 14px 0;
      padding: 8px 14px;
      border-left: 4px solid var(--primary-color);
      color: #4b5563;
      background: #f9fafb;
    }}

    hr {{
      border: 0;
      border-top: 1px solid var(--border-color);
      margin: 22px 0;
    }}
  </style>
</head>

<body>
  {body}
</body>
</html>
"""
    return html

def export_markdown(
    sections: list[Any],
    project_name: str,
    doc_title: str = "Documentation",
    export_settings: Optional[dict] = None,
) -> str:
    lines = [
        f"# {doc_title}",
        "",
        f"Project: {project_name}",
        "",
    ]

    for index, section in enumerate(sections, start=1):
        heading = _get_section_title(section, f"Section {index}")
        content = _get_section_content(section)

        lines.extend([
            f"## {heading}",
            "",
            content.strip(),
            "",
        ])

    return "\n".join(lines).strip() + "\n"


def export_pdf(
    sections: list[Any],
    project_name: str,
    doc_title: str = "Documentation",
    export_settings: Optional[dict] = None,
) -> bytes:
    """
    Generate a production-ready PDF for software documentation using WeasyPrint.

    Supports:
    - A4 / Letter page sizes
    - Headers
    - Footers
    - Page numbers
    - Logo
    - Organization colors
    - Custom fonts if installed on the server
    - Markdown tables
    - Code blocks
    - API-reference-friendly wrapping
    """
    settings = export_settings or {}

    html = export_html(
        sections=sections,
        project_name=project_name,
        doc_title=doc_title,
        export_settings=settings,
    )

    base_url = settings.get("base_url")

    if not base_url:
        logo_path = settings.get("logo_path")
        if logo_path:
            base_url = str(Path(str(logo_path)).parent.resolve())
        else:
            base_url = str(Path.cwd())

    return weasyprint.HTML(
        string=html,
        base_url=base_url,
    ).write_pdf()