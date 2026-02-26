import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../api/api";
import "./Auth.css";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isMerchant, setIsMerchant] = useState(false);
  const [isSupplier, setIsSupplier] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await registerUser({ email, password, is_merchant: isMerchant, is_supplier: isSupplier });
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">⬡ Lipwa Trust</Link>
        <h2>Create account</h2>
        <p className="auth-sub">Join Lipwa Trust to access credit financing</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="divider" />

          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
            I am registering as
          </p>

          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isMerchant}
                onChange={(e) => setIsMerchant(e.target.checked)}
              />
              🏪 Merchant — I want to apply for credit
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isSupplier}
                onChange={(e) => setIsSupplier(e.target.checked)}
              />
              🏭 Supplier — I supply goods to merchants
            </label>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
