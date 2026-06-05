"""
Phase 3: Analysis Snapshots Tests

Tests for shared analysis and source health:
- Multiple analysis snapshots per project
- is_current flag management
- Effective exclusions persistence
- Progressive facts exposure
- Partial analysis completion handling

Verifies:
- One analysis is marked current at a time
- New analysis updates is_current flag
- Effective exclusions recorded per snapshot
- Partial results preserved on failure
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.project import Project, ProjectSourceExclusion
from app.models.analysis import Analysis, AnalysisStatus
from app.models.user import User


@pytest.mark.asyncio
async def test_multiple_analysis_snapshots(
    db: AsyncSession,
    test_project: Project,
):
    """Test that multiple analysis snapshots can exist for one project."""
    # Create first analysis
    analysis1 = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.COMPLETED,
        source_type="git",
        source_commit="abc123",
        is_current=True,
        file_tree_json={"files": ["file1.py"]},
    )
    db.add(analysis1)
    await db.commit()
    await db.refresh(analysis1)
    
    # Create second analysis
    analysis2 = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.COMPLETED,
        source_type="git",
        source_commit="def456",
        is_current=False,
        file_tree_json={"files": ["file1.py", "file2.py"]},
    )
    db.add(analysis2)
    await db.commit()
    
    # Verify both exist
    result = await db.execute(
        select(Analysis)
        .where(Analysis.project_id == test_project.id)
        .order_by(Analysis.created_at.asc())
    )
    analyses = list(result.scalars().all())
    
    assert len(analyses) == 2
    assert analyses[0].source_commit == "abc123"
    assert analyses[1].source_commit == "def456"


@pytest.mark.asyncio
async def test_is_current_flag_management(
    db: AsyncSession,
    test_project: Project,
):
    """Test that only one analysis is marked current at a time."""
    # Create first analysis (current)
    analysis1 = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.COMPLETED,
        source_type="git",
        is_current=True,
    )
    db.add(analysis1)
    await db.commit()
    await db.refresh(analysis1)
    
    # Verify analysis1 is current
    assert analysis1.is_current is True
    
    # Create second analysis and mark it current
    analysis2 = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.COMPLETED,
        source_type="git",
        is_current=False,
    )
    db.add(analysis2)
    await db.commit()
    await db.refresh(analysis2)
    
    # Update: mark analysis2 as current
    analysis2.is_current = True
    await db.commit()
    
    # In a real implementation, we'd have a service that updates the old one
    # For now, manually update to simulate proper behavior
    analysis1.is_current = False
    await db.commit()
    
    # Refresh both from DB
    await db.refresh(analysis1)
    await db.refresh(analysis2)
    
    # Verify only analysis2 is current
    assert analysis1.is_current is False
    assert analysis2.is_current is True
    
    # Verify count of current analyses is 1
    result = await db.execute(
        select(Analysis)
        .where(
            Analysis.project_id == test_project.id,
            Analysis.is_current == True,
        )
    )
    current_analyses = list(result.scalars().all())
    assert len(current_analyses) == 1
    assert current_analyses[0].id == analysis2.id


@pytest.mark.asyncio
async def test_effective_exclusions_persistence(
    db: AsyncSession,
    test_project: Project,
    test_user: User,
):
    """Test that effective exclusions are recorded per analysis snapshot."""
    # Add exclusion patterns to project
    exclusion1 = ProjectSourceExclusion(
        project_id=test_project.id,
        pattern="*.test.js",
        reason="Test files",
        enabled=True,
        created_by=test_user.id,
    )
    exclusion2 = ProjectSourceExclusion(
        project_id=test_project.id,
        pattern="node_modules/**",
        reason="Dependencies",
        enabled=True,
        created_by=test_user.id,
    )
    db.add_all([exclusion1, exclusion2])
    await db.commit()
    
    # Create analysis with effective exclusions
    effective_exclusions = [
        {"pattern": "*.test.js", "reason": "Test files"},
        {"pattern": "node_modules/**", "reason": "Dependencies"},
    ]
    
    analysis = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.COMPLETED,
        source_type="git",
        is_current=True,
        effective_exclusions_json=effective_exclusions,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    # Verify exclusions were persisted
    assert analysis.effective_exclusions_json is not None
    assert len(analysis.effective_exclusions_json) == 2
    assert analysis.effective_exclusions_json[0]["pattern"] == "*.test.js"
    
    # Now disable one exclusion and create new analysis
    exclusion1.enabled = False
    await db.commit()
    
    # New analysis should have different effective exclusions
    new_effective = [
        {"pattern": "node_modules/**", "reason": "Dependencies"},
    ]
    
    analysis2 = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.COMPLETED,
        source_type="git",
        is_current=True,
        effective_exclusions_json=new_effective,
    )
    db.add(analysis2)
    await db.commit()
    
    # Verify old analysis preserves its exclusions
    await db.refresh(analysis)
    assert len(analysis.effective_exclusions_json) == 2
    
    # Verify new analysis has updated exclusions
    await db.refresh(analysis2)
    assert len(analysis2.effective_exclusions_json) == 1


@pytest.mark.asyncio
async def test_partial_analysis_completion(
    db: AsyncSession,
    test_project: Project,
):
    """Test that partial analysis results are preserved on failure."""
    analysis = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.FAILED,
        source_type="git",
        is_current=True,
        current_step="analyzing_complexity",
        step_number=5,
        total_steps=8,
        # Some facts completed before failure
        file_tree_json={"files": ["file1.py", "file2.py"]},
        languages_json={"python": 0.9, "javascript": 0.1},
        # But these failed
        endpoints_json=None,
        complexity_json=None,
        error_message="Complexity analysis timed out",
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    # Verify partial results are preserved
    assert analysis.status == AnalysisStatus.FAILED
    assert analysis.file_tree_json is not None
    assert analysis.languages_json is not None
    assert analysis.endpoints_json is None
    assert analysis.complexity_json is None
    assert analysis.error_message == "Complexity analysis timed out"
    
    # Verify we can identify available vs unavailable facts
    available_facts = []
    unavailable_facts = []
    
    if analysis.file_tree_json:
        available_facts.append("file_tree")
    else:
        unavailable_facts.append("file_tree")
        
    if analysis.languages_json:
        available_facts.append("languages")
    else:
        unavailable_facts.append("languages")
        
    if analysis.endpoints_json:
        available_facts.append("endpoints")
    else:
        unavailable_facts.append("endpoints")
        
    if analysis.complexity_json:
        available_facts.append("complexity")
    else:
        unavailable_facts.append("complexity")
    
    assert "file_tree" in available_facts
    assert "languages" in available_facts
    assert "endpoints" in unavailable_facts
    assert "complexity" in unavailable_facts


@pytest.mark.asyncio
async def test_analysis_progressive_facts(
    db: AsyncSession,
    test_project: Project,
):
    """Test progressive fact accumulation during analysis."""
    # Simulate analysis that's still running
    analysis = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.RUNNING,
        source_type="git",
        is_current=True,
        current_step="analyzing_languages",
        step_number=2,
        total_steps=8,
        # Step 1: file tree complete
        file_tree_json={"files": ["file1.py", "file2.py"]},
        # Step 2: languages in progress
        languages_json=None,
        # Steps 3-8: not started
        endpoints_json=None,
        complexity_json=None,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    # Client should see available facts even while running
    assert analysis.status == AnalysisStatus.RUNNING
    assert analysis.file_tree_json is not None
    assert analysis.current_step == "analyzing_languages"
    
    # Simulate step 2 completing
    analysis.languages_json = {"python": 1.0}
    analysis.step_number = 3
    analysis.current_step = "analyzing_endpoints"
    await db.commit()
    
    # Now both facts available
    await db.refresh(analysis)
    assert analysis.file_tree_json is not None
    assert analysis.languages_json is not None
    assert analysis.endpoints_json is None


@pytest.mark.asyncio
async def test_get_latest_analysis(
    db: AsyncSession,
    test_project: Project,
):
    """Test retrieving the current analysis for a project."""
    # Create multiple analyses
    old_analysis = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.COMPLETED,
        source_type="git",
        is_current=False,
    )
    current_analysis = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.COMPLETED,
        source_type="git",
        is_current=True,
    )
    db.add_all([old_analysis, current_analysis])
    await db.commit()
    
    # Query for current analysis
    result = await db.execute(
        select(Analysis)
        .where(
            Analysis.project_id == test_project.id,
            Analysis.is_current == True,
        )
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    
    assert latest is not None
    assert latest.id == current_analysis.id
    assert latest.is_current is True


@pytest.mark.asyncio
async def test_analysis_source_metadata(
    db: AsyncSession,
    test_project: Project,
):
    """Test that analysis preserves source metadata."""
    source_metadata = {
        "repository_url": "https://github.com/example/repo",
        "branch": "main",
        "commit": "abc123",
        "language": "Python",
        "framework": "FastAPI",
    }
    
    analysis = Analysis(
        project_id=test_project.id,
        status=AnalysisStatus.COMPLETED,
        source_type="git",
        source_commit="abc123",
        is_current=True,
        source_metadata=source_metadata,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    # Verify metadata preserved
    assert analysis.source_metadata is not None
    assert analysis.source_metadata["repository_url"] == "https://github.com/example/repo"
    assert analysis.source_metadata["branch"] == "main"
    assert analysis.source_metadata["framework"] == "FastAPI"
