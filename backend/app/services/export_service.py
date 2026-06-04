from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING, Optional

import markdown as md_lib

if TYPE_CHECKING:
    from app.models.document import Section


_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{title}</title>
  <style>
    :root {{
      --h1-color: {h1_color};
      --h2-color: {h2_color};
      --primary-color: {primary_color};
      --font-family: '{font_family}';
    }}
    *, *::before, *::after {{ box-sizing: border-box; }}
    body {{
      font-family: var(--font-family), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                   Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: #1a202c;
      max-width: 860px;
      margin: 0 auto;
      padding: 2rem 2.5rem 4rem;
    }}
    h1 {{ font-size: 2.2rem; border-bottom: 2px solid var(--h1-color); padding-bottom: .4rem; margin-top: 2rem; color: var(--h1-color); }}
    h2 {{ font-size: 1.6rem; border-bottom: 1px solid var(--h2-color); padding-bottom: .3rem; margin-top: 2rem; color: var(--h2-color); }}
    h3 {{ font-size: 1.25rem; margin-top: 1.5rem; color: var(--h1-color); }}
    h4, h5, h6 {{ margin-top: 1.25rem; color: var(--h2-color); }}
    p  {{ margin: .75rem 0; }}
    a  {{ color: var(--primary-color); text-decoration: underline; }}
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
      border-left: 4px solid var(--primary-color);
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
    @page {{
      {page_style}
    }}
    #header {{ text-align: center; font-size: 0.85em; color: #718096; margin-bottom: 1rem; {header_display} }}
    #header-left {{ float: left; }}
    #header-center {{ display: inline-block; }}
    #header-right {{ float: right; }}
    #footer {{ text-align: center; font-size: 0.85em; color: #718096; margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: 0.5rem; {footer_display} }}
  </style>
</head>
<body>
{header_html}
{logo_html}
{body}
{footer_html}
</body>
</html>
"""


def _resolve(settings: dict, key: str, default: str) -> str:
    """Return setting value or default. Treats empty string as 'use default'."""
    val = settings.get(key)
    return val if val else default


def export_markdown(sections: list["Section"], doc_title: str = "Documentation") -> str:
    parts: list[str] = [f"# {doc_title}\n"]
    for section in sorted(sections, key=lambda s: s.order_index):
        parts.append(f"\n## {section.title or section.heading}\n")
        content = (section.content_md or "").strip()
        if content:
            parts.append(f"\n{content}\n")
    return "\n".join(parts)


def export_html(
    sections: list["Section"],
    project_name: str,
    doc_title: str = "Documentation",
    export_settings: Optional[dict] = None,
) -> bytes:
    settings = export_settings or {}

    h1_color = _resolve(settings, "h1_color", "#0F172A")
    h2_color = _resolve(settings, "h2_color", "#0F172A")
    primary_color = _resolve(settings, "primary_color", "#6366f1")
    font_family = _resolve(settings, "font_family", "Inter")
    logo_url = settings.get("logo_url")
    logo_position = settings.get("logo_position", "title-page")
    header_left = settings.get("header_left", "")
    header_center = settings.get("header_center", "")
    header_right = settings.get("header_right", "")
    page_numbers = settings.get("page_numbers", False)
    paper_size = settings.get("paper_size", "a4")
    margins = settings.get("margins", "normal")

    # Logo
    logo_html = ""
    if logo_url:
        if logo_position == "title-page":
            logo_html = f'<div style="text-align:center;margin-bottom:2rem;"><img src="{logo_url}" style="max-height:80px;" alt="logo"/></div>'
        elif logo_position == "header-left":
            logo_html = f'<img src="{logo_url}" style="max-height:40px;float:left;margin-right:1rem;" alt="logo"/>'
        elif logo_position == "header-center":
            logo_html = f'<div style="text-align:center;margin-bottom:1rem;"><img src="{logo_url}" style="max-height:40px;" alt="logo"/></div>'
        elif logo_position == "header-right":
            logo_html = f'<img src="{logo_url}" style="max-height:40px;float:right;margin-left:1rem;" alt="logo"/>'

    # Header
    has_header = bool(header_left or header_center or header_right)
    header_html = ""
    if has_header:
        parts = []
        if header_left:
            parts.append(f'<span id="header-left">{header_left}</span>')
        if header_center:
            parts.append(f'<span id="header-center">{header_center}</span>')
        if header_right:
            parts.append(f'<span id="header-right">{header_right}</span>')
        header_html = f'<div id="header">{" ".join(parts)}</div>'

    # Footer with page numbers
    footer_html = ""
    footer_display = "none"
    if page_numbers:
        footer_display = "block"
        footer_html = '<div id="footer"><span class="page-number">Page <span class="page"></span></span></div>'

    # @page style
    size_map = {"a4": "A4", "letter": "Letter"}
    margin_map = {
        "normal": "2cm",
        "narrow": "1cm",
        "wide": "3cm",
    }
    ps = size_map.get(paper_size, "A4")
    mg = margin_map.get(margins, "2cm")
    page_style = f"size: {ps}; margin: {mg};"

    if page_numbers:
        page_style += " @bottom-center { content: counter(page); font-size: 0.85em; color: #718096; }"

    md_text = export_markdown(sections, doc_title)
    body_html = md_lib.markdown(
        md_text,
        extensions=["fenced_code", "tables", "toc", "nl2br"],
    )
    html = _HTML_TEMPLATE.format(
        title=project_name,
        h1_color=h1_color,
        h2_color=h2_color,
        primary_color=primary_color,
        font_family=font_family,
        logo_html=logo_html,
        header_html=header_html,
        footer_html=footer_html,
        header_display="block" if has_header else "none",
        footer_display=footer_display,
        page_style=page_style,
        body=body_html,
    )
    return html.encode("utf-8")


def export_pdf(
    sections: list["Section"],
    project_name: str,
    doc_title: str = "Documentation",
    export_settings: Optional[dict] = None,
) -> bytes:
    from weasyprint import HTML as WeasyHTML

    html_bytes = export_html(sections, project_name, doc_title, export_settings)
    html_str = html_bytes.decode("utf-8")
    return WeasyHTML(string=html_str).write_pdf()
