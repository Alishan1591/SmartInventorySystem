
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  PackagePlus,
  ReceiptText,
  Plus,
  Trash2,
  RefreshCw,
  Printer,
} from "lucide-react";
import "./Transactions.css";

const API = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = body.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(", ")
      : typeof detail === "string"
        ? detail
        : `Request failed (${response.status})`;

    throw new Error(message);
  }

  return body;
}

function asList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function Transactions({ initialTab = "sales" }) {
  const [tab, setTab] = useState(initialTab);

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);

  const [lines, setLines] = useState([
    { product_id: "", quantity: 1 },
  ]);

  const [customer, setCustomer] = useState("Walk-in Customer");
  const [payment, setPayment] = useState("cash");
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastInvoice, setLastInvoice] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");

  const isEntryTab = tab === "sales" || tab === "purchases";

  useEffect(() => {
    setTab(initialTab);
    setError("");
    setNotice("");
  }, [initialTab]);

  // Load products, suppliers, and transaction history.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        productData,
        supplierData,
        saleData,
        purchaseData,
      ] = await Promise.all([
        request("/api/products"),
        request("/api/suppliers"),
        request("/api/sales"),
        request("/api/purchases"),
      ]);

      setProducts(asList(productData));
      setSuppliers(asList(supplierData));
      setSales(asList(saleData));
      setPurchases(asList(purchaseData));
    } catch (err) {
      setError(
        `${err.message}. Check that FastAPI is running and that the required API endpoints are available.`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load the full invoice, including its product line items.
 
  // Load invoice details and open the invoice in a new browser tab.
  async function openInvoice(invoice) {
    if (!invoice?.id) {
      setError("This invoice does not have a valid ID.");
      return;
    }

    setError("");
    setInvoiceLoading(true);

    const rawKind =
      invoice.transactionKind || invoice.kind || "sales";

    const isPurchase = [
      "purchases",
      "purchase",
      "Purchase",
    ].includes(rawKind);

    const kind = isPurchase ? "purchases" : "sales";

    const endpoint = isPurchase
      ? `/api/purchases/${invoice.id}`
      : `/api/sales/${invoice.id}`;

    // Open the tab immediately during the click to reduce popup blocking.
    const invoiceWindow = window.open("", "_blank");

    if (invoiceWindow) {
      invoiceWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Loading invoice...</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 40px;
                color: #333;
              }
            </style>
          </head>
          <body>Loading invoice...</body>
        </html>
      `);
      invoiceWindow.document.close();
    }

    try {
      const details = await request(endpoint);

      const data = {
        ...invoice,
        ...details,
        kind,
        invoice_number:
          details.invoice_number ||
          invoice.invoice_number ||
          `#${invoice.id}`,
        total_amount:
          details.total_amount ??
          invoice.total_amount ??
          invoice.total ??
          0,
        created_at:
          details.created_at ||
          invoice.created_at ||
          new Date().toISOString(),
      };

      if (!invoiceWindow || invoiceWindow.closed) {
        setError(
          "The invoice tab was blocked or closed. Allow pop-ups and try again."
        );
        return;
      }

      const esc = (value) =>
        String(value ?? "—").replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char]);

      const date = data.created_at
        ? new Date(data.created_at).toLocaleString()
        : "—";

      const items = Array.isArray(data.items) ? data.items : [];

      const rows = items.map((item) => `
        <tr>
          <td>${esc(item.product_name || "Product")}</td>
          <td>${esc(item.sku || "—")}</td>
          <td>${esc(item.quantity ?? 0)}</td>
          <td>${esc(money(item.unit_price))}</td>
          <td>${esc(money(item.line_total ?? (
            (Number(item.quantity) || 0) *
            (Number(item.unit_price) || 0)
          )))}</td>
        </tr>
      `).join("");

      const partyName = isPurchase
        ? data.supplier_name ||
          data.supplier?.name ||
          (data.supplier_id
            ? `Supplier #${data.supplier_id}`
            : "Not specified")
        : data.customer_name || "Walk-in Customer";

      const title = isPurchase
        ? "PURCHASE INVOICE"
        : "SALES INVOICE";

      invoiceWindow.document.open();
      invoiceWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>${esc(title)} - ${esc(data.invoice_number)}</title>
            <style>
              * { box-sizing: border-box; }
              body {
                margin: 0;
                padding: 28px;
                color: #172033;
                background: #f3f5f9;
                font-family: Arial, Helvetica, sans-serif;
              }
              .invoice {
                max-width: 900px;
                margin: 0 auto;
                padding: 36px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 24px rgba(0,0,0,.07);
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 20px;
                flex-wrap: wrap;
              }
              .brand {
                margin: 0;
                font-size: 28px;
                font-weight: 800;
                letter-spacing: 2px;
              }
              .subtitle {
                color: #64748b;
                font-size: 11px;
                letter-spacing: 1px;
              }
              h2 { margin: 0 0 8px; font-size: 21px; }
              h3 { font-size: 15px; }
              .muted { color: #64748b; }
              .divider {
                height: 2px;
                background: #e2e8f0;
                margin: 24px 0;
              }
              .info {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 24px;
              }
              .info p { margin: 8px 0; overflow-wrap: anywhere; }
              table {
                width: 100%;
                margin-top: 18px;
                border-collapse: collapse;
              }
              th, td {
                padding: 12px 10px;
                border-bottom: 1px solid #e2e8f0;
                text-align: left;
                font-size: 13px;
              }
              th { background: #f1f5f9; }
              .total {
                display: flex;
                justify-content: flex-end;
                gap: 28px;
                align-items: center;
                margin-top: 24px;
                font-size: 20px;
                font-weight: bold;
              }
              .footer {
                margin-top: 36px;
                padding-top: 18px;
                border-top: 1px solid #e2e8f0;
                text-align: center;
                color: #64748b;
                font-size: 12px;
              }
              .actions {
                max-width: 900px;
                margin: 0 auto 18px;
                display: flex;
                justify-content: flex-end;
              }
              button {
                padding: 11px 18px;
                border: 0;
                border-radius: 7px;
                background: #172033;
                color: white;
                font-weight: bold;
                cursor: pointer;
              }
              @media (max-width: 600px) {
                body { padding: 12px; }
                .invoice { padding: 20px; }
                .info { grid-template-columns: 1fr; gap: 8px; }
                th, td { padding: 8px 5px; font-size: 11px; }
              }
              @media print {
                body { padding: 0; background: white; }
                .invoice {
                  max-width: none;
                  padding: 0;
                  box-shadow: none;
                  border-radius: 0;
                }
                .actions { display: none; }
                tr { break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <div class="actions">
              <button onclick="window.print()">Print Invoice</button>
            </div>

            <main class="invoice">
              <header class="header">
                <div>
                  <p class="brand">Alishan's</p>
                  <p class="subtitle">INVENTORY MANAGEMENT SYSTEM</p>
                </div>
                <div>
                  <h2>${esc(title)}</h2>
                  <strong>${esc(data.invoice_number)}</strong>
                </div>
              </header>

              <div class="divider"></div>

              <section class="info">
                <div>
                  <h3>Invoice Information</h3>
                  <p><strong>Invoice No:</strong> ${esc(data.invoice_number)}</p>
                  <p><strong>Date:</strong> ${esc(date)}</p>
                  <p><strong>Type:</strong> ${isPurchase ? "Purchase" : "Sale"}</p>
                  ${data.payment_method
                    ? `<p><strong>Payment:</strong> ${esc(data.payment_method)}</p>`
                    : ""}
                </div>
                <div>
                  <h3>${isPurchase ? "Supplier Details" : "Customer Details"}</h3>
                  <p>${esc(partyName)}</p>
                  ${data.notes
                    ? `<p><strong>Notes:</strong> ${esc(data.notes)}</p>`
                    : ""}
                </div>
              </section>

              <h3>Invoice Items</h3>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="5">No invoice items returned by the API.</td></tr>'}
                </tbody>
              </table>

              <div class="total">
                <span>Grand Total</span>
                <span>${esc(money(data.total_amount))}</span>
              </div>

              <footer class="footer">
                <p>Thank you for using .</p>
                <p>Computer-generated invoice</p>
              </footer>
            </main>
          </body>
        </html>
      `);
      invoiceWindow.document.close();
      invoiceWindow.focus();
    } catch (err) {
      if (invoiceWindow && !invoiceWindow.closed) {
        invoiceWindow.document.body.innerHTML =
          "<p>Could not load invoice details. Return to Alishan's and try again.</p>";
      }

      setError(`Could not load invoice details: ${err.message}`);
    } finally {
      setInvoiceLoading(false);
    }
  }

  // Calculate the current transaction total.
  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const product = products.find(
        (item) => Number(item.id) === Number(line.product_id)
      );

      const price = Number(product?.unit_price) || 0;
      const quantity = Number(line.quantity) || 0;

      return sum + price * quantity;
    }, 0);
  }, [lines, products]);

  // Combine sales and purchases into a single invoice history.
  const invoiceHistory = useMemo(() => {
    const saleInvoices = sales.map((sale) => ({
      ...sale,
      invoiceType: "Sale",
      partyName: sale.customer_name || "Walk-in Customer",
      transactionKind: "sales",
    }));

    const purchaseInvoices = purchases.map((purchase) => {
      const supplier = suppliers.find(
        (item) =>
          Number(item.id) === Number(purchase.supplier_id)
      );

      return {
        ...purchase,
        invoiceType: "Purchase",
        partyName:
          purchase.supplier_name ||
          purchase.supplier?.name ||
          supplier?.name ||
          (purchase.supplier_id
            ? `Supplier #${purchase.supplier_id}`
            : "Not specified"),
        transactionKind: "purchases",
      };
    });

    return [...saleInvoices, ...purchaseInvoices].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
  }, [sales, purchases, suppliers]);

  // Search by invoice number, type, customer, or supplier.
  const filteredInvoices = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();

    if (!query) return invoiceHistory;

    return invoiceHistory.filter((invoice) =>
      [
        invoice.invoice_number,
        invoice.invoiceType,
        invoice.partyName,
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      )
    );
  }, [invoiceHistory, invoiceSearch]);

  function changeLine(index, field, value) {
    setLines((current) =>
      current.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      )
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      { product_id: "", quantity: 1 },
    ]);
  }

  function removeLine(index) {
    setLines((current) =>
      current.length === 1
        ? [{ product_id: "", quantity: 1 }]
        : current.filter((_, i) => i !== index)
    );
  }

  function resetForm() {
    setLines([{ product_id: "", quantity: 1 }]);
    setCustomer("Walk-in Customer");
    setPayment("cash");
    setSupplierId("");
    setNotes("");
  }

  // Create a sale or purchase.
  async function submitTransaction(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLastInvoice(null);

    if (!["sales", "purchases"].includes(tab)) return;

    const validLines = lines.map((line) => ({
      product_id: Number(line.product_id),
      quantity: Number(line.quantity),
    }));

    if (
      validLines.some(
        (line) =>
          !Number.isInteger(line.product_id) ||
          line.product_id <= 0 ||
          !Number.isInteger(line.quantity) ||
          line.quantity <= 0
      )
    ) {
      setError(
        "Choose a product and enter a positive whole-number quantity for every row."
      );
      return;
    }

    const productIds = validLines.map((line) => line.product_id);

    if (new Set(productIds).size !== productIds.length) {
      setError(
        "Each product can appear only once. Combine its quantity into one row."
      );
      return;
    }

    // Client-side stock validation for sales.
    if (tab === "sales") {
      for (const line of validLines) {
        const product = products.find(
          (item) => Number(item.id) === line.product_id
        );

        if (!product) {
          setError(
            "A selected product is no longer available. Refresh the list."
          );
          return;
        }

        if (line.quantity > Number(product.quantity)) {
          setError(
            `Insufficient stock for ${product.name}. Available: ${product.quantity}.`
          );
          return;
        }
      }
    }

    const payload =
      tab === "sales"
        ? {
            customer_name: customer.trim() || "Walk-in Customer",
            payment_method: payment,
            items: validLines,
          }
        : {
            supplier_id: supplierId ? Number(supplierId) : null,
            notes: notes.trim() || null,
            items: validLines,
          };

    setBusy(true);

    try {
      const result = await request(
        tab === "sales" ? "/api/sales" : "/api/purchases",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      const kind = tab;

      let invoice = {
        ...result,
        kind,
        invoice_number:
          result.invoice_number ||
          result.invoice_no ||
          `#${result.id ?? "New"}`,
        total_amount:
          result.total_amount ?? result.total ?? total,
        created_at:
          result.created_at || new Date().toISOString(),
      };

      // Try to fetch full details for the newly created invoice.
      // If that request fails, keep the successful transaction result.
      if (result.id) {
        try {
          const details = await request(
            kind === "sales"
              ? `/api/sales/${result.id}`
              : `/api/purchases/${result.id}`
          );

          invoice = {
            ...invoice,
            ...details,
            kind,
            invoice_number:
              details.invoice_number || invoice.invoice_number,
            total_amount:
              details.total_amount ?? invoice.total_amount,
            created_at:
              details.created_at || invoice.created_at,
          };
        } catch {
          // The transaction was already saved successfully.
          // Do not retry the POST or create another transaction.
        }
      }

      setLastInvoice(invoice);

      setNotice(
        `${kind === "sales" ? "Sale" : "Purchase"} completed successfully. Invoice: ${invoice.invoice_number}`
      );

      resetForm();

      // Refresh stock quantities and transaction history.
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="transactions">
      <header className="transactions-header">
        <div>
          <p className="tx-eyebrow">INVENTORY OPERATIONS</p>
          <h1>Transactions</h1>
          <p className="tx-subtitle">
            Record stock movements and manage invoice history.
          </p>
        </div>

        <button
          type="button"
          className="tx-button tx-secondary"
          onClick={loadData}
          disabled={loading || busy}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <nav className="tx-tabs" aria-label="Transaction pages">
        <button
          type="button"
          className={tab === "sales" ? "active" : ""}
          onClick={() => {
            setTab("sales");
            setError("");
            setNotice("");
          }}
        >
          <ShoppingCart size={17} />
          New Sale
        </button>

        <button
          type="button"
          className={tab === "purchases" ? "active" : ""}
          onClick={() => {
            setTab("purchases");
            setError("");
            setNotice("");
          }}
        >
          <PackagePlus size={17} />
          New Purchase
        </button>

        <button
          type="button"
          className={tab === "invoices" ? "active" : ""}
          onClick={() => {
            setTab("invoices");
            setError("");
            setNotice("");
          }}
        >
          <ReceiptText size={17} />
          Invoice History
        </button>
      </nav>

      {error && (
        <div className="tx-alert tx-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="tx-alert tx-success" role="status">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="tx-empty">
          Loading products and transactions…
        </div>
      ) : (
        <>
          {/* SALE AND PURCHASE FORM */}
          {isEntryTab && (
            <form className="tx-panel" onSubmit={submitTransaction}>
              <div className="tx-panel-heading">
                <div>
                  <h2>
                    {tab === "sales"
                      ? "Create Sale"
                      : "Record Purchase"}
                  </h2>
                  <p>
                    {tab === "sales"
                      ? "Stock decreases after the sale is saved."
                      : "Stock increases after the purchase is saved."}
                  </p>
                </div>

                <span className="tx-total">{money(total)}</span>
              </div>

              {tab === "sales" ? (
                <div className="tx-fields">
                  <label>
                    Customer name
                    <input
                      value={customer}
                      onChange={(event) =>
                        setCustomer(event.target.value)
                      }
                      placeholder="Walk-in Customer"
                      maxLength={150}
                    />
                  </label>

                  <label>
                    Payment method
                    <select
                      value={payment}
                      onChange={(event) =>
                        setPayment(event.target.value)
                      }
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">
                        Bank transfer
                      </option>
                    </select>
                  </label>
                </div>
              ) : (
                <div className="tx-fields">
                  <label>
                    Supplier (optional)
                    <select
                      value={supplierId}
                      onChange={(event) =>
                        setSupplierId(event.target.value)
                      }
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => (
                        <option
                          key={supplier.id}
                          value={supplier.id}
                        >
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Purchase notes
                    <input
                      value={notes}
                      onChange={(event) =>
                        setNotes(event.target.value)
                      }
                      placeholder="Optional reference or notes"
                    />
                  </label>
                </div>
              )}

              <div className="tx-lines-heading">
                <h3>Products</h3>

                <button
                  type="button"
                  className="tx-button tx-secondary"
                  onClick={addLine}
                >
                  <Plus size={16} />
                  Add product
                </button>
              </div>

              <div className="tx-table-wrap">
                <table className="tx-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Available</th>
                      <th>Unit price</th>
                      <th>Quantity</th>
                      <th>Line total</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {lines.map((line, index) => {
                      const product = products.find(
                        (item) =>
                          Number(item.id) ===
                          Number(line.product_id)
                      );

                      const price =
                        Number(product?.unit_price) || 0;
                      const quantity =
                        Number(line.quantity) || 0;

                      return (
                        <tr key={index}>
                          <td>
                            <select
                              value={line.product_id}
                              onChange={(event) =>
                                changeLine(
                                  index,
                                  "product_id",
                                  event.target.value
                                )
                              }
                              required
                            >
                              <option value="">Choose product</option>

                              {products.map((item) => (
                                <option
                                  key={item.id}
                                  value={item.id}
                                >
                                  {item.name} ({item.sku})
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>{product?.quantity ?? "—"}</td>
                          <td>{money(price)}</td>

                          <td>
                            <input
                              className="tx-quantity"
                              type="number"
                              min="1"
                              step="1"
                              value={line.quantity}
                              onChange={(event) =>
                                changeLine(
                                  index,
                                  "quantity",
                                  event.target.value
                                )
                              }
                              required
                            />
                          </td>

                          <td>{money(price * quantity)}</td>

                          <td>
                            <button
                              type="button"
                              className="tx-icon-button"
                              aria-label="Remove product"
                              onClick={() => removeLine(index)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {products.length === 0 && (
                <p className="tx-muted">
                  No products found. Add a product before recording
                  a transaction.
                </p>
              )}

              <footer className="tx-form-footer">
                <span>
                  Total <strong>{money(total)}</strong>
                </span>

                <button
                  className="tx-button tx-primary"
                  type="submit"
                  disabled={busy || products.length === 0 || total <= 0}
                >
                  {busy
                    ? "Saving…"
                    : tab === "sales"
                      ? "Complete Sale"
                      : "Save Purchase"}
                </button>
              </footer>
            </form>
          )}

          {/* COMBINED INVOICE HISTORY */}
          {tab === "invoices" && (
            <div className="tx-panel">
              <div className="tx-panel-heading">
                <div>
                  <h2>Invoice History</h2>
                  <p className="tx-muted">
                    View sales and purchase invoices in one place.
                  </p>
                </div>

                <span className="tx-total">
                  {filteredInvoices.length} invoices
                </span>
              </div>

              <label className="tx-search-label">
                Search invoices
                <input
                  type="search"
                  value={invoiceSearch}
                  onChange={(event) =>
                    setInvoiceSearch(event.target.value)
                  }
                  placeholder="Search invoice, type, customer or supplier..."
                />
              </label>

              <div className="tx-table-wrap">
                <table className="tx-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Type</th>
                      <th>Customer / Supplier</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="tx-empty">
                          {invoiceHistory.length === 0
                            ? "No invoices found yet."
                            : "No invoices match your search."}
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((invoice) => (
                        <tr
                          key={`${invoice.transactionKind}-${invoice.id}`}
                        >
                          <td>
                            {invoice.invoice_number || `#${invoice.id}`}
                          </td>
                          <td>{invoice.invoiceType}</td>
                          <td>{invoice.partyName}</td>

                          <td>
                            {invoice.created_at
                              ? new Date(
                                  invoice.created_at
                                ).toLocaleString()
                              : "—"}
                          </td>

                          <td>
                            {money(
                              invoice.total_amount ?? invoice.total
                            )}
                          </td>

                          <td>
                            <button
                              type="button"
                              className="tx-button tx-secondary"
                              onClick={() => openInvoice(invoice)}
                              disabled={invoiceLoading}
                            >
                              <Printer size={15} />
                              {invoiceLoading
                                ? "Loading..."
                                : "View / Print"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RECENT SALES OR PURCHASES */}
          {isEntryTab && (
            <div className="tx-panel">
              <div className="tx-panel-heading">
                <div>
                  <h2>
                    {tab === "sales"
                      ? "Recent Sales"
                      : "Recent Purchases"}
                  </h2>
                  <p>Latest records returned by your API.</p>
                </div>
              </div>

              <div className="tx-table-wrap">
                <table className="tx-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Date</th>
                      <th>
                        {tab === "purchases" ? "Supplier" : "Customer"}
                      </th>
                      <th>Total</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(tab === "sales" ? sales : purchases).length ===
                    0 ? (
                      <tr>
                        <td colSpan={5} className="tx-empty">
                          No records yet.
                        </td>
                      </tr>
                    ) : (
                      (tab === "sales" ? sales : purchases).map(
                        (item) => {
                          const supplier = suppliers.find(
                            (entry) =>
                              Number(entry.id) ===
                              Number(item.supplier_id)
                          );

                          return (
                            <tr key={item.id}>
                              <td>
                                {item.invoice_number || `#${item.id}`}
                              </td>

                              <td>
                                {item.created_at
                                  ? new Date(
                                      item.created_at
                                    ).toLocaleString()
                                  : "—"}
                              </td>

                              <td>
                                {tab === "purchases"
                                  ? item.supplier_name ||
                                    item.supplier?.name ||
                                    supplier?.name ||
                                    item.supplier_id ||
                                    "—"
                                  : item.customer_name ||
                                    "Walk-in Customer"}
                              </td>

                              <td>
                                {money(
                                  item.total_amount ?? item.total
                                )}
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="tx-button tx-secondary"
                                  onClick={() =>
                                    openInvoice({
                                      ...item,
                                      transactionKind: tab,
                                    })
                                  }
                                  disabled={invoiceLoading}
                                >
                                  <ReceiptText size={15} />
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INVOICE PREVIEW */}
                
{/* INVOICE PREVIEW */}
    {lastInvoice && (
    <div
        className="tx-panel tx-invoice"
        id="print-invoice"
    >
        <div className="invoice-brand-header">
        <div>
            <p className="invoice-brand-name">Alishan's Inventory</p>
            <p className="invoice-brand-subtitle">
            INVENTORY MANAGEMENT SYSTEM
            </p>
        </div>

        <div className="invoice-title-block">
            <h2>
            {lastInvoice.kind === "purchases" ||
            lastInvoice.kind === "Purchase"
                ? "PURCHASE INVOICE"
                : "SALES INVOICE"}
            </h2>
            <p>{lastInvoice.invoice_number}</p>
        </div>
        </div>

        <div className="invoice-divider" />

        <div className="invoice-info-grid">
        <div>
            <h3>Invoice Information</h3>
            <p>
            <strong>Invoice No:</strong>{" "}
            {lastInvoice.invoice_number}
            </p>
            <p>
            <strong>Date:</strong>{" "}
            {lastInvoice.created_at
                ? new Date(lastInvoice.created_at).toLocaleString()
                : "—"}
            </p>
            <p>
            <strong>Type:</strong>{" "}
            {lastInvoice.kind === "purchases" ||
            lastInvoice.kind === "Purchase"
                ? "Purchase"
                : "Sale"}
            </p>
            {lastInvoice.payment_method && (
            <p>
                <strong>Payment:</strong>{" "}
                {lastInvoice.payment_method.toUpperCase()}
            </p>
            )}
        </div>

        <div>
            <h3>
            {lastInvoice.kind === "purchases" ||
            lastInvoice.kind === "Purchase"
                ? "Supplier Details"
                : "Customer Details"}
            </h3>

            {lastInvoice.customer_name && (
            <p>{lastInvoice.customer_name}</p>
            )}

            {(lastInvoice.supplier_name ||
            lastInvoice.supplier?.name ||
            lastInvoice.supplier_id) && (
            <p>
                {lastInvoice.supplier_name ||
                lastInvoice.supplier?.name ||
                `Supplier #${lastInvoice.supplier_id}`}
            </p>
            )}

            {lastInvoice.notes && (
            <p>
                <strong>Notes:</strong> {lastInvoice.notes}
            </p>
            )}
        </div>
        </div>

        <h3 className="invoice-items-title">Invoice Items</h3>

        <div className="tx-table-wrap">
        <table className="tx-table">
            <thead>
            <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Line Total</th>
            </tr>
            </thead>

            <tbody>
            {(lastInvoice.items || []).map((item, index) => (
                <tr key={`${item.product_id}-${index}`}>
                <td>{item.product_name || "Product"}</td>
                <td>{item.sku || "—"}</td>
                <td>{item.quantity}</td>
                <td>{money(item.unit_price)}</td>
                <td>{money(item.line_total)}</td>
                </tr>
            ))}

            {(!lastInvoice.items ||
                lastInvoice.items.length === 0) && (
                <tr>
                <td colSpan={5} className="tx-empty">
                    No invoice items returned by the API.
                </td>
                </tr>
            )}
            </tbody>
        </table>
        </div>

        <div className="invoice-total-row">
        <span>Grand Total</span>
        <strong>{money(lastInvoice.total_amount)}</strong>
        </div>

        <div className="invoice-footer">
        <p>Thank you for using Alishan's Inventory.</p>
        <p>Computer-generated invoice</p>
        </div>

        <div className="invoice-screen-actions">
        <button
            type="button"
            className="tx-button tx-secondary"
            onClick={() => window.print()}
        >
            <Printer size={16} />
            Print Invoice
        </button>
        </div>
    </div>
)}
          {/* INVOICE PREVIEW */}
          {lastInvoice && (
            <div
              className="tx-panel tx-invoice"
              id="print-invoice"
            >
              {/* Keep your complete existing NEXSTOCK invoice JSX here */}
            </div>
          )}
        </>
      )}
    </section>
  );
}