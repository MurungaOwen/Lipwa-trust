import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../api/api";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isMerchant, setIsMerchant] = useState(false);
  const [isSupplier, setIsSupplier] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await registerUser({
        email,
        password,
        is_merchant: isMerchant,
        is_supplier: isSupplier,
      });

      console.log("Registered user:", response.data);
      navigate("/"); // redirect to login
    } catch (err) {
      console.error(err.response?.data || err);
      setError(err.response?.data?.detail || "Registration failed");
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto" }}>
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div style={{ marginTop: "10px" }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div style={{ marginTop: "10px" }}>
          <label>
            <input
              type="checkbox"
              checked={isMerchant}
              onChange={(e) => setIsMerchant(e.target.checked)}
            />
            Register as Merchant
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={isSupplier}
              onChange={(e) => setIsSupplier(e.target.checked)}
            />
            Register as Supplier
          </label>
        </div>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" style={{ marginTop: "20px" }}>
          Register
        </button>
      </form>
    </div>
  );
}