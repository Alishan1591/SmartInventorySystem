from contextlib import asynccontextmanager
from decimal import Decimal
from sqlalchemy import select
from transaction_schemas import SaleCreate, PurchaseCreate
from datetime import datetime, timedelta
from datetime import datetime, date


from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from database import Base, engine, get_db
from schemas import (
    CategoryCreate,
    CategoryResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    SupplierCreate,
    SupplierResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Smart Inventory Management System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Smart Inventory API is running"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "healthy", "database": "connected"}


# ---------------- PRODUCTS ----------------

@app.post("/api/products", response_model=ProductResponse, status_code=201)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(models.Product).where(models.Product.sku == data.sku)
    )
    if existing:
        raise HTTPException(status_code=409, detail="SKU already exists")

    if data.category_id is not None:
        if not db.get(models.Category, data.category_id):
            raise HTTPException(status_code=404, detail="Category not found")

    if data.supplier_id is not None:
        if not db.get(models.Supplier, data.supplier_id):
            raise HTTPException(status_code=404, detail="Supplier not found")

    product = models.Product(**data.model_dump())
    db.add(product)

    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not create product")

    return product


@app.get("/api/products", response_model=list[ProductResponse])
def list_products(
    search: str | None = None,
    low_stock: bool = False,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    statement = select(models.Product)

    if search:
        term = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                models.Product.name.ilike(term),
                models.Product.sku.ilike(term),
            )
        )

    if low_stock:
        statement = statement.where(
            models.Product.quantity <= models.Product.reorder_level
        )

    statement = statement.order_by(models.Product.id.desc())
    statement = statement.offset(skip).limit(limit)

    return list(db.scalars(statement).all())


@app.get("/api/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.put("/api/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(product, field, value)

    if product.category_id is not None and not db.get(
        models.Category, product.category_id
    ):
        raise HTTPException(status_code=404, detail="Category not found")

    if product.supplier_id is not None and not db.get(
        models.Supplier, product.supplier_id
    ):
        raise HTTPException(status_code=404, detail="Supplier not found")

    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid product update")

    return product


@app.delete("/api/products/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(models.Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Product is referenced by other records",
        )


# ---------------- CATEGORIES ----------------

@app.post("/api/categories", response_model=CategoryResponse, status_code=201)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
):
    category = models.Category(**data.model_dump())
    db.add(category)

    try:
        db.commit()
        db.refresh(category)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category already exists")

    return category


@app.get("/api/categories", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    return list(
        db.scalars(select(models.Category).order_by(models.Category.name)).all()
    )
@app.put("/api/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    data: CategoryCreate,
    db: Session = Depends(get_db),
):
    category = db.get(models.Category, category_id)

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found",
        )

    updates = data.model_dump()

    # Prevent duplicate category names
    existing = db.scalar(
        select(models.Category).where(
            func.lower(models.Category.name) == updates["name"].strip().lower(),
            models.Category.id != category_id,
        )
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Category name already exists",
        )

    category.name = updates["name"].strip()
    category.description = (
        updates.get("description") or None
    )

    try:
        db.commit()
        db.refresh(category)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Category name already exists",
        )

    return category
@app.delete("/api/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
):
    category = db.get(models.Category, category_id)

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found",
        )

    # Do not delete categories assigned to products
    product_count = db.scalar(
        select(func.count(models.Product.id)).where(
            models.Product.category_id == category_id
        )
    ) or 0

    if product_count > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot delete this category because "
                f"{product_count} product(s) use it. "
                "Reassign those products first."
            ),
        )

    db.delete(category)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Category is referenced by other records",
        )

# ---------------- SUPPLIERS ----------------

@app.post("/api/suppliers", response_model=SupplierResponse, status_code=201)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
):
    supplier = models.Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@app.get("/api/suppliers", response_model=list[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db)):
    return list(
        db.scalars(select(models.Supplier).order_by(models.Supplier.name)).all()
    )


# ---------------- DASHBOARD ----------------

