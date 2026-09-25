"""Request and response shapes.

Every response is an explicit model so a new database column can never leak to the
public API by accident (e.g. customer phone numbers are only in AdminOrderOut).
"""

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, ClassVar

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator, model_validator

from .models import Order, OrderStatus, Role
from .security import MIN_PASSWORD_LENGTH

# Money is stored as Decimal but sent to the frontend as a JSON number.
Money = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
Price = Annotated[Decimal, Field(ge=0, le=100000, max_digits=10, decimal_places=2)]


def _check_image_url(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if not value.startswith("https://"):
        raise ValueError("Image URL must start with https://")
    return value


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PartialUpdate(BaseModel):
    """Base for PATCH bodies. Fields left out are unchanged; sending null is only
    allowed for columns listed in `nullable_fields`."""

    nullable_fields: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="after")
    def reject_nulls(self):
        for name in self.model_fields_set:
            if getattr(self, name) is None and name not in self.nullable_fields:
                raise ValueError(f"{name} cannot be null")
        return self

    def changes(self) -> dict:
        return self.model_dump(exclude_unset=True)


# ---------- Admin auth ----------


class LoginIn(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=256)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Staff accounts ----------

Password = Annotated[str, Field(min_length=MIN_PASSWORD_LENGTH, max_length=256)]


def _check_email(value: str) -> str:
    email = value.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Enter a valid email address")
    return email


class UserOut(OrmModel):
    id: int
    name: str
    email: str
    role: Role
    active: bool


class UserIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=255)
    role: Role = Role.STAFF
    password: Password

    _email = field_validator("email")(_check_email)


class UserUpdate(PartialUpdate):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    active: bool | None = None
    password: Password | None = None


# ---------- Guest (public) ----------


class CustomerSessionIn(BaseModel):
    name: str = Field(max_length=100)
    phone: str = Field(max_length=32)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        name = " ".join(value.split())
        if len(name) < 2 or not re.search(r"[A-Za-zÀ-ÿ]", name):
            raise ValueError("Enter your name")
        return name

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, value: str) -> str:
        phone = re.sub(r"[\s().-]", "", value)
        if not re.fullmatch(r"\+?[0-9]{7,15}", phone):
            raise ValueError("Enter a valid phone number")
        return phone


class OrderLineIn(BaseModel):
    item_id: int
    quantity: int = Field(ge=1, le=50)


class OrderIn(BaseModel):
    items: list[OrderLineIn] = Field(min_length=1, max_length=50)
    idempotency_key: str = Field(min_length=8, max_length=120)
    notes: str | None = Field(default=None, max_length=300)

    @field_validator("notes")
    @classmethod
    def blank_notes_are_none(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return value.strip()


class PublicTable(BaseModel):
    name: str


class PublicMenuItem(OrmModel):
    id: int
    name: str
    description: str
    price: Money
    image_url: str | None
    available: bool


class PublicCategory(BaseModel):
    id: int
    name: str
    description: str
    items: list[PublicMenuItem]


class Charges(BaseModel):
    """Rates added to the bill, so the cart can show an estimate. The server's bill is final."""

    service_charge_percent: Money
    tax_percent: Money
    tax_label: str


class PublicMenu(BaseModel):
    table: PublicTable
    categories: list[PublicCategory]
    charges: Charges


class CustomerSessionOut(BaseModel):
    session_token: str
    expires_at: datetime
    table: PublicTable


class OrderLineOut(BaseModel):
    name: str
    quantity: int
    unit_price: Money
    line_total: Money


class OrderOut(BaseModel):
    """What a guest may see about their own order."""

    id: int
    reference: str
    table_name: str
    status: OrderStatus
    notes: str | None
    subtotal: Money
    service_charge: Money
    tax: Money
    total: Money
    created_at: datetime
    items: list[OrderLineOut]

    @classmethod
    def from_order(cls, order: Order) -> "OrderOut":
        return cls(**_order_fields(order))


class AdminOrderOut(OrderOut):
    """Staff also see who placed the order, so they can spot and cancel prank orders."""

    customer_name: str
    customer_phone: str

    @classmethod
    def from_order(cls, order: Order) -> "AdminOrderOut":
        return cls(
            **_order_fields(order),
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
        )


def _order_fields(order: Order) -> dict:
    return {
        "id": order.id,
        "reference": order.reference,
        "table_name": order.table.name,
        "status": order.status,
        "notes": order.notes,
        "subtotal": order.subtotal,
        "service_charge": order.service_charge,
        "tax": order.tax,
        "total": order.total,
        "created_at": order.created_at,
        "items": [
            OrderLineOut(
                name=line.item_name_snapshot,
                quantity=line.quantity,
                unit_price=line.unit_price_snapshot,
                line_total=line.line_total,
            )
            for line in order.items
        ],
    }


# ---------- Admin: orders ----------


class StatusIn(BaseModel):
    status: OrderStatus


class TopItem(BaseModel):
    name: str
    quantity: int


class SummaryOut(BaseModel):
    day: date
    orders: int  # not counting cancelled ones
    cancelled: int
    revenue: Money  # total of non-cancelled orders, including service charge and tax
    top_items: list[TopItem]


# ---------- Admin: categories ----------


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=1000)
    active: bool = True


class CategoryUpdate(PartialUpdate):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=1000)
    active: bool | None = None


class CategoryOut(OrmModel):
    id: int
    name: str
    description: str
    active: bool


# ---------- Admin: menu items ----------


class MenuItemIn(BaseModel):
    category_id: int
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    price: Price
    image_url: str | None = Field(default=None, max_length=500)
    available: bool = True
    active: bool = True

    _image_url = field_validator("image_url")(_check_image_url)


class MenuItemUpdate(PartialUpdate):
    """Partial update: only fields present in the request body are changed.

    e.g. `{"available": false}` marks an item as sold out without touching anything else.
    """

    category_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    price: Price | None = None
    image_url: str | None = Field(default=None, max_length=500)
    available: bool | None = None
    active: bool | None = None

    nullable_fields: ClassVar[frozenset[str]] = frozenset({"image_url"})
    _image_url = field_validator("image_url")(_check_image_url)


class AvailabilityIn(BaseModel):
    available: bool


class MenuItemOut(OrmModel):
    id: int
    category_id: int
    name: str
    description: str
    price: Money
    image_url: str | None
    available: bool
    active: bool


# ---------- Admin: tables ----------


class TableIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    active: bool = True


class TableUpdate(PartialUpdate):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    active: bool | None = None


class TableOut(OrmModel):
    id: int
    name: str
    qr_token: str
    active: bool
