import "./Card.css";

export default function Card({ title, children, accent, className = "" }) {
  return (
    <div className={`card ${accent ? "card-accent" : ""} ${className}`}>
      {title && <div className="card-header"><h3 className="card-title">{title}</h3></div>}
      <div className="card-body">{children}</div>
    </div>
  );
}
