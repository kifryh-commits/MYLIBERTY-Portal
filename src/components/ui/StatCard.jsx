// Was a local function living only inside ManagerDashboard. Promoted here so
// AdminDashboard's overview tiles (and anywhere else) can use the exact same
// big-number tile instead of a hand-rolled lookalike.
//
// Usage: <StatCard label="Total Students" value={42} color="bg-indigo-50 text-indigo-700 border-indigo-100" />
export default function StatCard({ label, value, color }) {
  return (
    <div className={`p-6 rounded-2xl border text-left ${color}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-3xl font-black mt-2">{value}</p>
    </div>
  );
}
