"""
grammar_service.py — Grammar checking via LanguageTool public API.

Uses the LanguageTool API directly (no Java dependency) since httpx
is already in the project's dependencies.
"""

from typing import Any

import httpx

from app.schemas.grammar import GrammarMatch, GrammarMatchReplacement, GrammarCheckResponse

LANGUAGETOOL_API_URL = "https://api.languagetool.org/v2/check"


async def check_grammar(text: str, language: str = "en-US") -> GrammarCheckResponse:
    """
    Check grammar/spelling for the given text using the LanguageTool API.

    LanguageTool returns matches with byte-level offsets. Since we are
    sending UTF-8 text, the offsets should already align with Python
    string indices for basic Latin text. For text containing multi-byte
    characters we convert the offsets correctly.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            LANGUAGETOOL_API_URL,
            data={
                "text": text,
                "language": language,
                "enabledOnly": "false",
            },
        )
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()

    # Convert byte offsets to string offsets for non-ASCII safety
    encoded = text.encode("utf-8")
    matches: list[GrammarMatch] = []
    for m in data.get("matches", []):
        byte_offset = m["offset"]
        byte_length = m["length"]

        # Recompute offset/length in Python string indices
        str_offset = len(encoded[:byte_offset].decode("utf-8", errors="replace"))
        str_length = len(encoded[byte_offset:byte_offset + byte_length].decode("utf-8", errors="replace"))

        replacements = [
            GrammarMatchReplacement(value=r["value"])
            for r in m.get("replacements", [])
        ]

        rule = m.get("rule", {})
        matches.append(
            GrammarMatch(
                message=m["message"],
                short_message=m.get("shortMessage", ""),
                offset=str_offset,
                length=str_length,
                rule_id=rule.get("id", ""),
                rule_issue_type=rule.get("issueType", "misspelling"),
                replacements=replacements,
            )
        )

    return GrammarCheckResponse(matches=matches, text=text)
