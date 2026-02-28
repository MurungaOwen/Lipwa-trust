import { useEffect, useState, useCallback } from "react";
import {
  getMerchantDashboard,
  getAllSuppliers,
  applyCredit,
  simulateRepayment,
  getContractBlockchainStatus,
} from "../api/api";
import Navbar from "../components/Navbar";
import Card from "../components/Card";
import ProgressBar from "../components/ProgressBar";
import "./Dashboard.css";
import "./MerchantDashboard.css";

const MIN_TRUST_SCORE = 40;
const STELLAR_EXPERT_BASE = "https://stellar.expert/explorer/testnet";

const STATUS_META = {
  PENDING:    { color: "var(--gold)",  icon: "⏳" },
  APPROVED:   { color: "var(--blue)",  icon: "✓"  },
  DISPATCHED: { color: "var(--blue)",  icon: "🚚" },
  DELIVERED:  { color: "var(--green)", icon: "📦" },
  SETTLED:    { color: "var(--green)", icon: "✅" },
  REJECTED:   { color: "var(--red)",   icon: "✗"  },
  OVERDUE:    { color: "var(--red)",   icon: "⚠"  },
};

// ── Loan Modal ─────────────────────────────────────────────────────────────────
function LoanModal({ supplier, merchant, onClose, onSuccess }) {
  const [amount, setAmount]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const maxAmount = merchant.credit_limit;
  const canApply  = merchant.trust_score >= MIN_TRUST_SCORE;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0)    return setError("Enter a valid amount.");
    if (val > maxAmount)     return setError(`Maximum is KES ${maxAmount.toLocaleString()}.`);
    setLoading(true);
    setError("");
    try {
      await applyCredit({ amount_requested: val, supplier_db_id: supplier.id });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || "Application failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-label">Inventory Loan Request</p>
            <h3 className="modal-title">{supplier.name}</h3>
            <p className="modal-sub">
              {supplier.product_category || "General Supplies"} · {supplier.contact_person}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {!canApply ? (
          <div className="modal-blocked">
            <span className="blocked-icon">🔒</span>
            <p className="blocked-title">Trust score too low</p>
            <p className="blocked-sub">
              Your score is <strong>{merchant.trust_score}</strong>. You need at least{" "}
              <strong>{MIN_TRUST_SCORE}</strong> to apply.
            </p>
            <ProgressBar value={merchant.trust_score} label="Your trust score" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="modal-limit-row">
              <div className="limit-pill">
                <span className="limit-label">Credit limit</span>
                <span className="limit-value">KES {maxAmount?.toLocaleString()}</span>
              </div>
              <div className="limit-pill">
                <span className="limit-label">Trust score</span>
                <span className="limit-value" style={{ color: "var(--green)" }}>
                  {merchant.trust_score}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label>Amount requested (KES)</label>
              <input
                type="number"
                placeholder={`Up to ${maxAmount?.toLocaleString()}`}
                value={amount}
                min="1"
                max={maxAmount}
                onChange={(e) => { setAmount(e.target.value); setError(""); }}
                required
              />
            </div>

            {error && <div className="modal-error">{error}</div>}

            <button type="submit" className="modal-btn" disabled={loading}>
              {loading ? "Submitting…" : "Submit loan request →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Repayment Simulator Panel ──────────────────────────────────────────────────
function RepaymentSimulator({ contract, onSuccess }) {
  const [amount, setAmount]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const [result, setResult]           = useState(null);
  const [chainStatus, setChainStatus] = useState(null);
  const [error, setError]             = useState("");

  const remaining = (contract.amount_approved || 0) - (contract.total_repaid || 0);
  const isSettled = contract.status === "SETTLED" || remaining <= 0;

  const handleSimulate = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) return setError("Enter a valid payment amount.");
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const { data } = await simulateRepayment({
        contract_id: contract.id,
        amount: val,
      });
      setResult(data);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || "Simulation failed.");
    } finally {
      setLoading(false);
    }
  };

  const fetchChainStatus = async () => {
    setChainLoading(true);
    setChainStatus(null);
    setError("");
    try {
      const { data } = await getContractBlockchainStatus(contract.id);
      setChainStatus(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not fetch on-chain status.");
    } finally {
      setChainLoading(false);
    }
  };

  return (
    <div className="sim-panel">
      {/* Repayment form */}
      <div className="sim-section">
        <h4 className="sim-title">💳 Simulate Repayment</h4>
        {isSettled ? (
          <p className="sim-settled">✅ This contract is fully settled — no repayment needed.</p>
        ) : (
          <form onSubmit={handleSimulate} className="sim-form">
            <div className="sim-meta-row">
              <span className="sim-meta-item">
                <span className="sim-meta-label">Approved</span>
                KES {contract.amount_approved?.toLocaleString()}
              </span>
              <span className="sim-meta-item">
                <span className="sim-meta-label">Repaid so far</span>
                <span style={{ color: "var(--green)" }}>KES {(contract.total_repaid || 0).toLocaleString()}</span>
              </span>
              <span className="sim-meta-item">
                <span className="sim-meta-label">Remaining</span>
                <span style={{ color: "var(--gold)" }}>KES {remaining.toLocaleString()}</span>
              </span>
            </div>
            <div className="sim-input-row">
              <input
                type="number"
                className="sim-input"
                placeholder={`Pay up to KES ${remaining.toLocaleString()}`}
                value={amount}
                min="1"
                max={remaining}
                onChange={(e) => { setAmount(e.target.value); setError(""); setResult(null); }}
                required
              />
              <button
                type="button"
                className="sim-btn-fill"
                onClick={() => setAmount(remaining.toString())}
              >
                Pay Full
              </button>
              <button type="submit" className="sim-btn" disabled={loading}>
                {loading ? "Processing…" : "Simulate →"}
              </button>
            </div>
            {error && <p className="sim-error">{error}</p>}
          </form>
        )}

        {result && (
          <div className="sim-result">
            <div className="sim-result-row">
              <span>New status</span>
              <strong style={{ color: result.contract_status === "SETTLED" ? "var(--green)" : "var(--blue)" }}>
                {result.contract_status}
              </strong>
            </div>
            <div className="sim-result-row">
              <span>Total repaid</span>
              <strong style={{ color: "var(--green)" }}>KES {result.total_repaid?.toLocaleString()}</strong>
            </div>
            <div className="sim-result-row">
              <span>Remaining</span>
              <strong style={{ color: result.remaining > 0 ? "var(--gold)" : "var(--green)" }}>
                KES {result.remaining?.toLocaleString()}
              </strong>
            </div>
            {result.blockchain?.recorded_on_chain && (
              <div className="sim-chain-badge">⛓ Recorded on Stellar Testnet</div>
            )}
          </div>
        )}
      </div>

      {/* On-chain status fetcher */}
      <div className="sim-section">
        <h4 className="sim-title">🔗 Live On-Chain Status</h4>
        {contract.blockchain_contract_id ? (
          <>
            <div className="sim-chain-id">
              <span className="sim-meta-label">Contract ID</span>
              <code className="sim-code">{contract.blockchain_contract_id}</code>
            </div>
            <div className="sim-links">
              <a
                href={`${STELLAR_EXPERT_BASE}/contract/${contract.blockchain_contract_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="sim-explorer-link"
              >
                🌐 View on Stellar.Expert →
              </a>
            </div>
            <button
              className="sim-btn"
              onClick={fetchChainStatus}
              disabled={chainLoading}
              style={{ marginTop: 12 }}
            >
              {chainLoading ? "Fetching…" : "Fetch On-Chain State"}
            </button>

            {chainStatus && (
              <div className="sim-result" style={{ marginTop: 12 }}>
                <div className="sim-result-row">
                  <span>On-Chain Status</span>
                  <strong style={{ color: "var(--blue)" }}>{chainStatus.status}</strong>
                </div>
                <div className="sim-result-row">
                  <span>Amount</span>
                  <strong>{chainStatus.amount?.toLocaleString()} stroops</strong>
                </div>
                <div className="sim-result-row">
                  <span>Repaid On-Chain</span>
                  <strong style={{ color: "var(--green)" }}>{chainStatus.repaid?.toLocaleString()} stroops</strong>
                </div>
                <div className="sim-result-row">
                  <span>Escrow Balance</span>
                  <strong style={{ color: "var(--gold)" }}>{chainStatus.escrowBalance?.toLocaleString()} stroops</strong>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="sim-no-chain">No blockchain contract anchored yet for this contract.</p>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function MerchantDashboard() {
  const [merchant,  setMerchant]  = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [error,     setError]     = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [selected,  setSelected]  = useState(null);
  const [toast,     setToast]     = useState("");
  const [expandedContract, setExpandedContract] = useState(null);

  const load = useCallback(() => {
    getMerchantDashboard()
      .then(r => setMerchant(r.data))
      .catch(err => setError(err.response?.data?.detail || "Failed to load dashboard."));
    getAllSuppliers()
      .then(r => setSuppliers(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSuccess = () => {
    setSelected(null);
    setToast("Loan request submitted successfully!");
    setTimeout(() => setToast(""), 4000);
    load();
  };

  const handleRepaySuccess = () => {
    setToast("Repayment recorded!");
    setTimeout(() => setToast(""), 4000);
    load();
  };

  if (error) return (
    <>
      <Navbar />
      <div className="dash-error"><p>⚠ {error}</p></div>
    </>
  );

  if (!merchant) return (
    <>
      <Navbar />
      <div className="dash-loading">
        <div className="loading-spinner" />
        <p>Loading your dashboard…</p>
      </div>
    </>
  );

  const canApply = merchant.trust_score >= MIN_TRUST_SCORE;
  const settledCount = merchant.contracts?.filter(c => c.status === "SETTLED").length ?? 0;
  const repaymentRate = merchant.contracts?.length
    ? Math.round((settledCount / merchant.contracts.length) * 100)
    : 0;

  return (
    <>
      <Navbar />

      {toast && (
        <div className="toast">✅ {toast}</div>
      )}

      {selected && (
        <LoanModal
          supplier={selected}
          merchant={merchant}
          onClose={() => setSelected(null)}
          onSuccess={handleSuccess}
        />
      )}

      <div className="dash-page">

        {/* Header */}
        <div className="dash-header">
          <div>
            <p className="dash-greeting">Merchant Portal</p>
            <h2 className="dash-name">{merchant.name}</h2>
            <p className="dash-id">{merchant.merchant_id} · {merchant.business_type}</p>
          </div>
          <div className={`trust-badge ${canApply ? "trust-ok" : "trust-low"}`}>
            <span className="trust-icon">{canApply ? "✓" : "⚠"}</span>
            <div>
              <span className="trust-badge-label">Trust Score</span>
              <span className="trust-badge-value">{merchant.trust_score}</span>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <Card accent>
            <div className="kpi">
              <span className="kpi-label">Trust Score</span>
              <span className="kpi-value" style={{ color: canApply ? "var(--green)" : "var(--red)" }}>
                {merchant.trust_score}
              </span>
              <ProgressBar value={merchant.trust_score} showPercent={false} />
            </div>
          </Card>
          <Card>
            <div className="kpi">
              <span className="kpi-label">Credit Limit</span>
              <span className="kpi-value">KES {merchant.credit_limit?.toLocaleString()}</span>
              <span className="kpi-sub">Available financing</span>
            </div>
          </Card>
          <Card>
            <div className="kpi">
              <span className="kpi-label">Avg Daily Sales</span>
              <span className="kpi-value">KES {merchant.avg_daily_sales?.toLocaleString()}</span>
              <span className="kpi-sub">{merchant.days_active} days active</span>
            </div>
          </Card>
          <Card>
            <div className="kpi">
              <span className="kpi-label">Contracts</span>
              <span className="kpi-value">{merchant.contracts?.length ?? 0}</span>
              <span className="kpi-sub">{repaymentRate}% repayment rate</span>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            { key: "overview",   label: "📊 Overview" },
            { key: "suppliers",  label: `🏭 Suppliers (${suppliers.length})` },
            { key: "contracts",  label: `📄 Contracts (${merchant.contracts?.length ?? 0})` },
          ].map(t => (
            <button
              key={t.key}
              className={`tab ${activeTab === t.key ? "tab-active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="tab-content">
            <Card title="Credit Profile">
              <div className="profile-grid">
                <ProgressBar value={merchant.trust_score} label="Trust Score" />
                <ProgressBar value={merchant.consistency * 100} label="Payment Consistency" />
                <ProgressBar value={Math.min(100, merchant.days_active / 3)} label="Account Maturity" />
              </div>
            </Card>

            <Card title="Blockchain Wallet (Stellar)">
              <div className="wallet-info">
                <div className="wallet-row">
                  <span className="wallet-label">Connected Wallet ID</span>
                  <span className="wallet-value monospace">{merchant.blockchain_wallet_id || "Provisioning..."}</span>
                </div>
                <div className="wallet-row">
                  <span className="wallet-label">Public Address</span>
                  <span className="wallet-value monospace">{merchant.blockchain_public_key || "Provisioning..."}</span>
                </div>
                {merchant.blockchain_public_key && (
                  <>
                    <p className="wallet-sub">Your trust score and loan history are anchored on Stellar Testnet.</p>
                    <a
                      href={`${STELLAR_EXPERT_BASE}/account/${merchant.blockchain_public_key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sim-explorer-link"
                      style={{ marginTop: 8, display: "inline-block" }}
                    >
                      🌐 View Wallet on Stellar.Expert →
                    </a>
                  </>
                )}
              </div>
            </Card>

            <div className={`eligibility-banner ${canApply ? "eligible" : ""}`}>
              <span>{canApply ? "✅" : "🔒"}</span>
              <div>
                {canApply ? (
                  <>
                    <strong>You're eligible for inventory loans!</strong>
                    <p>Visit the Suppliers tab to browse and request financing up to KES {merchant.credit_limit?.toLocaleString()}.</p>
                  </>
                ) : (
                  <>
                    <strong>Not yet eligible for loans</strong>
                    <p>
                      Your trust score ({merchant.trust_score}) is below the minimum of {MIN_TRUST_SCORE}.
                      Keep selling consistently to improve it.
                    </p>
                  </>
                )}
              </div>
              {canApply && (
                <button className="banner-btn" onClick={() => setActiveTab("suppliers")}>
                  Browse suppliers →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── SUPPLIERS ── */}
        {activeTab === "suppliers" && (
          <div className="tab-content">
            {!canApply && (
              <div className="eligibility-banner" style={{ marginBottom: 20 }}>
                <span>🔒</span>
                <div>
                  <strong>Trust score too low to apply</strong>
                  <p>You need at least {MIN_TRUST_SCORE} to request a loan. You can still browse.</p>
                </div>
              </div>
            )}

            {suppliers.length === 0 ? (
              <div className="empty-state">
                <p>No suppliers available yet.</p>
                <p className="empty-sub">Check back soon.</p>
              </div>
            ) : (
              <div className="supplier-grid">
                {suppliers.map(s => (
                  <div key={s.id} className="supplier-card">
                    <div className="supplier-avatar">{s.name[0].toUpperCase()}</div>
                    <div className="supplier-info">
                      <h4 className="supplier-name">{s.name}</h4>
                      <p className="supplier-category">{s.product_category || "General Supplies"}</p>
                      <p className="supplier-contact">👤 {s.contact_person}</p>
                      <p className="supplier-contact">📞 {s.phone_number}</p>
                      {s.blockchain_public_key && (
                        <a
                          href={`${STELLAR_EXPERT_BASE}/account/${s.blockchain_public_key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="supplier-chain-link"
                        >
                          ⛓ Verified on Stellar
                        </a>
                      )}
                    </div>
                    <button
                      className={`supplier-btn ${!canApply ? "supplier-btn-disabled" : ""}`}
                      onClick={() => canApply && setSelected(s)}
                      title={canApply ? "Request loan" : "Trust score too low"}
                    >
                      {canApply ? "Request Loan" : "🔒 Locked"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CONTRACTS ── */}
        {activeTab === "contracts" && (
          <div className="tab-content">
            {!merchant.contracts?.length ? (
              <div className="empty-state">
                <p>No contracts yet.</p>
                <p className="empty-sub">Request a loan from a supplier to get started.</p>
                <button className="empty-action" onClick={() => setActiveTab("suppliers")}>
                  Browse suppliers →
                </button>
              </div>
            ) : (
              <div className="contracts-list">
                {merchant.contracts.map(c => {
                  const meta = STATUS_META[c.status] || { color: "var(--text-muted)", icon: "·" };
                  const remaining = c.amount_approved ? c.amount_approved - (c.total_repaid || 0) : null;
                  const isExpanded = expandedContract === c.id;
                  return (
                    <div key={c.id} className="contract-row">
                      <div className="contract-info">
                        <div>
                          <span className="contract-id">Contract #{c.id}</span>
                          <span className="contract-mid"> · {c.merchant_id}</span>
                          {c.blockchain_contract_id && (
                            <span className="contract-chain-badge">⛓ On-chain</span>
                          )}
                        </div>
                        <span className="contract-status" style={{ color: meta.color }}>
                          {meta.icon} {c.status}
                        </span>
                      </div>

                      <div className="contract-amounts">
                        <div className="amount-item">
                          <span className="amount-label">Requested</span>
                          <span className="amount-value">KES {c.amount_requested?.toLocaleString()}</span>
                        </div>
                        <div className="amount-item">
                          <span className="amount-label">Approved</span>
                          <span className="amount-value">
                            {c.amount_approved ? `KES ${c.amount_approved.toLocaleString()}` : "—"}
                          </span>
                        </div>
                        <div className="amount-item">
                          <span className="amount-label">Repaid</span>
                          <span className="amount-value" style={{ color: "var(--green)" }}>
                            KES {(c.total_repaid || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="amount-item">
                          <span className="amount-label">Remaining</span>
                          <span className="amount-value" style={{ color: remaining > 0 ? "var(--gold)" : "var(--green)" }}>
                            {remaining !== null ? `KES ${remaining.toLocaleString()}` : "—"}
                          </span>
                        </div>
                      </div>

                      {c.amount_approved && (
                        <ProgressBar
                          value={c.total_repaid || 0}
                          max={c.amount_approved}
                          label="Repayment progress"
                        />
                      )}

                      {/* Expand / Collapse Simulator */}
                      <button
                        className="sim-toggle-btn"
                        onClick={() => setExpandedContract(isExpanded ? null : c.id)}
                      >
                        {isExpanded ? "▲ Hide" : "▼ Repayment Simulator & On-Chain Status"}
                      </button>

                      {isExpanded && (
                        <RepaymentSimulator
                          contract={c}
                          onSuccess={handleRepaySuccess}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
