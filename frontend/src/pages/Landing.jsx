import { Link } from "react-router-dom";
import "./Landing.css";

export default function Landing() {
  return (
    <div className="landing">
      <div className="landing-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="grid-overlay" />
      </div>

      <nav className="landing-nav">
        <span className="landing-logo">⬡ Lipwa Trust</span>
        <div className="landing-nav-links">
          <Link to="/login" className="nav-link">Sign in</Link>
          <Link to="/register" className="btn-gold">Get Started</Link>
        </div>
      </nav>

      <main className="landing-hero">
        <div className="landing-badge">Fintech · East Africa</div>
        <h1 className="landing-title">
          Credit built on<br />
          <em>trust, not paper</em>
        </h1>
        <p className="landing-sub">
          Lipwa Trust connects merchants and suppliers through transparent credit scoring,
          enabling inventory financing for businesses that banks overlook.
        </p>
        <div className="landing-actions">
          <Link to="/register" className="btn-gold btn-lg">Start your application</Link>
          <Link to="/login" className="btn-ghost btn-lg">Sign in →</Link>
        </div>

        <div className="landing-stats">
          <div className="stat">
            <span className="stat-num">124+</span>
            <span className="stat-label">Active merchants</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">KES 2.4M</span>
            <span className="stat-label">Credit disbursed</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">94%</span>
            <span className="stat-label">Repayment rate</span>
          </div>
        </div>
      </main>
    </div>
  );
}
