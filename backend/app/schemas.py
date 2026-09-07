from pydantic import BaseModel, Field
from .models import OrderStatus
class LoginIn(BaseModel): email:str; password:str
class Token(BaseModel): access_token:str; token_type:str="bearer"
class OrderLineIn(BaseModel): item_id:int; quantity:int=Field(ge=1,le=50)
class CustomerSessionIn(BaseModel): name:str=Field(min_length=2,max_length=100); phone:str=Field(min_length=7,max_length=32)
class OrderIn(BaseModel): table_token:str; session_token:str=Field(min_length=20,max_length=96); items:list[OrderLineIn]=Field(min_length=1,max_length=50); idempotency_key:str=Field(min_length=8,max_length=120)
class StatusIn(BaseModel): status:OrderStatus
class TableIn(BaseModel): name:str=Field(min_length=1,max_length=80); active:bool=True
class ItemIn(BaseModel): category_id:int; name:str=Field(min_length=1,max_length=120); description:str=""; price:float=Field(ge=0); image_url:str|None=None; available:bool=True; active:bool=True
