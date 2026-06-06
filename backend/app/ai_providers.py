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
    "opencode-go": {
        "label": "OpenCode Go",
        "models": [
            {"id": "deepseek-v4-flash", "label": "DeepSeek V4 Flash"},
            {"id": "deepseek-v4-pro", "label": "DeepSeek V4 Pro"},
            {"id": "kimi-k2.6", "label": "Kimi K2.6"},
            {"id": "kimi-k2.5", "label": "Kimi K2.5"},
            {"id": "glm-5.1", "label": "GLM-5.1"},
            {"id": "glm-5", "label": "GLM-5"},
            {"id": "mimo-v2.5", "label": "MiMo V2.5"},
            {"id": "mimo-v2.5-pro", "label": "MiMo V2.5 Pro"},
        ],
    },
}

VALID_PROVIDERS = frozenset(PROVIDERS.keys())


def is_valid_model(provider: str, model_id: str) -> bool:
    if provider not in PROVIDERS:
        return False
    return any(m["id"] == model_id for m in PROVIDERS[provider]["models"])
