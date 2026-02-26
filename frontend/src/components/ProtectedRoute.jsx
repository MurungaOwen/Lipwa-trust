import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="p-6">Loading...</p>;

  if (!user) return <Navigate to="/" />;

  if (role === "MERCHANT" && !user.is_merchant) return <Navigate to="/" />;
  if (role === "SUPPLIER" && !user.is_supplier) return <Navigate to="/" />;
  if (role === "ADMIN" && (user.is_merchant || user.is_supplier)) return <Navigate to="/" />;

  return children;
}