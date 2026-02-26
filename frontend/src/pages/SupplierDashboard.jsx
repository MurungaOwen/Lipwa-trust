import { useEffect, useState } from "react";
import { getSupplierDashboard } from "../api/api";
import Navbar from "../components/Navbar";
import Card from "../components/Card";
import "./Dashboard.css";

const STATUS_COLORS = {
  active: "var(--blue)",
  settled: "var(--green)",
  rejected: "var(--red)",
  pending: "var(--gold)",
};

export default function SupplierDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getSupplierDashboard()
      .then(res => setData(res.data))
      .catch(err => {
        console.error(err);
        setError(err.response?.data?.detail || "Failed to load dashboard.");
      });
  }, []);

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

  const activeContracts = data.contracts?.filter(c => c.status === "active") || [];
  const settledContracts = data.contracts?.filter(c => c.status === "settled") || [];
  const totalValue = data.contracts?.reduce((sum, c) => sum + (c.amount_approved || 0), 0) || 0;

  return (
    <>
      <Navbar />
      <div className="dash-page">
        <div className="dash-header">
          <div>
            <p className="dash-greeting">Supplier Portal</p>
            <h2 className="dash-name">{data.name}</h2>
            <p className="dash-id">ID: {data.supplier_id}</p>
          </div>
        </div>

        <div className="kpi-grid">
          <Card accent>
            <div className="kpi">
              <span className="kpi-label">Active Orders</span>
              <span className="kpi-value" style={{ color: "var(--blue)" }}>{activeContracts.length}</span>
              <span className="kpi-sub">Pending fulfilment</span>
            </div>
          </Card>
          <Card>
            <div className="kpi">
              <span className="kpi-label">Completed Orders</span>
              <span className="kpi-value" style={{ color: "var(--green)" }}>{settledContracts.length}</span>
              <span className="kpi-sub">Fully settled</span>
            </div>
          </Card>
          <Card>
            <div className="kpi">
              <span className="kpi-label">Total Financed</span>
              <span className="kpi-value">KES {totalValue.toLocaleString()}</span>
              <span className="kpi-sub">All time</span>
            </div>
          </Card>
        </div>

        <Card title="Active Orders">
          {!activeContracts.length ? (
            <div className="empty-state">
              <p>No active orders.</p>
              <p className="empty-sub">Contracts from merchants will appear here.</p>
            </div>
          ) : (
            <div className="contracts-list">
              {activeContracts.map(c => (
                <div key={c.id} className="contract-row">
                  <div className="contract-info">
                    <span className="contract-id">Order #{c.id}</span>
                    <span className="contract-status" style={{ color: STATUS_COLORS[c.status] }}>● {c.status}</span>
                  </div>
                  <div className="contract-amounts">
                    <div className="amount-item">
                      <span className="amount-label">Value</span>
                      <span className="amount-value">KES {c.amount_approved?.toLocaleString()}</span>
                    </div>
                    <div className="amount-item">
                      <span className="amount-label">Repaid</span>
                      <span className="amount-value" style={{ color: "var(--green)" }}>
                        KES {c.total_repaid?.toLocaleString() ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
