export default function Card({ title, children }) {
  return (
    <div className="bg-white shadow-md rounded-xl p-5">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}