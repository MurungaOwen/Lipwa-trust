import { useEffect, useState } from "react";
import {
  getSupplierDashboard,
  approveContract,
  dispatchContract,
  confirmDelivery,
} from "../api/api";
import Navbar from "../components/Navbar";
import Card from "../components/Card";
import ProgressBar from "../components/ProgressBar";
import "./Dashboard.css";
import "./SupplierDashboard.css";

const STATUS_META = {
  PENDING:    { color: "var(--gold)",  icon: "⏳", label: "Pending Approval" },
  APPROVED:   { color: "var(--blue)",  icon: "✓",  label: "Approved" },
  DISPATCHED: { color: "var(--blue)",  icon: "🚚", label: "Dispatched" },
  DELIVERED:  { color: "var(--green)", icon: "📦", label: "Delivered" },
  SETTLED:    { color: "var(--green)", icon: "✅", label: "Settled" },
  REJECTED:   { color: "var(--red)",   icon: "✗",  label: "Rejected" },
  OVERDUE:    { color: "var(--red)",   icon: "⚠",  label: "Overdue" },
};

const NEXT_ACTION = {
  PENDING:    { label: "Approve",          fn: approveContract,  confirm: "Approve this loan contract?" },
  APPROVED:   { label: "Mark Dispatched",  fn: dispatchContract, confirm: "Confirm goods have been dispatched to the merchant?" },
  DISPATCHED: { label: "Confirm Delivery", fn: confirmDelivery,  confirm: "Confirm merchant received the goods? This triggers their repayment schedule." },
};

