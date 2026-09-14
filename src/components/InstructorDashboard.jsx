import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import DashboardShell from "./DashboardShell";
import Kiosk from "./Kiosk";
import ClassPhotoShare from "./ClassPhotoShare";
import ReportsDashboard from "./ReportsDashboard";
import TeachingMaterial from "./TeachingMaterial";
import AIAssistant from "./AIAssistant";
import StudentProgressForm from "./StudentProgressForm";

function uniqueClasses(classes) {
  const seen = new Set();
  return classes.filter(cls => {
    const signature = [cls.className, cls.instructorId, cls.schedule, cls.classRoom].join("|");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function InstructorProgress() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    (async () => {
      try {
        const [classSnap, studentSnap] = await Promise.all([
          getDocs(query(collection(db, "classes"), where("instructorId", "==", uid))),
          getDocs(query(collection(db, "users"), where("role", "==", "student"))),
        ]);
        setClasses(uniqueClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() }))));
        setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Progress roster fetch failed", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  if (loading) return <p className="text-gray-400 text-center py-8">Loading your classes...</p>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded-xl max-w-2xl mx-auto text-sm">Unable to load your progress classes: {error}</div>;
  if (classes.length === 0) return <div className="bg-amber-50 border border-amber-200 text-amber-800 p-5 rounded-xl max-w-2xl mx-auto text-sm">No classes are assigned to this instructor yet. Ask an admin to assign a class to this account.</div>;
  return <StudentProgressForm classes={classes} students={students} />;
}

function InstructorClasses() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [expandedClassId, setExpandedClassId] = useState(null);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    (async () => {
      try {
        // 1. Fetch assigned classes
        const qClasses = query(collection(db, "classes"), where("instructorId", "==", uid));
        const classSnap = await getDocs(qClasses);
        setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // 2. Fetch all student profiles to map details safely (Allowed by your updated Rules!)
        const qStudents = query(collection(db, "users"), where("role", "==", "student"));
        const studentSnap = await getDocs(qStudents);
        setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Fetch Error: ", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const toggleExpand = (classId) => {
    setExpandedClassId(expandedClassId === classId ? null : classId);
  };

  return (
    <div className="bg-white p-4 rounded-xl border max-w-2xl mx-auto text-xs">
      <h3 className="font-bold text-gray-700 text-sm mb-3">Your Active Classes</h3>
      {loading ? (
        <p className="text-gray-400 text-center py-4">Loading...</p>
      ) : classes.length === 0 ? (
        <p className="text-gray-400 text-center py-4">No classes assigned yet.</p>
      ) : (
        <div className="space-y-3">
          {classes.map(cls => {
            const isExpanded = expandedClassId === cls.id;
            return (
              <div key={cls.id} className="p-3 bg-gray-50 border rounded-lg transition-all">
                {/* Header: Click to expand roster */}
                <div onClick={() => toggleExpand(cls.id)} className="cursor-pointer flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{cls.className}</p>
                    <p className="text-gray-500 text-[10px]">{cls.schedule}</p>
                    <p className="text-indigo-600 font-semibold text-[10px] mt-0.5">
                      {(cls.studentIds || []).length} student(s) enrolled
                    </p>
                  </div>
                  <span className="text-gray-400 font-extrabold text-sm">{isExpanded ? "▲" : "▼"}</span>
                </div>

                {/* Worksheet link from Admin */}
                {cls.worksheetUrl && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-[10px] text-green-700 font-bold flex items-center gap-1">
                    <span>📄</span>
                    <a href="#" onClick={(e) => { e.preventDefault(); alert(`Opening Class Worksheet: ${cls.worksheetUrl}`); }} className="hover:underline">
                      View Admin Worksheet
                    </a>
                  </div>
                )}

                {/* Expanded Student List */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <p className="font-bold text-gray-600 text-[9px] uppercase tracking-wider">Enrolled Student Roster:</p>
                    {(cls.studentIds || []).length === 0 ? (
                      <p className="text-gray-400 italic text-[10px]">No students enrolled yet.</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {(cls.studentIds || []).map(sid => {
                          const sInfo = students.find(s => s.id === sid);
                          if (!sInfo) return <p key={sid} className="py-1.5 text-gray-400 italic">Student details loading...</p>;
                          return (
                            <div key={sid} className="py-2 flex justify-between items-start gap-1">
                              <div>
                                <p className="font-bold text-gray-800">{sInfo.displayName}</p>
                                <p className="text-gray-500 text-[10px]">
                                  Parent: {sInfo.parentName || "N/A"} ({sInfo.parentPhone || "N/A"})
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="bg-yellow-100 text-yellow-800 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                                  ⭐ {sInfo.rating || "1"}/5
                                </span>
                                <p className="text-gray-400 text-[9px] mt-1 max-w-[150px] truncate" title={sInfo.notes}>
                                  {sInfo.notes || "No notes"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function InstructorDashboard() {
  const tabs = [
    {
      id: "kiosk",
      label: "⏱️ Attendance & Clock-In",
      component: (
        <div className="space-y-4">
          <Kiosk title="Student Attendance Kiosk" studentsOnly={true} />
          <ClassPhotoShare />
        </div>
      ),
    },
    { id: "classes", label: "📚 My Classes", component: <InstructorClasses /> },
    { id: "progress", label: "📝 Student Progress", component: <InstructorProgress /> },
    { id: "materials", label: "📁 Teaching Materials", component: <TeachingMaterial /> },
    { id: "reports", label: "📊 Reports", component: <ReportsDashboard /> },
    { id: "ai", label: "✨ AI Assistant", component: <AIAssistant /> },
  ];

  return <DashboardShell tabs={tabs} defaultTab="kiosk" />;
}
