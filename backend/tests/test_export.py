from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from weasyprint import HTML

from app.routers.export import _gather_export_settings
from app.schemas.export_settings import ExportSettings, PAGE_SIZES, MARGIN_PRESETS
from app.services.export_service import (
    export_markdown,
    export_html,
    export_pdf,
    normalize_settings,
)


# ── Fixtures ───────────────────────────────────────────────────

@pytest.fixture
def sample_sections() -> list[dict[str, Any]]:
    return [
        {"heading": "Introduction", "content": "This is the **introduction**.\n\nIt has multiple paragraphs."},
        {"heading": "Architecture", "content": "## Overview\n\nThe system uses a modular design.\n\n```python\ndef hello():\n    print('Hello, World!')\n```"},
        {"heading": "API Reference", "content": "| Method | Endpoint | Description |\n|--------|----------|-------------|\n| GET | /users | List users |\n| POST | /users | Create user |"},
        {"heading": "Images", "content": "![Diagram](https://via.placeholder.com/400x200)"},
    ]


@pytest.fixture
def default_settings() -> dict[str, Any]:
    return {}


# ── ExportSettings Schema ─────────────────────────────────────

class TestExportSettingsSchema:
    def test_defaults(self):
        s = ExportSettings()
        assert s.paper_size == "a4"
        assert s.orientation == "portrait"
        assert s.margins == "normal"
        assert s.include_page_numbers is True
        assert s.font_family == "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
        assert s.body_font_size == "10pt"
        assert s.h1_font_size == "22pt"
        assert s.h2_font_size == "16pt"

    def test_margins_preset_expanded(self):
        s = ExportSettings(margins="wide")
        assert s.margin_top == "35mm"
        assert s.margin_bottom == "30mm"
        assert s.margin_left == "28mm"
        assert s.margin_right == "28mm"

    def test_narrow_margins(self):
        s = ExportSettings(margins="narrow")
        assert s.margin_top == "15mm"
        assert s.margin_left == "12mm"

    def test_custom_margins_override_preset(self):
        s = ExportSettings(margins="normal", margin_top="10mm", margin_left="15mm")
        assert s.margin_top == "10mm"
        assert s.margin_left == "15mm"

    def test_page_size_css_a4(self):
        s = ExportSettings(paper_size="a4", orientation="portrait")
        assert s.page_size_css() == "a4"

    def test_page_size_css_letter_landscape(self):
        s = ExportSettings(paper_size="letter", orientation="landscape")
        assert s.page_size_css() == "letter landscape"

    def test_normalize_empty(self):
        result = normalize_settings(None)
        assert result["paper_size"] == "a4"
        assert result["body_font_size"] == "10pt"

    def test_normalize_partial(self):
        result = normalize_settings({"paper_size": "letter"})
        assert result["paper_size"] == "letter"
        assert result["body_font_size"] == "10pt"  # default

    def test_normalize_legacy_page_numbers_alias(self):
        result = normalize_settings({"page_numbers": False})
        assert result["include_page_numbers"] is False

    def test_h1_underline_disabled_by_default(self):
        result = normalize_settings({})
        assert result["h1_underline"] is False


# ── Export route settings ──────────────────────────────────────

class TestExportRouteSettings:
    def test_document_print_profile_overrides_legacy_document_and_project_settings(self):
        project = SimpleNamespace(export_settings={
            "organization_name": "Project Default",
            "footer_right": "Project Footer",
            "include_page_numbers": False,
        })
        document = SimpleNamespace(
            export_settings={
                "footer_right": "Legacy Footer",
                "primary_color": "#111111",
            },
            print_profile={
                "footer_right": "Profile Footer",
                "primary_color": "#2563eb",
                "include_page_numbers": True,
            },
        )

        result = _gather_export_settings(document, {}, project)

        assert result["organization_name"] == "Project Default"
        assert result["footer_right"] == "Profile Footer"
        assert result["primary_color"] == "#2563eb"
        assert result["include_page_numbers"] is True

    def test_query_params_override_print_profile_and_accept_page_size_alias(self):
        document = SimpleNamespace(
            export_settings={},
            print_profile={
                "page_size": "a4",
                "footer_right": "Profile Footer",
                "h1_underline": False,
            },
        )

        result = _gather_export_settings(
            document,
            {
                "page_size": "letter",
                "footer_right": "Query Footer",
                "h1_underline": "true",
            },
        )

        assert result["paper_size"] == "letter"
        assert result["footer_right"] == "Query Footer"
        assert result["h1_underline"] is True

    def test_legacy_page_numbers_alias_still_coerces(self):
        document = SimpleNamespace(export_settings={}, print_profile={})

        result = _gather_export_settings(
            document,
            {"page_numbers": "false"},
        )

        assert result["include_page_numbers"] is False


# ── Markdown Export ────────────────────────────────────────────

