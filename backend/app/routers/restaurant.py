"""The restaurant's name, branding and bill rates."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..restaurant import get_restaurant
from ..schemas import Brand, RestaurantOut, RestaurantUpdate
from ..security import OWNER_ONLY, current_user

public_router = APIRouter(prefix="/api/public", tags=["guest"])
admin_router = APIRouter(prefix="/api/admin", tags=["admin: settings"], dependencies=[Depends(current_user)])


@public_router.get("/brand", response_model=Brand)
def brand(db: Session = Depends(get_db)):
    """Name, logo and colors, for pages shown before sign-in."""
    return get_restaurant(db)


@admin_router.get("/settings", response_model=RestaurantOut)
def read_settings(db: Session = Depends(get_db)):
    return get_restaurant(db)


@admin_router.patch("/settings", response_model=RestaurantOut, dependencies=OWNER_ONLY)
def update_settings(data: RestaurantUpdate, db: Session = Depends(get_db)):
    """Owner: change the name, branding or rates. Past bills keep the rates they were made with."""
    restaurant = get_restaurant(db)
    for field, value in data.changes().items():
        setattr(restaurant, field, value)
    db.commit()
    return restaurant
