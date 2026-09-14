import { useState, useEffect, useCallback } from "react";
import { db, firebaseConfig } from "../firebase";
import { collection, doc, setDoc, addDoc, getDocs, deleteDoc, query, where } from "firebase/firestore";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import QRCode from "qrcode";
import ReportsDashboard from "./ReportsDashboard";
import AIAssistant from "./AIAssistant";
import StudentApplications from "./StudentApplications";
import Kiosk from "./Kiosk";
import StudentRoster from "./StudentRoster"; 
import ClassManager from "./ClassManager"; // 👈 Imported your new ClassManager component!

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
  const [invites, setInvites] = useState([]); // 👈 Added state for invitations
  const [editId, setEditId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [badgeQr, setBadgeQr] = useState({ id: null, url: "" });

  // Form State for adding/editing users
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", nickname: "", gender: "male",
    email: "", password: "", role: "instructor", phone: "", dob: "",
    educationLevel: "SD", joinedDate: "", parentName: "", parentPhone: "",
    rating: "1", notes: ""
  });

  // Misc & Tasks States
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [todoType, setTodoType] = useState("task");
  const [todoPinned, setTodoPinned] = useState(false);
  const [todoAssignee, setTodoAssignee] = useState("all"); // 👈 Added assignee state

  // Invitation Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("instructor");

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

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    try {
      const token = crypto.randomUUID();
      const inviteData = {
        email: inviteEmail.toLowerCase(),
        role: inviteRole,
        createdAt: new Date().toISOString(),
        used: false,
        token
      };
      // Doc ID == token, so the public /join/ page can look an invite up
      // by exact ID without needing permission to list the whole collection.
      await setDoc(doc(db, "invites", token), inviteData);
      setInviteEmail("");
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

  // Generate the ID badge QR code locally instead of sending the person's
  // Firestore/Auth ID to a third-party image service (api.qrserver.com).
  useEffect(() => {
    if (!selectedStudent) return;
    let cancelled = false;
    QRCode.toDataURL(selectedStudent.id, { width: 240, margin: 1 })
      .then(url => { if (!cancelled) setBadgeQr({ id: selectedStudent.id, url }); })
      .catch(err => console.error("QR generation failed:", err));
    return () => { cancelled = true; };
  }, [selectedStudent]);

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

  const handleAddTodo = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "todos"), { 
        text: newTodo, 
        type: todoType, 
        isPinned: todoPinned,
        assignee: todoAssignee, // 👈 Saved assignee
        completed: false,
        createdAt: new Date().toISOString()
      });
      setNewTodo(""); setTodoType("task"); setTodoPinned(false); setTodoAssignee("all");
      fetchData();
    } catch (err) { alert(err.message); }
  };

  const handleDeleteTodo = async (todoId) => {
    if (!confirm("Delete this task or reminder?")) return;
    try {
      await deleteDoc(doc(db, "todos", todoId));
      setTodos(currentTodos => currentTodos.filter(todo => todo.id !== todoId));
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
          <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm text-sm border border-slate-150 max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
            <h3 className="font-bold text-slate-800 text-base md:col-span-2">{editId ? "Update Profile" : (formData.role === "student" ? "Add Student to Roster" : "Automated Account Creation")}</h3>
            
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Role</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-2.5 border rounded-lg bg-white font-bold" disabled={!!editId}>
                {editId && formData.role === "student" && <option value="student">Student (registered via form)</option>}
                <option value="instructor">Instructor</option>
                <option value="marketing">Marketing Staff</option>
                <option value="frontoffice">Front Office</option>
                <option value="officeboy">Office Boy</option>
              </select>
              {!editId && (
                <p className="text-[9px] text-gray-400 mt-1">Students now register via the Google Form — see the Student Applications tab.</p>
              )}
            </div>

            {/* 👈 Split Name input boxes */}
            <input type="text" placeholder="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full p-2.5 border rounded-lg" required />
            <input type="text" placeholder="Last Name" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full p-2.5 border rounded-lg" required />
            <input type="text" placeholder="Nickname" value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} className="w-full p-2.5 border rounded-lg" required />

            {/* 👈 Gender selection dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gender</label>
              <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full p-2.5 border rounded-lg bg-white font-bold">
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <input type="tel" placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2.5 border rounded-lg" />
            {formData.role !== "student" && (
              <>
                <input type="email" placeholder="Email" autoComplete="off" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2.5 border rounded-lg" required disabled={!!editId} />
                {!editId && <input type="password" placeholder="Password" autoComplete="new-password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-2.5 border rounded-lg" required />}
              </>
            )}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Birth</label>
              <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full p-2.5 border rounded-lg bg-white" required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Joined Date</label>
              <input type="date" value={formData.joinedDate} onChange={e => setFormData({...formData, joinedDate: e.target.value})} disabled={formData.role !== "student"} className={`w-full p-2.5 border rounded-lg transition ${formData.role !== "student" ? "bg-slate-50 cursor-not-allowed opacity-50" : "bg-white"}`} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Education Level</label>
              <select value={formData.educationLevel} onChange={e => setFormData({...formData, educationLevel: e.target.value})} className="w-full p-2.5 border rounded-lg bg-white font-bold">
                <option value="SD">SD (Sekolah Dasar)</option>
                <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                <option value="SMA_SMK">SMA/SMK (Sekolah Menengah Atas/Kejuruan)</option>
                <option value="Universitas">Universitas / Perguruan Tinggi</option>
                <option value="Umum">Umum / Pekerja (Adult)</option>
              </select>
            </div>
            <hr className="border-slate-100 my-1 md:col-span-2" />
            <label className="block text-[10px] font-bold text-slate-400 uppercase md:col-span-2">Student Profile Fields</label>
            <input type="text" placeholder="Parent's Name" value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} disabled={formData.role !== "student"} className={`w-full p-2.5 border rounded-lg transition ${formData.role !== "student" ? "bg-slate-50 cursor-not-allowed opacity-50" : "bg-white"}`} />
            <input type="tel" placeholder="Parent's Phone" value={formData.parentPhone} onChange={e => setFormData({...formData, parentPhone: e.target.value})} disabled={formData.role !== "student"} className={`w-full p-2.5 border rounded-lg transition ${formData.role !== "student" ? "bg-slate-50 cursor-not-allowed opacity-50" : "bg-white"}`} />
            <select value={formData.rating} onChange={e => setFormData({...formData, rating: e.target.value})} disabled={formData.role !== "student"} className={`w-full p-2.5 border rounded-lg transition bg-white ${formData.role !== "student" ? "bg-slate-50 cursor-not-allowed opacity-50 text-slate-400" : "bg-white font-bold"}`}>
              <option value="1">1 Star (Beginner)</option>
              <option value="3">3 Star (Intermediate)</option>
              <option value="5">5 Star (Fluent)</option>
            </select>
            <textarea placeholder="Notes / Evaluation" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} disabled={formData.role !== "student"} className={`w-full p-2.5 border rounded-lg transition ${formData.role !== "student" ? "bg-slate-50 cursor-not-allowed opacity-50" : "bg-white"}`} />
            <button type="submit" className="w-full bg-[#1a3a8f] text-white p-3 rounded-xl font-bold hover:bg-[#122b6e] transition md:col-span-2">{editId ? "Update Profile" : "Create & Save Profile"}</button>
          </form>
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

        {/* 👈 Staff Invitation System workspace */}
        {!isFrontOffice && activeTab === "invites" && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-150 max-w-6xl mx-auto space-y-6">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Invite Staff</h3>
              <p className="text-xs text-slate-500">Generate a unique link for new staff to set up their own accounts.</p>
            </div>

            <form onSubmit={handleCreateInvite} className="flex flex-col md:flex-row gap-3">
              <input 
                type="email" 
                placeholder="Staff Email" 
                value={inviteEmail} 
                onChange={e => setInviteEmail(e.target.value)} 
                className="flex-1 p-2.5 border rounded-lg text-sm" 
                required 
              />
              <select 
                value={inviteRole} 
                onChange={e => setInviteRole(e.target.value)} 
                className="p-2.5 border rounded-lg bg-white font-bold text-sm"
              >
                <option value="instructor">Instructor</option>
                <option value="marketing">Marketing Staff</option>
                <option value="frontoffice">Front Office</option>
                <option value="officeboy">Office Boy</option>
              </select>
              <button type="submit" className="bg-[#1a3a8f] text-white px-6 py-2.5 rounded-lg font-bold hover:bg-[#122b6e] transition text-sm">Generate Link</button>
            </form>

            <div className="space-y-2 border-t pt-4">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Pending Invitations</h4>
              {invites.filter(inv => !inv.used).length === 0 ? (
                <p className="text-xs text-slate-400 italic">No pending invitations.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {invites.filter(inv => !inv.used).map(inv => (
                    <div key={inv.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 bg-slate-50 rounded-xl border border-slate-150 gap-2">
                      <div className="text-xs">
                        <p className="font-bold text-slate-800">{inv.email}</p>
                        <p className="text-slate-500 uppercase font-bold text-[9px]">{inv.role} · Created {new Date(inv.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <button 
                          onClick={() => {
                            const link = `${window.location.origin}/join/${inv.token}`;
                            navigator.clipboard.writeText(link);
                            alert("Copied to clipboard: " + link);
                          }}
                          className="flex-1 md:flex-none bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 transition text-[10px]"
                        >
                          📋 Copy Link
                        </button>
                        <button 
                          onClick={() => handleDeleteInvite(inv.id)}
                          className="flex-1 md:flex-none bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-600 transition text-[10px]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Reports and Misc workspaces */}
        {activeTab === "reports" && <ReportsDashboard isAdminView={!isFrontOffice} isFrontOffice={isFrontOffice} />}
        {activeTab === "misc" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto text-sm">
            {/* Column 1: Pinned Reminders & Deadlines (Corkboard) */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-base">📌 Corkboard (Pinned Reminders)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {todos.filter(t => t.isPinned || t.type === "deadline").map(t => (
                  <div key={t.id} className="p-4 bg-yellow-150 border-yellow-300 border rounded-xl shadow-md transform rotate-1 space-y-1 relative bg-[#fef9c3]">
                    <span className="absolute top-2 right-2 text-[9px] font-bold uppercase text-red-600">{t.type}</span>
                    <p className="font-bold text-slate-800 pt-2">{t.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Create & View Task List */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 space-y-3">
              <h3 className="font-bold text-slate-700 text-sm border-b pb-2">Office Task Manager</h3>
              <form onSubmit={handleAddTodo} className="space-y-2">
                <input type="text" placeholder="Add task / appointment / deadline..." value={newTodo} onChange={e => setNewTodo(e.target.value)} className="w-full p-2.5 border rounded-lg" required />
              <div className="flex gap-2">
                  <select value={todoType} onChange={e => setTodoType(e.target.value)} className="flex-1 p-2.5 border rounded-lg bg-white font-bold">
                    <option value="task">Task</option>
                    <option value="appointment">Appointment</option>
                    <option value="deadline">Deadline</option>
                  </select>
                  <select value={todoAssignee} onChange={e => setTodoAssignee(e.target.value)} className="flex-1 p-2.5 border rounded-lg bg-white font-bold">
                    <option value="all">Everyone</option>
                    <option value="officeboy">Office Boy</option>
                  </select>
                  <label className="flex items-center gap-1.5 font-bold text-xs text-slate-600">
                    <input type="checkbox" checked={todoPinned} onChange={e => setTodoPinned(e.target.checked)} /> Pin
                  </label>
                </div>
                <button type="submit" className="w-full bg-[#1a3a8f] text-white p-3 rounded-xl font-bold hover:bg-[#122b6e] transition">Add Item</button>
              </form>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {todos.map(t => (
                  <div key={t.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg flex justify-between items-center text-xs gap-2">
                    <span><span className="font-bold uppercase text-[9px] mr-2 bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">{t.type}</span>{t.text}</span>
                    <button onClick={() => handleDeleteTodo(t.id)} className="text-red-600 hover:text-red-800 font-bold text-[10px] shrink-0" title="Delete task">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === "aiAssistant" && <AIAssistant />}
        {activeTab === "applications" && <StudentApplications />}
      </div>

      {/* Option A Modal: Student ID Card Printable Layout */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs w-full text-center border relative">
            <div className="border-2 border-indigo-600 p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-white text-xs space-y-3">
              <h4 className="font-black text-indigo-900 text-sm tracking-wider uppercase">{selectedStudent.role === "student" ? "Student ID Badge" : "Staff ID Badge"}</h4>
              <div className="flex justify-center bg-white p-1.5 rounded-lg inline-block mx-auto border shadow-sm">
                {badgeQr.id === selectedStudent.id && <img src={badgeQr.url} alt="Student QR Code" className="w-24 h-24" />}
              </div>
              <div>
                <p className="font-extrabold text-slate-800 text-sm uppercase">{selectedStudent.displayName}</p>
                <p className="text-slate-500 font-semibold">{selectedStudent.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 pt-2 border-t border-indigo-100">
                <p className="text-left font-bold">DOB: <span className="font-normal">{selectedStudent.dob || "N/A"}</span></p>
                <p className="text-right font-bold">Edu: <span className="font-normal">{selectedStudent.educationLevel || "N/A"}</span></p>
              </div>
            </div>
            <div className="flex gap-2 mt-4 text-sm">
              <button onClick={() => window.print()} className="flex-1 bg-indigo-600 text-white p-2.5 rounded-xl font-bold hover:bg-indigo-700">🖨️ Print</button>
              <button onClick={() => setSelectedStudent(null)} className="flex-1 bg-slate-200 text-slate-700 p-2.5 rounded-xl font-bold hover:bg-slate-300">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
