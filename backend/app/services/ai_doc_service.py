"""Core AI service — section generation, refinement, and streaming chat."""

import difflib
import json
from typing import AsyncGenerator

import anthropic
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.analysis import Analysis, AnalysisStatus
from app.models.chat import ChatMessage, ChatThread, MessageRole
from app.models.document import Document, Section, SectionStatus
from app.models.project import Project
from app.models.template import Template
from app.prompts.chat import build_chat_prompt
from app.prompts.refine import build_refine_prompt
from app.prompts.section import build_section_prompt
from app.services import ai_credential_service
from app.exceptions import NeedsClarificationException

CLAUDE_MODEL = "claude-sonnet-4-5"
MAX_TOKENS_SECTION = 2000
MAX_TOKENS_REFINE = 2000
MAX_TOKENS_CHAT = 1500


class AIService:
    """Async AI service backed by the user's active BYOK Anthropic credential."""

    # ── Internal helpers ────────────────────────────────────────

    async def _get_anthropic_client(
        self, db: AsyncSession, user_id: int, model_name: str | None = None
    ) -> tuple[anthropic.AsyncAnthropic, str]:
        """Return (async client, model_id) from the user's active credential.

        If model_name is provided, uses it instead of the credential's default.
        """
        cred = await ai_credential_service.get_active_credential(db, user_id)
        if not cred:
            raise HTTPException(
                status_code=400,
                detail="No active AI credential found. Please add an Anthropic API key in Settings.",
            )
        if cred.provider != "anthropic":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Active credential is for '{cred.provider}'. "
                    "Only Anthropic is supported for this operation."
                ),
            )
        client = anthropic.AsyncAnthropic(api_key=cred.api_key)
        return client, model_name or cred.model_id

    async def _fetch_project(self, db: AsyncSession, project_id: int) -> Project:
        result = await db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.deleted_at.is_(None),
            )
        )
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project

    async def _fetch_section(self, db: AsyncSession, section_id: int) -> Section:
        result = await db.execute(select(Section).where(Section.id == section_id))
        section = result.scalar_one_or_none()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        return section

    async def _fetch_document(self, db: AsyncSession, document_id: int) -> Document:
        result = await db.execute(select(Document).where(Document.id == document_id))
        document = result.scalar_one_or_none()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        return document

    async def _fetch_latest_analysis(
        self, db: AsyncSession, project_id: int
    ) -> Analysis | None:
        result = await db.execute(
            select(Analysis)
            .where(Analysis.project_id == project_id)
            .order_by(Analysis.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    def _project_context(self, project: Project) -> dict:
        """Extract project_context dict from the Project model."""
        ctx: dict = {
            "name": project.name,
            "language": "",
            "framework": "",
            "tone": "professional",
            "audience": "developers",
            "key_features": project.description or "",
            "custom_instructions": "",
            "preferred_terms": "",
        }
        # Overlay values from context_md (stored as JSON string)
        if hasattr(project, "context_md") and project.context_md:
            try:
                overrides = json.loads(project.context_md)
                if isinstance(overrides, dict):
                    ctx.update({k: v for k, v in overrides.items() if v})
            except (json.JSONDecodeError, TypeError):
                pass
        return ctx

    def _analysis_summary(self, analysis: Analysis | None) -> dict:
        """Build a flat summary dict from Analysis columns."""
        if not analysis:
            return {}
        languages = ""
        frameworks = ""
        file_count = 0
        endpoint_count = 0
        complexity_notes = ""

        if analysis.languages_json:
            lang_data = analysis.languages_json
            if isinstance(lang_data, dict):
                languages = ", ".join(lang_data.keys())
            elif isinstance(lang_data, list):
                languages = ", ".join(str(l) for l in lang_data)

        if analysis.endpoints_json:
            ep_data = analysis.endpoints_json
            if isinstance(ep_data, list):
                endpoint_count = len(ep_data)

        if analysis.file_tree_json:
            ft = analysis.file_tree_json
            if isinstance(ft, list):
                file_count = len(ft)

        if analysis.complexity_json:
            cx = analysis.complexity_json
            if isinstance(cx, dict):
                complexity_notes = cx.get("notes", "") or cx.get("summary", "")

        return {
            "languages": languages,
            "frameworks": frameworks,
            "file_count": file_count,
            "endpoint_count": endpoint_count,
            "complexity_notes": complexity_notes,
        }

    def _analysis_detail(self, analysis: Analysis | None) -> dict:
        """Extract granular lists (classes, functions, endpoints, deps) for prompts."""
        if not analysis:
            return {"classes": [], "functions": [], "endpoints": [], "dependencies": []}

        classes: list = []
        functions: list = []
        endpoints: list = []
        dependencies: list = []

        if analysis.complexity_json:
            cx = analysis.complexity_json
            if isinstance(cx, dict):
                classes = cx.get("classes", [])
                functions = cx.get("functions", [])

        if analysis.endpoints_json:
            ep_data = analysis.endpoints_json
            if isinstance(ep_data, list):
                endpoints = [
                    ep.get("path", str(ep)) if isinstance(ep, dict) else str(ep)
                    for ep in ep_data[:30]
                ]

        if analysis.languages_json:
            lang_data = analysis.languages_json
            if isinstance(lang_data, dict):
                dependencies = list(lang_data.get("dependencies", {}).keys())[:30]

        summary = self._analysis_summary(analysis)

        return {
            "classes": classes,
            "functions": functions,
            "endpoints": endpoints,
            "dependencies": dependencies,
            "languages": summary.get("languages", ""),
            "file_count": summary.get("file_count", 0),
            "complexity_notes": summary.get("complexity_notes", ""),
        }

    async def _get_template_prompt(
        self,
        db: AsyncSession,
        *,
        project_id: int,
        document_id: int | None = None,
    ) -> str | None:
        """Return the system_prompt from the relevant document template, if any."""
        document: Document | None = None
        if document_id is not None:
            document = await self._fetch_document(db, document_id)
            if document.project_id != project_id:
                raise HTTPException(status_code=404, detail="Document not found")
        else:
            # Temporary fallback for project-scoped chat threads that have not yet
            # been migrated to explicit document ownership.
            result = await db.execute(
                select(Document)
                .where(Document.project_id == project_id)
                .order_by(Document.updated_at.desc(), Document.id.desc())
                .limit(1)
            )
            document = result.scalar_one_or_none()

        if document is None or document.template_id is None:
            return None
        result = await db.execute(select(Template).where(Template.id == document.template_id))
        template = result.scalar_one_or_none()
        return template.system_prompt if template else None

    # ── Public API ──────────────────────────────────────────────

    async def generate_section(
        self,
        project_id: int,
        section_id: int,
        db: AsyncSession,
        user_id: int,
        answer: str | None = None,
    ) -> tuple[str, int]:
        """Generate content and confidence score for a section using Claude.

        Returns (content_markdown, confidence_score).
        Does NOT save to DB — caller is responsible.
        """
        client, model_id = await self._get_anthropic_client(db, user_id)
        project = await self._fetch_project(db, project_id)
        section = await self._fetch_section(db, section_id)
        document = await self._fetch_document(db, section.document_id)
        if document.project_id != project_id:
            raise HTTPException(status_code=404, detail="Section not found")
        analysis = await self._fetch_latest_analysis(db, project_id)

        project_ctx = self._project_context(project)
        analysis_detail = self._analysis_detail(analysis)
        template_prompt = await self._get_template_prompt(
            db,
            project_id=project_id,
            document_id=document.id,
        )

        prompt = build_section_prompt(
            section_heading=section.heading,
            project_context=project_ctx,
            analysis=analysis_detail,
            user_clarification=answer,
            template_system_prompt=template_prompt,
        )

        response = await client.messages.create(
            model=model_id,
            max_tokens=MAX_TOKENS_SECTION,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0].text.strip()

        try:
            data = json.loads(content)
            if data.get("action") == "ask_user":
                raise NeedsClarificationException(
                    question=data.get("question", "Please provide more details."),
                    section_id=section_id,
                )

            return data.get("content", ""), data.get("confidence_score", 0)
        except json.JSONDecodeError:
            # Fallback for cases where LLM might not return JSON
            return content, 50

    async def refine_section(
        self,
        section_id: int,
        instruction: str,
        db: AsyncSession,
        user_id: int,
    ) -> dict:
        """Refine section content per instruction.

        Returns {original, refined, added, removed, diff_lines}.
        Does NOT save to DB — caller decides whether to accept.
        """
        client, model_id = await self._get_anthropic_client(db, user_id)
        section = await self._fetch_section(db, section_id)

        # Resolve project for context
        doc_result = await db.execute(
            select(Document).where(Document.id == section.document_id)
        )
        document = doc_result.scalar_one_or_none()
        project = await self._fetch_project(db, document.project_id) if document else None

        project_ctx = self._project_context(project) if project else {}
        template_prompt = (
            await self._get_template_prompt(
                db,
                project_id=document.project_id,
                document_id=document.id,
            )
            if project and document
            else None
        )
        original = section.content_md or ""

        prompt = build_refine_prompt(
            section_heading=section.heading,
            current_content=original,
            instruction=instruction,
            project_context=project_ctx,
            template_system_prompt=template_prompt,
        )

        response = await client.messages.create(
            model=model_id,
            max_tokens=MAX_TOKENS_REFINE,
            messages=[{"role": "user", "content": prompt}],
        )
        refined = response.content[0].text.strip()

        # Compute diff stats
        old_lines = original.splitlines()
        new_lines = refined.splitlines()
        matcher = difflib.SequenceMatcher(None, old_lines, new_lines)

        added = removed = 0
        diff_lines = []
        line_number = 0

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                for idx in range(i1, i2):
                    line_number += 1
                    diff_lines.append(
                        {"type": "unchanged", "content": old_lines[idx], "line_number": line_number}
                    )
            elif tag == "delete":
                removed += i2 - i1
                for idx in range(i1, i2):
                    line_number += 1
                    diff_lines.append(
                        {"type": "removed", "content": old_lines[idx], "line_number": line_number}
                    )
            elif tag == "insert":
                added += j2 - j1
                for idx in range(j1, j2):
                    line_number += 1
                    diff_lines.append(
                        {"type": "added", "content": new_lines[idx], "line_number": line_number}
                    )
            elif tag == "replace":
                removed += i2 - i1
                for idx in range(i1, i2):
                    line_number += 1
                    diff_lines.append(
                        {"type": "removed", "content": old_lines[idx], "line_number": line_number}
                    )
                added += j2 - j1
                for idx in range(j1, j2):
                    line_number += 1
                    diff_lines.append(
                        {"type": "added", "content": new_lines[idx], "line_number": line_number}
                    )

        return {
            "original": original,
            "refined": refined,
            "added": added,
            "removed": removed,
            "diff_lines": diff_lines,
        }

    async def stream_chat(
        self,
        thread_id: int,
        user_message: str,
        db: AsyncSession,
        user_id: int,
        model_name: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        references: list[str] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream a chat response for the given thread.

        Saves user message before streaming, saves AI response after.
        Yields text chunks, then "data: [DONE]\\n\\n" at the end.

        model_name, temperature, max_tokens override the credential defaults.
        references: section headings to fetch and include as context.
        """
        client, model_id = await self._get_anthropic_client(db, user_id, model_name)

        # Fetch thread + project
        thread_result = await db.execute(
            select(ChatThread).where(ChatThread.id == thread_id)
        )
        thread = thread_result.scalar_one_or_none()
        if not thread:
            raise HTTPException(status_code=404, detail="Chat thread not found")

        # Save user message
        user_msg = ChatMessage(
            thread_id=thread_id,
            role=MessageRole.USER,
            content=user_message,
        )
        db.add(user_msg)
        await db.commit()

        # Fetch last 10 messages for context
        msgs_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.thread_id == thread_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(10)
        )
        recent_messages = list(reversed(msgs_result.scalars().all()))

        history = [
            {"role": msg.role.value, "content": msg.content}
            for msg in recent_messages
        ]

        # Fetch project + analysis
        project = await self._fetch_project(db, thread.project_id)
        analysis = await self._fetch_latest_analysis(db, thread.project_id)

        project_ctx = self._project_context(project)
        analysis_summary = self._analysis_summary(analysis)
        template_prompt = await self._get_template_prompt(db, project_id=thread.project_id)

        # Determine current section from thread title (best-effort)
        current_section_heading = thread.title
        current_section_content = ""

        system_prompt, api_messages = build_chat_prompt(
            messages=history,
            current_section_heading=current_section_heading,
            current_section_content=current_section_content,
            project_context=project_ctx,
            analysis_summary=analysis_summary,
            template_system_prompt=template_prompt,
        )

        # Inject referenced sections as context
        if references:
            resolved = []
            for heading in references:
                result = await db.execute(
                    select(Section).where(
                        Section.document_id == thread.document_id,
                        Section.heading == heading,
                        Section.lifecycle_status != "DELETED",
                    )
                )
                section = result.scalar_one_or_none()
                if section and section.content_md:
                    resolved.append(f"### {heading}\n{section.content_md}")
            if resolved:
                system_prompt += "\n\n## Referenced Sections\n" + "\n\n".join(resolved)

        # Stream response
        full_response = []
        effective_max_tokens = max_tokens or MAX_TOKENS_CHAT
        effective_temperature = temperature

        async def _stream() -> AsyncGenerator[str, None]:
            kwargs = {
                "model": model_id,
                "max_tokens": effective_max_tokens,
                "system": system_prompt,
                "messages": api_messages,
            }
            if effective_temperature is not None:
                kwargs["temperature"] = effective_temperature

            async with client.messages.stream(**kwargs) as stream:
                async for text in stream.text_stream:
                    full_response.append(text)
                    yield text

            # After stream completes, save AI message
            ai_content = "".join(full_response)
            ai_msg = ChatMessage(
                thread_id=thread_id,
                role=MessageRole.AI,
                content=ai_content,
            )
            db.add(ai_msg)
            await db.commit()

        return _stream()

    async def phrasing_suggestions(
        self,
        section_id: int,
        text_fragment: str,
        db: AsyncSession,
        user_id: int,
    ) -> list[str]:
        """Generate 3 phrasing alternatives for a text fragment."""
        client, model_id = await self._get_anthropic_client(db, user_id)
        section = await self._fetch_section(db, section_id)

        prompt = (
            f"You are an expert technical writer. Provide 3 distinct phrasing alternatives "
            f"for the following text fragment from the section '{section.heading}':\n\n"
            f"\"{text_fragment}\"\n\n"
            f"Return exactly 3 options, one for each of these styles:\n"
            f"1. Professional: Polished, authoritative, and clear.\n"
            f"2. Academic: Formal, precise, and structurally rigorous.\n"
            f"3. Concise: Short, direct, and efficient.\n\n"
            f"Return the result as a JSON array of strings: [\"Professional variant...\", \"Academic variant...\", \"Concise variant...\"]"
        )

        response = await client.messages.create(
            model=model_id,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )

        content = response.content[0].text.strip()
        try:
            suggestions = json.loads(content)
            if isinstance(suggestions, list):
                return suggestions[:3]
        except json.JSONDecodeError:
            pass

        return ["Could not generate suggestions. Please try again."]

# Module-level singleton
ai_service = AIService()