// ── Contract Row ──────────────────────────────────────────────────────────────
function ContractRow({ contract, onAction }) {
  const [loading, setLoading] = useState(false);
  const meta   = STATUS_META[contract.status] || { color: "var(--text-muted)", icon: "·", label: contract.status };
  const action = NEXT_ACTION[contract.status];
  const remaining = contract.amount_approved
    ? contract.amount_approved - (contract.total_repaid || 0)
    : null;

  const handleAction = async () => {
    if (!window.confirm(action.confirm)) return;
    setLoading(true);
    try {
      await action.fn(contract.id);
      onAction();
    } catch (err) {
      alert(err.response?.data?.detail || "Action failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contract-row supplier-contract-row">
      <div className="contract-info">
        <div className="contract-id-group">
          <span className="contract-id">Contract #{contract.id}</span>
          <span className="s-status-pill" style={{ color: meta.color, borderColor: meta.color }}>
            {meta.icon} {meta.label}
          </span>
        </div>
        {action && (
          <button
            className="action-btn"
            onClick={handleAction}
            disabled={loading}
          >
            {loading ? "Processing…" : `${action.label} →`}
          </button>
        )}
      </div>

      <div className="contract-amounts">
        <div className="amount-item">
          <span className="amount-label">Requested</span>
          <span className="amount-value">KES {contract.amount_requested?.toLocaleString()}</span>
        </div>
        <div className="amount-item">
          <span className="amount-label">Approved</span>
          <span className="amount-value">
            {contract.amount_approved ? `KES ${contract.amount_approved.toLocaleString()}` : "—"}
          </span>
        </div>
        <div className="amount-item">
          <span className="amount-label">Repaid</span>
          <span className="amount-value" style={{ color: "var(--green)" }}>
            KES {(contract.total_repaid || 0).toLocaleString()}
          </span>
        </div>
        <div className="amount-item">
          <span className="amount-label">Outstanding</span>
          <span className="amount-value" style={{ color: remaining > 0 ? "var(--gold)" : "var(--green)" }}>
            {remaining !== null ? `KES ${remaining.toLocaleString()}` : "—"}
          </span>
        </div>
      </div>

      {contract.amount_approved && (
        <ProgressBar
          value={contract.total_repaid || 0}
          max={contract.amount_approved}
          label="Repayment progress"
        />
      )}
    </div>
  );
}

// ── Pipeline Stage ────────────────────────────────────────────────────────────
function PipelineStage({ label, count, value, color, icon }) {
  return (
    <div className="pipeline-stage">
      <div className="pipeline-icon">{icon}</div>
      <div className="pipeline-count" style={{ color }}>{count}</div>
      <div className="pipeline-label">{label}</div>
      {value > 0 && <div className="pipeline-value">KES {value.toLocaleString()}</div>}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function SupplierDashboard() {
  const [data,      setData]      = useState(null);
  const [error,     setError]     = useState("");
  const [activeTab, setActiveTab] = useState("action");
  const [toast,     setToast]     = useState("");

  const load = () => {
    setError("");
    getSupplierDashboard()
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.detail || "Failed to load dashboard."));
  };

  useEffect(() => { load(); }, []);

  const handleAction = () => {
    load();
    setToast("Contract updated successfully!");
    setTimeout(() => setToast(""), 4000);
  };

  if (error) return (
    <>
      <Navbar />
      <div className="dash-error"><p>⚠ {error}</p></div>
    </>
  );

  if (!data) return (
    <>
      <Navbar />
      <div className="dash-loading">
        <div className="loading-spinner" />
        <p>Loading your dashboard…</p>
      </div>
    </>
  );

  const { supplier, stats, contracts } = data;

  const needsAction = [
    ...contracts.pending,
    ...contracts.approved,
    ...contracts.dispatched,
  ];
  const history = [...contracts.delivered, ...contracts.settled];

  const tabs = [
    { key: "action",   label: `🔔 Needs Action (${needsAction.length})` },
    { key: "pipeline", label: "📊 Pipeline" },
    { key: "history",  label: `📁 History (${history.length})` },
  ];

  return (
    <>
      <Navbar />

      {toast && <div className="toast">✅ {toast}</div>}

      <div className="dash-page">

        {/* Header */}
        <div className="dash-header">
          <div>
            <p className="dash-greeting">Supplier Portal</p>
            <h2 className="dash-name">{supplier.name}</h2>
            <p className="dash-id">{supplier.supplier_id} · {supplier.product_category || "General Supplies"}</p>
          </div>
          <div className="supplier-contact-card">
            <p className="sc-name">👤 {supplier.contact_person}</p>
            <p className="sc-phone">📞 {supplier.phone_number}</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <Card accent>
            <div className="kpi">
              <span className="kpi-label">Needs Action</span>
              <span className="kpi-value" style={{ color: needsAction.length ? "var(--gold)" : "var(--text-muted)" }}>
                {needsAction.length}
              </span>
              <span className="kpi-sub">Contracts awaiting you</span>
            </div>
          </Card>
          <Card>
            <div className="kpi">
              <span className="kpi-label">Total Portfolio</span>
              <span className="kpi-value">KES {stats.total_value?.toLocaleString()}</span>
              <span className="kpi-sub">{stats.total_contracts} contracts</span>
            </div>
          </Card>
          <Card>
            <div className="kpi">
              <span className="kpi-label">Settled Value</span>
              <span className="kpi-value" style={{ color: "var(--green)" }}>
                KES {stats.settled_value?.toLocaleString()}
              </span>
              <span className="kpi-sub">{stats.settled_count} fully repaid</span>
            </div>
          </Card>
          <Card>
            <div className="kpi">
              <span className="kpi-label">Total Repaid</span>
              <span className="kpi-value">KES {stats.total_repaid?.toLocaleString()}</span>
              <span className="kpi-sub">Across all contracts</span>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`tab ${activeTab === t.key ? "tab-active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── NEEDS ACTION ── */}
        {activeTab === "action" && (
          <div className="tab-content">
            {needsAction.length === 0 ? (
              <div className="empty-state">
                <p>All caught up! 🎉</p>
                <p className="empty-sub">No contracts need your attention right now.</p>
              </div>
            ) : (
              <>
                <div className="lifecycle-guide">
                  <div className="lc-step" style={{ background: "rgba(201,168,76,0.12)", color: "var(--gold)" }}>⏳ Approve</div>
                  <div className="lc-arrow">→</div>
                  <div className="lc-step" style={{ background: "rgba(59,130,246,0.12)", color: "var(--blue)" }}>🚚 Dispatch</div>
                  <div className="lc-arrow">→</div>
                  <div className="lc-step" style={{ background: "rgba(59,130,246,0.12)", color: "var(--blue)" }}>📦 Confirm Delivery</div>
                  <div className="lc-arrow">→</div>
                  <div className="lc-step" style={{ background: "rgba(34,197,94,0.12)", color: "var(--green)" }}>✅ Settled</div>
                </div>

                <div className="contracts-list">
                  {needsAction.map(c => (
                    <ContractRow key={c.id} contract={c} onAction={handleAction} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PIPELINE ── */}
        {activeTab === "pipeline" && (
          <div className="tab-content">
            <Card title="Contract Pipeline">
              <div className="pipeline-track">
                <PipelineStage
                  label="Pending"    icon="⏳" color="var(--gold)"
                  count={stats.pending_count}
                  value={contracts.pending.reduce((s, c) => s + (c.amount_requested || 0), 0)}
                />
                <div className="pipeline-connector" />
                <PipelineStage
                  label="Approved"   icon="✓"  color="var(--blue)"
                  count={stats.approved_count}
                  value={contracts.approved.reduce((s, c) => s + (c.amount_approved || 0), 0)}
                />
                <div className="pipeline-connector" />
                <PipelineStage
                  label="Dispatched" icon="🚚" color="var(--blue)"
                  count={stats.dispatched_count}
                  value={contracts.dispatched.reduce((s, c) => s + (c.amount_approved || 0), 0)}
                />
                <div className="pipeline-connector" />
                <PipelineStage
                  label="Delivered"  icon="📦" color="var(--green)"
                  count={stats.delivered_count}
                  value={contracts.delivered.reduce((s, c) => s + (c.amount_approved || 0), 0)}
                />
                <div className="pipeline-connector" />
                <PipelineStage
                  label="Settled"    icon="✅" color="var(--green)"
                  count={stats.settled_count}
                  value={stats.settled_value}
                />
              </div>
            </Card>

            <Card title="Repayment Overview">
              <div className="profile-grid">
                <ProgressBar
                  value={stats.total_repaid}
                  max={stats.total_value || 1}
                  label="Overall repayment rate"
                />
                <ProgressBar
                  value={stats.settled_count}
                  max={stats.total_contracts || 1}
                  label="Contracts fully settled"
                />
              </div>
            </Card>
          </div>
        )}

        {/* ── HISTORY ── */}
        {activeTab === "history" && (
          <div className="tab-content">
            {history.length === 0 ? (
              <div className="empty-state">
                <p>No completed contracts yet.</p>
                <p className="empty-sub">Delivered and settled contracts will appear here.</p>
              </div>
            ) : (
              <div className="contracts-list">
                {history.map(c => (
                  <ContractRow key={c.id} contract={c} onAction={load} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}
