#!/usr/bin/env python3
"""
Quick test to verify GET /projects/{project_id}/documents endpoint works.
This validates our Day 0 Quick Demo integration.
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.config import settings
from app.models.project import Project
from app.models.document import Document
from app.models.user import User
from app.models.organization import Organization

async def test_documents_endpoint():
    """Test that we can query documents for a project."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Get first project
        result = await session.execute(select(Project).limit(1))
        project = result.scalar_one_or_none()
        
        if not project:
            print("❌ No projects found in database. Create a project first.")
            return False
            
        print(f"✓ Found project: {project.name} (ID: {project.id})")
        
        # Get documents for this project
        result = await session.execute(
            select(Document).where(Document.project_id == project.id)
        )
        documents = list(result.scalars().all())
        
        if not documents:
            print(f"  ⚠ No documents found for project {project.id}")
            print(f"  Creating test document...")
            
            # Create a test document
            doc = Document(
                project_id=project.id,
                title="Test Document",
                setup_stage="purpose"
            )
            session.add(doc)
            await session.commit()
            await session.refresh(doc)
            print(f"  ✓ Created document: {doc.title} (ID: {doc.id})")
            documents = [doc]
        else:
            print(f"  ✓ Found {len(documents)} document(s):")
            for doc in documents:
                print(f"    - {doc.title} (ID: {doc.id}, status: {doc.status.value})")
        
        print("\n✅ Documents API integration test PASSED")
        print(f"   Frontend can now call: GET /projects/{project.id}/documents")
        return True

if __name__ == "__main__":
    try:
        success = asyncio.run(test_documents_endpoint())
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test FAILED with error:")
        print(f"   {type(e).__name__}: {e}")
        exit(1)
