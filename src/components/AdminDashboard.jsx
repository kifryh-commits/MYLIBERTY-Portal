import { useState, useEffect } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import DashboardShell from "./DashboardShell";
import StatCard from "./ui/StatCard";
import ReportsDashboard from "./ReportsDashboard";
import AIAssistant from "./AIAssistant";
import StudentApplications from "./StudentApplications";
import Kiosk from "./Kiosk";
import StudentRoster from "./StudentRoster";
import ClassManager from "./ClassManager";
import UserForm from "./UserForm";
import InvitesPanel from "./InvitesPanel";
import TasksPanel from "./TasksPanel";
import BadgeModal from "./BadgeModal";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [filterRole, setFilterRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    users, classes, invites, todos, fetchData,
    editId, selectedStudent, setSelectedStudent,
    formData, setFormData,
    handleSave, handleEdit, handleDelete,
    handleAddTodo, handleDeleteTodo,
    handleCreateInvite, handleDeleteInvite,
    getStudentClasses, instructors, students, unenrolledStudents, pendingApplications,
  } = useDashboardData({ setActiveTab });

  // 👈 The old sidebar button reset filterRole to "all" inline on click.
  // DashboardShell's buttons don't carry per-tab side effects, so this
  // replicates the same behavior: reset whenever Staff Directory becomes active.
  useEffect(() => {
    if (activeTab === "directory") setFilterRole("all");
  }, [activeTab]);

  const filteredUsers = users
    .filter(u => u.role !== "student" && u.role !== "admin") // Staff Directory is for regular staff only — admin access is granted manually via Firebase Console, never shown or managed here
    .filter(u => filterRole === "all" || u.role === filterRole)
    .filter(u => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (u.displayName || "").toLowerCase().includes(q) || (u.phone || "").includes(q);
    });

  const overviewTab = (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h3 className="font-bold text-slate-800 text-xl">Admin Overview</h3>
        <p className="text-sm text-slate-500 mt-1">Your operational snapshot for today.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Pending applications", value: pendingApplications, tab: "applications", color: "text-amber-700 bg-amber-50" },
          { label: "Active students", value: students.length, tab: "students", color: "text-indigo-700 bg-indigo-50" },
          { label: "Active classes", value: classes.length, tab: "classes", color: "text-emerald-700 bg-emerald-50" },
          { label: "Unassigned students", value: unenrolledStudents.length, tab: "students", color: "text-rose-700 bg-rose-50" },
        ].map(card => (
          <StatCard key={card.label} size="sm" label={card.label} value={card.value} color={card.color} onClick={() => setActiveTab(card.tab)} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <h4 className="font-bold text-slate-800">Quick actions</h4>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => setActiveTab("applications")} className="p-3 rounded-lg bg-slate-50 border text-sm font-bold text-slate-700 hover:bg-slate-100">Review applications</button>
            <button onClick={() => setActiveTab("addUser")} className="p-3 rounded-lg bg-slate-50 border text-sm font-bold text-slate-700 hover:bg-slate-100">Add staff</button>
            <button onClick={() => setActiveTab("classes")} className="p-3 rounded-lg bg-slate-50 border text-sm font-bold text-slate-700 hover:bg-slate-100">Manage classes</button>
            <button onClick={() => setActiveTab("reports")} className="p-3 rounded-lg bg-slate-50 border text-sm font-bold text-slate-700 hover:bg-slate-100">Open reports</button>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <h4 className="font-bold text-slate-800">Staff snapshot</h4>
          <p className="text-sm text-slate-500 mt-2">{users.filter(user => user.role !== "student" && user.role !== "admin").length} staff profiles · {instructors.length} instructors</p>
          <p className="text-sm text-slate-500 mt-1">{invites.filter(inv => !inv.used).length} pending invitations · {todos.filter(todo => todo.isPinned || todo.type === "deadline").length} pinned tasks</p>
        </div>
      </div>
    </div>
  );

  const directoryTab = (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-150 max-w-6xl mx-auto">
      <h3 className="font-bold text-slate-800 text-base mb-3">Staff Directory</h3>
      <input
        type="text"
        placeholder="🔍 Search by name or phone..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full p-2.5 border rounded-lg mb-3 text-sm"
      />
      <div className="flex gap-1.5 mb-4 flex-wrap text-[10px] font-bold">
        {["all", "instructor", "manager", "marketing", "frontoffice"].map(r => (
          <button key={r} onClick={() => setFilterRole(r)} className={`px-3 py-1.5 rounded-lg transition uppercase ${filterRole === r ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{r}</button>
        ))}
      </div>
      <div className="space-y-2 max-h-[450px] overflow-y-auto">
        {filteredUsers.map(u => (
          <div key={u.id} className="flex justify-between items-start p-3.5 bg-slate-50/50 rounded-xl text-xs border border-slate-150 gap-1.5 hover:bg-slate-50 transition">
            <div className="space-y-1">
              <div className="flex gap-2.5 items-center">
                <span className="bg-[#1a3a8f]/10 text-[#1a3a8f] px-2 py-0.5 rounded uppercase font-bold text-[9px]">{u.role}</span>
                <p className="font-bold text-slate-800">{u.displayName}</p>
              </div>
              <p className="text-slate-500">Email: {u.email} | Phone: {u.phone || "N/A"}</p>
              <p className="text-slate-500">DOB: {u.dob || "N/A"} | Education: {u.educationLevel || "N/A"}</p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setSelectedStudent(u)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 transition">Print Badge</button>
              <button onClick={() => handleEdit(u)} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-600 transition">Edit</button>
              <button onClick={() => handleDelete(u.id)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-600 transition">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const tabs = [
    { id: "overview", label: "🏠 Overview", component: overviewTab },
    { id: "applications", label: "📝 Applications", component: <StudentApplications /> },
    {
      id: "students", label: "🎓 Students", component: (
        <StudentRoster
          students={students}
          getStudentClasses={getStudentClasses}
          setSelectedStudent={setSelectedStudent}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          fetchData={fetchData}
        />
      )
    },
    {
      id: "classes", label: "🏫 Classes", component: (
        <ClassManager
          classes={classes}
          users={users}
          instructors={instructors}
          unenrolledStudents={unenrolledStudents}
          fetchData={fetchData}
        />
      )
    },
    { id: "kiosk", label: "📷 Attendance", component: <Kiosk title="Office Reception Kiosk Station" /> },
    { id: "directory", label: "👥 Staff", component: directoryTab },
    {
      id: "invites", label: "✉️ Invites", component: (
        <InvitesPanel invites={invites} onCreateInvite={handleCreateInvite} onDeleteInvite={handleDeleteInvite} />
      )
    },
    { id: "reports", label: "📊 Reports", component: <ReportsDashboard isAdminView={true} isFrontOffice={false} /> },
    {
      id: "misc", label: "⚙️ Tasks", component: (
        <TasksPanel todos={todos} onAddTodo={handleAddTodo} onDeleteTodo={handleDeleteTodo} />
      )
    },
    { id: "aiAssistant", label: "✨ AI Assistant", component: <AIAssistant /> },
    // 👈 Not a nav destination — only reached via "Edit"/"Add staff" above,
    // which is why it's marked hidden instead of getting a sidebar button.
    {
      id: "addUser", label: "Add / Edit User", hidden: true, component: (
        <UserForm formData={formData} setFormData={setFormData} editId={editId} onSubmit={handleSave} />
      )
    },
  ];

  return (
    <div className="p-5 bg-[#f0f2f5] rounded-2xl min-h-[500px]">
      <DashboardShell tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} title="Admin Panel" />

      {/* ID Badge Modal */}
      <BadgeModal
        person={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
}
