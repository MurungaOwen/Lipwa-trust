import { useEffect, useState } from "react";
import { getMerchantDashboard } from "../api/api";
import Navbar from "../components/Navbar";
import Card from "../components/Card";
import ProgressBar from "../components/Progressbar";
import "./Dashboard.css";

const STATUS_COLORS = {
  active: "var(--blue)",
  settled: "var(--green)",
  rejected: "var(--red)",
  pending: "var(--gold)",
};

export default function MerchantDashboard() {
  const [merchant, setMerchant] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMerchantDashboard()
      .then(res => setMerchant(res.data))
      .catch(err => {
        console.error(err);
        setError(err.response?.data?.detail || "Failed to load dashboard. Please try again.");
      });
  }, []);

  if (error) return (
    <>
      <Navbar />
      <div className="dash-error">
        <p>⚠ {error}</p>
      </div>
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

  const repaymentRate = merchant.contracts?.length
    ? Math.round(
        (merchant.contracts.filter(c => c.status === "settled").length / merchant.contracts.length) * 100
      )
    : 0;

  return (
    <>
      <Navbar />
      <div className="dash-page">
        <div className="dash-header">
          <div>
            <p className="dash-greeting">Good day,</p>
            <h2 className="dash-name">{merchant.name}</h2>
            <p className="dash-id">Merchant ID: {merchant.merchant_id}</p>
          </div>
          <div className="dash-header-badge">
            <span className="badge-label">Trust Tier</span>
            <span className="badge-value" style={{
              color: merchant.trust_score >= 70 ? "var(--green)" : merchant.trust_score >= 40 ? "var(--gold)" : "var(--red)"
            }}>
              {merchant.trust_score >= 70 ? "⭐ Premium" : merchant.trust_score >= 40 ? "✓ Standard" : "⚠ Limited"}
            </span>
          </div>
        </div>

        {/* KPI row */}
        <div className="kpi-grid">
          <Card accent>
            <div className="kpi">
              <span className="kpi-label">Trust Score</span>
              <span className="kpi-value" style={{ color: "var(--gold)" }}>{merchant.trust_score}</span>
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
              <span className="kpi-label">Repayment Rate</span>
              <span className="kpi-value" style={{ color: repaymentRate >= 70 ? "var(--green)" : "var(--gold)" }}>
                {repaymentRate}%
              </span>
              <span className="kpi-sub">{merchant.contracts?.length || 0} total contracts</span>
            </div>
          </Card>
        </div>

        {/* Trust score breakdown */}
        <Card title="Credit Profile">
          <div className="profile-grid">
            <ProgressBar value={merchant.trust_score} label="Trust Score" />
            <ProgressBar value={merchant.consistency * 100} label="Payment Consistency" />
            <ProgressBar value={Math.min(100, merchant.days_active / 3)} label="Account Maturity" />
          </div>
        </Card>

        {/* Contracts */}
        <Card title="Contracts">
          {!merchant.contracts?.length ? (
            <div className="empty-state">
              <p>No contracts yet.</p>
              <p className="empty-sub">Apply for credit to get started.</p>
            </div>
          ) : (
            <div className="contracts-list">
              {merchant.contracts.map(contract => (
                <div key={contract.id} className="contract-row">
                  <div className="contract-info">
                    <span className="contract-id">Contract #{contract.id}</span>
                    <span
                      className="contract-status"
                      style={{ color: STATUS_COLORS[contract.status] || "var(--text-muted)" }}
                    >
                      ● {contract.status}
                    </span>
                  </div>
                  <div className="contract-amounts">
                    <div className="amount-item">
                      <span className="amount-label">Requested</span>
                      <span className="amount-value">KES {contract.amount_requested?.toLocaleString()}</span>
                    </div>
                    <div className="amount-item">
                      <span className="amount-label">Approved</span>
                      <span className="amount-value">KES {contract.amount_approved?.toLocaleString() ?? "—"}</span>
                    </div>
                    <div className="amount-item">
                      <span className="amount-label">Repaid</span>
                      <span className="amount-value" style={{ color: "var(--green)" }}>
                        KES {contract.total_repaid?.toLocaleString() ?? 0}
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
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
