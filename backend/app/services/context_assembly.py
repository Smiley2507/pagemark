"""LLM context assembly — structured, token-budgeted context from Resource objects."""

import base64
import logging
from dataclasses import dataclass
from typing import Optional

from app.models.resource import Resource, ResourceType

logger = logging.getLogger(__name__)

CHARS_PER_TOKEN = 4
DEFAULT_CONTEXT_BUDGET_TOKENS = 4000
DEFAULT_CONTEXT_BUDGET_CHARS = DEFAULT_CONTEXT_BUDGET_TOKENS * CHARS_PER_TOKEN
MAX_CHARS_PER_RESOURCE = 8000


@dataclass
class ContextAssemblyResult:
    system_context: str
    image_count: int


class ContextAssemblyService:
    """Builds structured ## Context Resources sections from Resource objects.

    Handles text extraction by resource type, token-budget-aware truncation,
    priority ordering, and image preparation per provider capability.
    """

    def __init__(self, budget_tokens: int = DEFAULT_CONTEXT_BUDGET_TOKENS):
        self.budget_chars = budget_tokens * CHARS_PER_TOKEN

    # ── Public API ─────────────────────────────────────────────────

    def assemble(
        self,
        resources: list[Resource],
        provider: str,
    ) -> ContextAssemblyResult:
        """Build a ContextAssemblyResult from the given resources.

        *provider* is the AI provider name (``"anthropic"``, ``"google"``, etc.)
        and controls whether image resources are treated as vision content or
        plain text fallback.
        """
        if not resources:
            return ContextAssemblyResult(system_context="", image_count=0)

        blocks: list[str] = []
        image_count = 0
        remaining = self.budget_chars

        for res in self._prioritise(resources):
            if remaining <= 0:
                break

            text = self._get_text(res)
            label = res.original_name or res.type.value
            is_image = res.mime_type and res.mime_type.startswith("image/")

            if is_image:
                if provider == "anthropic":
                    blocks.append(self._image_text_block(res, label))
                    image_count += 1
                else:
                    blocks.append(self._image_text_block(res, label))
                    image_count += 1
                continue

            if text:
                truncated = self._truncate(text, min(remaining, MAX_CHARS_PER_RESOURCE))
                blocks.append(self._format_block(label, res.type, truncated))
                remaining -= len(truncated)

        if not blocks:
            return ContextAssemblyResult(system_context="", image_count=0)

        header = "## Context Resources\nAttached context for this conversation:"
        return ContextAssemblyResult(
            system_context="\n\n" + header + "\n" + "\n\n".join(blocks),
            image_count=image_count,
        )

    def get_vision_content_blocks(self, resources: list[Resource]) -> list[dict]:
        """Return Anthropic-style vision content blocks for image resources."""
        blocks: list[dict] = []
        for res in resources:
            if not (res.mime_type and res.mime_type.startswith("image/") and res.data):
                continue
            b64 = base64.b64encode(res.data).decode("ascii")
            blocks.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": res.mime_type,
                    "data": b64,
                },
            })
        return blocks

    # ── Private helpers ────────────────────────────────────────────

    def _prioritise(self, resources: list[Resource]) -> list[Resource]:
        priority = {
            ResourceType.REPO_FILE: 0,
            ResourceType.SECTION: 1,
            ResourceType.DOCUMENT: 2,
            ResourceType.NOTE: 3,
            ResourceType.SYMBOL: 4,
            ResourceType.UPLOAD: 5,
            ResourceType.ANALYSIS: 6,
            ResourceType.TRANSIENT: 7,
        }
        return sorted(resources, key=lambda r: (priority.get(r.type, 99), r.original_name or ""))

    def _get_text(self, res: Resource) -> str:
        if res.extracted_text:
            return res.extracted_text
        if res.data:
            try:
                return res.data.decode("utf-8")
            except (UnicodeDecodeError, AttributeError):
                pass
        return ""

    def _truncate(self, text: str, max_chars: int) -> str:
        if len(text) <= max_chars:
            return text
        truncated = text[:max_chars]
        last_para = truncated.rfind("\n\n")
        if last_para > max_chars // 2:
            return text[:last_para] + "\n\n[... content truncated ...]"
        for end in (". ", "!\n", "?\n"):
            idx = truncated.rfind(end)
            if idx > max_chars // 2:
                return text[: idx + 1] + "\n\n[... content truncated ...]"
        return truncated + "\n\n[... content truncated ...]"

    def _format_block(self, label: str, rtype: ResourceType, text: str) -> str:
        type_tag = rtype.value.replace("_", " ")
        return f"### {label} ({type_tag})\n{text}"

    def _image_text_block(self, res: Resource, label: str) -> str:
        if res.extracted_text:
            return f"### {label} (image)\n{res.extracted_text}"
        return f"### {label}\n[Image file — {res.mime_type or 'unknown type'}]"


context_assembly_service = ContextAssemblyService()