class TestMarkdownExport:
    def test_basic_export(self, sample_sections):
        result = export_markdown(sample_sections, "MyProject", "MyDoc")
        assert result.startswith("# MyDoc")
        assert "Project: MyProject" in result
        assert "## Introduction" in result
        assert "## Architecture" in result
        assert "## API Reference" in result
        assert result.endswith("\n")

    def test_with_custom_title(self, sample_sections):
        result = export_markdown(sample_sections, "Proj", doc_title="Custom", export_settings={"title": "Overridden"})
        assert result.startswith("# Overridden")

    def test_empty_sections(self):
        result = export_markdown([], "Proj", "Doc")
        assert result == "# Doc\n\nProject: Proj\n"


# ── HTML Export ───────────────────────────────────────────────

class TestHtmlExport:
    def test_basic_html(self, sample_sections):
        result = export_html(sample_sections, "MyProject", "MyDoc")
        assert "<!DOCTYPE html>" in result
        assert "<title>MyDoc</title>" in result
        assert "Introduction" in result
        assert "Architecture" in result
        assert "API Reference" in result
        assert "<style>" in result
        assert "</style>" in result

    def test_cover_page(self, sample_sections):
        result = export_html(sample_sections, "MyProject", "MyDoc")
        assert 'class="cover' in result
        assert 'class="subtitle"' in result
        assert "MyProject" in result

    def test_cover_page_disabled(self, sample_sections):
        result = export_html(sample_sections, "MyProject", "MyDoc", {"include_cover_page": False})
        assert 'class="cover' not in result

    def test_toc_included(self, sample_sections):
        result = export_html(sample_sections, "MyProject", "MyDoc")
        assert "Table of Contents" in result
        assert "#section-1" in result

    def test_toc_disabled(self, sample_sections):
        result = export_html(sample_sections, "MyProject", "MyDoc", {"include_toc": False})
        assert "Table of Contents" not in result

    def test_css_variables_applied(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {
            "primary_color": "#ff0000",
            "h1_color": "#00ff00",
        })
        assert "#ff0000" in result
        assert "#00ff00" in result

    def test_page_numbers_css(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {"include_page_numbers": True})
        assert "counter(page)" in result

    def test_page_numbers_disabled(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {"include_page_numbers": False})
        assert "content: none" in result

    def test_a4_size_in_css(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {"paper_size": "a4", "orientation": "portrait"})
        assert "size: a4" in result or "size: A4" in result

    def test_letter_landscape_in_css(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {"paper_size": "letter", "orientation": "landscape"})
        assert "letter landscape" in result.lower()

    def test_margins_in_css(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {"margins": "wide"})
        assert "35mm" in result
        assert "30mm" in result

    def test_header_footer_in_css(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {
            "header_left": "Draft",
            "footer_right": "Confidential",
            "include_page_numbers": False,
        })
        assert "Draft" in result
        assert "Confidential" in result

    def test_logo_html(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {
            "logo_url": "https://example.com/logo.png",
            "logo_position": "title-page",
        })
        assert "logo.png" in result
        assert 'class="title-page-logo"' in result

    def test_organization_name(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {
            "organization_name": "Acme Corp",
        })
        assert "Acme Corp" in result

    def test_subtitle(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {
            "subtitle": "API Reference v2",
        })
        assert "API Reference v2" in result

    def test_table_style(self, sample_sections):
        for style in ("simple", "striped", "bordered", "minimal"):
            result = export_html(sample_sections, "Proj", "Doc", {"table_style": style})
            # Should not crash
            assert "<table" in result or "Table of Contents" in result

    def test_code_theme(self, sample_sections):
        for theme in ("dark", "light", "github", "monokai"):
            result = export_html(sample_sections, "Proj", "Doc", {"code_theme": theme})
            # Should not crash
            assert "pre" in result

    def test_empty_sections(self):
        result = export_html([], "Proj", "Doc")
        assert "<!DOCTYPE html>" in result

    def test_markdown_table_renders(self):
        sections = [{"heading": "Table", "content": "| A | B |\n|---|---|\n| 1 | 2 |"}]
        result = export_html(sections, "Proj", "Doc")
        assert "<table" in result

    def test_markdown_code_block_renders(self):
        sections = [{"heading": "Code", "content": "```python\nx = 1\n```"}]
        result = export_html(sections, "Proj", "Doc")
        assert "<pre" in result

    def test_markdown_image_renders(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc")
        assert "<img" in result

    def test_first_page_no_header_footer(self, sample_sections):
        """The cover page should suppress headers/footers via @page :first."""
        result = export_html(sample_sections, "Proj", "Doc")
        assert "@page :first" in result
        assert result.index("@page {\n  size:") < result.index("@page :first")

    def test_page_box_margins_and_header_footer_zones(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc", {
            "paper_size": "letter",
            "orientation": "landscape",
            "margin_top": "18mm",
            "margin_bottom": "16mm",
            "margin_left": "14mm",
            "margin_right": "12mm",
            "header_left": "Draft",
            "header_center": "Internal",
            "header_right": "v1",
            "footer_left": "Acme",
            "footer_right": "Confidential",
            "include_page_numbers": False,
        })

        assert "size: letter landscape;" in result
        assert "margin-top: 18mm;" in result
        assert "margin-bottom: 16mm;" in result
        assert "margin-left: 14mm;" in result
        assert "margin-right: 12mm;" in result
        assert '@top-left { content: "Draft";' in result
        assert '@top-center { content: "Internal";' in result
        assert '@top-right { content: "v1";' in result
        assert '@bottom-left { content: "Acme";' in result
        assert '@bottom-right { content: "Confidential";' in result

    def test_page_number_positions_are_rendered_in_margin_boxes(self, sample_sections):
        center = export_html(sample_sections, "Proj", "Doc", {
            "include_page_numbers": True,
            "page_number_position": "center",
            "page_number_format": "page-n-of-m",
        })
        assert '@bottom-center { content: "Page " counter(page) " of " counter(pages);' in center

        right = export_html(sample_sections, "Proj", "Doc", {
            "include_page_numbers": True,
            "page_number_position": "bottom-right",
            "page_number_format": "page-n",
        })
        assert '@bottom-right { content: "Page " counter(page);' in right

    def test_header_and_footer_logo_placement(self, sample_sections):
        header = export_html(sample_sections, "Proj", "Doc", {
            "logo_url": "https://example.com/logo.png",
            "logo_position": "header-right",
            "include_page_numbers": False,
        })
        assert '@top-right { content: url("https://example.com/logo.png");' in header
        assert 'page-header-logo' not in header

        footer = export_html(sample_sections, "Proj", "Doc", {
            "logo_url": "https://example.com/logo.png",
            "logo_position": "footer-center",
            "include_page_numbers": False,
        })
        assert '@bottom-center { content: url("https://example.com/logo.png");' in footer
        assert 'page-footer-logo' not in footer

    def test_no_h1_underline_unless_profile_selects_it(self, sample_sections):
        result = export_html(sample_sections, "Proj", "Doc")
        assert "border-bottom:0;" in result

        underlined = export_html(sample_sections, "Proj", "Doc", {"h1_underline": True})
        assert "border-bottom:2px solid var(--primary-color);" in underlined


