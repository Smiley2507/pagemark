"""Core AI service — section generation, refinement, and streaming chat."""

import asyncio
import difflib
import json
from typing import AsyncGenerator

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.analysis import Analysis, AnalysisStatus
from app.models.chat import ChatMessage, ChatMessageResource, ChatThread, MessageRole
from app.models.document import Document, Section, SectionStatus
from app.models.project import Project
from app.models.resource import Resource
from app.models.template import Template
from app.prompts.chat import build_chat_prompt
from app.prompts.refine import build_refine_prompt
from app.prompts.section import build_section_prompt
from app.services import activity_service, ai_credential_service
from app.services.ai_service import AiServiceError, complete_text
from app.services.context_assembly import context_assembly_service
from app.exceptions import NeedsClarificationException

MAX_TOKENS_SECTION = 2000
MAX_TOKENS_REFINE = 2000
MAX_TOKENS_CHAT = 1500


class AIService:
    """Async AI service backed by the user's active BYOK provider credential."""

    # ── Internal helpers ────────────────────────────────────────

    async def _get_active_credential(
        self, db: AsyncSession, user_id: int, model_name: str | None = None
    ) -> ai_credential_service.ActiveCredential:
        cred = await ai_credential_service.get_active_credential(db, user_id)
        if not cred:
            raise HTTPException(
                status_code=400,
                detail="No active AI credential found. Add an AI provider in Settings.",
            )
        if model_name:
            cred.model_id = model_name
        return cred

    async def _complete_with_active_provider(
        self,
        db: AsyncSession,
        user_id: int,
        *,
        system: str,
        user: str,
        max_tokens: int,
        model_name: str | None = None,
    ) -> str:
        cred = await self._get_active_credential(db, user_id, model_name)
        try:
            return await asyncio.to_thread(
                complete_text,
                system,
                user,
                cred.provider,
                cred.api_key,
                cred.model_id,
                max_tokens=max_tokens,
            )
        except AiServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

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
                ctx["custom_instructions"] = project.context_md
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
            return {"classes": [], "functions": [], "endpoints": [], "dependencies": [], "source_files": []}

        classes: list = []
        functions: list = []
        endpoints: list = []
        dependencies: list = []
        source_files: list[str] = []

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

        if analysis.file_contents_json:
            if isinstance(analysis.file_contents_json, dict):
                source_files.extend([str(path) for path in analysis.file_contents_json.keys()][:30])

        if analysis.file_tree_json and isinstance(analysis.file_tree_json, dict):
            def _walk(node: dict, prefix: str = "") -> None:
                name = str(node.get("name") or "")
                node_type = node.get("type")
                current = f"{prefix}/{name}".strip("/") if name and name != "/" else prefix
                if node_type == "file" and current:
                    source_files.append(current)
                    return
                children = node.get("children")
                if isinstance(children, list):
                    for child in children:
                        if isinstance(child, dict):
                            next_prefix = current if current else prefix
                            _walk(child, next_prefix)

            _walk(analysis.file_tree_json)

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
            "source_files": list(dict.fromkeys(source_files))[:30],
            "languages": summary.get("languages", ""),
            "file_count": summary.get("file_count", 0),
            "complexity_notes": summary.get("complexity_notes", ""),
        }

    def _parse_ai_action(self, raw: str) -> dict | None:
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None
        return data if isinstance(data, dict) else None

    def _clarification_question(self, data: dict, default: str) -> str:
        return (
            data.get("question")
            or data.get("reason")
            or data.get("message")
            or default
        )

    def _format_context_action(self, data: dict) -> str:
        action = data.get("action")
        label = "Insufficient source context" if action == "insufficient_context" else "Clarification needed"
        question = self._clarification_question(data, "Please provide more source-grounded detail.")
        return f"**{label}**\n\n{question}"

    async def _get_template_prompt(
        self,
        db: AsyncSession,
        *,
        project_id: int,
        document_id: int | None = None,
    ) -> str | None:
        """Return the system_prompt and guidance combined from the document template, if any."""
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
        if template is None:
            return None
        parts: list[str] = []
        if template.system_prompt:
            parts.append(template.system_prompt)
        if template.guidance:
            parts.append(f"Writing guidance: {template.guidance}")
        return "\n\n".join(parts) if parts else None

    # ── Public API ──────────────────────────────────────────────

    async def generate_section(
        self,
        project_id: int,
        section_id: int,
        db: AsyncSession,
        user_id: int,
        answer: str | None = None,
        model_name: str | None = None,
    ) -> tuple[str, int]:
        """Generate content and confidence score for a section using the active provider.

        Returns (content_markdown, confidence_score).
        Does NOT save to DB — caller is responsible.
        """
        project = await self._fetch_project(db, project_id)
        section = await self._fetch_section(db, section_id)
        document = await self._fetch_document(db, section.document_id)
        if document.project_id != project_id:
            raise HTTPException(status_code=404, detail="Section not found")
        analysis = await self._fetch_latest_analysis(db, project_id)

        project_ctx = self._project_context(project)
        analysis_detail = self._analysis_detail(analysis)
        project_ctx["source_files"] = analysis_detail.get("source_files", [])
        template_prompt = await self._get_template_prompt(
            db,
            project_id=project_id,
            document_id=document.id,
        )

        wf = section.workflow_metadata or {}
        section_guidance = wf.get("guidance") if isinstance(wf, dict) else None
        expected_sources = wf.get("expected_sources") if isinstance(wf, dict) else None

        prompt = build_section_prompt(
            section_heading=section.heading,
            project_context=project_ctx,
            analysis=analysis_detail,
            user_clarification=answer,
            template_system_prompt=template_prompt,
            section_guidance=section_guidance,
            expected_sources=expected_sources,
        )

        content = await self._complete_with_active_provider(
            db,
            user_id,
            system="Return valid JSON for the requested documentation section.",
            user=prompt,
            max_tokens=MAX_TOKENS_SECTION,
            model_name=model_name,
        )

        try:
            data = json.loads(content)
            if data.get("action") in {"ask_user", "insufficient_context"}:
                raise NeedsClarificationException(
                    question=self._clarification_question(data, "Please provide more details."),
                    section_id=section_id,
                    action=data.get("action", "ask_user"),
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
        model_name: str | None = None,
    ) -> dict:
        """Refine section content per instruction.

        Returns {original, refined, added, removed, diff_lines}.
        Does NOT save to DB — caller decides whether to accept.
        """
        section = await self._fetch_section(db, section_id)

        # Resolve project for context
        doc_result = await db.execute(
            select(Document).where(Document.id == section.document_id)
        )
        document = doc_result.scalar_one_or_none()
        project = await self._fetch_project(db, document.project_id) if document else None

        project_ctx = self._project_context(project) if project else {}
        analysis_detail = self._analysis_detail(await self._fetch_latest_analysis(db, document.project_id)) if project and document else {"source_files": []}
        project_ctx["source_files"] = analysis_detail.get("source_files", [])
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

        refined = await self._complete_with_active_provider(
            db,
            user_id,
            system="Refine the section content according to the user instruction.",
            user=prompt,
            max_tokens=MAX_TOKENS_REFINE,
            model_name=model_name,
        )

        parsed = self._parse_ai_action(refined)
        if parsed and parsed.get("action") in {"ask_user", "insufficient_context"}:
            return {
                "original": original,
                "refined": "",
                "added": 0,
                "removed": 0,
                "diff_lines": [],
                "action": parsed.get("action"),
                "question": self._clarification_question(
                    parsed,
                    "Please provide more context before refining this section.",
                ),
            }
        if parsed and "content" in parsed:
            refined = str(parsed.get("content") or "")

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
        target_section_id: int | None = None,
        references: list[str] | None = None,
        resources: list[Resource] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream a chat response for the given thread.

        Saves user message before streaming, saves AI response after.
        Yields text chunks, then "data: [DONE]\\n\\n" at the end.

        model_name, temperature, max_tokens override the credential defaults.
        references: section headings to fetch and include as context.
        resources: pre-resolved Resource objects to attach and include as context.
        """
        cred = await self._get_active_credential(db, user_id, model_name)

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
        await db.flush()

        # Persist resource attachments
        if resources:
            for resource in resources:
                db.add(ChatMessageResource(
                    message_id=user_msg.id,
                    resource_id=resource.id,
                ))
            await db.commit()
        else:
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
        analysis_summary["source_files"] = self._analysis_detail(analysis).get("source_files", [])
        template_prompt = await self._get_template_prompt(db, project_id=thread.project_id)

        current_section_heading = thread.title
        current_section_content = ""
        if target_section_id:
            section = await self._fetch_section(db, target_section_id)
            document = await self._fetch_document(db, section.document_id)
            if document.project_id != thread.project_id:
                raise HTTPException(status_code=404, detail="Section not found")
            current_section_heading = section.title or section.heading
            current_section_content = section.content_md or ""

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

        # Inject attached resources as context via context_assembly_service
        assembly_result = None
        if resources:
            assembly_result = context_assembly_service.assemble(resources, cred.provider)
            if assembly_result.system_context:
                system_prompt += assembly_result.system_context

        # Stream response
        full_response = []
        effective_max_tokens = max_tokens or MAX_TOKENS_CHAT
        effective_temperature = temperature

        async def _stream() -> AsyncGenerator[str, None]:
            # Anthropic supports native async streaming via its SDK.
            # All other providers (Google, OpenAI, OpenCode Go) deliver a single
            # response via complete_text and it is emitted as a single chunk.
            if cred.provider == "anthropic":
                import anthropic as _anthropic

                client = _anthropic.AsyncAnthropic(api_key=cred.api_key)

                # Inject vision content blocks for image resources
                msgs = list(api_messages)
                if assembly_result and assembly_result.image_count > 0:
                    vision_blocks = context_assembly_service.get_vision_content_blocks(resources)
                    if vision_blocks and msgs:
                        last = msgs[-1]
                        if last["role"] == "user":
                            last["content"] = [
                                {"type": "text", "text": last["content"]},
                                *vision_blocks,
                            ]

                kwargs = {
                    "model": cred.model_id,
                    "max_tokens": effective_max_tokens,
                    "system": system_prompt,
                    "messages": msgs,
                }
                if effective_temperature is not None:
                    kwargs["temperature"] = effective_temperature

                async with client.messages.stream(**kwargs) as stream:
                    async for text in stream.text_stream:
                        full_response.append(text)
                        yield text

                ai_content = "".join(full_response)
            else:
                transcript = "\n".join(
                    f"{message['role']}: {message['content']}" for message in api_messages
                )
                try:
                    ai_content = await asyncio.to_thread(
                        complete_text,
                        system_prompt,
                        transcript,
                        cred.provider,
                        cred.api_key,
                        cred.model_id,
                        max_tokens=effective_max_tokens,
                    )
                except AiServiceError as exc:
                    raise HTTPException(status_code=400, detail=str(exc)) from exc

                parsed = self._parse_ai_action(ai_content)
                if parsed and parsed.get("action") in {"ask_user", "insufficient_context"}:
                    ai_content = self._format_context_action(parsed)
                elif parsed and "content" in parsed:
                    ai_content = str(parsed.get("content") or "")

                full_response.append(ai_content)
                yield ai_content

            # Save AI message after generation completes
            ai_msg = ChatMessage(
                thread_id=thread_id,
                role=MessageRole.AI,
                content=ai_content,
            )
            db.add(ai_msg)
            await db.commit()
            await activity_service.record_event(
                db,
                thread.project_id,
                "ai_chat_completed",
                section_id=target_section_id,
                message="AI response completed",
                payload={
                    "model": cred.model_id,
                    "provider": cred.provider,
                    "thread_id": thread_id,
                },
            )

        return _stream()

    async def phrasing_suggestions(
        self,
        section_id: int,
        text_fragment: str,
        db: AsyncSession,
        user_id: int,
    ) -> list[str]:
        """Generate 3 phrasing alternatives for a text fragment."""
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

        content = await self._complete_with_active_provider(
            db,
            user_id,
            system="Return exactly a JSON array of three strings.",
            user=prompt,
            max_tokens=1000,
        )
        try:
            suggestions = json.loads(content)
            if isinstance(suggestions, list):
                return suggestions[:3]
        except json.JSONDecodeError:
            pass

        return ["Could not generate suggestions. Please try again."]

    async def suggest_structure(
        self,
        document_id: int,
        db: AsyncSession,
        user_id: int,
    ) -> list[dict]:
        """Ask AI to suggest structural improvements for a document's sections.

        Returns a list of suggestion dicts with keys:
          type (reorder|rename|add|remove|merge),
          section_id, heading, suggested_heading, suggested_order,
          suggested_parent_heading, suggested_content_md, target_section_id,
          reasoning.
        """
        document = await self._fetch_document(db, document_id)
        project = await self._fetch_project(db, document.project_id)

        # Fetch active sections ordered by index
        result = await db.execute(
            select(Section)
            .where(
                Section.document_id == document_id,
                Section.lifecycle_status != "DELETED",
            )
            .order_by(Section.order_index)
        )
        sections = result.scalars().all()

        analysis = await self._fetch_latest_analysis(db, project.id)
        analysis_detail = self._analysis_detail(analysis) if analysis else {}

        current_structure = [
            {
                "id": s.id,
                "heading": s.heading,
                "order": s.order_index,
                "has_content": bool(s.content_md and s.content_md.strip()),
                "parent_id": s.parent_id,
            }
            for s in sections
        ]

        project_ctx = self._project_context(project)

        prompt = (
            f"You are a documentation structure expert. Analyze the document '"
            f'{document.title}\' for the project "{project.name}" and suggest '
            f"structural improvements to its section outline.\n\n"
            f"## Project Context\n"
            f"- Name: {project_ctx.get('name', '')}\n"
            f"- Language: {project_ctx.get('language', '')}\n"
            f"- Framework: {project_ctx.get('framework', '')}\n"
            f"- Description: {project_ctx.get('key_features', '')}\n\n"
            f"## Current Section Structure (in order)\n"
            f"{json.dumps(current_structure, indent=2)}\n\n"
            f"## Analysis Facts\n"
            f"- Languages: {analysis_detail.get('languages', '')}\n"
            f"- Classes: {json.dumps(analysis_detail.get('classes', [])[:10])}\n"
            f"- Functions: {json.dumps(analysis_detail.get('functions', [])[:10])}\n"
            f"- Endpoints: {json.dumps(analysis_detail.get('endpoints', [])[:15])}\n"
            f"- Dependencies: {json.dumps(analysis_detail.get('dependencies', [])[:10])}\n"
            f"- File count: {analysis_detail.get('file_count', 0)}\n"
            f"- Complexity notes: {analysis_detail.get('complexity_notes', '')}\n\n"
            f"## Task\n"
            f"Suggest structural improvements. Consider:\n"
            f"1. **Reorder** — if logical ordering could be improved\n"
            f"2. **Rename** — if a heading is unclear or too generic\n"
            f"3. **Add** — if a heading is missing based on analysis facts\n"
            f"4. **Remove** — if a section is irrelevant, empty, or redundant\n"
            f"5. **Merge** — if two adjacent sections overlap or one is too short\n\n"
            f"Return a JSON object with a single key 'suggestions' containing an array "
            f"of objects, each with:\n"
            f'- "type": one of "reorder", "rename", "add", "remove", "merge"\n'
            f'- "section_id": int (the section id for rename/reorder/remove, null for add)\n'
            f'- "target_section_id": int (for merge — the section to merge into)\n'
            f'- "heading": str (current heading, null for add)\n'
            f'- "suggested_heading": str (new heading for rename, or heading for add)\n'
            f'- "suggested_order": int (new position index, for reorder)\n'
            f'- "suggested_parent_heading": str or null (for add, which section to add under)\n'
            f'- "suggested_content_md": str or null (for add, a concise initial markdown draft grounded in analysis facts)\n'
            f'- "reasoning": str (why this change is suggested)\n\n'
            f"If the structure is already optimal, return an empty suggestions array.\n\n"
            f"Return ONLY valid JSON. No preamble."
        )

        content = await self._complete_with_active_provider(
            db,
            user_id,
            system="Return only valid JSON with structural suggestions.",
            user=prompt,
            max_tokens=2000,
        )

        try:
            data = json.loads(content)
            suggestions = data.get("suggestions", [])
            if isinstance(suggestions, list):
                return suggestions[:15]
            return []
        except (json.JSONDecodeError, TypeError):
            return []


# Module-level singleton
ai_service = AIService()
