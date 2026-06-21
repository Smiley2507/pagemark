import asyncio
import json
import logging
import time
from datetime import datetime

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

_DEBUG_LOG = "/tmp/pagemark_agent_debug.log"


def _agent_log(hypothesis_id: str, location: str, message: str, data: dict | None = None) -> None:
    # #region agent log
    try:
        with open(_DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "sessionId": "be49b0",
                        "hypothesisId": hypothesis_id,
                        "location": location,
                        "message": message,
                        "data": data or {},
                        "timestamp": int(time.time() * 1000),
                    }
                )
                + "\n"
            )
    except OSError:
        pass
    # #endregion
from app.models.analysis import AnalysisStatus
from app.services import git_service
from app.services.analysis_service import (
    STEP_NAMES,
    complete_analysis_snapshot_sync,
    exclusion_patterns,
    extract_zip_archive,
    get_effective_exclusions_sync,
    run_static_analysis,
    update_analysis_step_sync,
)
from app.models.document import Section, SectionStatus
from app.models.clarification import ClarificationRequest, ClarificationStatus
from app.services.ai_doc_service import ai_service
from app.exceptions import NeedsClarificationException


def run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(coro)
    except RuntimeError:
        pass
    return asyncio.run(coro)


def _fail(analysis_id: int, step_num: int, message: str, exc: Exception):
    logger.error("Analysis %d failed at step %d: %s", analysis_id, step_num, exc)
    update_analysis_step_sync(
        analysis_id,
        step_num,
        STEP_NAMES.get(step_num, "Failed"),
        status=AnalysisStatus.FAILED,
        step_detail=str(exc)[:500],
        error=str(exc)[:2000],
    )


def _run_pipeline(
    project_id: int,
    analysis_id: int,
    root_path: str,
    *,
    source_commit: str | None = None,
):
    """Steps 3-7 after source is on disk."""
    detail_holder: list[str] = []

    def on_detail(msg: str):
        detail_holder[0] = msg
        update_analysis_step_sync(
            analysis_id,
            3,
            STEP_NAMES[3],
            step_detail=msg,
        )

    update_analysis_step_sync(analysis_id, 3, STEP_NAMES[3], step_detail="Scanning files…")
    artifacts = run_static_analysis(
        root_path,
        on_step_detail=lambda m: update_analysis_step_sync(
            analysis_id,
            4,
            STEP_NAMES[4],
            step_detail=m,
        ),
    )

    langs = artifacts.languages_json.get("breakdown", [])
    lang_summary = ", ".join(f"{x['language']}" for x in langs[:5]) or "none"
    update_analysis_step_sync(
        analysis_id,
        3,
        STEP_NAMES[3],
        step_detail=f"Detected: {lang_summary}",
    )

    update_analysis_step_sync(
        analysis_id,
        4,
        STEP_NAMES[4],
        step_detail=f"Parsed {artifacts.complexity_json.get('parse_stats', {}).get('parsed_files', 0)} files",
    )

    ep_count = artifacts.endpoints_json.get("count", 0)
    update_analysis_step_sync(
        analysis_id,
        5,
        STEP_NAMES[5],
        step_detail=f"Found {ep_count} endpoints",
    )

    total_lines = artifacts.complexity_json.get("total_lines", 0)
    update_analysis_step_sync(
        analysis_id,
        6,
        STEP_NAMES[6],
        step_detail=f"{artifacts.complexity_json.get('total_files', 0)} files, {total_lines} lines",
    )

    update_analysis_step_sync(
        analysis_id,
        7,
        STEP_NAMES[7],
        step_detail="Saving analysis results",
        artifacts=artifacts,
    )
    logger.info("Pipeline complete for analysis %d, finalizing snapshot", analysis_id)
    complete_analysis_snapshot_sync(analysis_id, artifacts, source_commit=source_commit)
    logger.info("Analysis snapshot %d finalized successfully", analysis_id)


