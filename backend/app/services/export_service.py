from __future__ import annotations

import base64
import mimetypes
import os
from typing import TYPE_CHECKING, Optional

import markdown as md_lib

if TYPE_CHECKING:
    from app.models.document import Section

from app.config import settings


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
      --font-family: {font_family};
      --body-font-size: {body_font_size};
      --h1-font-size: {h1_font_size};
      --h2-font-size: {h2_font_size};
    }}
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html {{
      font-family: var(--font-family), -apple-system, BlinkMacSystemFont, "Segoe UI",
                   Roboto, Helvetica, Arial, sans-serif;
      font-size: var(--body-font-size);
      line-height: 1.7;
      color: #1a202c;
    }}
    body {{
      max-width: 860px;
      margin: 0 auto;
      padding: 2rem 2.5rem 6rem;
    }}
    h1 {{ font-size: var(--h1-font-size); border-bottom: 2px solid var(--h1-color); padding-bottom: .4rem; margin-top: 2rem; color: var(--h1-color); }}
    h2 {{ font-size: var(--h2-font-size); border-bottom: 1px solid var(--h2-color); padding-bottom: .3rem; margin-top: 2rem; color: var(--h2-color); }}
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
    pre code {{ background: transparent; padding: 0; color: inherit; font-size: .85em; }}
    table {{ border-collapse: collapse; width: 100%; margin: 1rem 0; }}
    th, td {{ border: 1px solid #e2e8f0; padding: .5rem .75rem; text-align: left; }}
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
    img {{ max-width: 100%; }}

    /* ── Running header / footer — repeat on every printed page ── */
    .page-header {{
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10;
      padding: 0.6cm 2cm 0.3cm;
      font-size: 0.85em;
      color: #718096;
      display: flex;
      align-items: center;
      gap: 1rem;
      background: white;
      {header_display}
    }}
    .page-header .h-left {{ margin-right: auto; }}
    .page-header .h-center {{ margin: 0 auto; }}
    .page-header .h-right {{ margin-left: auto; }}
    .page-header img.logo-header {{ max-height: {logo_height}; vertical-align: middle; }}

    .page-footer {{
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 10;
      padding: 0.3cm 2cm 0.6cm;
      font-size: 0.85em;
      color: #718096;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      background: white;
      {footer_display}
    }}
    .page-footer .f-left {{ margin-right: auto; }}
    .page-footer .f-center {{ margin: 0 auto; }}
    .page-footer .f-right {{ margin-left: auto; }}
    .page-footer img.logo-footer {{ max-height: {logo_height}; vertical-align: middle; }}

    .title-page-logo {{
      text-align: center;
      margin-bottom: 2rem;
    }}
    .title-page-logo img {{ max-height: {logo_height}; }}

    /* ── Print: move body content out from under fixed header/footer ── */
    @media print {{
      html {{ font-size: var(--body-font-size); }}
      body {{
        max-width: 100%;
        padding: 1.5cm 1.5cm 2cm;
      }}
      .page-header, .page-footer {{ background: none; }}

      @page {{
        {page_style}
        margin-top: 2.5cm;
        margin-bottom: 2cm;
        margin-left: 2cm;
        margin-right: 2cm;
      }}
    }}
  </style>
</head>
<body>
{logo_title_html}
{body}
{header_fixed_html}
{footer_fixed_html}
</body>
</html>
"""


def _resolve(settings: dict, key: str, default: str) -> str:
    val = settings.get(key)
    return val if val else default


def _maybe_embed_logo(logo_url: str) -> str:
    if not logo_url or logo_url.startswith("data:"):
        return logo_url
    if logo_url.startswith("/static/"):
        local_path = os.path.join(settings.UPLOAD_DIR, *logo_url.split("/")[2:])
        if os.path.isfile(local_path):
            mime_type, _ = mimetypes.guess_type(local_path)
            if not mime_type:
                mime_type = "image/png"
            with open(local_path, "rb") as f:
                data = f.read()
            return f"data:{mime_type};base64,{base64.b64encode(data).decode()}"
    return logo_url


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
    body_font_size = _resolve(settings, "body_font_size", "16px")
    h1_font_size = _resolve(settings, "h1_font_size", "2.2rem")
    h2_font_size = _resolve(settings, "h2_font_size", "1.6rem")
    logo_url = settings.get("logo_url")
    logo_position = settings.get("logo_position", "none")
    logo_height = settings.get("logo_height", "60px")
    header_left = settings.get("header_left", "")
    header_center = settings.get("header_center", "")
    header_right = settings.get("header_right", "")
    page_numbers = settings.get("page_numbers", False)
    page_number_position = settings.get("page_number_position", "center")
    page_number_format = settings.get("page_number_format", "number")
    paper_size = settings.get("paper_size", "a4")
    margins = settings.get("margins", "normal")

    # ---- sanitise font-family (remove accidental quotes) ----
    font_family = font_family.strip().strip("'\"")

    # ---- resolve logo to base64 ----
    embedded = _maybe_embed_logo(logo_url) if logo_url else None

    # ---- title-page logo (body flow) ----
    logo_title_html = ""
    if embedded and logo_position == "title-page":
        logo_title_html = (
            f'<div class="title-page-logo">'
            f'<img src="{embedded}" alt="logo"/>'
            f"</div>"
        )

    # ---- fixed header bar ----
    has_header = bool(header_left or header_center or header_right or
                      (embedded and logo_position in ("header-left", "header-center", "header-right")))
    header_fixed_html = ""
    if has_header:
        cells = []
        if embedded and logo_position == "header-left":
            cells.append(f'<span class="h-left"><img class="logo-header" src="{embedded}" alt="logo"/></span>')
        elif header_left:
            cells.append(f'<span class="h-left">{header_left}</span>')
        else:
            cells.append('<span class="h-left"></span>')

        if embedded and logo_position == "header-center":
            cells.append(f'<span class="h-center"><img class="logo-header" src="{embedded}" alt="logo"/></span>')
        elif header_center:
            cells.append(f'<span class="h-center">{header_center}</span>')
        else:
            cells.append('<span class="h-center"></span>')

        if embedded and logo_position == "header-right":
            cells.append(f'<span class="h-right"><img class="logo-header" src="{embedded}" alt="logo"/></span>')
        elif header_right:
            cells.append(f'<span class="h-right">{header_right}</span>')
        else:
            cells.append('<span class="h-right"></span>')

        header_fixed_html = f'<div class="page-header">{" ".join(cells)}</div>'

    # ---- fixed footer bar ----
    footer_parts = []
    has_footer = False

    if page_numbers:
        has_footer = True
        pn = '<span class="page"></span>'
        fmt = f"{pn}" if page_number_format == "number" else f"Page {pn}"
        pos_class = {"left": "f-left", "center": "f-center", "right": "f-right"}.get(page_number_position, "f-center")
        footer_parts.append(f'<span class="{pos_class}">{fmt}</span>')
    elif embedded and logo_position in ("footer-left", "footer-center", "footer-right"):
        has_footer = True

    if embedded and logo_position == "footer-left":
        footer_parts.insert(0, f'<span class="f-left"><img class="logo-footer" src="{embedded}" alt="logo"/></span>')
    if embedded and logo_position == "footer-center":
        footer_parts.append(f'<span class="f-center"><img class="logo-footer" src="{embedded}" alt="logo"/></span>')
    if embedded and logo_position == "footer-right":
        footer_parts.append(f'<span class="f-right"><img class="logo-footer" src="{embedded}" alt="logo"/></span>')

    footer_fixed_html = ""
    if has_footer:
        footer_fixed_html = f'<div class="page-footer">{" ".join(footer_parts)}</div>'

    # ---- @page style ----
    size_map = {"a4": "A4", "letter": "Letter"}
    margin_map = {"normal": "2cm", "narrow": "1cm", "wide": "3cm"}
    ps = size_map.get(paper_size, "A4")
    mg = margin_map.get(margins, "2cm")
    page_style = f"size: {ps}; margin: {mg};"

    # ---- body ----
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
        body_font_size=body_font_size,
        h1_font_size=h1_font_size,
        h2_font_size=h2_font_size,
        logo_height=logo_height,
        logo_title_html=logo_title_html,
        header_fixed_html=header_fixed_html,
        footer_fixed_html=footer_fixed_html,
        header_display="block" if has_header else "none",
        footer_display="block" if has_footer else "none",
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
