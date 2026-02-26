fetch("http://localhost:8000/merchants/onboard", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "My Test Shop",
    business_type: "Duka",
    contact_person: "John Doe",
    phone_number: "0712345678",
    avg_daily_sales: 2500,
    consistency: 0.75,
    days_active: 120
  })
}).then(r => r.json()).then(console.log)