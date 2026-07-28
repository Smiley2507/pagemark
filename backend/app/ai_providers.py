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
            {"id": "gemini-3.1-flash-lite", "label": "Gemini 3.1 Flash-Lite"},
            {"id": "gemini-3.5-flash", "label": "Gemini 3.5 Flash"},
            {"id": "gemini-3.1-pro-preview", "label": "Gemini 3.1 Pro Preview"},
        ],
    },
    "openai": {
        "label": "OpenAI",
        "models": [
            {"id": "gpt-5", "label": "GPT-5"},
            {"id": "gpt-5-mini", "label": "GPT-5 mini"},
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

MODEL_PREFIXES: dict[str, tuple[str, ...]] = {
    "anthropic": ("claude-",),
    "google": ("gemini-",),
    "openai": ("gpt-", "o"),
    "opencode-go": (),
}


def is_valid_model(provider: str, model_id: str) -> bool:
    if provider not in PROVIDERS:
        return False
    return any(m["id"] == model_id for m in PROVIDERS[provider]["models"])


def is_plausible_model(provider: str, model_id: str) -> bool:
    if provider not in PROVIDERS:
        return False
    if is_valid_model(provider, model_id):
        return True

    prefixes = MODEL_PREFIXES.get(provider, ())
    if provider == "opencode-go":
        return bool(model_id.strip())
    return any(model_id.startswith(prefix) for prefix in prefixes)
