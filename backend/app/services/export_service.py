from __future__ import annotations

import base64
import mimetypes
import subprocess
from html import escape
from pathlib import Path
from typing import Any, Optional, Sequence
import re

import weasyprint

from app.config import settings as app_settings
from app.schemas.export_settings import ExportSettings


try:
    import markdown as _md_lib
except ImportError:
    _md_lib = None


# ── Section helpers ─────────────────────────────────────────────

def _section_title(section: Any, fallback: str = "Untitled") -> str:
    if isinstance(section, dict):
        return section.get("title") or section.get("heading") or section.get("name") or fallback
    return (
        getattr(section, "title", None)
        or getattr(section, "heading", None)
        or getattr(section, "name", None)
        or fallback
    )


def _section_content(section: Any) -> str:
    if isinstance(section, dict):
        return section.get("content") or section.get("content_md") or section.get("body") or section.get("text") or ""
    return (
        getattr(section, "content", None)
        or getattr(section, "content_md", None)
        or getattr(section, "body", None)
        or getattr(section, "text", None)
        or ""
    )


# ── Markdown → HTML ────────────────────────────────────────────

_MERMAID_FENCE_RE = re.compile(
    r"(^|\n)(?P<fence>`{3,}|~{3,})[ \t]*mermaid[^\n]*\n(?P<code>.*?)(?:\n(?P=fence)[ \t]*(?=\n|$))",
    re.IGNORECASE | re.DOTALL,
)


def _frontend_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "frontend"


