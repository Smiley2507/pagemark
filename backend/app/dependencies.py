from fastapi import Depends
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

async def get_current_user(db: AsyncSession = Depends(get_db)):
    return None
