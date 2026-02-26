import { useEffect, useState } from "react";
import { getMerchantDashboard } from "../api/api";
import Navbar from "../components/Navbar";
import Card from "../components/Card";
import ProgressBar from "../components/Progressbar";

export default function MerchantDashboard() {
  const [merchant, setMerchant] = useState(null);

  useEffect(() => {
    getMerchantDashboard()
      .then(res => setMerchant(res.data))
      .catch(err => console.error(err));
  }, []);

  if (!merchant) return <p className="p-6">Loading dashboard...</p>;

  return (
    <>
      <Navbar />
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold">
          Welcome, {merchant.name}
        </h2>

        <Card title="Trust Score">
          <p>{merchant.trust_score}%</p>
          <ProgressBar value={merchant.trust_score} />
        </Card>

        <Card title="Credit Limit">
          <p className="text-xl font-semibold">
            KES {merchant.credit_limit}
          </p>
        </Card>

        <Card title="Contracts">
          {merchant.contracts.map(contract => (
            <div key={contract.id} className="mb-3 border-b pb-2">
              <p>Requested: {contract.amount_requested}</p>
              <p>Repaid: {contract.total_repaid}</p>
              <p>Status: {contract.status}</p>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}