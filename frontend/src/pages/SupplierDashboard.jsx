import Navbar from "../components/Navbar";
import Card from "../components/Card";

export default function SupplierDashboard() {
  return (
    <>
      <Navbar />
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold">Supplier Dashboard</h2>

        <Card title="Pending Orders">
          <p>Order #221 - KES 7,000</p>
          <p>Order #229 - KES 12,500</p>
        </Card>

        <Card title="Delivered Orders">
          <p>Order #201 - Completed</p>
        </Card>
      </div>
    </>
  );
}