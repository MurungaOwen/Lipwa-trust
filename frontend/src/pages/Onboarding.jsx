import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { onboardMerchant, onboardSupplier } from "../api/api";
import "./Auth.css";

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Merchant fields
  const [merchantData, setMerchantData] = useState({
    name: "",
    business_type: "Duka",
    contact_person: "",
    phone_number: "",
    avg_daily_sales: 1000,
    consistency: 0.8,
    days_active: 30
  });

  // Supplier fields
  const [supplierData, setSupplierData] = useState({
    name: "",
    contact_person: "",
    phone_number: "",
    product_category: "Wholesale Groceries"
  });

  const handleMerchantSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await onboardMerchant(merchantData);
      setUser({ ...user, has_merchant_profile: true });
      navigate("/merchant");
    } catch (err) {
      setError(err.response?.data?.detail || "Onboarding failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await onboardSupplier(supplierData);
      setUser({ ...user, has_supplier_profile: true });
      navigate("/supplier");
    } catch (err) {
      setError(err.response?.data?.detail || "Onboarding failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="auth-page">Loading...</div>;

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: "500px" }}>
        <h2>Complete your profile</h2>
        <p className="auth-sub">Tell us more about your business to get started</p>

        {error && <div className="auth-error">{error}</div>}

        {user.is_merchant && !user.has_merchant_profile && (
          <form onSubmit={handleMerchantSubmit}>
            <h3>Merchant Information</h3>
            <div className="form-group">
              <label>Business Name</label>
              <input
                type="text"
                value={merchantData.name}
                onChange={(e) => setMerchantData({ ...merchantData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Business Type</label>
              <select
                value={merchantData.business_type}
                onChange={(e) => setMerchantData({ ...merchantData, business_type: e.target.value })}
              >
                <option value="Kibanda">Kibanda</option>
                <option value="Duka">Duka</option>
                <option value="Wholesaler">Wholesaler</option>
                <option value="Restaurant">Restaurant</option>
              </select>
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input
                type="text"
                value={merchantData.contact_person}
                onChange={(e) => setMerchantData({ ...merchantData, contact_person: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="text"
                value={merchantData.phone_number}
                onChange={(e) => setMerchantData({ ...merchantData, phone_number: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Average Daily Sales (KES)</label>
              <input
                type="number"
                value={merchantData.avg_daily_sales}
                onChange={(e) => setMerchantData({ ...merchantData, avg_daily_sales: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="form-group">
              <label>Days Active</label>
              <input
                type="number"
                value={merchantData.days_active}
                onChange={(e) => setMerchantData({ ...merchantData, days_active: parseInt(e.target.value) })}
                required
              />
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Onboarding..." : "Complete Merchant Setup"}
            </button>
          </form>
        )}

        {user.is_supplier && !user.has_supplier_profile && (
          <form onSubmit={handleSupplierSubmit}>
            <h3>Supplier Information</h3>
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                value={supplierData.name}
                onChange={(e) => setSupplierData({ ...supplierData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input
                type="text"
                value={supplierData.contact_person}
                onChange={(e) => setSupplierData({ ...supplierData, contact_person: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="text"
                value={supplierData.phone_number}
                onChange={(e) => setSupplierData({ ...supplierData, phone_number: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Product Category</label>
              <input
                type="text"
                value={supplierData.product_category}
                onChange={(e) => setSupplierData({ ...supplierData, product_category: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Onboarding..." : "Complete Supplier Setup"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
