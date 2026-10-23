import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  RefreshCw,
  TrendingUp,
  ShoppingCart,
  PackagePlus,
  ReceiptText,
  CalendarDays,
  Filter,
  RotateCcw,
  Download,
} from "lucide-react";
import "./TransactionDashboard.css";

const API = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const EMPTY_FILTERS = {
  start_date: "",
  end_date: "",
  transaction_type: "all",
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

export default function TransactionDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [draftFilters, setDraftFilters] = useState({
    ...EMPTY_FILTERS,
  });

  const [appliedFilters, setAppliedFilters] = useState({
    ...EMPTY_FILTERS,
  });

  // Load analytics using the currently applied filters.
  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (appliedFilters.start_date) {
        params.set("start_date", appliedFilters.start_date);
      }

      if (appliedFilters.end_date) {
        params.set("end_date", appliedFilters.end_date);
      }

      if (appliedFilters.transaction_type !== "all") {
        params.set(
          "transaction_type",
          appliedFilters.transaction_type
        );
      }

      const query = params.toString();
      const url = `${API}/api/analytics/transactions${
        query ? `?${query}` : ""
      }`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Analytics request failed (${response.status})`
        );
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(
        err.message || "Unable to load transaction analytics."
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  // Export all transactions matching the applied filters.
  const exportToCSV = async () => {
    setExporting(true);

    try {
      const params = new URLSearchParams();

      if (appliedFilters.start_date) {
        params.set("start_date", appliedFilters.start_date);
      }

      if (appliedFilters.end_date) {
        params.set("end_date", appliedFilters.end_date);
      }

      if (appliedFilters.transaction_type !== "all") {
        params.set(
          "transaction_type",
          appliedFilters.transaction_type
        );
      }

      const query = params.toString();
      const url = `${API}/api/analytics/transactions${
        query ? `?${query}` : ""
      }`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Export request failed (${response.status})`
        );
      }

      const result = await response.json();
      const transactions = result.transactions || [];

      const headers = [
        "Invoice Number",
        "Transaction Type",
        "Party",
        "Amount",
        "Date",
      ];

      const escapeCSV = (value) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;

      const rows = transactions.map((transaction) => [
        transaction.invoice_number,
        transaction.type,
        transaction.party,
        transaction.total,
        transaction.created_at,
      ]);

      const csv = [
        headers.map(escapeCSV).join(","),
        ...rows.map((row) =>
          row.map(escapeCSV).join(",")
        ),
      ].join("\r\n");

      const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8;",
      });

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = `transaction-analytics-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      // Release the temporary download URL after the click.
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (err) {
      console.error("CSV export failed:", err);
      window.alert(
        err.message ||
          "Unable to export transactions. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
  const rows = data?.transactions ?? [];

  if (rows.length === 0) {
    alert("No transactions available to export.");
    return;
  }

  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Alishan's Inventory Hub", 14, 18);

  doc.setFontSize(12);
  doc.text("Transaction Analytics Report", 14, 27);

  doc.setFontSize(9);
  doc.text(
    `Generated: ${new Date().toLocaleString()}`,
    14,
    35
  );

  const filterDescription = [
    `Type: ${appliedFilters.type || "All Transactions"}`,
    `From: ${appliedFilters.from || "Any date"}`,
    `To: ${appliedFilters.to || "Any date"}`,
  ].join(" | ");

  doc.text(filterDescription, 14, 42);

  const totalAmount = rows.reduce(
    (sum, transaction) =>
      sum + Number(
        transaction.total_amount ??
        transaction.total ??
        transaction.amount ??
        0
      ),
    0
  );

  doc.text(`Transaction Count: ${rows.length}`, 14, 50);
  doc.text(
    `Total Amount: ${totalAmount.toFixed(2)}`,
    14,
    57
  );

  autoTable(doc, {
    startY: 64,
    head: [[
      "Invoice No.",
      "Type",
      "Party",
      "Date",
      "Amount",
    ]],
    body: rows.map((transaction) => [
      transaction.invoice_number ??
        transaction.invoice_no ??
        transaction.id ??
        "-",
      transaction.type ??
        transaction.transaction_type ??
        "-",
      transaction.party_name ??
        transaction.customer_name ??
        transaction.supplier_name ??
        transaction.party ??
        "-",
      transaction.date ??
        transaction.created_at ??
        "-",
      Number(
        transaction.total_amount ??
        transaction.total ??
        transaction.amount ??
        0
      ).toFixed(2),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: {
      left: 14,
      right: 14,
    },
  });

  doc.save("Alishan's Inventory Hub-Transaction-Report.pdf");
};
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const updateDraft = (field, value) => {
    setDraftFilters((current) => ({
      ...current,
      [field]: value,
    }));

    setFilterError("");
  };

  const applyFilters = (event) => {
    event.preventDefault();

    if (
      draftFilters.start_date &&
      draftFilters.end_date &&
      draftFilters.start_date > draftFilters.end_date
    ) {
      setFilterError(
        "Start date cannot be later than end date."
      );
      return;
    }

    setFilterError("");
    setAppliedFilters({ ...draftFilters });
  };

  const clearFilters = () => {
    setDraftFilters({ ...EMPTY_FILTERS });
    setFilterError("");
    setAppliedFilters({ ...EMPTY_FILTERS });
  };

  const cards = data
    ? [
        {
          label: "Total Sales",
          value: money(data.total_sales),
          detail: `${data.sales_count ?? 0} sales invoices`,
          icon: ShoppingCart,
          type: "sales",
        },
        {
          label: "Total Purchases",
          value: money(data.total_purchases),
          detail: `${data.purchases_count ?? 0} purchase invoices`,
          icon: PackagePlus,
          type: "purchases",
        },
        {
          label: "Today's Sales",
          value: money(data.today_sales),
          detail: "Sales recorded today",
          icon: TrendingUp,
          type: "today-sales",
        },
        {
          label: "Today's Purchases",
          value: money(data.today_purchases),
          detail: "Purchases recorded today",
          icon: CalendarDays,
          type: "today-purchases",
        },
        {
  label: "Net Transaction Balance",
  value: money(
    Number(data.total_sales ?? 0) -
    Number(data.total_purchases ?? 0)
  ),
  detail: "Sales minus purchases",
  icon: TrendingUp,
  type: "net-balance",
},
      ]
    : [];

    

      const comparisonData = [
  {
    name: "Sales",
    amount: Number(data?.total_sales ?? 0),
  },
  {
    name: "Purchases",
    amount: Number(data?.total_purchases ?? 0),
  },
];
const monthlyData = Object.values(
  (data?.transactions ?? []).reduce((months, transaction) => {
    const date = transaction.created_at;

    if (!date) return months;

    // ISO date format: YYYY-MM-DD...
    const monthKey = date.slice(0, 7);

    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return months;
    }

    if (!months[monthKey]) {
      const monthDate = new Date(`${monthKey}-01T12:00:00`);

      months[monthKey] = {
        monthKey,
        month: monthDate.toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        }),
        sales: 0,
        purchases: 0,
      };
    }

    const amount = Number(transaction.total ?? 0);

    if (transaction.type?.toLowerCase() === "sale") {
      months[monthKey].sales += amount;
    } else if (transaction.type?.toLowerCase() === "purchase") {
      months[monthKey].purchases += amount;
    }

    return months;
  }, {})
).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  return (
    <section className="transaction-dashboard">
      {/* Page heading */}
      <div className="td-heading">
        <div>
          <h2>Transaction Analytics</h2>
          <p>Sales, purchases, and recent invoice activity</p>
        </div>

        <button
          type="button"
          className="td-refresh"
          onClick={loadAnalytics}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? "td-spinning" : ""}
          />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Filters */}
      <form className="td-filters" onSubmit={applyFilters}>
        <div className="td-filter-heading">
          <div className="td-filter-title">
            <Filter size={18} />
            <h3>Filter Transactions</h3>
          </div>
          <span>Refine your analytics</span>
        </div>

        <div className="td-filter-fields">
          <label className="td-filter-field">
            <span>Start Date</span>
            <input
              type="date"
              value={draftFilters.start_date}
              max={draftFilters.end_date || undefined}
              onChange={(event) =>
                updateDraft("start_date", event.target.value)
              }
            />
          </label>

          <label className="td-filter-field">
            <span>End Date</span>
            <input
              type="date"
              value={draftFilters.end_date}
              min={draftFilters.start_date || undefined}
              onChange={(event) =>
                updateDraft("end_date", event.target.value)
              }
            />
          </label>

          <label className="td-filter-field">
            <span>Transaction Type</span>
            <select
              value={draftFilters.transaction_type}
              onChange={(event) =>
                updateDraft(
                  "transaction_type",
                  event.target.value
                )
              }
            >
              <option value="all">All Transactions</option>
              <option value="sale">Sales Only</option>
              <option value="purchase">Purchases Only</option>
            </select>
          </label>
        </div>

        {filterError && (
          <p className="td-filter-error" role="alert">
            {filterError}
          </p>
        )}

        <div className="td-filter-actions">
          <button
            type="submit"
            className="td-apply-filter"
            disabled={loading}
          >
            <Filter size={15} />
            Apply Filters
          </button>

          <button
            type="button"
            className="td-export-btn"
            onClick={exportToCSV}
            disabled={loading || exporting}
          >
            <Download size={16} />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
         <button
            type="button"
            className="td-export-btn"
            onClick={exportToPDF}
            >
            <Download size={16} />
            Export PDF
            </button>
          <button
            type="button"
            className="td-clear-filter"
            onClick={clearFilters}
            disabled={loading}
          >
            <RotateCcw size={15} />
            Clear Filters
          </button>
        </div>
      </form>

      {/* Error message */}
      {error && (
        <div className="td-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadAnalytics}>
            Try again
          </button>
        </div>
      )}

      {/* Dashboard content */}
      {loading && !data ? (
        <p className="td-message">
          Loading transaction analytics...
        </p>
      ) : data ? (
        <>
          {loading && (
            <p className="td-message">
              Updating analytics...
            </p>
          )}

          {/* Analytics cards */}
          <div className="td-cards">
            {cards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  className="td-card"
                  key={card.type}
                >
                  <div
                    className={`td-icon td-icon-${card.type}`}
                  >
                    <Icon size={20} />
                  </div>

                  <p className="td-label">{card.label}</p>
                  <h3>{card.value}</h3>
                  <p className="td-detail">{card.detail}</p>
                </article>
              );
            })}
          </div>

          {/* Transaction summary */}
          <div className="td-summary">
            <div>
              <span className="td-summary-label">
                All Transactions
              </span>
              <strong>{data.transaction_count ?? 0}</strong>
            </div>

            <div>
              <span className="td-summary-label">
                Sales Invoices
              </span>
              <strong>{data.sales_count ?? 0}</strong>
            </div>

            <div>
              <span className="td-summary-label">
                Purchase Invoices
              </span>
              <strong>{data.purchases_count ?? 0}</strong>
            </div>
          </div>

          <div className="td-chart-card">
  <div className="td-chart-header">
    <div>
      <h3>Sales vs. Purchases</h3>
      <p>Compare your total sales and purchases</p>
    </div>
  </div>
  <div className="td-chart-card">
  <div className="td-chart-header">
    <div>
      <h3>Monthly Transaction Trend</h3>
      <p>Sales and purchases grouped by month</p>
    </div>
  </div>

  {monthlyData.length === 0 ? (
    <p>No transaction data available for the selected filters.</p>
  ) : (
    <div className="td-chart-container">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={monthlyData}
          margin={{
            top: 10,
            right: 20,
            left: 10,
            bottom: 10,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip
            formatter={(value) => money(Number(value))}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="sales"
            name="Sales"
            stroke="#22c55e"
            strokeWidth={2}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="purchases"
            name="Purchases"
            stroke="#6366f1"
            strokeWidth={2}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )}
</div>

  <div className="td-chart-container">
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={comparisonData}
        margin={{
          top: 10,
          right: 20,
          left: 10,
          bottom: 10,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip
          formatter={(value) => money(Number(value))}
        />
        <Legend />
        <Bar
          dataKey="amount"
          name="Amount"
          fill="#6366f1"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>

          {/* Recent transaction history */}
          <div className="td-history">
            <div className="td-history-heading">
              <div>
                <h3>Recent Transactions</h3>
                <p>
                  {appliedFilters.start_date ||
                  appliedFilters.end_date ||
                  appliedFilters.transaction_type !== "all"
                    ? "Transactions matching your filters"
                    : "Latest sales and purchases from your database"}
                </p>
              </div>

              <ReceiptText size={20} />
            </div>

            {(data.recent_transactions || []).length === 0 ? (
              <p className="td-message">
                No transactions match the selected filters.
              </p>
            ) : (
              <div className="td-table-wrap">
                <table className="td-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Type</th>
                      <th>Customer / Supplier</th>
                      <th>Date</th>
                      <th className="td-amount">Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.recent_transactions.map((item) => (
                      <tr key={`${item.type}-${item.id}`}>
                        <td className="td-invoice">
                          {item.invoice_number || `#${item.id}`}
                        </td>

                        <td>
                          <span
                            className={`td-badge ${
                              item.type === "Sale"
                                ? "td-badge-sale"
                                : "td-badge-purchase"
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>

                        <td>{item.party || "—"}</td>
                        <td>{formatDate(item.created_at)}</td>

                        <td className="td-amount">
                          {money(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        !error && (
          <p className="td-message">
            Analytics data is not available yet.
          </p>
        )
      )}
    </section>
  );
}