def _render_mermaid_svg(code: str) -> tuple[str | None, str | None]:
    script = _frontend_dir() / "scripts" / "render-mermaid.mjs"
    if not script.exists():
        return None, "Mermaid renderer script is unavailable."
    try:
        result = subprocess.run(
            ["node", str(script)],
            input=code,
            text=True,
            capture_output=True,
            cwd=str(_frontend_dir()),
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return None, str(exc)

    if result.returncode != 0 or not result.stdout.strip():
        return None, result.stderr.strip() or "Mermaid rendering failed."
    return result.stdout, None


def _mermaid_fallback_html(code: str, error: str | None) -> str:
    note = escape(error or "Mermaid rendering failed.")
    return (
        '<div class="mermaid-export mermaid-export--error">'
        f'<p class="mermaid-export-error">Mermaid render failed: {note}</p>'
        f'<pre><code>{escape(code)}</code></pre>'
        "</div>"
    )


def _render_mermaid_blocks(text: str) -> str:
    if not text:
        return text

    def repl(match: re.Match[str]) -> str:
        leading = match.group(1) or ""
        code = match.group("code").strip("\n")
        svg, error = _render_mermaid_svg(code)
        if svg:
            html = f'<div class="mermaid-export">{svg}</div>'
        else:
            html = _mermaid_fallback_html(code, error)
        return f"{leading}{html}"

    return _MERMAID_FENCE_RE.sub(repl, text)


def _markdown_to_html(text: str) -> str:
    if not text:
        return ""
    text = _render_mermaid_blocks(text)
    if _md_lib:
        return _md_lib.markdown(
            text,
            extensions=["extra", "tables", "fenced_code", "toc", "sane_lists"],
            output_format="html5",
        )
    image_placeholders: list[str] = []

    def _image_repl(match: re.Match[str]) -> str:
        alt = escape(match.group(1))
        src = escape(match.group(2), quote=True)
        placeholder = f"@@PAGEMARK_IMAGE_{len(image_placeholders)}@@"
        image_placeholders.append(f'<img src="{src}" alt="{alt}" />')
        return placeholder

    escaped = escape(re.sub(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)", _image_repl, text))
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = escaped.replace("\n\n", "</p><p>").replace("\n", "<br/>")
    for index, img in enumerate(image_placeholders):
        escaped = escaped.replace(f"@@PAGEMARK_IMAGE_{index}@@", img)
    return f"<p>{escaped}</p>"


# ── Settings normalization ─────────────────────────────────────

def normalize_settings(raw: Optional[dict]) -> dict:
    return ExportSettings.model_validate(raw or {}).to_safe_dict()


# ── Asset helpers ──────────────────────────────────────────────

def _resolve_base_url(settings: dict) -> str:
    logo_url = settings.get("logo_url") or settings.get("logo_path")
    if logo_url:
        p = Path(str(logo_url))
        if p.is_absolute():
            return str(p.parent.resolve())
        return str(Path.cwd())
    return str(Path.cwd())


def _logo_img_tag(settings: dict) -> str:
    """Return resolved <img> tag for the logo, or empty string."""
    url = settings.get("logo_url") or settings.get("logo_path")
    if not url:
        return ""
    height = settings.get("logo_height", "48px")
    alt = escape(settings.get("organization_name", "") or "Logo")
    src = _resolve_logo_src(str(url))
    return f'<img src="{escape(src)}" alt="{alt}" style="height:{height}"/>'


def _logo_position(settings: dict) -> str:
    pos = settings.get("logo_position", "title-page")
    return pos if pos in LOGO_POSITIONS else "title-page"


LOGO_POSITIONS = {
    "none", "title-page",
    "header-left", "header-center", "header-right",
    "footer-left", "footer-center", "footer-right",
}


def _resolve_logo_src(url: str) -> str:
    if url.startswith("data:"):
        return url
    if url.startswith("/static/logos/"):
        filename = url[len("/static/logos/"):]
        filepath = Path(app_settings.UPLOAD_DIR) / "logos" / filename
        if filepath.is_file():
            raw = filepath.read_bytes()
            mime = mimetypes.guess_type(str(filepath))[0] or "image/png"
            b64 = base64.b64encode(raw).decode("ascii")
            return f"data:{mime};base64,{b64}"
    return url


# ── Cover page ─────────────────────────────────────────────────

def _render_cover(settings: dict, organization_name: str, title: str) -> str:
    if not settings.get("include_cover_page", True):
        return ""
    subtitle = settings.get("subtitle", "Technical Documentation")
    parts = [
        '<section class="cover page-break-after">',
        '<div class="cover-inner">',
    ]
    if _logo_position(settings) == "title-page":
        img = _logo_img_tag(settings)
        if img:
            parts.append(f'<div class="title-page-logo">{img}</div>')
    parts.append(f'<p class="eyebrow">{escape(organization_name)}</p>')
    parts.append(f"<h1>{escape(title)}</h1>")
    if subtitle:
        parts.append(f'<p class="subtitle">{escape(subtitle)}</p>')
    parts.append("</div></section>")
    return "\n".join(parts)


# ── Table of Contents ──────────────────────────────────────────

def _render_toc(sections: Sequence[Any], settings: dict) -> str:
    if not settings.get("include_toc", True):
        return ""
    items = []
    for i, sec in enumerate(sections, start=1):
        heading = escape(_section_title(sec, f"Section {i}"))
        items.append(f'<li><a href="#section-{i}">{heading}</a></li>')
    return (
        '<section class="toc page-break-after">'
        "<h1>Table of Contents</h1>"
        f"<ol>{''.join(items)}</ol>"
        "</section>"
    )


# ── Section rendering ──────────────────────────────────────────

def _render_sections(sections: Sequence[Any]) -> str:
    parts = []
    for i, sec in enumerate(sections, start=1):
        heading = escape(_section_title(sec, f"Section {i}"))
        content = _markdown_to_html(_section_content(sec))
        parts.append(
            f'<section class="doc-section" id="section-{i}">'
            f"<h1>{heading}</h1>"
            f'<div class="section-content">{content}</div>'
            f"</section>"
        )
    return "\n".join(parts)


# ── CSS generation ─────────────────────────────────────────────

def _build_css(s: dict) -> str:
    ps = s.get("paper_size", "a4")
    orient = s.get("orientation", "portrait")
    size_css = f"{ps} landscape" if orient == "landscape" else ps

    margin_top = s.get("margin_top", "25mm")
    margin_bottom = s.get("margin_bottom", "22mm")
    margin_left = s.get("margin_left", "20mm")
    margin_right = s.get("margin_right", "20mm")

    include_pn = s.get("include_page_numbers", True)
    pn_pos = s.get("page_number_position", "bottom-center")
    pn_fmt = s.get("page_number_format", "page-n-of-m")

    header_left = s.get("header_left", "")
    header_center = s.get("header_center", "")
    header_right = s.get("header_right", "")
    footer_left = s.get("footer_left", "")
    footer_center = s.get("footer_center", "")
    footer_right = s.get("footer_right", "")

    font_family = s.get("font_family", "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif")
    body_fs = s.get("body_font_size", "10pt")
    h1_fs = s.get("h1_font_size", "22pt")
    h2_fs = s.get("h2_font_size", "16pt")
    h3_fs = s.get("h3_font_size", "13pt")
    code_fs = s.get("code_font_size", "8.5pt")

    primary = s.get("primary_color", "#4f46e5")
    h1_c = s.get("h1_color", "#111827")
    h2_c = s.get("h2_color", "#1f2937")
    text_c = s.get("text_color", "#374151")
    muted_c = s.get("muted_color", "#6b7280")
    border_c = s.get("border_color", "#e5e7eb")
    table_hdr_bg = s.get("table_header_bg", "#f9fafb")
    code_bg = s.get("code_bg", "#1e293b")
    code_c = s.get("code_color", "#f8fafc")

    logo_height = s.get("logo_height", "48px")

    table_style = s.get("table_style", "striped")
    code_theme = s.get("code_theme", "dark")
    h1_underline = s.get("h1_underline", False)

    watermark = s.get("watermark_text", "")

    # ── Logo in page margin boxes ──
    logo_url = _resolve_logo_src(s.get("logo_url", "")) if s.get("logo_url") else None
    logo_pos = _logo_position(s)

    def _mc(text: str, add_logo: bool, page_num: str = "") -> str:
        parts = []
        if page_num:
            parts.append(page_num)
        elif text:
            parts.append(f'"{escape(str(text))}"')
        if logo_url and add_logo:
            parts.append("element(pageLogo)")
        if not parts:
            return "content: none;"
        return f"content: {' '.join(parts)};"

    def _mc_first(add_logo: bool) -> str:
        if logo_url and add_logo:
            return "content: element(pageLogo);"
        return "content: none;"

    # ── Headers in @page ──
    top_left = _mc(header_left, logo_pos == "header-left")
    top_center = _mc(header_center, logo_pos == "header-center")
    top_right = _mc(header_right, logo_pos == "header-right")

    # ── Footer / page numbers ──
    pn = ""
    if include_pn:
        if pn_fmt == "page-n-of-m":
            pn = '"Page " counter(page) " of " counter(pages)'
        elif pn_fmt == "page-n":
            pn = '"Page " counter(page)'
        elif isinstance(include_pn, str):
            pn = f'"{escape(str(include_pn))}"'
        else:
            pn = "counter(page)"

    bottom_left = _mc(footer_left, logo_pos == "footer-left", pn if pn_pos == "bottom-left" else "")
    bottom_center = _mc(footer_center, logo_pos == "footer-center", pn if pn_pos in ("bottom-center", "center", "") else "")
    bottom_right = _mc(footer_right, logo_pos == "footer-right", pn if pn_pos == "bottom-right" else "")

    top_left_first = _mc_first(logo_pos == "header-left")
    top_center_first = _mc_first(logo_pos == "header-center")
    top_right_first = _mc_first(logo_pos == "header-right")
    bottom_left_first = _mc_first(logo_pos == "footer-left")
    bottom_center_first = _mc_first(logo_pos == "footer-center")
    bottom_right_first = _mc_first(logo_pos == "footer-right")

    # ── Table style variants ──
    if table_style == "minimal":
        table_css = """
    table { width:100%; border-collapse:collapse; margin:12px 0; font-size:9pt; page-break-inside:auto; }
    thead { display:table-header-group; }
    tr { page-break-inside:avoid; }
    th, td { padding:6px 8px; text-align:left; vertical-align:top; word-break:break-word; border-bottom:1px solid var(--border-color); }
    th { font-weight:700; color:var(--h1-color); }
"""
    elif table_style == "bordered":
        table_css = """
    table { width:100%; border-collapse:collapse; margin:12px 0; font-size:9pt; page-break-inside:auto; border:2px solid var(--border-color); }
    thead { display:table-header-group; }
    tr { page-break-inside:avoid; }
    th, td { border:1px solid var(--border-color); padding:6px 8px; text-align:left; vertical-align:top; word-break:break-word; }
    th { background:var(--table-header-bg); font-weight:700; }
    tr:nth-child(even) td { background:#fafafa; }
"""
    elif table_style == "simple":
        table_css = """
    table { width:100%; border-collapse:collapse; margin:12px 0; font-size:9pt; page-break-inside:auto; }
    thead { display:table-header-group; }
    tr { page-break-inside:avoid; }
    th, td { padding:6px 8px; text-align:left; vertical-align:top; word-break:break-word; border-bottom:1px solid var(--border-color); }
    th { font-weight:700; background:transparent; }
"""
    else:  # striped (default)
        table_css = """
    table { width:100%; border-collapse:collapse; margin:14px 0; font-size:9.5pt; page-break-inside:auto; }
    thead { display:table-header-group; }
    tr { page-break-inside:avoid; }
    th, td { border:1px solid var(--border-color); padding:7px 9px; text-align:left; vertical-align:top; word-break:break-word; }
    th { background:var(--table-header-bg); font-weight:700; }
    tr:nth-child(even) td { background:#fafafa; }
"""

    # ── Code theme variants ──
    if code_theme == "light":
        code_bg_actual = "#f3f4f6"
        code_c_actual = "#1f2937"
    elif code_theme == "github":
        code_bg_actual = "#f6f8fa"
        code_c_actual = "#24292e"
    elif code_theme == "monokai":
        code_bg_actual = "#272822"
        code_c_actual = "#f8f8f2"
    else:  # dark (default)
        code_bg_actual = code_bg
        code_c_actual = code_c

    return f"""
:root {{
  --primary-color: {primary};
  --h1-color: {h1_c};
  --h2-color: {h2_c};
  --text-color: {text_c};
  --muted-color: {muted_c};
  --border-color: {border_c};
  --table-header-bg: {table_hdr_bg};
  --code-bg: {code_bg_actual};
  --code-color: {code_c_actual};
  --font-family: {font_family};
  --body-font-size: {body_fs};
  --h1-font-size: {h1_fs};
  --h2-font-size: {h2_fs};
  --h3-font-size: {h3_fs};
  --code-font-size: {code_fs};
  --logo-height: {logo_height};
  --margin-top: {margin_top};
  --margin-bottom: {margin_bottom};
}}

@page {{
  size: {size_css};
  margin-top: {margin_top};
  margin-bottom: {margin_bottom};
  margin-left: {margin_left};
  margin-right: {margin_right};

  @top-left {{ {top_left} font-family:var(--font-family); font-size:8pt; color:{muted_c}; }}
  @top-center {{ {top_center} font-family:var(--font-family); font-size:8pt; color:{muted_c}; }}
  @top-right {{ {top_right} font-family:var(--font-family); font-size:8pt; color:{muted_c}; }}

  @bottom-left {{ {bottom_left} font-family:var(--font-family); font-size:8pt; color:{muted_c}; }}
  @bottom-center {{ {bottom_center} font-family:var(--font-family); font-size:8pt; color:{muted_c}; }}
  @bottom-right {{ {bottom_right} font-family:var(--font-family); font-size:8pt; color:{muted_c}; }}
}}

#page-logo-runner {{ position: running(pageLogo); }}

@page :first {{
  @top-left {{ {top_left_first} }}
  @top-center {{ {top_center_first} }}
  @top-right {{ {top_right_first} }}
  @bottom-left {{ {bottom_left_first} }}
  @bottom-center {{ {bottom_center_first} }}
  @bottom-right {{ {bottom_right_first} }}
}}

* {{ box-sizing:border-box; }}

html, body {{
  margin:0; padding:0;
  font-family:var(--font-family);
  font-size:var(--body-font-size);
  line-height:1.65;
  color:var(--text-color);
  background:transparent;
}}

.export-document {{
  margin:0;
}}

@media screen {{
  html {{
    background:#f3f4f6;
  }}
  body {{
    background:#f3f4f6;
    padding:32px;
  }}
  .export-document {{
    max-width:920px;
    min-height:calc(100vh - 64px);
    margin:0 auto;
    padding:48px;
    background:#fff;
    box-shadow:0 12px 40px rgba(15, 23, 42, 0.10);
  }}
}}

@media screen and (max-width: 720px) {{
  body {{
    padding:16px;
  }}
  .export-document {{
    padding:24px;
  }}
}}

h1 {{
  font-size:var(--h1-font-size);
  color:var(--h1-color);
  line-height:1.25;
  margin:28px 0 12px 0;
  page-break-after:avoid;
  break-after:avoid;
}}
h2 {{
  font-size:var(--h2-font-size);
  color:var(--h2-color);
  line-height:1.3;
  margin:22px 0 8px 0;
  page-break-after:avoid;
  break-after:avoid;
}}
h3 {{
  font-size:var(--h3-font-size);
  color:var(--h2-color);
  line-height:1.35;
  margin:18px 0 6px 0;
  page-break-after:avoid;
  break-after:avoid;
}}
h4, h5, h6 {{
  color:var(--h2-color);
  margin:14px 0 4px 0;
  page-break-after:avoid;
  break-after:avoid;
}}

p {{ margin:6px 0; orphans:3; widows:3; }}

a {{ color:var(--primary-color); text-decoration:underline; }}

ul, ol {{ padding-left:22px; }}
li {{ margin:3px 0; }}

code {{
  font-family:"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size:0.88em;
  background:#f3f4f6;
  color:var(--h1-color);
  padding:0.12em 0.35em;
  border-radius:3px;
}}

pre {{
  background:var(--code-bg);
  color:var(--code-color);
  padding:12px 14px;
  border-radius:6px;
  margin:12px 0;
  white-space:pre-wrap;
  word-break:break-word;
  overflow-wrap:anywhere;
  page-break-inside:avoid;
  break-inside:avoid;
  font-size:var(--code-font-size);
  line-height:1.5;
}}
pre code {{
  background:transparent;
  color:inherit;
  padding:0;
  font-size:inherit;
}}

.mermaid-export {{
  margin:16px 0;
  page-break-inside:avoid;
  break-inside:avoid;
  text-align:center;
}}
.mermaid-export svg {{
  max-width:100%;
  height:auto;
}}
.mermaid-export--error {{
  text-align:left;
  border:1px solid var(--border-color);
  border-radius:6px;
  padding:12px;
  background:#fff7ed;
}}
.mermaid-export-error {{
  margin:0 0 8px 0;
  color:#9a3412;
  font-weight:600;
}}

img {{
  max-width:100%;
  height:auto;
  border-radius:4px;
}}

blockquote {{
  margin:14px 0;
  padding:8px 16px;
  border-left:4px solid var(--primary-color);
  color:#4b5563;
  background:#f9fafb;
  page-break-inside:avoid;
}}

hr {{
  border:0;
  border-top:1px solid var(--border-color);
  margin:18px 0;
}}

/* ── Cover page ── */
.cover {{
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  page-break-after:always;
  min-height:80vh;
}}
.cover-inner {{
  max-width:140mm;
  margin:0 auto;
}}
.title-page-logo img {{
  max-height:var(--logo-height);
  max-width:200px;
  object-fit:contain;
  margin-bottom:24px;
}}
.eyebrow {{
  color:var(--primary-color);
  text-transform:uppercase;
  letter-spacing:0.08em;
  font-size:9pt;
  font-weight:700;
  margin-bottom:8px;
}}
.cover h1 {{
  font-size:28pt;
  line-height:1.15;
  margin:0;
  color:var(--h1-color);
}}
.subtitle {{
  color:var(--muted-color);
  font-size:12pt;
  margin-top:12px;
}}

/* ── TOC ── */
.toc {{
  page-break-after:always;
}}
.toc h1 {{
  font-size:var(--h1-font-size);
  color:var(--h1-color);
  {"border-bottom:2px solid var(--primary-color);" if h1_underline else "border-bottom:0;"}
  padding-bottom:8px;
  margin:0 0 14px 0;
}}
.toc ol {{
  padding-left:20px;
  margin-top:14px;
  list-style-type:decimal;
}}
.toc li {{
  margin:6px 0;
}}
.toc a {{
  color:var(--text-color);
  text-decoration:none;
}}

/* ── Sections ── */
.doc-section {{
  margin-bottom:18px;
}}
.doc-section h1 {{
  font-size:var(--h1-font-size);
  color:var(--h1-color);
  {"border-bottom:2px solid var(--primary-color);" if h1_underline else "border-bottom:0;"}
  padding-bottom:6px;
  margin:0 0 14px 0;
  page-break-after:avoid;
  break-after:avoid;
}}
.section-content h1:first-child,
.section-content h2:first-child {{
  margin-top:0;
}}

/* ── Tables ── */
{table_css}

/* ── Page breaks ── */
.page-break-after {{ page-break-after:always; }}
.page-break-before {{ page-break-before:always; }}

/* ── Watermark ── */
{"body::after { content: ''; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 80pt; color: rgba(0,0,0,0.04); white-space: nowrap; pointer-events: none; z-index: 9999; }" if watermark else ""}
"""


# ── Full HTML document ────────────────────────────────────────

def export_html(
    sections: Sequence[Any],
    project_name: str = "Documentation",
    doc_title: str = "Documentation",
    export_settings: Optional[dict] = None,
) -> str:
    s = normalize_settings(export_settings)
    org_name = s.get("organization_name") or project_name
    title = s.get("title") or doc_title

    body_parts = []
    logo_runner = ""
    logo_url_raw = s.get("logo_url") or s.get("logo_path")
    logo_pos = _logo_position(s)
    if logo_url_raw and logo_pos not in ("none", "title-page"):
        logo_src = _resolve_logo_src(str(logo_url_raw))
        logo_h = s.get("logo_height", "48px")
        logo_runner = f'<div id="page-logo-runner"><img src="{escape(logo_src)}" alt="Logo" style="height:{logo_h};" /></div>'

    cover = _render_cover(s, org_name, title)
    if cover:
        body_parts.append(cover)

    toc = _render_toc(sections, s)
    if toc:
        body_parts.append(toc)

    body_parts.append(_render_sections(sections))

    css = _build_css(s)
    body = "\n".join(body_parts)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>{escape(title)}</title>
<style>{css}</style>
</head>
<body>
{logo_runner}
<main class="export-document">
{body}
</main>
</body>
</html>"""


# ── Markdown export ──────────────────────────────────────────

def export_markdown(
    sections: Sequence[Any],
    project_name: str = "Documentation",
    doc_title: str = "Documentation",
    export_settings: Optional[dict] = None,
) -> str:
    s = normalize_settings(export_settings)
    title = s.get("title") or doc_title
    lines = [f"# {title}", "", f"Project: {project_name}", ""]
    for i, sec in enumerate(sections, start=1):
        heading = _section_title(sec, f"Section {i}")
        content = _section_content(sec)
        lines.extend([f"## {heading}", "", content.strip(), ""])
    return "\n".join(lines).strip() + "\n"


# ── PDF export ───────────────────────────────────────────────

def export_pdf(
    sections: Sequence[Any],
    project_name: str = "Documentation",
    doc_title: str = "Documentation",
    export_settings: Optional[dict] = None,
) -> bytes:
    s = normalize_settings(export_settings)
    html = export_html(
        sections=sections,
        project_name=project_name,
        doc_title=doc_title,
        export_settings=s,
    )
    base_url = _resolve_base_url(s)
    return weasyprint.HTML(string=html, base_url=base_url).write_pdf()


# ── Debug: save generated HTML ───────────────────────────────

def debug_save_html(
    html: str,
    project_name: str = "export",
) -> Path:
    out = Path.cwd() / ".export-debug"
    out.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^\w\-]", "_", project_name)
    path = out / f"{safe}.html"
    path.write_text(html, encoding="utf-8")
    return path
