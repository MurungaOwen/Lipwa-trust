import "./ProgressBar.css";

export default function ProgressBar({ value, max = 100, label, showPercent = true }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--gold)" : "var(--red)";

  return (
    <div className="progress-wrap">
      {(label || showPercent) && (
        <div className="progress-meta">
          {label && <span className="progress-label">{label}</span>}
          {showPercent && <span className="progress-pct" style={{ color }}>{Math.round(pct)}%</span>}
        </div>
      )}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
