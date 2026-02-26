import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="bg-indigo-600 text-white p-4 flex justify-between">
      <h1 className="font-bold text-xl">Lipwa Trust</h1>

      <div className="flex gap-4">
        <Link to="/merchant">Merchant</Link>
        <Link to="/supplier">Supplier</Link>
        <Link to="/admin">Admin</Link>
      </div>
    </nav>
  );
}