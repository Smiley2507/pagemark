from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, model_validator


PAGE_SIZES = {"a4", "letter"}
MARGIN_PRESETS = {
    "narrow": {"top": "15mm", "bottom": "15mm", "left": "12mm", "right": "12mm"},
    "normal": {"top": "25mm", "bottom": "22mm", "left": "20mm", "right": "20mm"},
    "wide": {"top": "35mm", "bottom": "30mm", "left": "28mm", "right": "28mm"},
}
ORIENTATIONS = {"portrait", "landscape"}
PAGE_NUMBER_POSITIONS = {"left", "center", "right"}
MARGIN_BOX_POSITIONS = {
    "top-left", "top-center", "top-right",
    "bottom-left", "bottom-center", "bottom-right",
}
LOGO_POSITIONS = {
    "none", "title-page",
    "header-left", "header-center", "header-right",
    "footer-left", "footer-center", "footer-right",
}
TABLE_STYLES = {"simple", "striped", "bordered", "minimal"}
CODE_THEMES = {"dark", "light", "github", "monokai"}


def _safe_page_size(value: Optional[str]) -> str:
    v = (value or "a4").strip().lower()
    parts = v.split()
    size = parts[0] if parts[0] in PAGE_SIZES else "a4"
    orientation = parts[1] if len(parts) > 1 and parts[1] in ORIENTATIONS else "portrait"
    if orientation == "landscape":
        return f"{size} landscape"
    return size


class ExportSettings(BaseModel):
    organization_name: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = "Technical Documentation"
    include_toc: bool = True
    include_cover_page: bool = True
    include_page_numbers: bool = True
    h1_underline: bool = False

    paper_size: str = "a4"
    orientation: str = "portrait"
    margins: str = "normal"
    margin_top: Optional[str] = None
    margin_bottom: Optional[str] = None
    margin_left: Optional[str] = None
    margin_right: Optional[str] = None

    primary_color: str = "#4f46e5"
    h1_color: str = "#111827"
    h2_color: str = "#1f2937"
    text_color: str = "#374151"
    muted_color: str = "#6b7280"
    border_color: str = "#e5e7eb"
    table_header_bg: str = "#f9fafb"
    code_bg: str = "#1e293b"
    code_color: str = "#f8fafc"

    font_family: str = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    body_font_size: str = "10pt"
    h1_font_size: str = "22pt"
    h2_font_size: str = "16pt"
    h3_font_size: str = "13pt"
    code_font_size: str = "8.5pt"

    header_left: Optional[str] = None
    header_center: Optional[str] = None
    header_right: Optional[str] = None

    footer_left: Optional[str] = None
    footer_center: Optional[str] = None
    footer_right: Optional[str] = None

    page_number_position: str = "bottom-center"
    page_number_format: str = "page-n-of-m"

    logo_url: Optional[str] = None
    logo_position: str = "title-page"
    logo_height: str = "48px"

    table_style: str = "striped"
    code_theme: str = "dark"

    watermark_text: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize(cls, data: dict) -> dict:
        if data is None:
            data = {}
        data = dict(data)
        if "include_page_numbers" not in data and "page_numbers" in data:
            data["include_page_numbers"] = data.get("page_numbers")
        if "logo_url" not in data and "logo_path" in data:
            data["logo_url"] = data.get("logo_path")
        if "paper_size" not in data and "page_size" in data:
            data["paper_size"] = data.get("page_size")

        margins_val = data.get("margins", "normal")
        if isinstance(margins_val, str) and margins_val in MARGIN_PRESETS:
            preset = MARGIN_PRESETS[margins_val]
            data.setdefault("margin_top", preset["top"])
            data.setdefault("margin_bottom", preset["bottom"])
            data.setdefault("margin_left", preset["left"])
            data.setdefault("margin_right", preset["right"])
        else:
            data.setdefault("margin_top", "25mm")
            data.setdefault("margin_bottom", "22mm")
            data.setdefault("margin_left", "20mm")
            data.setdefault("margin_right", "20mm")

        return data

    def page_size_css(self) -> str:
        size = (self.paper_size or "a4").strip().lower()
        orient = (self.orientation or "portrait").strip().lower()
        if orient == "landscape":
            return f"{size} landscape"
        return size

    def margin_box_position(self) -> str:
        pos_map = {
            "left": "bottom-left",
            "center": "bottom-center",
            "right": "bottom-right",
        }
        pos = (self.page_number_position or "bottom-center").strip().lower()
        return pos_map.get(pos, pos) if pos in pos_map else pos

    def to_safe_dict(self) -> dict:
        return self.model_dump(exclude_none=False)
