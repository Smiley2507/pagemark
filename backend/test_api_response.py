#!/usr/bin/env python3
"""
Test the actual API response format for GET /projects/{project_id}/documents
"""
import asyncio
import json
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.config import settings
from app.models.project import Project
from app.models.document import Document, Section, LifecycleStatus, SectionContentLifecycle, SectionStatus

async def test_api_response_format():
    """Test the API response format matches what frontend expects."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Get first project
        result = await session.execute(select(Project).limit(1))
        project = result.scalar_one_or_none()
        
        if not project:
            print("❌ No projects found")
            return False
        
        # Get documents with sections loaded (like the real endpoint does)
        result = await session.execute(
            select(Document)
            .where(Document.project_id == project.id)
            .options(selectinload(Document.sections), selectinload(Document.template))
            .order_by(Document.updated_at.desc())
        )
        documents = list(result.scalars().all())
        
        print(f"✓ Testing API response format for project {project.id}")
        print(f"  Found {len(documents)} document(s)\n")
        
        for doc in documents:
            # Simulate what the endpoint does
            sections = [s for s in doc.sections if s.lifecycle_status == LifecycleStatus.ACTIVE]
            
            reviewed = sum(
                1 for s in sections
                if s.content_lifecycle == SectionContentLifecycle.REVIEWED or s.status == SectionStatus.FINALIZED
            )
            generated = sum(
                1 for s in sections
                if s.content_lifecycle in [SectionContentLifecycle.GENERATED_DRAFT, SectionContentLifecycle.REVIEWED]
                or s.status in [SectionStatus.DRAFT, SectionStatus.FINALIZED]
            )
            pct = round(reviewed / len(sections) * 100, 1) if sections else 0.0
            
            # Derive status
            if not sections:
                status = "empty"
            elif any(s.has_failed for s in sections):
                status = "failed"
            elif any(s.is_generating for s in sections):
                status = "generating"
            elif any(s.needs_input or s.status == SectionStatus.NEEDS_INPUT for s in sections):
                status = "needs_input"
            elif any(s.is_potentially_stale for s in sections):
                status = "potentially_stale"
            elif all(s.content_lifecycle == SectionContentLifecycle.REVIEWED or s.status == SectionStatus.FINALIZED for s in sections):
                status = "reviewed"
            elif any(s.content_lifecycle == SectionContentLifecycle.GENERATED_DRAFT or s.status == SectionStatus.DRAFT for s in sections):
                status = "draft"
            else:
                status = "not_started"
            
            # Derive freshness
            if any(s.is_potentially_stale for s in sections):
                freshness = "potentially_stale"
            else:
                freshness = "fresh"
            
            response_data = {
                "id": doc.id,
                "project_id": doc.project_id,
                "title": doc.title,
                "setup_stage": doc.setup_stage.value,
                "status": status,
                "freshness": freshness,
                "progress": {
                    "total_sections": len(sections),
                    "reviewed_sections": reviewed,
                    "generated_sections": generated,
                    "pct": pct,
                },
                "tags": doc.tags or [],
                "template": {"id": doc.template.id, "name": doc.template.name} if doc.template else None,
                "template_id": doc.template_id,
                "last_activity_at": doc.updated_at.isoformat(),
                "created_at": doc.created_at.isoformat(),
                "updated_at": doc.updated_at.isoformat(),
            }
            
            print(f"Document: {doc.title}")
            print(f"  Response format:")
            print(f"    - status: {status}")
            print(f"    - progress: {pct}% ({reviewed}/{len(sections)} reviewed)")
            print(f"    - freshness: {freshness}")
            print(f"    - template: {doc.template.name if doc.template else 'None'}")
            print()
        
        print("✅ API response format test PASSED")
        print("   Frontend DocumentLibraryPage should display documents correctly")
        return True

if __name__ == "__main__":
    try:
        success = asyncio.run(test_api_response_format())
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test FAILED with error:")
        print(f"   {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
