
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class TransactionLine(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    unit_price: Decimal | None = Field(default=None, ge=0)


class SaleCreate(BaseModel):
    customer_name: str | None = Field(default=None, max_length=150)
    payment_method: str = Field(default="cash", max_length=30)
    items: list[TransactionLine] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_products(self):
        ids = [item.product_id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Each product may appear only once per invoice")
        return self


class PurchaseCreate(BaseModel):
    supplier_id: int | None = Field(default=None, gt=0)
    notes: str | None = None
    items: list[TransactionLine] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_products(self):
        ids = [item.product_id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Each product may appear only once per invoice")
        return self
