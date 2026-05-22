import asyncio
import json
import time
from datetime import datetime

from app.workers.celery_app import celery_app

_DEBUG_LOG = "/app/.cursor-debug/debug-be49b0.log"


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
    TOTAL_STEPS,
    extract_zip_archive,
    run_static_analysis,
    run_outline_step,
    run_outline_step_sync,
    update_analysis_step,
    update_analysis_step_sync,
)


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
    update_analysis_step_sync(
        analysis_id,
        step_num,
        STEP_NAMES.get(step_num, "Failed"),
        status=AnalysisStatus.FAILED,
        step_detail=str(exc)[:500],
        error=str(exc)[:2000],
    )


def _run_pipeline(project_id: int, analysis_id: int, root_path: str):
    """Steps 3–8 after source is on disk."""
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

    update_analysis_step_sync(
        analysis_id,
        8,
        STEP_NAMES[8],
        step_detail="Calling AI to adapt template outline…",
    )
    run_outline_step_sync(project_id, analysis_id, artifacts)


@celery_app.task(bind=True, max_retries=3)
def analyze_project_task(self, project_id: int, analysis_id: int, source_path: str, source_type: str = "zip"):
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
        root_path = extract_zip_archive(source_path, project_id)
        _agent_log("A", "analysis_worker.py:analyze_project_task", "extract_ok", {"root_path": root_path})
        _run_pipeline(project_id, analysis_id, root_path)
        _agent_log("A", "analysis_worker.py:analyze_project_task", "task_done", {"analysis_id": analysis_id})
    except Exception as e:
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
        cloned_path = git_service.clone_repo(repo_url, target_path, branch, depth=1)
        _run_pipeline(project_id, analysis_id, cloned_path)
        _agent_log("A", "analysis_worker.py:clone_and_analyze_task", "task_done", {"analysis_id": analysis_id})
    except Exception as e:
        _agent_log("A", "analysis_worker.py:clone_and_analyze_task", "task_error", {"error_type": type(e).__name__, "error": str(e)[:300]})
        _fail(analysis_id, 2, str(e), e)
        raise self.retry(exc=e, countdown=10)
    finally:
        git_service.cleanup_repo(target_path)
