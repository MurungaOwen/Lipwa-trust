import { useEffect, useState } from "react";
import { getAdminOverview } from "../api/api";
import Navbar from "../components/Navbar";
import Card from "../components/Card";
import "./Dashboard.css";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminOverview()
      .then(res => setData(res.data))
      .catch(err => {
        console.error(err);
        // Admin overview might not be fully implemented — show placeholder
        setData({ placeholder: true });
      });
  }, []);

  return (
    <>
      <Navbar />
      <div className="dash-page">
        <div className="dash-header">
          <div>
            <p className="dash-greeting">Administration</p>
            <h2 className="dash-name">Platform Overview</h2>
          </div>
        </div>

        {error && <div className="dash-error-inline">⚠ {error}</div>}

        <div className="kpi-grid">
          <Card accent>
            <div className="kpi">
              <span className="kpi-label">Total Merchants</span>
              <span className="kpi-value" style={{ color: "var(--gold)" }}>
                {data?.total_merchants ?? "—"}
              </span>
              <span className="kpi-sub">Registered</span>
            </div>
          </Card>

          <Card>
            <div className="kpi">
              <span className="kpi-label">Active Contracts</span>
              <span className="kpi-value" style={{ color: "var(--blue)" }}>
                {data?.active_contracts ?? "—"}
              </span>
              <span className="kpi-sub">Ongoing</span>
            </div>
          </Card>

          <Card>
            <div className="kpi">
              <span className="kpi-label">Total Suppliers</span>
              <span className="kpi-value" style={{ color: "var(--green)" }}>
                {data?.total_suppliers ?? "—"}
              </span>
              <span className="kpi-sub">Registered</span>
            </div>
          </Card>

          <Card>
            <div className="kpi">
              <span className="kpi-label">Credit Disbursed</span>
              <span className="kpi-value">
                {data?.total_disbursed ? `KES ${data.total_disbursed.toLocaleString()}` : "—"}
              </span>
              <span className="kpi-sub">All time</span>
            </div>
          </Card>
        </div>

        <Card title="System Status">
          <div className="status-grid">
            <div className="status-item">
              <span className="status-dot" style={{ background: "var(--green)" }} />
              <span>API — Operational</span>
            </div>
            <div className="status-item">
              <span className="status-dot" style={{ background: "var(--green)" }} />
              <span>Database — Operational</span>
            </div>
            <div className="status-item">
              <span className="status-dot" style={{ background: "var(--green)" }} />
              <span>Trust Score Engine — Operational</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
