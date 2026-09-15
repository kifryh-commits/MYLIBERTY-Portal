import { useState, useEffect, useCallback } from "react";
import { db, firebaseConfig } from "../firebase";
import { collection, doc, setDoc, addDoc, getDocs, deleteDoc, query, where } from "firebase/firestore";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { useToast } from "../components/ui/useToast";
import { useConfirm } from "../components/ui/useConfirm";

function getSecondaryAuth() {
  const secondaryApp = getApps().find(app => app.name === "Secondary")
    || initializeApp(firebaseConfig, "Secondary");
  return getAuth(secondaryApp);
}

const emptyFormData = {
  firstName: "", lastName: "", nickname: "", gender: "male",
  email: "", password: "", role: "instructor", phone: "", dob: "",
  educationLevel: "SD", joinedDate: "", parentName: "", parentPhone: "",
  rating: "1", notes: ""
};

/**
 * Shared data + handlers used by both AdminDashboard and FrontOfficeDashboard.
 * This is everything that used to live inside one AdminDashboard.jsx guarded
 * by an `isFrontOffice` flag — pulled out so the two dashboards can each be
 * a real, separate component instead of one file with branches everywhere.
 *
 * `restrictedRead: true` (Front Office) narrows the users query to match
 * what Firestore's rules actually allow it to read (student + instructor
 * docs only). This isn't optional styling — Firestore rejects a query
 * outright if it can't prove every possible result satisfies the rule, so
 * without this narrower query Front Office's whole fetch would fail, not
 * just return extra data.
 *
 * `setActiveTab` is passed in (not owned by this hook) because
 * handleEdit/handleSave need to jump the *caller's* tab state to the right
 * screen after an edit/save, and each dashboard has its own tab list.
 */
export function useDashboardData({ restrictedRead = false, setActiveTab } = {}) {
  const toast = useToast();
  const confirm = useConfirm(); // 👈 shadows native window.confirm on purpose — same call shape, styled modal, just needs "await"

  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [applications, setApplications] = useState([]);
  const [invites, setInvites] = useState([]);
  const [todos, setTodos] = useState([]);
  const [editId, setEditId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formData, setFormData] = useState(emptyFormData);

  const fetchData = useCallback(async () => {
    try {
      const usersQuery = restrictedRead
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

      // Front Office's Firestore rules don't grant read access to invites,
      // so this naturally comes back empty for them — same as it silently
      // did before the split, not a new behavior.
      const inviteSnap = await getDocs(collection(db, "invites"));
      setInvites(inviteSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
  }, [restrictedRead]);

  useEffect(() => { (async () => { await fetchData(); })(); }, [fetchData]);

  const togglePaymentStatus = useCallback(async (uid, currentStatus) => {
    try {
      await setDoc(doc(db, "users", uid), { paymentStatus: currentStatus === "paid" ? "pending" : "paid" }, { merge: true });
      fetchData();
    } catch (err) { toast(err.message, "error"); }
  }, [fetchData, toast]);

  useEffect(() => {
    const handleToggle = (e) => togglePaymentStatus(e.detail.id, e.detail.status);
    window.addEventListener("togglePayment", handleToggle);
    return () => window.removeEventListener("togglePayment", handleToggle);
  }, [togglePaymentStatus]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
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

      toast(editId ? "Profile updated!" : (formData.role === "student" ? "Student added to roster!" : "Account created!"));
      setEditId(null);
      setFormData(emptyFormData);
      fetchData();
      // 👈 Fixed bug from the old shared file: it always navigated to
      // "directory" after saving, but Front Office has no "directory" tab —
      // editing a student there silently landed on a blank screen. Now it
      // routes by what was actually saved: students go back to "students",
      // staff (admin-only) go to "directory".
      setActiveTab?.(formData.role === "student" ? "students" : "directory");
    } catch (err) { toast(err.message, "error"); }
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
    setActiveTab?.("addUser");
  };

  const handleDelete = async (uid) => {
    const user = users.find(profile => profile.id === uid);
    if (!user || !(await confirm(`Are you sure you want to delete ${user.displayName || "this profile"}?`))) return;

    try {
      await deleteDoc(doc(db, "users", uid));
      fetchData();
      if (user.role === "student") {
        toast("Student roster profile deleted.");
      } else {
        toast("Staff profile deleted from Firestore. The Firebase Auth account still exists and must be deleted separately in Firebase Console before this email can be registered again.");
      }
    } catch (err) { toast("Unable to delete profile: " + err.message, "error"); }
  };

  const handleAddTodo = async ({ text, type, isPinned, assignee }) => {
    try {
      await addDoc(collection(db, "todos"), {
        text, type, isPinned, assignee,
        completed: false,
        createdAt: new Date().toISOString()
      });
      fetchData();
    } catch (err) { toast(err.message, "error"); }
  };

  const handleDeleteTodo = async (todoId) => {
    if (!(await confirm("Delete this task or reminder?"))) return;
    try {
      await deleteDoc(doc(db, "todos", todoId));
      setTodos(current => current.filter(t => t.id !== todoId));
    } catch (err) { toast("Error deleting task: " + err.message, "error"); }
  };

  const handleCreateInvite = async (email, role) => {
    try {
      const token = crypto.randomUUID();
      await setDoc(doc(db, "invites", token), {
        email: email.toLowerCase(), role,
        createdAt: new Date().toISOString(),
        used: false, token
      });
      fetchData();
      toast("Invitation generated!");
    } catch (err) { toast(err.message, "error"); }
  };

  const handleDeleteInvite = async (id) => {
    if (!(await confirm("Cancel this invitation?"))) return;
    try {
      await deleteDoc(doc(db, "invites", id));
      fetchData();
    } catch (err) { toast(err.message, "error"); }
  };

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
  const enrolledStudentIds = classes.flatMap(cls => cls.studentIds || []);
  const unenrolledStudents = students.filter(s => !enrolledStudentIds.includes(s.id));
  const pendingApplications = applications.filter(application => (application.status || "pending") === "pending").length;

  return {
    users, classes, applications, invites, todos, fetchData,
    editId, setEditId, selectedStudent, setSelectedStudent,
    formData, setFormData,
    handleSave, handleEdit, handleDelete,
    handleAddTodo, handleDeleteTodo,
    handleCreateInvite, handleDeleteInvite,
    togglePaymentStatus,
    getStudentClasses, instructors, students, unenrolledStudents, pendingApplications,
  };
}
