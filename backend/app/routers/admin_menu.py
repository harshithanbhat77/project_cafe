from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Category, MenuItem
from ..schemas import (
    AvailabilityIn,
    CategoryIn,
    CategoryOut,
    CategoryUpdate,
    MenuItemIn,
    MenuItemOut,
    MenuItemUpdate,
)
from ..security import OWNER_ONLY, current_user
from .helpers import commit_or_conflict, get_or_404

router = APIRouter(prefix="/api/admin", tags=["admin: menu"], dependencies=[Depends(current_user)])

DUPLICATE_CATEGORY = "A category with that name already exists"


# ---------- Categories ----------


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.id)).all()


@router.post("/categories", response_model=CategoryOut, dependencies=OWNER_ONLY)
def create_category(data: CategoryIn, db: Session = Depends(get_db)):
    category = Category(**data.model_dump())
    db.add(category)
    commit_or_conflict(db, DUPLICATE_CATEGORY)
    return category


@router.patch("/categories/{category_id}", response_model=CategoryOut, dependencies=OWNER_ONLY)
def update_category(category_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    category = get_or_404(db, Category, category_id)
    for field, value in data.changes().items():
        setattr(category, field, value)
    commit_or_conflict(db, DUPLICATE_CATEGORY)
    return category


# ---------- Menu items ----------


@router.get("/menu", response_model=list[MenuItemOut])
def list_menu_items(db: Session = Depends(get_db)):
    return db.scalars(select(MenuItem).order_by(MenuItem.id)).all()


@router.post("/menu/{item_id}/availability", response_model=MenuItemOut)
def set_availability(item_id: int, data: AvailabilityIn, db: Session = Depends(get_db)):
    """Staff and owner: mark an item sold out (e.g. out of ingredients) or back in stock."""
    item = get_or_404(db, MenuItem, item_id)
    item.available = data.available
    db.commit()
    return item


@router.post("/menu", response_model=MenuItemOut, dependencies=OWNER_ONLY)
def create_menu_item(data: MenuItemIn, db: Session = Depends(get_db)):
    _require_category(db, data.category_id)
    item = MenuItem(**data.model_dump())
    db.add(item)
    db.commit()
    return item


@router.patch("/menu/{item_id}", response_model=MenuItemOut, dependencies=OWNER_ONLY)
def update_menu_item(item_id: int, data: MenuItemUpdate, db: Session = Depends(get_db)):
    item = get_or_404(db, MenuItem, item_id)
    changes = data.changes()
    if "category_id" in changes:
        _require_category(db, changes["category_id"])
    for field, value in changes.items():
        setattr(item, field, value)
    db.commit()
    return item


def _require_category(db: Session, category_id: int) -> None:
    if db.get(Category, category_id) is None:
        raise HTTPException(422, "Category does not exist")
