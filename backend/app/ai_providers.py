"""Curated BYOK AI provider catalog (not stored in DB)."""

from typing import TypedDict


class ModelOption(TypedDict):
    id: str
    label: str


class ProviderInfo(TypedDict):
    label: str
    models: list[ModelOption]


PROVIDERS: dict[str, ProviderInfo] = {
    "anthropic": {
        "label": "Anthropic (Claude)",
        "models": [
            {"id": "claude-sonnet-4-20250514", "label": "Claude Sonnet 4"},
            {"id": "claude-3-5-sonnet-20241022", "label": "Claude 3.5 Sonnet"},
        ],
    },
    "google": {
        "label": "Google AI Studio",
        "models": [
            {"id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
            {"id": "gemini-1.5-flash", "label": "Gemini 1.5 Flash"},
        ],
    },
}

VALID_PROVIDERS = frozenset(PROVIDERS.keys())


def is_valid_model(provider: str, model_id: str) -> bool:
    if provider not in PROVIDERS:
        return False
    return any(m["id"] == model_id for m in PROVIDERS[provider]["models"])
