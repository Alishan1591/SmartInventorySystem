
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Building2,
  Eye,
  X,
  Package,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import "./Suppliers.css";

const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")
  .replace(/\/$/, "");

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  address: "",
};

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "S";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = await response.json();
      message = body.detail || body.message || message;
    } catch {
      // Keep the default error message if the response isn't JSON.
    }

    throw new Error(
      Array.isArray(message)
        ? message.map((item) => item.msg).join(", ")
        : message
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/api/suppliers");
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load suppliers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return suppliers;

    return suppliers.filter((supplier) =>
      [
        supplier.name,
        supplier.email,
        supplier.phone,
        supplier.address,
        String(supplier.id),
      ].some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [suppliers, search]);

  const supplierWithEmail = useMemo(
    () => suppliers.filter((supplier) => supplier.email?.trim()).length,
    [suppliers]
  );

  const supplierWithPhone = useMemo(
    () => suppliers.filter((supplier) => supplier.phone?.trim()).length,
    [suppliers]
  );

  const openCreateForm = () => {
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const closeCreateForm = () => {
    if (submitting) return;
    setShowForm(false);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    };

    if (!payload.name) {
      setError("Supplier name is required.");
      return;
    }

    setSubmitting(true);

    try {
      const created = await apiRequest("/api/suppliers", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuppliers((current) =>
        [...current, created].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        )
      );

      setShowForm(false);
      setForm(emptyForm);
      setSuccess(`${created.name} was added successfully.`);
    } catch (err) {
      setError(err.message || "Unable to create supplier.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  return (
    <main className="suppliers-page">
      <header className="suppliers-header">
        <div className="suppliers-heading">
          <span className="suppliers-eyebrow">
            <Building2 size={14} />
            INVENTORY MANAGEMENT
          </span>

          <h1>Suppliers</h1>
          <p>
            Manage your supplier directory and keep contact information
            organized in one place.
          </p>
        </div>

        <div className="suppliers-header-actions">
          <button
            type="button"
            className="suppliers-btn suppliers-btn-secondary"
            onClick={loadSuppliers}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "suppliers-spinning" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="suppliers-btn suppliers-btn-primary"
            onClick={openCreateForm}
          >
            <UserPlus size={17} />
            Add Supplier
          </button>
        </div>
      </header>

      {error && !showForm && (
        <div className="suppliers-alert suppliers-alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="suppliers-alert suppliers-alert-success" role="status">
          <CheckCircle2 size={18} />
          <span>{success}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setSuccess("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="suppliers-stats" aria-label="Supplier summary">
        <article className="suppliers-stat-card">
          <div className="suppliers-stat-top">
            <span>Total suppliers</span>
            <span className="suppliers-stat-icon suppliers-icon-violet">
              <Users size={20} />
            </span>
          </div>
          <strong>{loading ? "—" : suppliers.length}</strong>
          <span className="suppliers-stat-caption">Registered in your system</span>
        </article>

        <article className="suppliers-stat-card">
          <div className="suppliers-stat-top">
            <span>With email</span>
            <span className="suppliers-stat-icon suppliers-icon-blue">
              <Mail size={20} />
            </span>
          </div>
          <strong>{loading ? "—" : supplierWithEmail}</strong>
          <span className="suppliers-stat-caption">Email contact available</span>
        </article>

        <article className="suppliers-stat-card">
          <div className="suppliers-stat-top">
            <span>With phone</span>
            <span className="suppliers-stat-icon suppliers-icon-green">
              <Phone size={20} />
            </span>
          </div>
          <strong>{loading ? "—" : supplierWithPhone}</strong>
          <span className="suppliers-stat-caption">Phone contact available</span>
        </article>

        <article className="suppliers-stat-card">
          <div className="suppliers-stat-top">
            <span>Search results</span>
            <span className="suppliers-stat-icon suppliers-icon-orange">
              <Search size={20} />
            </span>
          </div>
          <strong>{loading ? "—" : filteredSuppliers.length}</strong>
          <span className="suppliers-stat-caption">Matching your search</span>
        </article>
      </section>

      <section className="suppliers-directory">
        <div className="suppliers-directory-heading">
          <div>
            <h2>Supplier directory</h2>
            <p>Browse and manage supplier contact details.</p>
          </div>

          <span className="suppliers-count">
            {loading ? "Loading..." : `${filteredSuppliers.length} records`}
          </span>
        </div>

        <div className="suppliers-toolbar">
          <label className="suppliers-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search name, email, phone or address..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search suppliers"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            )}
          </label>

          <button
            type="button"
            className="suppliers-btn suppliers-btn-secondary"
            onClick={() => setSearch("")}
            disabled={!search}
          >
            Clear filters
          </button>
        </div>

        <div className="suppliers-table-wrap">
          <table className="suppliers-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact information</th>
                <th>Address</th>
                <th className="suppliers-action-heading">Details</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>
                    <div className="suppliers-state">
                      <RefreshCw size={22} className="suppliers-spinning" />
                      <span>Loading suppliers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="suppliers-state suppliers-empty-state">
                      <span className="suppliers-empty-icon">
                        <Users size={28} />
                      </span>
                      <strong>
                        {search ? "No matching suppliers" : "No suppliers yet"}
                      </strong>
                      <span>
                        {search
                          ? "Try a different search term."
                          : "Add your first supplier to get started."}
                      </span>
                      {!search && (
                        <button
                          type="button"
                          className="suppliers-btn suppliers-btn-primary"
                          onClick={openCreateForm}
                        >
                          <UserPlus size={16} />
                          Add first supplier
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div className="suppliers-name-cell">
                        <span className="suppliers-avatar">
                          {getInitials(supplier.name)}
                        </span>
                        <span className="suppliers-name-text">
                          <strong>{supplier.name}</strong>
                          <small>Supplier #{supplier.id}</small>
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="suppliers-contact-cell">
                        {supplier.email ? (
                          <a href={`mailto:${supplier.email}`}>
                            <Mail size={14} />
                            <span>{supplier.email}</span>
                          </a>
                        ) : (
                          <span className="suppliers-muted">
                            <Mail size={14} />
                            No email provided
                          </span>
                        )}

                        {supplier.phone ? (
                          <a href={`tel:${supplier.phone}`}>
                            <Phone size={14} />
                            <span>{supplier.phone}</span>
                          </a>
                        ) : (
                          <span className="suppliers-muted">
                            <Phone size={14} />
                            No phone provided
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="suppliers-address-cell">
                        <MapPin size={15} />
                        <span>{supplier.address || "No address provided"}</span>
                      </div>
                    </td>

                    <td className="suppliers-action-cell">
                      <button
                        type="button"
                        className="suppliers-view-btn"
                        onClick={() => setSelectedSupplier(supplier)}
                        aria-label={`View ${supplier.name}`}
                      >
                        <Eye size={16} />
                        View
                        <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="suppliers-table-footer">
          <span>
            Showing {loading ? 0 : filteredSuppliers.length} of{" "}
            {loading ? 0 : suppliers.length} suppliers
          </span>
          <span>Supplier directory</span>
        </footer>
      </section>

      {showForm && (
        <div
          className="suppliers-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateForm();
          }}
        >
          <section
            className="suppliers-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suppliers-form-title"
          >
            <div className="suppliers-modal-header">
              <div>
                <span className="suppliers-modal-icon">
                  <UserPlus size={21} />
                </span>
                <h2 id="suppliers-form-title">Add new supplier</h2>
                <p>Enter the supplier's contact information below.</p>
              </div>
              <button
                type="button"
                className="suppliers-close-btn"
                onClick={closeCreateForm}
                disabled={submitting}
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="suppliers-alert suppliers-alert-error" role="alert">
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="suppliers-form-grid">
                <label className="suppliers-field suppliers-field-full">
                  <span>Supplier name <b>*</b></span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Acme Supplies"
                    maxLength={150}
                    required
                    autoFocus
                  />
                </label>

                <label className="suppliers-field">
                  <span>Email address</span>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleFormChange}
                    placeholder="supplier@example.com"
                  />
                </label>

                <label className="suppliers-field">
                  <span>Phone number</span>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleFormChange}
                    placeholder="Enter phone number"
                    maxLength={30}
                  />
                </label>

                <label className="suppliers-field suppliers-field-full">
                  <span>Address</span>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleFormChange}
                    placeholder="Street, city, state and postal code"
                    rows={3}
                  />
                </label>
              </div>

              <div className="suppliers-form-note">
                <span>*</span> Required field. Contact details are optional.
              </div>

              <div className="suppliers-form-actions">
                <button
                  type="button"
                  className="suppliers-btn suppliers-btn-secondary"
                  onClick={closeCreateForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="suppliers-btn suppliers-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="suppliers-spinning" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Save supplier
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedSupplier && (
        <div
          className="suppliers-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedSupplier(null);
          }}
        >
          <section
            className="suppliers-modal suppliers-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suppliers-details-title"
          >
            <div className="suppliers-modal-header">
              <div>
                <span className="suppliers-modal-icon">
                  <Building2 size={21} />
                </span>
                <h2 id="suppliers-details-title">Supplier details</h2>
                <p>Contact information from your supplier directory.</p>
              </div>
              <button
                type="button"
                className="suppliers-close-btn"
                onClick={() => setSelectedSupplier(null)}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="suppliers-profile">
              <span className="suppliers-profile-avatar">
                {getInitials(selectedSupplier.name)}
              </span>
              <h3>{selectedSupplier.name}</h3>
              <span>Supplier #{selectedSupplier.id}</span>
            </div>

            <div className="suppliers-detail-list">
              <div className="suppliers-detail-item">
                <span className="suppliers-detail-icon"><Mail size={17} /></span>
                <div>
                  <small>Email address</small>
                  {selectedSupplier.email ? (
                    <a href={`mailto:${selectedSupplier.email}`}>
                      {selectedSupplier.email}
                    </a>
                  ) : (
                    <span>Not provided</span>
                  )}
                </div>
              </div>

              <div className="suppliers-detail-item">
                <span className="suppliers-detail-icon"><Phone size={17} /></span>
                <div>
                  <small>Phone number</small>
                  {selectedSupplier.phone ? (
                    <a href={`tel:${selectedSupplier.phone}`}>
                      {selectedSupplier.phone}
                    </a>
                  ) : (
                    <span>Not provided</span>
                  )}
                </div>
              </div>

              <div className="suppliers-detail-item">
                <span className="suppliers-detail-icon"><MapPin size={17} /></span>
                <div>
                  <small>Address</small>
                  <span>{selectedSupplier.address || "Not provided"}</span>
                </div>
              </div>

              <div className="suppliers-detail-item">
                <span className="suppliers-detail-icon"><Package size={17} /></span>
                <div>
                  <small>Linked products and purchase history</small>
                  <span>
                    Not included in the current supplier API response.
                  </span>
                </div>
              </div>
            </div>

            <div className="suppliers-form-actions">
              <button
                type="button"
                className="suppliers-btn suppliers-btn-secondary"
                onClick={() => setSelectedSupplier(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
