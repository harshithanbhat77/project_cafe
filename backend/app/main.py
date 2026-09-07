import secrets, logging, re
from decimal import Decimal
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from .config import settings
from .db import get_db, Base, engine
from .models import *
from .schemas import *
from .auth import *
logging.basicConfig(level=logging.INFO); log=logging.getLogger("cafeflow")
app=FastAPI(title="CafeFlow API",version="1.0.0")
app.add_middleware(CORSMiddleware,allow_origins=[settings.frontend_origin],allow_credentials=True,allow_methods=["GET","POST","PATCH"],allow_headers=["*"])
@app.on_event("startup")
def startup():
    Base.metadata.create_all(engine); db=next(get_db())
    if settings.seed_demo_data and not db.scalar(select(User).where(User.email=="admin@cafeflow.local")):
        db.add(User(name="CafeFlow Admin",email="admin@cafeflow.local",password_hash=hash_password.hash("change-me-now")))
    if settings.seed_demo_data and not db.scalar(select(CafeTable).where(CafeTable.name=="Table 7")):
        c=Category(name="All-day favourites",description="Comfort food, made fresh."); db.add(c); db.flush(); db.add(CafeTable(name="Table 7",qr_token="demo-table-7-token")); db.add_all([MenuItem(category_id=c.id,name="Miso mushroom toast",description="Sourdough, miso butter, herbs",price=240,image_url="https://images.unsplash.com/photo-1547592180-85f173990554?w=800"),MenuItem(category_id=c.id,name="Smoky tomato pasta",description="Roasted tomato, chilli, parmesan",price=320,image_url="https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800"),MenuItem(category_id=c.id,name="House cold brew",description="Slow-steeped, bright and smooth",price=160,image_url="https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800")])
    db.commit(); db.close()
def item_json(i): return {"id":i.id,"category_id":i.category_id,"name":i.name,"description":i.description,"price":float(i.price),"image_url":i.image_url,"available":i.available,"active":i.active}
def order_json(o): return {"id":o.id,"reference":o.reference,"table_name":o.table.name,"status":o.status.value,"subtotal":float(o.subtotal),"total":float(o.total),"created_at":o.created_at.isoformat(),"items":[{"name":i.item_name_snapshot,"quantity":i.quantity,"unit_price":float(i.unit_price_snapshot),"line_total":float(i.line_total)} for i in o.items]}
@app.get("/health")
def health(): return {"status":"ok"}
@app.post("/api/admin/auth/login",response_model=Token)
def login(data:LoginIn,db:Session=Depends(get_db)):
    u=db.scalar(select(User).where(User.email==data.email.lower().strip()))
    if not u or not u.active or not verify_password(data.password,u.password_hash): raise HTTPException(401,"Invalid email or password")
    return Token(access_token=make_token(u))
@app.get("/api/public/tables/{token}")
def public_table(token:str,db:Session=Depends(get_db)):
    t=db.scalar(select(CafeTable).where(CafeTable.qr_token==token))
    if not t or not t.active: raise HTTPException(404,"This table is unavailable")
    cats=db.scalars(select(Category).where(Category.active).options(joinedload(Category.items))).unique().all()
    return {"table":{"name":t.name,"token":t.qr_token},"categories":[{"id":c.id,"name":c.name,"items":[item_json(i) for i in c.items if i.active]} for c in cats]}
@app.post("/api/public/tables/{token}/session")
def create_customer_session(token:str,data:CustomerSessionIn,db:Session=Depends(get_db)):
    t=db.scalar(select(CafeTable).where(CafeTable.qr_token==token))
    if not t or not t.active: raise HTTPException(404,"This table is unavailable")
    name=" ".join(data.name.strip().split())
    phone=re.sub(r"[\s().-]", "", data.phone.strip())
    if not re.fullmatch(r"\+?[0-9]{7,15}", phone): raise HTTPException(422,"Enter a valid phone number")
    if len(name)<2 or not re.search(r"[A-Za-zÀ-ÿ]",name): raise HTTPException(422,"Enter your name")
    s=CustomerSession(session_token=secrets.token_urlsafe(32),table_id=t.id,customer_name=name,customer_phone=phone); db.add(s); db.commit(); return {"session_token":s.session_token,"table":{"name":t.name,"token":t.qr_token}}
