"""Unified BYOK AI provider adapters (Anthropic + Google AI Studio)."""

import httpx

from app.ai_providers import VALID_PROVIDERS, is_valid_model


class AiServiceError(Exception):
    """User-safe AI errors."""


def validate_credential(provider: str, api_key: str, model_id: str) -> None:
    if provider not in VALID_PROVIDERS:
        raise AiServiceError(f"Unsupported provider: {provider}")
    if not api_key or len(api_key.strip()) < 8:
        raise AiServiceError("API key is too short or empty")
    if not is_valid_model(provider, model_id):
        raise AiServiceError(f"Unsupported model '{model_id}' for {provider}")

    api_key = api_key.strip()
    try:
        if provider == "anthropic":
            _validate_anthropic(api_key, model_id)
        elif provider == "google":
            _validate_google(api_key, model_id)
        elif provider == "opencode-go":
            _validate_opencode_go(api_key, model_id)
    except AiServiceError:
        raise
    except Exception as e:
        raise AiServiceError(f"Could not validate {provider} key: {_safe_error(e)}") from e


def complete_text(
    system: str,
    user: str,
    provider: str,
    api_key: str,
    model_id: str,
    *,
    max_tokens: int = 4096,
) -> str:
    validate_credential(provider, api_key, model_id)
    api_key = api_key.strip()

    if provider == "anthropic":
        return _complete_anthropic(system, user, api_key, model_id, max_tokens)
    if provider == "google":
        return _complete_google(system, user, api_key, model_id, max_tokens)
    if provider == "opencode-go":
        return _complete_opencode_go(system, user, api_key, model_id, max_tokens)
    raise AiServiceError(f"Unsupported provider: {provider}")


def _safe_error(exc: Exception) -> str:
    msg = str(exc).strip()
    if len(msg) > 200:
        return msg[:200] + "…"
    return msg or "unknown error"


def _validate_anthropic(api_key: str, model_id: str) -> None:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    client.messages.create(
        model=model_id,
        max_tokens=16,
        messages=[{"role": "user", "content": "Reply with OK"}],
    )


def _complete_anthropic(
    system: str, user: str, api_key: str, model_id: str, max_tokens: int
) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model_id,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text.strip()


def _validate_google(api_key: str, model_id: str) -> None:
    from google import genai

    client = genai.Client(api_key=api_key)
    client.models.generate_content(
        model=model_id,
        contents="Reply with OK",
    )


def _complete_google(
    system: str, user: str, api_key: str, model_id: str, max_tokens: int
) -> str:
    from google import genai

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_id,
        contents=f"{system}\n\n{user}",
        config={"max_output_tokens": max_tokens},
    )
    text = getattr(response, "text", None)
    if text:
        return text.strip()
    if response.candidates and response.candidates[0].content:
        parts = response.candidates[0].content.parts
        if parts:
            return (parts[0].text or "").strip()
    raise AiServiceError("Empty response from Google AI")


def _opencode_go_chat_completion(
    api_key: str,
    model_id: str,
    messages: list[dict[str, str]],
    max_tokens: int,
) -> str:
    response = httpx.post(
        "https://opencode.ai/zen/go/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
        },
        timeout=60,
    )
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise AiServiceError(f"OpenCode Go request failed: {_safe_error(exc)}") from exc

    data = response.json()
    choices = data.get("choices")
    if not choices:
        raise AiServiceError("Empty response from OpenCode Go")
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        return content.strip()
    raise AiServiceError("Empty response from OpenCode Go")


def _validate_opencode_go(api_key: str, model_id: str) -> None:
    _opencode_go_chat_completion(
        api_key,
        model_id,
        [{"role": "user", "content": "Reply with OK"}],
        16,
    )


def _complete_opencode_go(
    system: str, user: str, api_key: str, model_id: str, max_tokens: int
) -> str:
    return _opencode_go_chat_completion(
        api_key,
        model_id,
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens,
    )