@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    total_products = db.scalar(
        select(func.count(models.Product.id))
    ) or 0

    low_stock_items = db.scalar(
        select(func.count(models.Product.id)).where(
            models.Product.quantity <= models.Product.reorder_level
        )
    ) or 0

    inventory_value = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    models.Product.quantity * models.Product.unit_price
                ),
                0,
            )
        )
    ) or 0

    total_sales = db.scalar(
        select(func.coalesce(func.sum(models.Sale.total_amount), 0))
    ) or 0

    total_suppliers = db.scalar(
        select(func.count(models.Supplier.id))
    ) or 0

    return {
        "total_products": total_products,
        "low_stock_items": low_stock_items,
        "inventory_value": float(inventory_value),
        "total_sales": float(total_sales),
        "total_suppliers": total_suppliers,
    }


def record_movement(db, product_id, movement_type, quantity_change, note):
    db.add(models.StockMovement(
        product_id=product_id,
        movement_type=movement_type,
        quantity_change=quantity_change,
        note=note,
    ))


@app.post("/api/sales", status_code=201)
def create_sale(data: SaleCreate, db: Session = Depends(get_db)):
    try:
        if data.payment_method not in {"cash", "card", "upi", "bank_transfer"}:
            raise HTTPException(status_code=422, detail="Invalid payment method")

        if data.customer_name is not None:
            data.customer_name = data.customer_name.strip() or None

        products = {}
        for item in data.items:
            product = db.scalar(
                select(models.Product)
                .where(models.Product.id == item.product_id)
                .with_for_update()
            )
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
            if product.quantity < item.quantity:
                raise HTTPException(
                    status_code=409,
                    detail=f"Insufficient stock for {product.name}; available: {product.quantity}",
                )
            products[item.product_id] = product

        total = Decimal("0.00")
        lines = []
        for item in data.items:
            product = products[item.product_id]
            price = (
                item.unit_price
                if item.unit_price is not None
                else product.unit_price
            )
            line_total = price * item.quantity
            total += line_total
            lines.append((item, product, price, line_total))

        sale = models.Sale(
            customer_name=data.customer_name,
            payment_method=data.payment_method,
            total_amount=total,
        )
        db.add(sale)
        db.flush()
        sale.invoice_number = f"SALE-{sale.id:06d}"

        for item, product, price, line_total in lines:
            product.quantity -= item.quantity
            db.add(models.SaleItem(
                sale_id=sale.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_price=price,
                line_total=line_total,
            ))
            record_movement(
                db, product.id, "sale", -item.quantity,
                f"Invoice {sale.invoice_number}",
            )

        db.commit()
        return {
            "id": sale.id,
            "invoice_number": sale.invoice_number,
            "customer_name": sale.customer_name,
            "payment_method": sale.payment_method,
            "total_amount": str(total),
            "items": [
                {
                    "product_id": item.product_id,
                    "name": product.name,
                    "quantity": item.quantity,
                    "unit_price": str(price),
                    "line_total": str(line_total),
                }
                for item, product, price, line_total in lines
            ],
            "message": "Sale recorded and stock updated",
        }
    except Exception:
        db.rollback()
        raise


@app.post("/api/purchases", status_code=201)
def create_purchase(data: PurchaseCreate, db: Session = Depends(get_db)):
    try:
        if data.supplier_id is not None and not db.get(
            models.Supplier, data.supplier_id
        ):
            raise HTTPException(status_code=404, detail="Supplier not found")

        products = {}
        for item in data.items:
            product = db.scalar(
                select(models.Product)
                .where(models.Product.id == item.product_id)
                .with_for_update()
            )
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
            products[item.product_id] = product

        total = Decimal("0.00")
        lines = []
        for item in data.items:
            product = products[item.product_id]
            price = (
                item.unit_price
                if item.unit_price is not None
                else product.unit_price
            )
            line_total = price * item.quantity
            total += line_total
            lines.append((item, product, price, line_total))

        purchase = models.Purchase(
            supplier_id=data.supplier_id,
            notes=data.notes,
            total_amount=total,
        )
        db.add(purchase)
        db.flush()
        purchase.invoice_number = f"PUR-{purchase.id:06d}"

        for item, product, price, line_total in lines:
            product.quantity += item.quantity
            db.add(models.PurchaseItem(
                purchase_id=purchase.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_price=price,
                line_total=line_total,
            ))
            record_movement(
                db, product.id, "purchase", item.quantity,
                f"Invoice {purchase.invoice_number}",
            )

        db.commit()
        return {
            "id": purchase.id,
            "invoice_number": purchase.invoice_number,
            "supplier_id": purchase.supplier_id,
            "total_amount": str(total),
            "items": [
                {
                    "product_id": item.product_id,
                    "name": product.name,
                    "quantity": item.quantity,
                    "unit_price": str(price),
                    "line_total": str(line_total),
                }
                for item, product, price, line_total in lines
            ],
            "message": "Purchase recorded and stock updated",
        }
    except Exception:
        db.rollback()
        raise


