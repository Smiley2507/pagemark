import difflib
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.version import AuthorType, SectionVersion
from app.schemas.version import DiffLineResponse, DiffLineType


def count_diff_stats(old_content: str, new_content: str) -> Tuple[int, int, int]:
    """Return (added, removed, modified) line counts between two markdown bodies."""
    old_lines = old_content.splitlines()
    new_lines = new_content.splitlines()
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines)

    added = removed = modified = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "insert":
            added += j2 - j1
        elif tag == "delete":
            removed += i2 - i1
        elif tag == "replace":
            modified += max(i2 - i1, j2 - j1)
    return added, removed, modified


def build_diff_lines(old_content: str, new_content: str) -> List[DiffLineResponse]:
    """Build line-by-line diff for version comparison UI."""
    old_lines = old_content.splitlines()
    new_lines = new_content.splitlines()
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines)

    lines: List[DiffLineResponse] = []
    line_number = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for idx in range(i1, i2):
                line_number += 1
                lines.append(
                    DiffLineResponse(
                        type=DiffLineType.UNCHANGED,
                        content=old_lines[idx],
                        line_number=line_number,
                    )
                )
        elif tag == "delete":
            for idx in range(i1, i2):
                line_number += 1
                lines.append(
                    DiffLineResponse(
                        type=DiffLineType.REMOVED,
                        content=old_lines[idx],
                        line_number=line_number,
                    )
                )
        elif tag == "insert":
            for idx in range(j1, j2):
                line_number += 1
                lines.append(
                    DiffLineResponse(
                        type=DiffLineType.ADDED,
                        content=new_lines[idx],
                        line_number=line_number,
                    )
                )
        elif tag == "replace":
            for idx in range(i1, i2):
                line_number += 1
                lines.append(
                    DiffLineResponse(
                        type=DiffLineType.REMOVED,
                        content=old_lines[idx],
                        line_number=line_number,
                    )
                )
            for idx in range(j1, j2):
                line_number += 1
                lines.append(
                    DiffLineResponse(
                        type=DiffLineType.ADDED,
                        content=new_lines[idx],
                        line_number=line_number,
                    )
                )

    return lines


async def create_version_snapshot(
    db: AsyncSession,
    section_id: int,
    old_content: str,
    new_content: str,
    author_type: AuthorType = AuthorType.USER,
    summary: Optional[str] = None,
) -> SectionVersion:
    """Persist a version row with diff stats for the transition old → new."""
    added, removed, modified = count_diff_stats(old_content, new_content)
    version = SectionVersion(
        section_id=section_id,
        content_md=new_content,
        author_type=author_type,
        summary=summary,
        added=added,
        removed=removed,
        modified=modified,
    )
    db.add(version)
    await db.flush()
    await db.refresh(version)
    return version


async def get_previous_version_content(
    db: AsyncSession,
    section_id: int,
    before_version_id: int,
) -> str:
    """Content of the version immediately before the given version, or empty string."""
    result = await db.execute(
        select(SectionVersion)
        .where(SectionVersion.section_id == section_id)
        .order_by(SectionVersion.created_at.desc())
    )
    versions = list(result.scalars().all())
    for idx, version in enumerate(versions):
        if version.id == before_version_id:
            if idx + 1 < len(versions):
                return versions[idx + 1].content_md
            return ""
    return ""
