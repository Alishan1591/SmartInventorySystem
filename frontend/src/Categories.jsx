
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  Tags,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers3,
  FolderOpen,
  ChartNoAxesColumn,
  ArrowUpRight,
} from "lucide-react";
import "./Categories.css";

const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")
  .replace(/\/$/, "");

const emptyForm = { name: "", description: "" };

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsAvailable, setProductsAvailable] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/categories`);
      if (!response.ok) throw new Error("Unable to load categories.");

      const result = await response.json();
      setCategories(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/products`);
      if (!response.ok) throw new Error("Product endpoint unavailable.");

      const result = await response.json();
      const list = Array.isArray(result)
        ? result
        : Array.isArray(result.items)
          ? result.items
          : Array.isArray(result.products)
            ? result.products
            : [];

      setProducts(list);
      setProductsAvailable(true);
    } catch {
      setProducts([]);
      setProductsAvailable(false);
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([loadCategories(), loadProducts()]);
  }, [loadCategories, loadProducts]);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  const showMessage = (message, type = "success") => {
    setError(type === "error" ? message : "");
    setSuccess(type === "success" ? message : "");
  };

  const openAddForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const openEditForm = (category) => {
    setForm({
      name: category.name || "",
      description: category.description || "",
    });
    setEditingId(category.id);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const description = form.description.trim();

    if (!name) {
      showMessage("Category name is required.", "error");
      return;
    }

    const duplicate = categories.some(
      (category) =>
        category.name?.trim().toLowerCase() === name.toLowerCase() &&
        category.id !== editingId
    );

    if (duplicate) {
      showMessage("A category with this name already exists.", "error");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const isEditing = editingId !== null;
    const url = isEditing
      ? `${API}/api/categories/${editingId}`
      : `${API}/api/categories`;

    try {
      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
        }),
      });

      if (!response.ok) {
        let message = "Unable to save category.";
        try {
          const result = await response.json();
          message = result.detail || message;
        } catch {
          // Use the default message.
        }
        throw new Error(
          Array.isArray(message)
            ? message.map((item) => item.msg).join(", ")
            : message
        );
      }

      await refreshDashboard();
      closeForm();
      showMessage(
        isEditing
          ? "Category updated successfully."
          : "Category created successfully."
      );
    } catch (err) {
      showMessage(err.message || "Unable to save category.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category) => {
    const confirmed = window.confirm(
      `Delete category "${category.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(category.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API}/api/categories/${category.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        let message = "Unable to delete category.";
        try {
          const result = await response.json();
          message = result.detail || message;
        } catch {
          // Use the default message.
        }
        throw new Error(
          Array.isArray(message)
            ? message.map((item) => item.msg).join(", ")
            : message
        );
      }

      await refreshDashboard();
      showMessage("Category deleted successfully.");
    } catch (err) {
      showMessage(err.message || "Unable to delete category.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const getProductCategoryId = (product) =>
    product.category_id ?? product.category?.id ?? null;

  const productCounts = useMemo(() => {
    const counts = new Map();

    products.forEach((product) => {
      const id = getProductCategoryId(product);
      if (id !== null && id !== undefined) {
        const key = String(id);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    return counts;
  }, [products]);

  const categoryStats = useMemo(() => {
    const withProducts = categories.filter(
      (category) => (productCounts.get(String(category.id)) || 0) > 0
    ).length;

    const emptyCategories = categories.length - withProducts;

    const categorizedProducts = products.filter((product) => {
      const id = getProductCategoryId(product);
      return id !== null && id !== undefined;
    }).length;

    return { withProducts, emptyCategories, categorizedProducts };
  }, [categories, products, productCounts]);

  const distribution = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          productCount: productCounts.get(String(category.id)) || 0,
        }))
        .sort((a, b) => b.productCount - a.productCount)
        .slice(0, 5),
    [categories, productCounts]
  );

  const maxProductCount = Math.max(
    1,
    ...distribution.map((category) => category.productCount)
  );

  const filteredCategories = categories.filter((category) => {
    const query = search.trim().toLowerCase();
    return (
      (category.name || "").toLowerCase().includes(query) ||
      (category.description || "").toLowerCase().includes(query)
    );
  });

  return (
    <section className="categories-page">
      <header className="categories-heading">
        <div>
          <span className="categories-eyebrow">Alishan's Inventory Hub</span>
          <h1>Category Management</h1>
          <p>Organize your products and get a clearer view of your inventory.</p>
        </div>

        <button className="cat-primary-btn" onClick={openAddForm}>
          <Plus size={18} />
          Add Category
        </button>
      </header>

      {error && (
        <div className="cat-alert cat-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="cat-alert cat-alert-success" role="status">
          <CheckCircle2 size={18} />
          <span>{success}</span>
          <button
            type="button"
            aria-label="Dismiss success message"
            onClick={() => setSuccess("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="cat-stats-grid">
        <article className="cat-stat-card">
          <div className="cat-stat-top">
            <span className="cat-stat-icon cat-icon-teal"><Tags size={21} /></span>
            <span className="cat-stat-caption">OVERVIEW</span>
          </div>
          <strong className="cat-stat-value">
            {loading ? "—" : categories.length}
          </strong>
          <span className="cat-stat-label">Total Categories</span>
          <span className="cat-stat-foot">All registered categories</span>
        </article>

        <article className="cat-stat-card">
          <div className="cat-stat-top">
            <span className="cat-stat-icon cat-icon-blue"><Package size={21} /></span>
            <span className="cat-stat-caption">ACTIVE</span>
          </div>
          <strong className="cat-stat-value">
            {loading || !productsAvailable ? "—" : categoryStats.withProducts}
          </strong>
          <span className="cat-stat-label">Categories in Use</span>
          <span className="cat-stat-foot">Categories with products</span>
        </article>

        <article className="cat-stat-card">
          <div className="cat-stat-top">
            <span className="cat-stat-icon cat-icon-purple"><Layers3 size={21} /></span>
            <span className="cat-stat-caption">PRODUCTS</span>
          </div>
          <strong className="cat-stat-value">
            {loading || !productsAvailable ? "—" : categoryStats.categorizedProducts}
          </strong>
          <span className="cat-stat-label">Categorized Products</span>
          <span className="cat-stat-foot">Products assigned to a category</span>
        </article>

        <article className="cat-stat-card">
          <div className="cat-stat-top">
            <span className="cat-stat-icon cat-icon-amber"><FolderOpen size={21} /></span>
            <span className="cat-stat-caption">REVIEW</span>
          </div>
          <strong className="cat-stat-value">
            {loading || !productsAvailable ? "—" : categoryStats.emptyCategories}
          </strong>
          <span className="cat-stat-label">Empty Categories</span>
          <span className="cat-stat-foot">Categories with no products</span>
        </article>
      </div>

      <div className="cat-dashboard-grid">
        <section className="categories-panel cat-distribution-panel">
          <div className="cat-section-heading">
            <div className="cat-section-title-icon"><ChartNoAxesColumn size={19} /></div>
            <div>
              <h2>Category Overview</h2>
              <p>Product distribution across your categories</p>
            </div>
          </div>

          {!productsAvailable ? (
            <div className="cat-chart-message">
              <Package size={24} />
              <strong>Product statistics unavailable</strong>
              <span>Check that GET /api/products is available.</span>
            </div>
          ) : distribution.length === 0 ? (
            <div className="cat-chart-message">
              <Tags size={24} />
              <strong>No categories to display</strong>
              <span>Create a category to start organizing products.</span>
            </div>
          ) : (
            <div className="cat-distribution-list">
              {distribution.map((category, index) => (
                <div className="cat-distribution-item" key={category.id}>
                  <div className="cat-distribution-label">
                    <span className={`cat-rank cat-rank-${index + 1}`}>
                      {index + 1}
                    </span>
                    <span className="cat-distribution-name">{category.name}</span>
                    <strong>{category.productCount}</strong>
                  </div>
                  <div className="cat-progress-track">
                    <div
                      className={`cat-progress-fill cat-progress-${index + 1}`}
                      style={{
                        width: `${(category.productCount / maxProductCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="cat-chart-footer">
            <span>Top 5 categories by product count</span>
            <ArrowUpRight size={16} />
          </div>
        </section>

        <section className="categories-panel cat-insights-panel">
          <div className="cat-section-heading">
            <div className="cat-section-title-icon"><Layers3 size={19} /></div>
            <div>
              <h2>Quick Insights</h2>
              <p>Category management snapshot</p>
            </div>
          </div>

          <div className="cat-insight-row">
            <span className="cat-insight-icon cat-icon-teal"><Tags size={18} /></span>
            <div className="cat-insight-copy">
              <strong>Category records</strong>
              <span>Total categories saved in the system</span>
            </div>
            <b>{loading ? "—" : categories.length}</b>
          </div>

          <div className="cat-insight-row">
            <span className="cat-insight-icon cat-icon-blue"><Package size={18} /></span>
            <div className="cat-insight-copy">
              <strong>In-use categories</strong>
              <span>Categories assigned to products</span>
            </div>
            <b>{productsAvailable ? categoryStats.withProducts : "—"}</b>
          </div>

          <div className="cat-insight-row">
            <span className="cat-insight-icon cat-icon-amber"><FolderOpen size={18} /></span>
            <div className="cat-insight-copy">
              <strong>Empty categories</strong>
              <span>Available for future products</span>
            </div>
            <b>{productsAvailable ? categoryStats.emptyCategories : "—"}</b>
          </div>

          <button
            type="button"
            className="cat-refresh-link"
            onClick={refreshDashboard}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "cat-spinning" : ""} />
            Refresh dashboard data
          </button>
        </section>
      </div>

      <section className="categories-panel cat-list-panel">
        <div className="categories-toolbar">
          <div>
            <h2>All Categories</h2>
            <p>
              {filteredCategories.length}{" "}
              {filteredCategories.length === 1 ? "category" : "categories"} found
            </p>
          </div>

          <div className="cat-toolbar-actions">
            <label className="cat-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search categories..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <button
              className="cat-icon-btn"
              type="button"
              title="Refresh categories"
              aria-label="Refresh categories"
              onClick={refreshDashboard}
              disabled={loading}
            >
              <RefreshCw size={17} className={loading ? "cat-spinning" : ""} />
            </button>
          </div>
        </div>

        <div className="cat-table-wrapper">
          <table className="cat-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Category Name</th>
                <th>Description</th>
                <th>Products</th>
                <th className="cat-actions-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="cat-empty">Loading categories...</td></tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cat-empty">
                    <Tags size={28} />
                    <strong>{search ? "No matching categories" : "No categories found"}</strong>
                    <span>
                      {search
                        ? "Try a different search term."
                        : "Add your first category to get started."}
                    </span>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
                  <tr key={category.id}>
                    <td className="cat-id">#{category.id}</td>
                    <td>
                      <div className="cat-name-cell">
                        <span className="cat-name-icon"><Tags size={16} /></span>
                        <strong>{category.name}</strong>
                      </div>
                    </td>
                    <td className="cat-description">{category.description || "—"}</td>
                    <td>
                      {productsAvailable ? (
                        <span className="cat-product-badge">
                          {productCounts.get(String(category.id)) || 0}
                        </span>
                      ) : "—"}
                    </td>
                    <td>
                      <div className="cat-row-actions">
                        <button
                          type="button"
                          className="cat-action-btn cat-edit-btn"
                          title="Edit category"
                          aria-label={`Edit ${category.name}`}
                          onClick={() => openEditForm(category)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="cat-action-btn cat-delete-btn"
                          title="Delete category"
                          aria-label={`Delete ${category.name}`}
                          disabled={deletingId === category.id}
                          onClick={() => handleDelete(category)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div
          className="cat-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) closeForm();
          }}
        >
          <div
            className="cat-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cat-modal-title"
          >
            <div className="cat-modal-heading">
              <div>
                <span className="categories-eyebrow">CATEGORY DETAILS</span>
                <h2 id="cat-modal-title">
                  {editingId !== null ? "Edit Category" : "Add Category"}
                </h2>
              </div>
              <button
                type="button"
                className="cat-icon-btn"
                aria-label="Close form"
                disabled={saving}
                onClick={closeForm}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label htmlFor="cat-name">Category Name *</label>
              <input
                id="cat-name"
                type="text"
                placeholder="e.g. Electronics"
                maxLength={100}
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />

              <label htmlFor="cat-description">Description</label>
              <textarea
                id="cat-description"
                placeholder="Enter a short category description..."
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />

              <div className="cat-form-actions">
                <button
                  type="button"
                  className="cat-secondary-btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cat-primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Save Changes"
                      : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