@app.get("/api/sales")
def list_sales(db: Session = Depends(get_db)):
    sales = db.scalars(
        select(models.Sale).order_by(models.Sale.id.desc()).limit(100)
    ).all()
    return [
        {
            "id": sale.id,
            "invoice_number": sale.invoice_number,
            "customer_name": sale.customer_name,
            "payment_method": sale.payment_method,
            "total_amount": str(sale.total_amount),
            "created_at": sale.created_at,
        }
        for sale in sales
    ]


@app.get("/api/purchases")
def list_purchases(db: Session = Depends(get_db)):
    purchases = db.scalars(
        select(models.Purchase).order_by(models.Purchase.id.desc()).limit(100)
    ).all()
    return [
        {
            "id": purchase.id,
            "invoice_number": purchase.invoice_number,
            "supplier_id": purchase.supplier_id,
            "total_amount": str(purchase.total_amount),
            "notes": purchase.notes,
            "created_at": purchase.created_at,
        }
        for purchase in purchases
    ]
@app.get("/api/sales/{sale_id}")
def get_sale_invoice(sale_id: int, db: Session = Depends(get_db)):
    sale = db.get(models.Sale, sale_id)

    if sale is None:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    items = db.scalars(
        select(models.SaleItem).where(
            models.SaleItem.sale_id == sale.id
        )
    ).all()

    product_ids = [item.product_id for item in items]
    products = {
        product.id: product
        for product in db.scalars(
            select(models.Product).where(
                models.Product.id.in_(product_ids)
            )
        ).all()
    } if product_ids else {}

    return {
        "id": sale.id,
        "invoice_number": sale.invoice_number,
        "customer_name": sale.customer_name,
        "payment_method": sale.payment_method,
        "total_amount": str(sale.total_amount),
        "created_at": sale.created_at,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": (
                    products[item.product_id].name
                    if item.product_id in products
                    else f"Product #{item.product_id}"
                ),
                "sku": (
                    products[item.product_id].sku
                    if item.product_id in products
                    else None
                ),
                "quantity": item.quantity,
                "unit_price": str(item.unit_price),
                "line_total": str(item.line_total),
            }
            for item in items
        ],
    }


@app.get("/api/purchases/{purchase_id}")
def get_purchase_invoice(
    purchase_id: int,
    db: Session = Depends(get_db),
):
    purchase = db.get(models.Purchase, purchase_id)

    if purchase is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase invoice not found",
        )

    items = db.scalars(
        select(models.PurchaseItem).where(
            models.PurchaseItem.purchase_id == purchase.id
        )
    ).all()

    product_ids = [item.product_id for item in items]
    products = {
        product.id: product
        for product in db.scalars(
            select(models.Product).where(
                models.Product.id.in_(product_ids)
            )
        ).all()
    } if product_ids else {}

    return {
        "id": purchase.id,
        "invoice_number": purchase.invoice_number,
        "supplier_id": purchase.supplier_id,
        "total_amount": str(purchase.total_amount),
        "notes": purchase.notes,
        "created_at": purchase.created_at,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": (
                    products[item.product_id].name
                    if item.product_id in products
                    else f"Product #{item.product_id}"
                ),
                "sku": (
                    products[item.product_id].sku
                    if item.product_id in products
                    else None
                ),
                "quantity": item.quantity,
                "unit_price": str(item.unit_price),
                "line_total": str(item.line_total),
            }
            for item in items
        ],
    }
    transaction_type = transaction_type.lower().strip()

    if transaction_type not in {"all", "sale", "purchase"}:
        raise HTTPException(
            status_code=400,
            detail="transaction_type must be all, sale, or purchase",
        )

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    def within_date_range(transaction):
        if not transaction.created_at:
            return False

        transaction_date = transaction.created_at.date()

        if start_date and transaction_date < start_date:
            return False

        if end_date and transaction_date > end_date:
            return False

        return True

    sales = [
        sale for sale in sales
        if within_date_range(sale)
    ]

    purchases = [
        purchase for purchase in purchases
        if within_date_range(purchase)
    ]

    if transaction_type == "sale":
        purchases = []
    elif transaction_type == "purchase":
        sales = []