# ── PDF Export ────────────────────────────────────────────────

class TestPdfExport:
    """Test PDF export using WeasyPrint (basic smoke/integration tests)."""

    def test_pdf_generates_bytes(self, sample_sections):
        pdf_bytes = export_pdf(sample_sections, "MyProject", "MyDoc")
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 100
        # PDF magic bytes
        assert pdf_bytes.startswith(b"%PDF")

    def test_pdf_a4(self, sample_sections):
        pdf_bytes = export_pdf(sample_sections, "Proj", "Doc", {"paper_size": "a4"})
        assert pdf_bytes.startswith(b"%PDF")

    def test_pdf_letter(self, sample_sections):
        pdf_bytes = export_pdf(sample_sections, "Proj", "Doc", {"paper_size": "letter"})
        assert pdf_bytes.startswith(b"%PDF")

    def test_pdf_landscape(self, sample_sections):
        pdf_bytes = export_pdf(sample_sections, "Proj", "Doc", {"paper_size": "a4", "orientation": "landscape"})
        assert pdf_bytes.startswith(b"%PDF")

    def test_pdf_with_logo_url(self, sample_sections):
        """At minimum should not crash when given a logo URL."""
        pdf_bytes = export_pdf(sample_sections, "Proj", "Doc", {
            "logo_url": "https://via.placeholder.com/100",
        })
        assert pdf_bytes.startswith(b"%PDF")

    def test_pdf_empty_sections(self):
        pdf_bytes = export_pdf([], "Proj", "Doc")
        assert pdf_bytes.startswith(b"%PDF")

    def test_pdf_with_all_settings(self, sample_sections):
        pdf_bytes = export_pdf(sample_sections, "Proj", "Doc", {
            "paper_size": "a4",
            "orientation": "portrait",
            "margins": "normal",
            "primary_color": "#4f46e5",
            "h1_color": "#111827",
            "font_family": "Inter",
            "include_toc": True,
            "include_cover_page": True,
            "include_page_numbers": True,
            "header_left": "My Header",
        })
        assert pdf_bytes.startswith(b"%PDF")
        assert len(pdf_bytes) > 200


# ── Normalization ──────────────────────────────────────────────

class TestNormalization:
    def test_bool_coercion(self):
        result = normalize_settings({"include_page_numbers": "false"})
        assert result["include_page_numbers"] is False

    def test_missing_keys_have_defaults(self):
        result = normalize_settings({})
        for key in ("body_font_size", "h1_font_size", "text_color", "primary_color"):
            assert key in result

    def test_logo_url_preserved(self):
        result = normalize_settings({"logo_url": "https://example.com/logo.svg"})
        assert result["logo_url"] == "https://example.com/logo.svg"

    def test_watermark(self):
        result = normalize_settings({"watermark_text": "DRAFT"})
        assert result["watermark_text"] == "DRAFT"

    def test_table_style_default(self):
        result = normalize_settings({})
        assert result["table_style"] == "striped"

    def test_code_theme_default(self):
        result = normalize_settings({})
        assert result["code_theme"] == "dark"
