import re
from typing import Any

# ── Syllable counting ────────────────────────────────────────────

_VOWELS = set("aeiouy")
_DIPHTHONGS = {"ai", "au", "ea", "ee", "ei", "ie", "oa", "oi", "oo", "ou", "oy"}


def _count_syllables(word: str) -> int:
    word = word.lower().strip(".,!?;:\"'()[]{}").strip("'\"")
    if not word:
        return 0
    if len(word) <= 3:
        return 1

    count = 0
    prev_vowel = False
    for i, ch in enumerate(word):
        is_vowel = ch in _VOWELS
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel

    # Deduct for silent e at end
    if word.endswith("e") and count > 1:
        count -= 1

    return max(count, 1)


# ── Flesch Reading Ease ───────────────────────────────────────────

def compute_readability(text: str) -> float:
    if not text.strip():
        return 0.0

    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return 0.0

    words = text.split()
    if not words:
        return 0.0

    total_words = len(words)
    total_sentences = len(sentences)
    total_syllables = sum(_count_syllables(w) for w in words)

    score = 206.835 - 1.015 * (total_words / total_sentences) - 84.6 * (total_syllables / total_words)
    return round(max(0, min(100, score)), 1)


# ── Entity extraction ─────────────────────────────────────────────

_IMPORT_PATTERNS = [
    re.compile(r'^\s*import\s+(\S+)', re.MULTILINE),
    re.compile(r'^\s*from\s+(\S+)\s+import', re.MULTILINE),
    re.compile(r'require\([\'"]([^\'"]+)[\'"]\)'),
    re.compile(r'import\s+[\{]?([^;}]+)[\} ]?\s+from'),
]

_URL_PATTERN = re.compile(r'https?://[^\s"\'<>()]+')
_TECH_KEYWORDS = re.compile(
    r'\b(PostgreSQL|MySQL|SQLite|MongoDB|Redis|Elasticsearch|Kafka|RabbitMQ|Docker|Kubernetes|AWS|GCP|Azure|GraphQL|REST|gRPC)\b',
    re.IGNORECASE,
)


def extract_entities(text: str) -> list[dict[str, Any]]:
    entities: list[dict[str, Any]] = []
    seen: set[str] = set()

    for pat in _IMPORT_PATTERNS:
        for m in pat.finditer(text):
            for name in re.split(r'[, ]+', m.group(1)):
                name = name.strip().strip("'\"")
                if name and name not in seen and len(name) > 1:
                    seen.add(name)
                    entities.append({"name": name, "type": "library"})

    for m in _TECH_KEYWORDS.finditer(text):
        name = m.group(1)
        if name.lower() not in seen:
            seen.add(name.lower())
            entities.append({"name": name, "type": "technology"})

    for m in _URL_PATTERN.finditer(text):
        url = m.group(0)
        if url not in seen:
            seen.add(url)
            entities.append({"name": url, "type": "url"})

    return entities


# ── Style analysis ────────────────────────────────────────────────

def analyze_style(text: str) -> dict[str, Any]:
    if not text.strip():
        return {}

    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    words = text.split()

    if not sentences or not words:
        return {}

    avg_words_per_sentence = round(len(words) / len(sentences), 1)
    avg_word_length = round(sum(len(w.strip(".,!?;:\"'()[]{}")) for w in words) / len(words), 1)

    passive_pattern = re.compile(r'\b(is|are|was|were|been|being)\s+\w+ed\b', re.IGNORECASE)
    passive_count = len(passive_pattern.findall(text))
    passive_pct = round(passive_count / len(sentences) * 100, 1) if sentences else 0

    jargon_pattern = re.compile(r'\b(utilize|implement|deploy|facilitate|leverage|optimize|streamline|robust|scalable|asynchronous|synergy)\b', re.IGNORECASE)
    jargon_count = len(jargon_pattern.findall(text))

    return {
        "avg_words_per_sentence": avg_words_per_sentence,
        "avg_word_length": avg_word_length,
        "passive_voice_pct": passive_pct,
        "jargon_terms": jargon_count,
    }


# ── Suggestions ───────────────────────────────────────────────────

def generate_suggestions(style: dict[str, Any]) -> list[str]:
    suggestions: list[str] = []

    if style.get("avg_words_per_sentence", 0) > 25:
        suggestions.append("Sentences are long on average — consider breaking complex sentences into shorter ones for better readability.")
    elif style.get("avg_words_per_sentence", 0) > 20:
        suggestions.append("Average sentence length is moderate — aim for under 20 words for wider audience readability.")

    if style.get("passive_voice_pct", 0) > 20:
        suggestions.append("High passive voice usage detected — prefer active voice for clearer documentation.")
    elif style.get("passive_voice_pct", 0) > 10:
        suggestions.append("Moderate passive voice usage — review passive constructions for possible active-voice rewrites.")

    if style.get("jargon_terms", 0) > 5:
        suggestions.append("Many jargon terms found — ensure each term is defined on first use.")

    if style.get("avg_word_length", 0) > 6:
        suggestions.append("Average word length is high — consider simpler alternatives where possible.")

    return suggestions
