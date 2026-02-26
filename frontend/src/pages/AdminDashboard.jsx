import Navbar from "../components/Navbar";
import Card from "../components/Card";

export default function AdminDashboard() {
  return (
    <>
      <Navbar />
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>

        <Card title="Total Merchants">
          <p className="text-xl font-semibold">124</p>
        </Card>

        <Card title="Total Active Contracts">
          <p className="text-xl font-semibold">38</p>
        </Card>
      </div>
    </>
  );
}