@celery_app.task(bind=True, max_retries=3)
def analyze_project_task(self, project_id: int, analysis_id: int, source_path: str, source_type: str = "zip", ignore_patterns: list[str] = None):
    _agent_log("A", "analysis_worker.py:analyze_project_task", "task_start", {"project_id": project_id, "analysis_id": analysis_id, "source_type": source_type})
    try:
        update_analysis_step_sync(
            analysis_id,
            1,
            STEP_NAMES[1],
            status=AnalysisStatus.RUNNING,
            step_detail="Validating upload",
        )
        update_analysis_step_sync(
            analysis_id,
            2,
            STEP_NAMES[2],
            step_detail="Extracting archive",
        )
        effective_patterns = ignore_patterns or exclusion_patterns(get_effective_exclusions_sync(project_id))
        root_path = extract_zip_archive(source_path, project_id, ignore_patterns=effective_patterns)
        _agent_log("A", "analysis_worker.py:analyze_project_task", "extract_ok", {"root_path": root_path})
        _run_pipeline(project_id, analysis_id, root_path)
        _agent_log("A", "analysis_worker.py:analyze_project_task", "task_done", {"analysis_id": analysis_id})
    except Exception as e:
        logger.exception("analyze_project_task failed for analysis %d", analysis_id)
        _agent_log("A", "analysis_worker.py:analyze_project_task", "task_error", {"error_type": type(e).__name__, "error": str(e)[:300]})
        step = getattr(e, "_analysis_step", 2)
        _fail(analysis_id, step, str(e), e)
        raise self.retry(exc=e, countdown=10)


@celery_app.task(bind=True, max_retries=3)
def clone_and_analyze_task(
    self, project_id: int, analysis_id: int, repo_url: str, branch: str = "main"
):
    target_path = f"/tmp/pagemark_repos/{project_id}_{analysis_id}"
    _agent_log("A", "analysis_worker.py:clone_and_analyze_task", "task_start", {"project_id": project_id, "analysis_id": analysis_id})
    try:
        update_analysis_step_sync(
            analysis_id,
            1,
            STEP_NAMES[1],
            status=AnalysisStatus.RUNNING,
            step_detail="Connecting to repository",
        )
        _agent_log("A", "analysis_worker.py:clone_and_analyze_task", "step1_ok", {"analysis_id": analysis_id})
        update_analysis_step_sync(
            analysis_id,
            2,
            STEP_NAMES[2],
            step_detail=f"Cloning branch {branch}",
        )
        effective_patterns = exclusion_patterns(get_effective_exclusions_sync(project_id))
        cloned_path = git_service.clone_repo(
            repo_url,
            target_path,
            branch,
            depth=1,
            ignore_patterns=effective_patterns,
        )
        source_commit = git_service.get_head_commit(cloned_path)
        _run_pipeline(project_id, analysis_id, cloned_path, source_commit=source_commit)
        _agent_log("A", "analysis_worker.py:clone_and_analyze_task", "task_done", {"analysis_id": analysis_id})
    except Exception as e:
        logger.exception("clone_and_analyze_task failed for analysis %d", analysis_id)
        _agent_log("A", "analysis_worker.py:clone_and_analyze_task", "task_error", {"error_type": type(e).__name__, "error": str(e)[:300]})
        _fail(analysis_id, 2, str(e), e)
        raise self.retry(exc=e, countdown=10)
    finally:
        git_service.cleanup_repo(target_path)

def _run_nlp_analysis(project_id: int, analysis_id: int):
    logger.info("Starting NLP analysis for project %d, analysis %d", project_id, analysis_id)
    from app.database import SessionLocal
    from app.models.nlp import NLPReport
    from app.models.document import Document, Section
    from app.services.nlp_service import compute_readability, extract_entities, analyze_style, generate_suggestions

    with SessionLocal() as db:
        try:
            doc = db.query(Document).filter(Document.project_id == project_id).first()
            if not doc:
                update_analysis_step_sync(analysis_id, 9, STEP_NAMES[9], status=AnalysisStatus.FAILED, step_detail="No document found")
                return

            sections = db.query(Section).filter(
                Section.document_id == doc.id,
                Section.deleted_at.is_(None),
            ).all()

            all_text = "\n".join(s.content_md or "" for s in sections)

            readability = compute_readability(all_text)
            entities = extract_entities(all_text)
            style = analyze_style(all_text)
            suggestions = generate_suggestions(style)

            report = NLPReport(
                project_id=project_id,
                readability_score=readability,
                entities=entities,
                style_analysis=style,
                suggestions=suggestions,
            )
            db.add(report)
            db.commit()

            update_analysis_step_sync(
                analysis_id, 9, STEP_NAMES[9],
                step_detail=f"Readability: {readability}, entities: {len(entities)}, suggestions: {len(suggestions)}",
            )
        except Exception as e:
            update_analysis_step_sync(
                analysis_id, 9, STEP_NAMES[9],
                status=AnalysisStatus.FAILED,
                step_detail=str(e)[:200],
            )


