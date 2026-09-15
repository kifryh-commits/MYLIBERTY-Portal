import { useState } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import ReportsDashboard from "./ReportsDashboard";
import AIAssistant from "./AIAssistant";
import StudentApplications from "./StudentApplications";
import Kiosk from "./Kiosk";
import StudentRoster from "./StudentRoster";
import ClassManager from "./ClassManager";
import UserForm from "./UserForm";
import TasksPanel from "./TasksPanel";
import BadgeModal from "./BadgeModal";

export default function FrontOfficeDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [receptionMode, setReceptionMode] = useState(false);

  const {
    users, classes, todos, fetchData,
    editId, selectedStudent, setSelectedStudent,
    formData, setFormData,
    handleSave, handleEdit, handleDelete,
    handleAddTodo, handleDeleteTodo,
    getStudentClasses, instructors, students, unenrolledStudents, pendingApplications,
  } = useDashboardData({ restrictedRead: true, setActiveTab });

  const sendWhatsAppInvite = (phone) => {
    if (!phone) return alert("Please enter a phone number first.");

    // Clean and format phone for international use (62 for Indonesia)
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.substring(1);
    }

    const regUrl = window.location.origin + "/register";
    const message = encodeURIComponent(`Hello! Greetings from My Liberty school. 🌟 Please complete your student registration here: ${regUrl}`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
  };

  if (receptionMode) {
    return (
      <div className="fixed inset-0 z-[1000] bg-slate-900 flex flex-col items-center justify-center p-6">
        <button
          onClick={() => setReceptionMode(false)}
          className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold transition"
        >
          Exit Reception Mode
        </button>
        <div className="w-full max-w-2xl">
          <Kiosk title="Front Office Student Scan Station" studentsOnly={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 p-5 bg-[#f0f2f5] rounded-2xl min-h-[500px]">
      {/* Sidebar — deliberately shorter than Admin's: no Attendance, Staff, or Invites */}
      <div className="w-full md:w-1/4 flex md:flex-col gap-2.5 overflow-x-auto md:overflow-visible md:border-r md:pr-5 border-slate-200">
        <h2 className="text-xl font-bold text-[#1a3a8f] mb-4 hidden md:block">Front Office</h2>

        <button
          onClick={() => setReceptionMode(true)}
          className="p-3 rounded-xl text-left font-bold text-sm bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition mb-2"
        >
          🚀 Launch Reception Mode
        </button>

        <button onClick={() => setActiveTab("overview")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "overview" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>🏠 Overview</button>
        <button onClick={() => setActiveTab("applications")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "applications" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>📝 Applications</button>
        <button onClick={() => setActiveTab("students")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "students" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>🎓 Students</button>
        <button onClick={() => setActiveTab("classes")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "classes" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>🏫 Classes</button>
        <button onClick={() => setActiveTab("reports")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "reports" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>📊 Reports</button>
        <button onClick={() => setActiveTab("misc")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "misc" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>⚙️ Tasks</button>
        <button onClick={() => setActiveTab("aiAssistant")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "aiAssistant" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>✨ AI Assistant</button>
      </div>

      {/* Workspace */}
      <div className="w-full md:w-3/4">
        {activeTab === "overview" && (
          <div className="space-y-5 max-w-6xl mx-auto">
            <div>
              <h3 className="font-bold text-slate-800 text-xl">Front Office Overview</h3>
              <p className="text-sm text-slate-500 mt-1">Your operational snapshot for today.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Pending applications", value: pendingApplications, tab: "applications", color: "text-amber-700 bg-amber-50" },
                { label: "Active students", value: students.length, tab: "students", color: "text-indigo-700 bg-indigo-50" },
                { label: "Active classes", value: classes.length, tab: "classes", color: "text-emerald-700 bg-emerald-50" },
                { label: "Unassigned students", value: unenrolledStudents.length, tab: "students", color: "text-rose-700 bg-rose-50" },
              ].map(card => (
                <button key={card.label} onClick={() => setActiveTab(card.tab)} className={`p-4 rounded-xl border text-left hover:shadow-sm transition ${card.color}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{card.label}</p>
                  <p className="text-2xl font-black mt-2">{card.value}</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border-2 border-indigo-100 shadow-sm">
                <h4 className="font-bold text-indigo-900 flex items-center gap-2">🟢 Walk-in Registration</h4>
                <p className="text-xs text-slate-500 mt-1">Send a registration link directly to a parent's WhatsApp.</p>
                <div className="mt-4 flex gap-2">
                  <input
                    type="tel"
                    id="wa-phone"
                    placeholder="Parent's Phone (e.g. 0812...)"
                    className="flex-1 p-2.5 border rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#1a3a8f]"
                  />
                  <button
                    onClick={() => sendWhatsAppInvite(document.getElementById("wa-phone").value)}
                    className="bg-[#25D366] text-white px-4 py-2 rounded-xl font-bold text-xs hover:shadow-md transition"
                  >
                    Send Link
                  </button>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-800">Quick actions</h4>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button onClick={() => setActiveTab("applications")} className="p-3 rounded-lg bg-slate-50 border text-sm font-bold text-slate-700 hover:bg-slate-100">Review applications</button>
                  <button onClick={() => setActiveTab("classes")} className="p-3 rounded-lg bg-slate-50 border text-sm font-bold text-slate-700 hover:bg-slate-100">Manage classes</button>
                  <button onClick={() => setActiveTab("reports")} className="p-3 rounded-lg bg-slate-50 border text-sm font-bold text-slate-700 hover:bg-slate-100">Open reports</button>
                  <button onClick={() => setReceptionMode(true)} className="p-3 rounded-lg bg-slate-50 border text-sm font-bold text-slate-700 hover:bg-slate-100">Reception mode</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Not in the sidebar — only reachable via "Edit" on a student in the
            roster below. Editing is safe here: UserForm locks the Role field
            whenever editId is set, so this can never be used to create staff
            accounts or change someone's role. */}
        {activeTab === "addUser" && (
          <UserForm
            formData={formData}
            setFormData={setFormData}
            editId={editId}
            onSubmit={handleSave}
          />
        )}

        {activeTab === "students" && (
          <StudentRoster
            students={students}
            getStudentClasses={getStudentClasses}
            setSelectedStudent={setSelectedStudent}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
            fetchData={fetchData}
          />
        )}

        {activeTab === "classes" && (
          <ClassManager
            classes={classes}
            users={users}
            instructors={instructors}
            unenrolledStudents={unenrolledStudents}
            fetchData={fetchData}
          />
        )}

        {activeTab === "reports" && <ReportsDashboard isAdminView={false} isFrontOffice={true} />}
        {activeTab === "misc" && (
          <TasksPanel
            todos={todos}
            onAddTodo={handleAddTodo}
            onDeleteTodo={handleDeleteTodo}
          />
        )}
        {activeTab === "aiAssistant" && <AIAssistant />}
        {activeTab === "applications" && <StudentApplications />}
      </div>

      {/* ID Badge Modal */}
      <BadgeModal
        person={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
}
