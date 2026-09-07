from app.models import OrderStatus

TRANSITIONS={OrderStatus.PLACED:{OrderStatus.ACCEPTED,OrderStatus.CANCELLED},OrderStatus.ACCEPTED:{OrderStatus.PREPARING,OrderStatus.CANCELLED},OrderStatus.PREPARING:{OrderStatus.READY},OrderStatus.READY:{OrderStatus.COMPLETED},OrderStatus.COMPLETED:set(),OrderStatus.CANCELLED:set()}

def test_status_workflow_is_forward_only():
    assert OrderStatus.ACCEPTED in TRANSITIONS[OrderStatus.PLACED]
    assert OrderStatus.PREPARING in TRANSITIONS[OrderStatus.ACCEPTED]
    assert OrderStatus.PLACED not in TRANSITIONS[OrderStatus.COMPLETED]
    assert OrderStatus.PREPARING not in TRANSITIONS[OrderStatus.CANCELLED]

def test_quantities_are_positive_and_bounded_by_schema():
    from app.schemas import OrderLineIn
    assert OrderLineIn(item_id=1, quantity=1).quantity == 1
    try: OrderLineIn(item_id=1, quantity=0)
    except Exception: pass
    else: raise AssertionError('zero quantity must be rejected')
