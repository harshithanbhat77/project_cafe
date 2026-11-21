"""The restaurant's settings row: name, branding and bill rates."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .models import RestaurantSettings

DEFAULT_ACCENT = "#b4532a"


def get_restaurant(db: Session) -> RestaurantSettings:
    """Return the settings row, creating it from the .env defaults on first use.

    Existing installs therefore keep the rates they already had in .env; after that,
    the owner changes them in the dashboard."""
    row = db.get(RestaurantSettings, 1)
    if row is not None:
        return row
    db.add(
        RestaurantSettings(
            id=1,
            name=settings.restaurant_name,
            accent_color=DEFAULT_ACCENT,
            currency=settings.currency.upper(),
            service_charge_percent=settings.service_charge_percent,
            tax_percent=settings.tax_percent,
            tax_label=settings.tax_label,
        )
    )
    try:
        db.commit()
    except IntegrityError:
        # Another request created it at the same moment.
        db.rollback()
    return db.get(RestaurantSettings, 1)
