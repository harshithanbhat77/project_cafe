"""Bill maths. Everything is Decimal and rounded to paise/cents with ROUND_HALF_UP
(the rounding people expect on a bill, unlike Python's default banker's rounding)."""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .config import settings

CENT = Decimal("0.01")


def percent_of(amount: Decimal, percent: Decimal) -> Decimal:
    return (amount * percent / 100).quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass
class Bill:
    subtotal: Decimal
    service_charge: Decimal
    tax: Decimal
    total: Decimal


def make_bill(subtotal: Decimal) -> Bill:
    service_charge = percent_of(subtotal, settings.service_charge_percent)
    tax = percent_of(subtotal + service_charge, settings.tax_percent)
    return Bill(subtotal, service_charge, tax, subtotal + service_charge + tax)
