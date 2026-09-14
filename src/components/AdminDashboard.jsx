import { useState, useEffect, useCallback } from "react";
import { db, firebaseConfig } from "../firebase";
import { collection, doc, setDoc, addDoc, getDocs, deleteDoc, query, where } from "firebase/firestore";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
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

function getSecondaryAuth() {
  const secondaryApp = getApps().find(app => app.name === "Secondary")
    || initializeApp(firebaseConfig, "Secondary");
  return getAuth(secondaryApp);
}

export default function AdminDashboard({ isFrontOffice = false }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [filterRole, setFilterRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [applications, setApplications] = useState([]);
  const [invites, setInvites] = useState([]);
  const [editId, setEditId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Form State for adding/editing users
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", nickname: "", gender: "male",
    email: "", password: "", role: "instructor", phone: "", dob: "",
    educationLevel: "SD", joinedDate: "", parentName: "", parentPhone: "",
    rating: "1", notes: ""
  });

  // Misc & Tasks
  const [todos, setTodos] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const usersQuery = isFrontOffice
        ? query(collection(db, "users"), where("role", "in", ["student", "instructor"]))
        : collection(db, "users");
      const userSnap = await getDocs(usersQuery);
      setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const classSnap = await getDocs(collection(db, "classes"));
      setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const applicationSnap = await getDocs(collection(db, "applications"));
      setApplications(applicationSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const todoSnap = await getDocs(collection(db, "todos"));
      setTodos(todoSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Fetch invites
      const inviteSnap = await getDocs(collection(db, "invites"));
      setInvites(inviteSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
  }, [isFrontOffice]);

  const handleCreateInvite = async (email, role) => {
    try {
      const token = crypto.randomUUID();
      // Doc ID == token, so the public /join/ page can look an invite up
      // by exact ID without needing permission to list the whole collection.
      await setDoc(doc(db, "invites", token), {
        email: email.toLowerCase(), role,
        createdAt: new Date().toISOString(),
        used: false, token
      });
      fetchData();
      alert("Invitation generated!");
    } catch (err) { alert(err.message); }
  };

  const handleDeleteInvite = async (id) => {
    if (!confirm("Cancel this invitation?")) return;
    try {
      await deleteDoc(doc(db, "invites", id));
      fetchData();
    } catch (err) { alert(err.message); }
  };

  useEffect(() => { (async () => { await fetchData(); })(); }, [fetchData]);

  // QR code generation is now handled inside BadgeModal

  // Handle cross-component payment toggles
  const togglePaymentStatus = useCallback(async (uid, currentStatus) => {
    try {
      await setDoc(doc(db, "users", uid), { paymentStatus: currentStatus === "paid" ? "pending" : "paid" }, { merge: true });
      fetchData();
    } catch (err) { alert(err.message); }
  }, [fetchData]);

  useEffect(() => {
    const handleToggle = (e) => togglePaymentStatus(e.detail.id, e.detail.status);
    window.addEventListener("togglePayment", handleToggle);
    return () => window.removeEventListener("togglePayment", handleToggle);
  }, [togglePaymentStatus]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      // 👈 Constructs displayName dynamically and includes gender/nickname fields
      const baseData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        nickname: formData.nickname,
        gender: formData.gender,
        displayName: `${formData.firstName} ${formData.lastName}`.trim(),
        role: formData.role, phone: formData.phone, dob: formData.dob, educationLevel: formData.educationLevel,
        joinedDate: formData.role === "student" ? formData.joinedDate : "",
        parentName: formData.role === "student" ? formData.parentName : "", parentPhone: formData.role === "student" ? formData.parentPhone : "",
        rating: formData.role === "student" ? formData.rating : "", notes: formData.role === "student" ? formData.notes : ""
      };

      if (formData.role === "student") {
        if (editId) {
          await setDoc(doc(db, "users", editId), baseData);
        } else {
          await addDoc(collection(db, "users"), baseData);
        }
      } else {
        let uid = editId;
        if (!editId) {
          const secAuth = getSecondaryAuth();
          const cred = await createUserWithEmailAndPassword(secAuth, formData.email, formData.password);
          uid = cred.user.uid;
        }
        await setDoc(doc(db, "users", uid), { ...baseData, email: formData.email });
      }

      alert(editId ? "Profile updated!" : (formData.role === "student" ? "Student added to roster!" : "Account created!"));
      setEditId(null);
      setFormData({ firstName: "", lastName: "", nickname: "", gender: "male", email: "", password: "", role: "instructor", phone: "", dob: "", educationLevel: "SD", joinedDate: "", parentName: "", parentPhone: "", rating: "1", notes: "" });
      fetchData();
      setActiveTab("directory");
    } catch (err) { alert(err.message); }
  };

  const handleAddTodo = async ({ text, type, isPinned, assignee }) => {
    try {
      await addDoc(collection(db, "todos"), {
        text, type, isPinned, assignee,
        completed: false,
        createdAt: new Date().toISOString()
      });
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleDeleteTodo = async (todoId) => {
    if (!confirm("Delete this task or reminder?")) return;
    try {
      await deleteDoc(doc(db, "todos", todoId));
      setTodos(current => current.filter(t => t.id !== todoId));
    } catch (err) { alert("Error deleting task: " + err.message); }
  };

  const handleEdit = (user) => {
    setEditId(user.id);
    setFormData({
      firstName: user.firstName || user.displayName?.split(" ")[0] || "",
      lastName: user.lastName || user.displayName?.split(" ").slice(1).join(" ") || "",
      nickname: user.nickname || "",
      gender: user.gender || "male",
      email: user.email || "", password: "PREFILLED_PASSWORD", role: user.role || "student", phone: user.phone || "", dob: user.dob || "",
      educationLevel: user.educationLevel || "SD", joinedDate: user.joinedDate || "", parentName: user.parentName || "", parentPhone: user.parentPhone || "", rating: user.rating || "1", notes: user.notes || ""
    });
    setActiveTab("addUser");
  };

  const handleDelete = async (uid) => {
    const user = users.find(profile => profile.id === uid);
    if (!user || !confirm(`Are you sure you want to delete ${user.displayName || "this profile"}?`)) return;

    try {
      await deleteDoc(doc(db, "users", uid));
      fetchData();
      if (user.role === "student") {
        alert("Student roster profile deleted.");
      } else {
        alert("Staff profile deleted from Firestore. The Firebase Auth account still exists and must be deleted separately in Firebase Console before this email can be registered again.");
      }
    } catch (err) { alert("Unable to delete profile: " + err.message); }
  };

  const filteredUsers = users
    .filter(u => u.role !== "student" && u.role !== "admin") // Staff Directory is for regular staff only — admin access is granted manually via Firebase Console, never shown or managed here
    .filter(u => filterRole === "all" || u.role === filterRole)
    .filter(u => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (u.displayName || "").toLowerCase().includes(q) || (u.phone || "").includes(q);
    });

  const getStudentClasses = (studentId) => {
    return classes
      .filter(c => (c.studentIds || []).includes(studentId))
      .map(c => ({
        className: c.className,
        instructorName: users.find(u => u.id === c.instructorId)?.displayName || "Unassigned",
        dateJoined: (c.enrollments || []).find(e => e.studentId === studentId)?.dateJoined || "",
      }));
  };
  const instructors = users.filter(u => u.role === "instructor");
  const students = users.filter(u => u.role === "student");

  // Calculate unenrolled students dynamically based on active class studentIds!
  const enrolledStudentIds = classes.flatMap(cls => cls.studentIds || []);
  const unenrolledStudents = students.filter(s => !enrolledStudentIds.includes(s.id));
  const pendingApplications = applications.filter(application => (application.status || "pending") === "pending").length;

  // ── FRONT OFFICE SPECIALIZED LOGIC ──
  const [receptionMode, setReceptionMode] = useState(false);

  const sendWhatsAppInvite = (phone) => {
    if (!phone) return alert("Please enter a phone number first.");
    
    // Clean and format phone for international use (62 for Indonesia)
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.substring(1);
    }
    
    // Build message with the correct live or local URL
    const regUrl = window.location.origin + "/register";
    const message = encodeURIComponent(`Hello! Greetings from My Liberty school. 🌟 Please complete your student registration here: ${regUrl}`);
    
    // Open WhatsApp
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
      {/* Sidebar */}
      <div className="w-full md:w-1/4 flex md:flex-col gap-2.5 overflow-x-auto md:overflow-visible md:border-r md:pr-5 border-slate-200">
        <h2 className="text-xl font-bold text-[#1a3a8f] mb-4 hidden md:block">{isFrontOffice ? "Front Office" : "Admin Panel"}</h2>
        
        {isFrontOffice && (
          <button 
            onClick={() => setReceptionMode(true)} 
            className="p-3 rounded-xl text-left font-bold text-sm bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition mb-2"
          >
            🚀 Launch Reception Mode
          </button>
        )}

        <button onClick={() => setActiveTab("overview")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "overview" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>🏠 Overview</button>
        <button onClick={() => setActiveTab("applications")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "applications" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>📝 Applications</button>
        <button onClick={() => setActiveTab("students")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "students" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>🎓 Students</button>
        <button onClick={() => setActiveTab("classes")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "classes" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>🏫 Classes</button>
        {!isFrontOffice && <button onClick={() => setActiveTab("kiosk")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "kiosk" ? "bg-[#1a3a8f] text-white" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>📷 Attendance</button>}
        {!isFrontOffice && <button onClick={() => { setActiveTab("directory"); setFilterRole("all"); }} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "directory" ? "bg-[#1a3a8f] text-white" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>👥 Staff</button>}
        {!isFrontOffice && <button onClick={() => setActiveTab("invites")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "invites" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>✉️ Invites</button>}
        <button onClick={() => setActiveTab("reports")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "reports" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>📊 Reports</button>
        <button onClick={() => setActiveTab("misc")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "misc" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>⚙️ Tasks</button>
        <button onClick={() => setActiveTab("aiAssistant")} className={`p-3 rounded-xl text-left font-bold text-sm whitespace-nowrap transition duration-150 ${activeTab === "aiAssistant" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"}`}>✨ AI Assistant</button>
      </div>

      {/* Workspace */}
      <div className="w-full md:w-3/4">
        {activeTab === "overview" && (
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
                <button key={card.label} onClick={() => setActiveTab(card.tab)} className={`p-4 rounded-xl border text-left hover:shadow-sm transition ${card.color}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{card.label}</p>
                  <p className="text-2xl font-black mt-2">{card.value}</p>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isFrontOffice && (
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
              )}
              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-800">Quick actions</h4>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button onClick={() => setActiveTab("applications")} className="p-3 rounded-lg bg-slate-50 border text-sm font-bold text-slate-700 hover:bg-slate-100">Review applications</button>
                  {!isFrontOffice && <button onClick={() => { setActiveTab("addUser"); setEditId(null); }} className="p-3 rounded-lg bg-slate-50 border text-sm font-bold text-slate-700 hover:bg-slate-100">Add staff</button>}
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
        )}
        {!isFrontOffice && activeTab === "addUser" && (
          <UserForm
            formData={formData}
            setFormData={setFormData}
            editId={editId}
            onSubmit={handleSave}
          />
        )}

        {!isFrontOffice && activeTab === "directory" && (
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
              {["all", "instructor", "marketing", "frontoffice"].map(r => (
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
        )}

        {/* 👈 Rendered StudentRoster with your new Delete prop! */}
        {activeTab === "students" && (
          <StudentRoster 
            students={students}
            getStudentClasses={getStudentClasses}
            setSelectedStudent={setSelectedStudent}
            handleEdit={handleEdit}
            handleDelete={handleDelete} // 👈 Passed delete function!
            fetchData={fetchData}
          />
        )}

        {!isFrontOffice && activeTab === "kiosk" && <Kiosk title="Office Reception Kiosk Station" />}

        {/* 👈 Rendered ClassManager cleanly as a standalone component! */}
        {activeTab === "classes" && (
          <ClassManager 
            classes={classes}
            users={users}
            instructors={instructors}
            unenrolledStudents={unenrolledStudents}
            fetchData={fetchData}
          />
        )}

        {/* Staff Invitation System */}
        {!isFrontOffice && activeTab === "invites" && (
          <InvitesPanel
            invites={invites}
            onCreateInvite={handleCreateInvite}
            onDeleteInvite={handleDeleteInvite}
          />
        )}

        {/* Reports, Tasks, AI, Applications */}
        {activeTab === "reports" && <ReportsDashboard isAdminView={!isFrontOffice} isFrontOffice={isFrontOffice} />}
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