# ------------------------ Transaction Analytics ------------------------

@app.get("/api/analytics/transactions")
def transaction_analytics(
    start_date: date | None = None,
    end_date: date | None = None,
    transaction_type: str = "all",
    db: Session = Depends(get_db),
):
    sales = db.scalars(
        select(models.Sale).order_by(models.Sale.id.desc())
    ).all()

    purchases = db.scalars(
        select(models.Purchase).order_by(models.Purchase.id.desc())
    ).all()

    transaction_type = transaction_type.lower().strip()

    if transaction_type not in {"all", "sale", "purchase"}:
        raise HTTPException(
            status_code=400,
            detail="transaction_type must be all, sale, or purchase",
        )

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    def within_date_range(transaction):
        if not transaction.created_at:
            return False

        transaction_date = transaction.created_at.date()

        if start_date and transaction_date < start_date:
            return False

        if end_date and transaction_date > end_date:
            return False

        return True

    sales = [
        sale for sale in sales
        if within_date_range(sale)
    ]

    purchases = [
        purchase for purchase in purchases
        if within_date_range(purchase)
    ]

    if transaction_type == "sale":
        purchases = []
    elif transaction_type == "purchase":
        sales = []

    def amount(value):
        return float(value or 0)

    total_sales = sum(
        (Decimal(str(s.total_amount or 0)) for s in sales),
        Decimal("0"),
    )

    total_purchases = sum(
        (Decimal(str(p.total_amount or 0)) for p in purchases),
        Decimal("0"),
    )

    today = datetime.now().date()

    today_sales = sum(
        (
            Decimal(str(s.total_amount or 0))
            for s in sales
            if s.created_at and s.created_at.date() == today
        ),
        Decimal("0"),
    )

    today_purchases = sum(
        (
            Decimal(str(p.total_amount or 0))
            for p in purchases
            if p.created_at and p.created_at.date() == today
        ),
        Decimal("0"),
    )

    recent = []

    for sale in sales:
        recent.append({
            "id": sale.id,
            "invoice_number": sale.invoice_number,
            "type": "Sale",
            "party": sale.customer_name or "Walk-in Customer",
            "total": amount(sale.total_amount),
            "created_at": (
                sale.created_at.isoformat()
                if sale.created_at else None
            ),
        })

    for purchase in purchases:
        recent.append({
            "id": purchase.id,
            "invoice_number": purchase.invoice_number,
            "type": "Purchase",
            "party": (
                f"Supplier #{purchase.supplier_id}"
                if purchase.supplier_id else "Not specified"
            ),
            "total": amount(purchase.total_amount),
            "created_at": (
                purchase.created_at.isoformat()
                if purchase.created_at else None
            ),
        })

    recent.sort(
        key=lambda item: item["created_at"] or "",
        reverse=True,
    )

    return {
        "total_sales": float(total_sales),
        "total_purchases": float(total_purchases),
        "transaction_count": len(sales) + len(purchases),
        "sales_count": len(sales),
        "purchases_count": len(purchases),
        "today_sales": float(today_sales),
        "today_purchases": float(today_purchases),
        "transactions": recent,
        "recent_transactions": recent[:10],
    }
