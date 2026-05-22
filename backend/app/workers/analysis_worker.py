import asyncio
import os
import time
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.workers.celery_app import celery_app
from app.database import async_session
from app.models.analysis import Analysis, AnalysisStatus
from app.services import git_service

async def _update_analysis_step(analysis_id: int, step_num: int, step_name: str, status: AnalysisStatus = None, error: str = None):
    async with async_session() as db:
        result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
        analysis = result.scalar_one_or_none()
        if not analysis:
            return

        analysis.step_number = step_num
        analysis.current_step = step_name
        
        if status:
            analysis.status = status
            if status == AnalysisStatus.RUNNING and not analysis.started_at:
                analysis.started_at = datetime.utcnow()
            elif status in [AnalysisStatus.COMPLETED, AnalysisStatus.FAILED]:
                analysis.completed_at = datetime.utcnow()
        
        if error:
            analysis.error_message = error

        await db.commit()

# Need a wrapper to run async functions from sync celery task
def run_async(coro):
    loop = asyncio.get_event_loop()
    if loop.is_running():
        # Fallback if somehow already in a running loop
        import nest_asyncio
        nest_asyncio.apply()
    return asyncio.run(coro)

def _run_mock_analysis_pipeline(analysis_id: int):
    """Mocks the tree-sitter analysis pipeline steps 3-7 for now."""
    steps = [
        (3, "Detecting languages"),
        (4, "Parsing AST"),
        (5, "Detecting endpoints"),
        (6, "Computing complexity metrics"),
        (7, "Finalizing results")
    ]
    
    for step_num, step_name in steps:
        run_async(_update_analysis_step(analysis_id, step_num, step_name))
        time.sleep(1) # mock work
        
    run_async(_update_analysis_step(analysis_id, 7, "Completed", status=AnalysisStatus.COMPLETED))

@celery_app.task(bind=True, max_retries=3)
def analyze_project_task(self, project_id: int, analysis_id: int, source_path: str, source_type: str = 'zip'):
    """
    Main task for analyzing a project from a ZIP upload.
    """
    try:
        run_async(_update_analysis_step(analysis_id, 1, "Connecting to source", status=AnalysisStatus.RUNNING))
        time.sleep(1) # mock work
        
        run_async(_update_analysis_step(analysis_id, 2, "Extracting source directory"))
        time.sleep(1) # mock work
        
        _run_mock_analysis_pipeline(analysis_id)
        
    except Exception as e:
        run_async(_update_analysis_step(analysis_id, 0, "Failed", status=AnalysisStatus.FAILED, error=str(e)))
        raise self.retry(exc=e, countdown=10)


@celery_app.task(bind=True, max_retries=3)
def clone_and_analyze_task(self, project_id: int, analysis_id: int, repo_url: str, branch: str = "main"):
    """
    Main task for cloning a Git repo and analyzing it.
    """
    target_path = f"/tmp/pagemark_repos/{project_id}"
    
    try:
        run_async(_update_analysis_step(analysis_id, 1, "Connecting to repository", status=AnalysisStatus.RUNNING))
        
        # In a real scenario we might validate if it's reachable here again
        
        run_async(_update_analysis_step(analysis_id, 2, "Cloning repository"))
        
        try:
            cloned_path = git_service.clone_repo(repo_url, target_path, branch, depth=1)
        except Exception as git_err:
            raise Exception(f"Failed to clone repository: {str(git_err)}")
            
        _run_mock_analysis_pipeline(analysis_id)
        
    except Exception as e:
        run_async(_update_analysis_step(analysis_id, 0, "Failed", status=AnalysisStatus.FAILED, error=str(e)))
        raise
    finally:
        # Cleanup
        git_service.cleanup_repo(target_path)
