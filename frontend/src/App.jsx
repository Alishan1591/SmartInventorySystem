
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  BrainCircuit,
  Boxes,
  Check,
  CircleDollarSign,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  PackagePlus,
  ReceiptText,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  X,
  Pencil,
  Trash2,
  Tags,
  Wallet,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import "./App.css";
import TransactionDashboard from "./TransactionDashboard";
import Transactions from "./Transactions";
import Categories from "./Categories";
import Suppliers from "./Suppliers";
const API = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot connect to FastAPI. Make sure the backend is running on port 8000."
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep the fallback message if the response isn't JSON.
    }
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

const emptyForm = {
  sku: "",
  name: "",
  description: "",
  category_id: "",
  supplier_id: "",
  quantity: 0,
  reorder_level: 10,
  unit_price: "0.00",
};

function StatCard({ title, value, icon: Icon, tone, note }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{title}</span>
        <span className={`stat-icon ${tone}`}><Icon size={19} /></span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </article>
  );
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "", email: "", phone: "", address: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stats, productData, categoryData, supplierData] =
        await Promise.all([
          request("/api/dashboard"),
          request("/api/products?limit=100"),
          request("/api/categories"),
          request("/api/suppliers"),
        ]);
      setDashboard(stats);
      setProducts(productData);
      setCategories(categoryData);
      setSuppliers(supplierData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = products.filter((product) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      product.name.toLowerCase().includes(term) ||
      product.sku.toLowerCase().includes(term);
    const matchesStock =
      !lowStockOnly || product.quantity <= product.reorder_level;
    return matchesSearch && matchesStock;
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setModal("product");
  };

  const openEdit = (product) => {
    setEditingId(product.id);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      category_id: product.category_id ?? "",
      supplier_id: product.supplier_id ?? "",
      quantity: product.quantity,
      reorder_level: product.reorder_level,
      unit_price: String(product.unit_price),
    });
    setError("");
    setSuccess("");
    setModal("product");
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category_id: form.category_id ? Number(form.category_id) : null,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      quantity: Number(form.quantity),
      reorder_level: Number(form.reorder_level),
      unit_price: form.unit_price,
    };

    if (!editingId) {
      payload.sku = form.sku.trim();
    }

    try {
      await request(
        editingId ? `/api/products/${editingId}` : "/api/products",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );
      setModal(null);
      setSuccess(editingId ? "Product updated successfully." : "Product added successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await request(`/api/products/${product.id}`, { method: "DELETE" });
      setSuccess("Product deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveSupplier = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/api/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: supplierForm.name.trim(),
          email: supplierForm.email.trim() || null,
          phone: supplierForm.phone.trim() || null,
          address: supplierForm.address.trim() || null,
        }),
      });
      setSupplierForm({ name: "", email: "", phone: "", address: "" });
      setModal(null);
      setSuccess("Supplier added successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Products", icon: Package },
    { name: "Categories", icon: Tags },
    { name: "Suppliers", icon: Truck },
    { name: "Sales", icon: ShoppingCart },
    { name: "Purchases", icon: PackagePlus },
    { name: "Invoices", icon: ReceiptText },
    { name: "Transaction Analytics", icon: BarChart3 },
    { name: "AI Analytics", icon: BrainCircuit },
  ];

  const lowStockProducts = products.filter(
    (p) => p.quantity <= p.reorder_level
  );

  const categoryChart = categories.map((category) => ({
    name: category.name,
    count: products.filter((p) => p.category_id === category.id).length,
  }));

  const stockChart = [
    { name: "Healthy stock", value: products.filter((p) => p.quantity > p.reorder_level).length },
    { name: "Low stock", value: lowStockProducts.length },
  ];

  const visibleError = error;
  const visibleSuccess = success;

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Boxes size={24} /></div>
          <div>
            <div className="brand-name">Alishan's Inventory Hub </div>
            <div className="brand-caption">INTELLIGENT INVENTORY System </div>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() => {
                setPage(name);
                setSidebarOpen(false);
                setError("");
              }}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Products" && <span className="nav-count">{products.length}</span>}
              {name === "AI Analytics" && <span className="beta-tag">AI</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="ai-card">
            <div className="ai-card-icon"><BrainCircuit size={20} /></div>
            <strong>Smarter stock decisions</strong>
            <p>AI forecasting features are coming in the next development stage.</p>
            <button onClick={() => setPage("AI Analytics")}>Explore analytics <ArrowUpRight size={14} /></button>
          </div>
          <button className="nav-item settings-item" onClick={() => setSuccess("Settings and user roles will be configured in a later step.")}>
            <Settings size={18} /><span>Settings</span>
          </button>
          <div className="user-profile">
            <div className="avatar">A</div>
            <div className="user-details">
              <strong>Inventory Admin</strong>
              <span>Local development</span>
            </div>
            <ShieldCheck size={17} className="profile-shield" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={21} />
            </button>
            <div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div>
          </div>
          <div className="topbar-actions">
            <div className="connection-pill">
              <span className={`connection-dot ${error ? "offline" : ""}`} />
              {loading ? "Connecting…" : error ? "Check connection" : "API connection"}
            </div>
            <button className="icon-button" onClick={loadData} title="Refresh data" aria-label="Refresh data">
              <RefreshCw size={18} />
            </button>
            <button className="icon-button notification-button" title="Low stock items" onClick={() => { setPage("Products"); setLowStockOnly(true); }}>
              <Bell size={18} />
              {lowStockProducts.length > 0 && <span className="notification-dot" />}
            </button>
          </div>
        </header>

        <div className="page-content">
          {visibleError && (
            <div className="alert alert-error">
              <AlertTriangle size={18} />
              <span>{visibleError}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button>
            </div>
          )}
          {visibleSuccess && (
            <div className="alert alert-success">
              <Check size={18} />
              <span>{visibleSuccess}</span>
              <button onClick={() => setSuccess("")} aria-label="Dismiss message"><X size={16} /></button>
            </div>
          )}

          {page === "Dashboard" && (
            <>
              <SectionHeading
                eyebrow="OVERVIEW / LIVE DATA"
                title="Inventory overview"
                description="Monitor your stock, suppliers and business performance in one place."
                action={<button className="button button-primary" onClick={openCreate}><Plus size={17} /> Add product</button>}
              />

              <div className="stats-grid">
                <StatCard title="Total products" value={dashboard?.total_products ?? "—"} icon={Package} tone="purple" note="Products in your database" />
                <StatCard title="Low stock items" value={dashboard?.low_stock_items ?? "—"} icon={AlertTriangle} tone="amber" note="At or below reorder level" />
                <StatCard title="Inventory value" value={money(dashboard?.inventory_value)} icon={Wallet} tone="green" note="Current quantity × unit price" />
                <StatCard title="Total sales" value={money(dashboard?.total_sales)} icon={CircleDollarSign} tone="blue" note="Recorded sales transactions" />
              </div>

              <div className="dashboard-grid">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div><h3>Products by category</h3><p>Distribution of your current inventory</p></div>
                    <span className="panel-icon"><BarChart3 size={18} /></span>
                  </div>
                  {categoryChart.length ? (
                    <div className="chart-wrap">
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={categoryChart} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid stroke="#282832" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: "#9292A1", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis allowDecimals={false} tick={{ fill: "#9292A1", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: "#17171D", border: "1px solid #343440", borderRadius: 10, color: "#fff" }} />
                          <Bar dataKey="count" name="Products" fill="#A78BFA" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="empty-chart"><BarChart3 size={30} /><strong>No category data yet</strong><span>Create categories and assign them to products to see this chart.</span><button className="button button-secondary" onClick={() => setPage("Categories")}>View categories</button></div>
                  )}
                </section>

                <section className="panel stock-panel">
                  <div className="panel-heading">
                    <div><h3>Stock health</h3><p>Current reorder-level status</p></div>
                    <span className="panel-icon"><Activity size={18} /></span>
                  </div>
                  {products.length ? (
                    <>
                      <div className="donut-wrap">
                        <ResponsiveContainer width="100%" height={190}>
                          <PieChart>
                            <Pie data={stockChart} dataKey="value" nameKey="name" innerRadius={56} outerRadius={78} paddingAngle={5} stroke="none">
                              <Cell fill="#34D399" />
                              <Cell fill="#FBBF24" />
                            </Pie>
                            <Tooltip contentStyle={{ background: "#17171D", border: "1px solid #343440", borderRadius: 10, color: "#fff" }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-center"><strong>{products.length}</strong><span>products</span></div>
                      </div>
                      <div className="legend-row"><span><i className="legend-dot green-dot" /> Healthy stock</span><strong>{stockChart[0].value}</strong></div>
                      <div className="legend-row"><span><i className="legend-dot amber-dot" /> Low stock</span><strong>{stockChart[1].value}</strong></div>
                    </>
                  ) : <div className="empty-chart"><Package size={28} /><strong>No inventory yet</strong><span>Add your first product to view stock health.</span></div>}
                </section>
              </div>

              <section className="panel table-panel">
                <div className="panel-heading">
                  <div><h3>Recent products</h3><p>Latest products saved in your database</p></div>
                  <button className="text-button" onClick={() => setPage("Products")}>View all <ArrowUpRight size={15} /></button>
                </div>
                <ProductTable products={products.slice(0, 5)} onEdit={openEdit} onDelete={deleteProduct} />
              </section>

              <section className="panel low-stock-panel">
                <div className="panel-heading">
                  <div><h3><AlertTriangle size={17} className="inline-icon amber-text" /> Stock attention</h3><p>Products that may need replenishment</p></div>
                  <button className="text-button" onClick={() => { setPage("Products"); setLowStockOnly(true); }}>Review stock <ArrowUpRight size={15} /></button>
                </div>
                {lowStockProducts.length ? (
                  <div className="low-stock-list">
                    {lowStockProducts.slice(0, 4).map((p) => (
                      <div className="low-stock-row" key={p.id}>
                        <div className="product-avatar"><Package size={17} /></div>
                        <div className="low-stock-name"><strong>{p.name}</strong><span>{p.sku}</span></div>
                        <span className="stock-badge">{p.quantity} left</span>
                        <span className="reorder-text">Reorder at {p.reorder_level}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="calm-state"><Check size={17} /> No low-stock products detected.</div>}
              </section>
            </>
          )}

          {page === "Products" && (
            <>
              <SectionHeading eyebrow="INVENTORY / CATALOG" title="Products" description="Manage product details, stock levels and pricing." action={<button className="button button-primary" onClick={openCreate}><Plus size={17} /> Add product</button>} />
              <div className="stats-grid compact-stats">
                <StatCard title="Total products" value={products.length} icon={Package} tone="purple" note="Saved product records" />
                <StatCard title="Low stock" value={lowStockProducts.length} icon={AlertTriangle} tone="amber" note="Needs attention" />
                <StatCard title="Inventory value" value={money(dashboard?.inventory_value)} icon={Wallet} tone="green" note="Current stock valuation" />
              </div>
              <section className="panel table-panel">
                <div className="toolbar">
                  <div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product name or SKU…" /></div>
                  <button className={`button ${lowStockOnly ? "button-warning" : "button-secondary"}`} onClick={() => setLowStockOnly((v) => !v)}><AlertTriangle size={16} /> {lowStockOnly ? "Show all products" : "Low stock only"}</button>
                  <button className="icon-button" onClick={loadData} title="Refresh products"><RefreshCw size={17} /></button>
                </div>
                <div className="table-caption">{filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found</div>
                <ProductTable products={filteredProducts} onEdit={openEdit} onDelete={deleteProduct} />
              </section>
            </>
          )}

         
          {page === "Categories" && <Categories />}
          
         

          {page === "Suppliers" && (
            <>
              <SectionHeading eyebrow="INVENTORY / PARTNERS" title="Suppliers" description="Manage the supplier directory connected to your products." action={<button className="button button-primary" onClick={() => { setError(""); setModal("supplier"); }}><Plus size={17} /> Add supplier</button>} />
              <div className="stats-grid compact-stats"><StatCard title="Total suppliers" value={suppliers.length} icon={Truck} tone="blue" note="Supplier records" /><StatCard title="Linked products" value={products.filter((p) => p.supplier_id != null).length} icon={Package} tone="purple" note="Products with a supplier" /></div>
              <section className="panel">
                {suppliers.length ? (
                  <div className="simple-list">{suppliers.map((s) => <div className="simple-row" key={s.id}><div className="product-avatar"><Truck size={18} /></div><div className="simple-row-main"><strong>{s.name}</strong><span>{s.email || "No email"}{s.phone ? ` · ${s.phone}` : ""}</span><span>{s.address || "No address added"}</span></div><span className="neutral-badge">{products.filter((p) => p.supplier_id === s.id).length} products</span></div>)}</div>
                ) : <EmptyState icon={Truck} title="No suppliers yet" text="Add a supplier to connect vendors to your inventory." />}
              </section>
            </>
          )}

          {page === "Sales" && (
            
            <>
              <SectionHeading eyebrow="OPERATIONS / REVENUE" title="Sales" description="Your sales summary is connected to the database. Transaction entry comes in the next module." />
              <div className="stats-grid compact-stats"><StatCard title="Recorded sales value" value={money(dashboard?.total_sales)} icon={CircleDollarSign} tone="green" note="Sum of sales transactions" /><StatCard title="Inventory items" value={products.length} icon={Package} tone="purple" note="Current catalog size" /></div>
              <section className="panel"><EmptyState icon={ShoppingCart} title="Sales transactions are next" text="The next backend step will add sale items, invoice records and automatic stock deduction." /></section>
            </>
          )}
          {page === "Purchases" && (
            <Transactions initialTab="purchases" />
          )}

          {page === "Invoices" && (
            <Transactions initialTab="invoices" />
          )}
          {page === "Sales" && <Transactions initialTab="sales" />}

          {page === "AI Analytics" && (
            <>
              <SectionHeading eyebrow="INTELLIGENCE / FORECASTING" title="AI analytics" description="A foundation for demand forecasting, stock recommendations and anomaly detection." />
              <div className="stats-grid compact-stats"><StatCard title="Products analyzed" value={products.length} icon={BrainCircuit} tone="purple" note="Current inventory records" /><StatCard title="Stock alerts" value={lowStockProducts.length} icon={AlertTriangle} tone="amber" note="Rule-based alerts, not ML predictions" /><StatCard title="Sales history" value={money(dashboard?.total_sales)} icon={BarChart3} tone="blue" note="Available sales value" /></div>
              <section className="panel ai-coming-panel"><div className="ai-large-icon"><BrainCircuit size={30} /></div><div><span className="beta-tag">UPCOMING MODULE</span><h3>Demand forecasting engine</h3><p>We will train and evaluate forecasting models using historical sales data, compare their errors, and show recommendations with transparent explanations. Predictions will not be fabricated from empty sales history.</p><div className="feature-pills"><span>Demand prediction</span><span>Reorder recommendations</span><span>Anomaly detection</span><span>Explainable insights</span></div></div></section>
            </>
          )}

           {page === "Transaction Analytics" && (
            <>
              <SectionHeading
                eyebrow="OPERATIONS / BUSINESS INTELLIGENCE"
                title="Transaction Analytics"
                description="Track sales, purchases, daily totals, and recent invoice activity."
              />
              <TransactionDashboard />
            </>
           )}

          <footer className="footer"><span>© 2026 Alishan's Inventory Hub</span><span><span className="connection-dot" /> Built with React, FastAPI & MySQL</span></footer>
        </div>
      </main>

      {modal === "product" && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <section className="modal-card">
            <div className="modal-heading"><div><span className="eyebrow">INVENTORY / PRODUCT</span><h2>{editingId ? "Edit product" : "Add new product"}</h2><p>Changes are saved directly to MySQL.</p></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button></div>
            <form onSubmit={saveProduct}>
              <div className="form-grid">
                <label className="field"><span>Product name *</span><input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Wireless Mouse" /></label>
                <label className="field"><span>SKU *</span><input required maxLength={64} disabled={Boolean(editingId)} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. INV-1002" /></label>
                <label className="field"><span>Category</span><select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">No category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="field"><span>Supplier</span><select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}><option value="">No supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <label className="field"><span>Quantity *</span><input type="number" required min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
                <label className="field"><span>Reorder level *</span><input type="number" required min="0" step="1" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></label>
                <label className="field"><span>Unit price (₹) *</span><input type="number" required min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></label>
                <label className="field field-full"><span>Description</span><textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional product details" /></label>
              </div>
              {error && <div className="form-error"><AlertTriangle size={16} /> {error}</div>}
              <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{saving ? "Saving…" : editingId ? "Save changes" : "Create product"}</button></div>
            </form>
          </section>
        </div>
      )}

      {modal === "supplier" && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <section className="modal-card modal-small">
            <div className="modal-heading"><div><span className="eyebrow">PARTNERS / SUPPLIER</span><h2>Add supplier</h2><p>Save supplier information in MySQL.</p></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button></div>
            <form onSubmit={saveSupplier}>
              <div className="form-grid single-grid">
                <label className="field"><span>Supplier name *</span><input required maxLength={150} value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} /></label>
                <label className="field"><span>Email</span><input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} /></label>
                <label className="field"><span>Phone</span><input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></label>
                <label className="field"><span>Address</span><textarea rows="2" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} /></label>
              </div>
              {error && <div className="form-error"><AlertTriangle size={16} /> {error}</div>}
              <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Add supplier"}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function ProductTable({ products, onEdit, onDelete }) {
  if (!products.length) {
    return <div className="table-empty"><Package size={28} /><strong>No products found</strong><span>Add a product or change your search filters.</span></div>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>UNIT PRICE</th><th>QUANTITY</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
        <tbody>
          {products.map((p) => {
            const isLow = p.quantity <= p.reorder_level;
            return (
              <tr key={p.id}>
                <td><div className="product-cell"><div className="product-avatar"><Package size={17} /></div><div><strong>{p.name}</strong><span>{p.description || "Inventory item"}</span></div></div></td>
                <td><span className="sku-text">{p.sku}</span></td>
                <td><span className="muted-cell">{p.category_id ? `Category #${p.category_id}` : "Unassigned"}</span></td>
                <td className="price-cell">{money(p.unit_price)}</td>
                <td><strong>{p.quantity}</strong><span className="muted-small"> / reorder {p.reorder_level}</span></td>
                <td><span className={`status-badge ${isLow ? "status-low" : "status-good"}`}><span />{isLow ? "Low stock" : "In stock"}</span></td>
                <td><div className="row-actions"><button className="icon-button small-action" title="Edit product" onClick={() => onEdit(p)}><Pencil size={15} /></button><button className="icon-button small-action danger-action" title="Delete product" onClick={() => onDelete(p)}><Trash2 size={15} /></button></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="empty-state"><div className="empty-state-icon"><Icon size={25} /></div><h3>{title}</h3><p>{text}</p></div>;
}
