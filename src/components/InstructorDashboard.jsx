import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import DashboardShell from "./DashboardShell";
import Kiosk from "./Kiosk";
import ClassPhotoShare from "./ClassPhotoShare";
import ReportsDashboard from "./ReportsDashboard";
import TeachingMaterial from "./TeachingMaterial";
import AIAssistant from "./AIAssistant";
import StudentProgressForm from "./StudentProgressForm";
import StudentRoster from "./StudentRoster";
import BadgeModal from "./BadgeModal";

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
  const [instructorName, setInstructorName] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    (async () => {
      try {
        const [classSnap, studentSnap, meSnap] = await Promise.all([
          getDocs(query(collection(db, "classes"), where("instructorId", "==", uid))),
          getDocs(query(collection(db, "users"), where("role", "==", "student"))),
          getDoc(doc(db, "users", uid)),
        ]);
        const myClasses = classSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const enrolledIds = new Set(myClasses.flatMap(cls => cls.studentIds || []));
        setClasses(myClasses);
        setStudents(studentSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(student => enrolledIds.has(student.id)));
        setInstructorName(meSnap.exists() ? (meSnap.data().displayName || "") : "");
      } catch (err) {
        console.error("Fetch Error: ", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const getStudentClasses = (studentId) => {
    return classes
      .filter(cls => (cls.studentIds || []).includes(studentId))
      .map(cls => ({
        className: cls.className,
        instructorName: instructorName || "Unassigned",
        dateJoined: (cls.enrollments || []).find(enrollment => enrollment.studentId === studentId)?.dateJoined || "",
      }));
  };

  if (loading) return <p className="text-gray-400 text-center py-8">Loading your students...</p>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded-xl max-w-2xl mx-auto text-sm">Unable to load your class roster: {error}</div>;
  if (classes.length === 0) return <div className="bg-amber-50 border border-amber-200 text-amber-800 p-5 rounded-xl max-w-2xl mx-auto text-sm">No classes are assigned to this instructor yet. Ask an admin to assign a class to this account.</div>;

  const worksheets = classes.filter(cls => cls.worksheetUrl);

  return (
    <div className="space-y-4">
      {worksheets.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 max-w-6xl mx-auto text-sm">
          <p className="font-bold text-slate-700 mb-2">Class worksheets</p>
          <div className="flex flex-wrap gap-2">
            {worksheets.map(cls => (
              <a
                key={cls.id}
                href={cls.worksheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 font-bold text-xs hover:underline"
              >
                📄 {cls.className}
              </a>
            ))}
          </div>
        </div>
      )}
      <StudentRoster
        readOnly
        students={students}
        getStudentClasses={getStudentClasses}
        setSelectedStudent={setSelectedStudent}
      />
      <BadgeModal person={selectedStudent} onClose={() => setSelectedStudent(null)} />
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