@app.post("/api/public/orders")
def create_order(data:OrderIn,db:Session=Depends(get_db)):
    old=db.scalar(select(Order).where(Order.idempotency_key==data.idempotency_key).options(joinedload(Order.items),joinedload(Order.table)))
    if old:return order_json(old)
    t=db.scalar(select(CafeTable).where(CafeTable.qr_token==data.table_token).with_for_update())
    if not t or not t.active: raise HTTPException(404,"This table is unavailable")
    session=db.scalar(select(CustomerSession).where(CustomerSession.session_token==data.session_token,CustomerSession.active==True).with_for_update())
    if not session or session.table_id!=t.id: raise HTTPException(403,"Customer session does not match this table")
    ids=[x.item_id for x in data.items]
    if len(ids)!=len(set(ids)): raise HTTPException(422,"Duplicate items are not allowed")
    rows=db.scalars(select(MenuItem).where(MenuItem.id.in_(ids)).with_for_update()).all(); by_id={i.id:i for i in rows}
    if len(rows)!=len(ids): raise HTTPException(422,"One or more items are unavailable")
    total=Decimal("0"); lines=[]
    for line in data.items:
        i=by_id[line.item_id]
        if not i.active or not i.available: raise HTTPException(409,f"{i.name} is unavailable")
        lt=Decimal(str(i.price))*line.quantity; total+=lt; lines.append(OrderItem(menu_item_id=i.id,item_name_snapshot=i.name,unit_price_snapshot=i.price,quantity=line.quantity,line_total=lt))
    o=Order(reference=f"CF-{secrets.token_hex(3).upper()}",table_id=t.id,customer_session_id=session.id,customer_name=session.customer_name,customer_phone=session.customer_phone,status=OrderStatus.PLACED,subtotal=total,total=total,idempotency_key=data.idempotency_key,items=lines); db.add(o); db.commit(); db.refresh(o); return order_json(o)
@app.get("/api/public/orders/{reference}")
def public_order(reference:str,db:Session=Depends(get_db)):
    o=db.scalar(select(Order).where(Order.reference==reference).options(joinedload(Order.items),joinedload(Order.table)))
    if not o: raise HTTPException(404,"Order not found")
    return order_json(o)
@app.get("/api/admin/orders")
def orders(_:User=Depends(current_admin),db:Session=Depends(get_db)):
    return [order_json(o) for o in db.scalars(select(Order).order_by(Order.created_at.desc()).options(joinedload(Order.items),joinedload(Order.table))).all()]
TRANSITIONS={OrderStatus.PLACED:{OrderStatus.ACCEPTED,OrderStatus.CANCELLED},OrderStatus.ACCEPTED:{OrderStatus.PREPARING,OrderStatus.CANCELLED},OrderStatus.PREPARING:{OrderStatus.READY},OrderStatus.READY:{OrderStatus.COMPLETED},OrderStatus.COMPLETED:set(),OrderStatus.CANCELLED:set()}
@app.patch("/api/admin/orders/{order_id}/status")
def update_status(order_id:int,data:StatusIn,_:User=Depends(current_admin),db:Session=Depends(get_db)):
    o=db.scalar(select(Order).where(Order.id==order_id).options(joinedload(Order.items),joinedload(Order.table)))
    if not o: raise HTTPException(404,"Order not found")
    if data.status not in TRANSITIONS[o.status]: raise HTTPException(409,f"Cannot move {o.status.value} to {data.status.value}")
    o.status=data.status; db.commit(); return order_json(o)
@app.get("/api/admin/menu")
def menu(_:User=Depends(current_admin),db:Session=Depends(get_db)): return [item_json(i) for i in db.scalars(select(MenuItem).order_by(MenuItem.id)).all()]
@app.patch("/api/admin/menu/{item_id}")
def edit_menu(item_id:int,data:ItemIn,_:User=Depends(current_admin),db:Session=Depends(get_db)):
    i=db.get(MenuItem,item_id)
    if not i: raise HTTPException(404,"Item not found")
    for k,v in data.model_dump().items(): setattr(i,k,v)
    db.commit(); return item_json(i)
@app.get("/api/admin/tables")
def tables(_:User=Depends(current_admin),db:Session=Depends(get_db)): return [{"id":t.id,"name":t.name,"token":t.qr_token,"active":t.active} for t in db.scalars(select(CafeTable)).all()]
@app.post("/api/admin/tables")
def add_table(data:TableIn,_:User=Depends(current_admin),db:Session=Depends(get_db)):
    t=CafeTable(**data.model_dump()); db.add(t); db.commit(); db.refresh(t); return {"id":t.id,"name":t.name,"token":t.qr_token,"active":t.active}
@app.patch("/api/admin/tables/{table_id}")
def edit_table(table_id:int,data:TableIn,_:User=Depends(current_admin),db:Session=Depends(get_db)):
    t=db.get(CafeTable,table_id)
    if not t: raise HTTPException(404,"Table not found")
    t.name=data.name;t.active=data.active;db.commit();return {"id":t.id,"name":t.name,"token":t.qr_token,"active":t.active}
@app.post("/api/admin/tables/{table_id}/rotate-token")
def rotate(table_id:int,_:User=Depends(current_admin),db:Session=Depends(get_db)):
    t=db.get(CafeTable,table_id)
    if not t: raise HTTPException(404,"Table not found")
    t.qr_token=secrets.token_urlsafe(32);db.commit();return {"id":t.id,"name":t.name,"token":t.qr_token,"active":t.active}