@celery_app.task(bind=True, max_retries=3)
def generate_section_task(self, section_id: int, project_id: int, user_id: int):
    """
    Generate content for a section.
    If AI requests clarification, it raises NeedsClarificationException
    which is caught to set the status to NEEDS_INPUT.
    """
    from app.database import SessionLocal
    with SessionLocal() as db:
        try:
            content, score = run_async(ai_service.generate_section(project_id, section_id, db, user_id))

            section = db.query(Section).filter(Section.id == section_id).first()
            if section:
                section.content_md = content
                section.confidence_score = score
                section.status = SectionStatus.DRAFT
                db.commit()

        except NeedsClarificationException as e:
            section = db.query(Section).filter(Section.id == section_id).first()
            if section:
                section.status = SectionStatus.NEEDS_INPUT

            clarification = ClarificationRequest(
                section_id=section_id,
                question=e.question,
                status=ClarificationStatus.PENDING,
            )
            db.add(clarification)
            db.commit()
        except Exception as e:
            logger.exception("generate_section_task failed for section %d", section_id)
            _agent_log("A", "analysis_worker.py:generate_section_task", "error", {"error": str(e)})
            raise self.retry(exc=e, countdown=10)

@celery_app.task(bind=True, max_retries=3)
def check_freshness_after_analysis_task(self, project_id: int, analysis_id: int):
    """After a webhook-triggered analysis, check all documents for stale sections."""
    from app.database import SessionLocal
    from app.models.analysis import Analysis
    from app.models.document import Document, Section, SectionContentLifecycle, LifecycleStatus
    from app.models.evidence import EvidenceReference

    with SessionLocal() as db:
        try:
            new_analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
            if not new_analysis:
                return

            documents = db.query(Document).filter(
                Document.project_id == project_id,
                Document.deleted_at.is_(None),
            ).all()

            for doc in documents:
                sections = db.query(Section).filter(
                    Section.document_id == doc.id,
                    Section.lifecycle_status == LifecycleStatus.ACTIVE,
                    Section.content_lifecycle == SectionContentLifecycle.REVIEWED,
                ).all()

                stale_ids: list[int] = []
                for section in sections:
                    if section.reviewed_against_analysis_id and section.reviewed_against_analysis_id != analysis_id:
                        old = db.query(Analysis).filter(Analysis.id == section.reviewed_against_analysis_id).first()
                        if old:
                            if (old.source_commit and new_analysis.source_commit and
                                    old.source_commit != new_analysis.source_commit):
                                stale_ids.append(section.id)
                                continue

                    for ev in db.query(EvidenceReference).filter(
                        EvidenceReference.section_id == section.id
                    ).all():
                        if ev.analysis_id != analysis_id:
                            stale_ids.append(section.id)
                            break

                for sid in set(stale_ids):
                    sec = db.query(Section).filter(Section.id == sid).first()
                    if sec:
                        sec.is_potentially_stale = True
                db.commit()
        except Exception:
            pass


@celery_app.task(bind=True, max_retries=3)
def resume_generation_task(self, section_id: int, answer: str, project_id: int, user_id: int):
    """
    Resume section generation after receiving user clarification.
    """
    from app.database import SessionLocal
    with SessionLocal() as db:
        try:
            content, score = run_async(ai_service.generate_section(project_id, section_id, db, user_id, answer=answer))

            section = db.query(Section).filter(Section.id == section_id).first()
            if section:
                section.content_md = content
                section.confidence_score = score
                section.status = SectionStatus.DRAFT
                db.commit()
        except Exception as e:
            raise self.retry(exc=e, countdown=10)
