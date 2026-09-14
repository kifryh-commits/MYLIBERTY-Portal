import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import DashboardShell from "./DashboardShell";
import ReportsDashboard from "./ReportsDashboard";
import AIAssistant from "./AIAssistant";
import SelfClockInOut from "./SelfClockInOut";

function ManagerOverview() {
  const [stats, setStats] = useState({
    students: 0,
    classes: 0,
    applications: 0,
    staff: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [userSnap, classSnap, appSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "classes")),
          getDocs(collection(db, "applications"))
        ]);

        const users = userSnap.docs.map(d => d.data());
        setStats({
          students: users.filter(u => u.role === "student").length,
          staff: users.filter(u => u.role !== "student" && u.role !== "admin").length,
          classes: classSnap.size,
          applications: appSnap.docs.filter(d => d.data().status === "pending").length
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#1a3a8f]">Manager Command Center</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time overview of school operations.</p>
        </div>
        <div className="w-full md:w-64">
          <SelfClockInOut />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl border border-slate-200"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={stats.students} color="bg-indigo-50 text-indigo-700 border-indigo-100" />
          <StatCard label="Active Classes" value={stats.classes} color="bg-emerald-50 text-emerald-700 border-emerald-100" />
          <StatCard label="Pending Apps" value={stats.applications} color="bg-amber-50 text-amber-700 border-amber-100" />
          <StatCard label="Staff Members" value={stats.staff} color="bg-rose-50 text-rose-700 border-rose-100" />
        </div>
      )}
      
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
        Use the <strong>Reports</strong> tab for detailed punctuality and analytics.
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`p-6 rounded-2xl border text-left ${color}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-3xl font-black mt-2">{value}</p>
    </div>
  );
}

export default function ManagerDashboard() {
  const tabs = [
    { id: "overview", label: "🏠 Overview", component: <ManagerOverview /> },
    { id: "reports", label: "📊 Reports & Analytics", component: <ReportsDashboard isAdminView={false} isManagerView={true} /> },
    { id: "ai", label: "✨ AI Assistant", component: <AIAssistant /> },
  ];

  return <DashboardShell tabs={tabs} defaultTab="overview" />;
}