@app.get("/api/intelligence/overview")
def get_intelligence_overview(db: Session = Depends(get_db)):
    """
    Return real inventory intelligence:
    - Product-level sales history
    - Reorder recommendations
    - Forecast data readiness
    """

    # 1. Load products
    products = db.scalars(
        select(models.Product).order_by(models.Product.name.asc())
    ).all()

    # 2. Aggregate real sales by product
    sales_rows = db.execute(
        select(
            models.SaleItem.product_id,
            func.coalesce(func.sum(models.SaleItem.quantity), 0).label(
                "total_units_sold"
            ),
            func.count(func.distinct(models.SaleItem.sale_id)).label(
                "sales_count"
            ),
            func.max(models.Sale.created_at).label("last_sold_at"),
        )
        .join(
            models.Sale,
            models.Sale.id == models.SaleItem.sale_id,
        )
        .group_by(models.SaleItem.product_id)
    ).all()

    sales_by_product = {
        row.product_id: {
            "total_units_sold": int(row.total_units_sold or 0),
            "sales_count": int(row.sales_count or 0),
            "last_sold_at": (
                row.last_sold_at.isoformat()
                if row.last_sold_at
                else None
            ),
        }
        for row in sales_rows
    }

    # 3. Calculate real inventory risk
    inventory = []
    reorder_recommendations = []

    for product in products:
        sales = sales_by_product.get(
            product.id,
            {
                "total_units_sold": 0,
                "sales_count": 0,
                "last_sold_at": None,
            },
        )

        current_stock = int(product.quantity or 0)
        reorder_level = int(product.reorder_level or 0)
        total_units_sold = sales["total_units_sold"]

        if current_stock <= reorder_level:
            status = "critical" if current_stock == 0 else "low_stock"

            reorder_recommendations.append({
                "product_id": product.id,
                "product_name": product.name,
                "sku": product.sku,
                "current_stock": current_stock,
                "reorder_level": reorder_level,
                "suggested_reorder_quantity": max(
                    reorder_level * 2 - current_stock,
                    1,
                ),
                "reason": (
                    "Out of stock."
                    if current_stock == 0
                    else "Current stock is at or below the reorder level."
                ),
                "priority": status,
            })
        else:
            status = "healthy"

        inventory.append({
            "product_id": product.id,
            "product_name": product.name,
            "sku": product.sku,
            "current_stock": current_stock,
            "reorder_level": reorder_level,
            "stock_status": status,
            "total_units_sold": total_units_sold,
            "sales_count": sales["sales_count"],
            "last_sold_at": sales["last_sold_at"],
        })

    # 4. Check whether sales history is suitable for forecasting
    first_sale_date = db.scalar(
        select(func.min(models.Sale.created_at))
    )

    total_sales_invoices = int(
        db.scalar(select(func.count(models.Sale.id))) or 0
    )

    days_of_history = 0

    if first_sale_date:
        days_of_history = max(
            (date.today() - first_sale_date.date()).days + 1,
            1,
        )

    # Initial conservative readiness check.
    # This is NOT a trained model or a prediction.
    forecast_ready = (
        total_sales_invoices >= 30
        and days_of_history >= 30
    )

    if total_sales_invoices == 0:
        readiness_message = (
            "No sales history is available yet. Record real sales "
            "before evaluating demand forecasts."
        )
    elif not forecast_ready:
        readiness_message = (
            "More sales history is required before forecasting can "
            "be evaluated reliably."
        )
    else:
        readiness_message = (
            "Initial history threshold met. Train and evaluate a "
            "forecasting model with time-based validation before "
            "displaying predictions."
        )

    # 5. Return actual data to the frontend
    return {
        "summary": {
            "products_analyzed": len(products),
            "stock_alerts": len(reorder_recommendations),
            "critical_stock": sum(
                1
                for item in reorder_recommendations
                if item["priority"] == "critical"
            ),
            "total_sales_invoices": total_sales_invoices,
            "days_of_sales_history": days_of_history,
            "forecast_ready": forecast_ready,
        },
        "readiness": {
            "status": (
                "ready_for_evaluation"
                if forecast_ready
                else "insufficient_history"
            ),
            "message": readiness_message,
        },
        "inventory": inventory,
        "reorder_recommendations": reorder_recommendations,
    }
