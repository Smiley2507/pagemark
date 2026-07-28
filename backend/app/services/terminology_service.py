import re
from collections import Counter
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.document import Document, Section, LifecycleStatus
from app.services.version_service import create_version_snapshot
from app.models.version import AuthorType
from datetime import datetime
from app.models.time import utcnow

SYNONYM_GROUPS = [
    ["endpoint", "route", "path", "url"],
    ["user", "customer", "client", "member"],
    ["token", "credential", "key", "secret"],
    ["request", "payload", "body", "data"],
    ["response", "result", "output", "return"],
    ["error", "exception", "fault", "failure"],
    ["database", "db", "datastore", "store"],
    ["function", "method", "procedure", "handler"],
    ["parameter", "param", "argument", "arg"],
    ["configuration", "config", "settings", "options"],
]

async def check_terminology_consistency(db: AsyncSession, project_id: int):
    # Fetch all ACTIVE sections
    result = await db.execute(
        select(Section)
        .join(Document)
        .where(Document.project_id == project_id, Section.lifecycle_status == LifecycleStatus.ACTIVE)
    )
    sections = result.scalars().all()
    
    all_text = " ".join((s.content_md or "") for s in sections).lower()
    words = re.findall(r"\b\w+\b", all_text)
    freq = Counter(words)
    
    conflicts = []
    for group in SYNONYM_GROUPS:
        present = [w for w in group if freq[w] > 0]
        if len(present) >= 2:
            # Sort by frequency descending; the most common is "canonical"
            present_sorted = sorted(present, key=lambda w: freq[w], reverse=True)
            canonical = present_sorted[0]
            alternates = present_sorted[1:]
            
            # For each alternate, find which sections contain it
            for alt in alternates:
                conflict_occurrences = []
                for s in sections:
                    if alt in (s.content_md or "").lower():
                        # Find the context (a small window around the word)
                        content = s.content_md or ""
                        match = re.search(rf"\b{re.escape(alt)}\b", content, re.IGNORECASE)
                        if match:
                            start = max(0, match.start() - 40)
                            end = min(len(content), match.end() + 40)
                            context = f"...{content[start:end]}..."
                            conflict_occurrences.append({
                                "section_id": s.id,
                                "context": context
                            })
                
                conflicts.append({
                    "term_a": canonical,
                    "term_b": alt,
                    "conflicts": conflict_occurrences
                })
    
    return conflicts

async def resolve_terminology(db: AsyncSession, project_id: int, term_to_replace: str, correct_term: str):
    result = await db.execute(
        select(Section)
        .join(Document)
        .where(Document.project_id == project_id, Section.lifecycle_status == LifecycleStatus.ACTIVE)
    )
    sections = result.scalars().all()
    
    # Case-insensitive replacement with word boundaries
    pattern = re.compile(rf"\b{re.escape(term_to_replace)}\b", re.IGNORECASE)
    
    modified_count = 0
    for s in sections:
        old_content = s.content_md or ""
        if pattern.search(old_content):
            new_content = pattern.sub(correct_term, old_content)
            if new_content != old_content:
                s.content_md = new_content
                s.updated_at = utcnow()
                await create_version_snapshot(
                    db,
                    section_id=s.id,
                    old_content=old_content,
                    new_content=new_content,
                    author_type=AuthorType.USER,
                    summary=f"Resolved terminology: replaced '{term_to_replace}' with '{correct_term}'"
                )
                modified_count += 1
    
    await db.commit()
    return modified_count
