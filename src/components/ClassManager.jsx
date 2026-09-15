import { useState, Fragment } from "react";
import { db, demoUploadWorksheet } from "../firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc, arrayUnion } from "firebase/firestore";

const LEVELS = ["warrior", "elite", "master", "grandmaster", "epic"];

const LEVEL_STYLES = {
  warrior: "bg-slate-100 text-slate-700",
  elite: "bg-blue-100 text-blue-700",
  master: "bg-purple-100 text-purple-700",
  grandmaster: "bg-amber-100 text-amber-700",
  epic: "bg-rose-100 text-rose-700",
};

function LevelBadge({ level }) {
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${LEVEL_STYLES[level] || "bg-gray-100 text-gray-400"}`}>
      {level || "Unset"}
    </span>
  );
}

export default function ClassManager({ classes, users, instructors, unenrolledStudents, fetchData }) {
  const [classSubTab, setClassSubTab] = useState("schedule");
  const [className, setClassName] = useState("");
  const [assignedInstructor, setAssignedInstructor] = useState("");
  const [classDay, setClassDay] = useState("Mon/Wed");
  const [classStartDate, setClassStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(""); 
  const [endTime, setEndTime] = useState("");     
  const [classLevel, setClassLevel] = useState("warrior"); // 👈 New: level for the whole class group
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [enrollmentDetails, setEnrollmentDetails] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [classRoom, setClassRoom] = useState("");

  // Add-to-existing-class panel state
  const [enrollingIntoClassId, setEnrollingIntoClassId] = useState(null);
  const [addStudentId, setAddStudentId] = useState("");
  const [addDateJoined, setAddDateJoined] = useState(new Date().toISOString().slice(0, 10));
  
  const [classSortField, setClassSortField] = useState("className");
  const [classSortAsc, setClassSortAsc] = useState(true);

  // 👈 New: which grouped rows are expanded in the Active Classes table
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const handleCreateClass = async (e) => {
    e.preventDefault();

    // 👈 Warn (don't silently block) if any selected student's last known
    // level doesn't match the level of the class they're about to join.
    const mismatched = enrolledStudents
      .map(id => users.find(u => u.id === id))
      .filter(s => s?.currentLevel && s.currentLevel !== classLevel);

    if (mismatched.length > 0) {
      const names = mismatched.map(s => `${s.displayName} (currently ${s.currentLevel})`).join(", ");
      if (!confirm(`These students are recorded at a different level than "${classLevel}": ${names}.\n\nEnroll them into this class anyway?`)) {
        return;
      }
    }

    try {
      setUploading(true);
      let fileUrl = "";
      if (selectedFile) {
        fileUrl = await demoUploadWorksheet(selectedFile);
      }
      await addDoc(collection(db, "classes"), {
        className,
        instructorId: assignedInstructor,
        schedule: `${classDay} @ ${startTime} - ${endTime}`,
        classDay,
        classStartDate,
        startTime,
        endTime,
        classLevel, // 👈 New: every student in this class shares this level
        studentIds: enrolledStudents,
        enrollments: enrolledStudents.map(studentId => ({
          studentId,
          dateJoined: enrollmentDetails[studentId]?.dateJoined || new Date().toISOString().slice(0, 10),
          level: classLevel, // 👈 Level now comes from the class, not a per-student picker
        })),
        worksheetUrl: fileUrl,
        classRoom: classRoom || "N/A"
      });

      // 👈 Keep each enrolled student's recorded level in sync with the class
      // they just joined, so future enrollments can check against it.
      await Promise.all(
        enrolledStudents.map(studentId =>
          updateDoc(doc(db, "users", studentId), { currentLevel: classLevel }).catch(() => {})
        )
      );

      alert("Success! Class scheduled.");
      setClassName(""); setAssignedInstructor(""); setClassDay("Mon/Wed"); setClassStartDate(new Date().toISOString().slice(0, 10)); setStartTime(""); setEndTime(""); setClassLevel("warrior"); setEnrolledStudents([]); setEnrollmentDetails({});
      setSelectedFile(null); setClassRoom("");
      fetchData();
      setClassSubTab("list"); 
    } catch (err) { 
      alert("Error: " + err.message); 
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (confirm("Are you sure you want to delete this scheduled class group?")) {
      try {
        await deleteDoc(doc(db, "classes", classId));
        alert("Class deleted successfully.");
        fetchData();
      } catch (err) { alert(err.message); }
    }
  };

  const handleAddStudentToClass = async (classId, e) => {
    e.preventDefault();
    if (!addStudentId) return;

    const cls = classes.find(c => c.id === classId);
    const targetLevel = cls?.classLevel || "warrior";
    const student = users.find(u => u.id === addStudentId);

    // 👈 Same mismatch warning as class creation, checked against this
    // specific class's level.
    if (student?.currentLevel && student.currentLevel !== targetLevel) {
      if (!confirm(`${student.displayName} is recorded at "${student.currentLevel}", but this class is "${targetLevel}".\n\nEnroll anyway?`)) {
        return;
      }
    }

    try {
      await updateDoc(doc(db, "classes", classId), {
        studentIds: arrayUnion(addStudentId),
        enrollments: arrayUnion({
          studentId: addStudentId,
          dateJoined: addDateJoined || new Date().toISOString().slice(0, 10),
          level: targetLevel, // 👈 Locked to the class's level, not freely chosen
        }),
      });
      await updateDoc(doc(db, "users", addStudentId), { currentLevel: targetLevel }).catch(() => {});
      setEnrollingIntoClassId(null);
      setAddStudentId(""); setAddDateJoined(new Date().toISOString().slice(0, 10));
      fetchData();
    } catch (err) { alert("Error enrolling student: " + err.message); }
  };

  const handleRemoveStudentFromClass = async (cls, studentId) => {
    const student = users.find(u => u.id === studentId);
    if (!confirm(`Remove ${student?.displayName || "this student"} from ${cls.className}?`)) return;
    try {
      await updateDoc(doc(db, "classes", cls.id), {
        studentIds: (cls.studentIds || []).filter(id => id !== studentId),
        enrollments: (cls.enrollments || []).filter(e => e.studentId !== studentId),
      });
      fetchData();
    } catch (err) { alert("Error removing student: " + err.message); }
  };

  const handleClassSort = (field) => {
    if (classSortField === field) {
      setClassSortAsc(!classSortAsc);
    } else {
      setClassSortField(field);
      setClassSortAsc(true);
    }
  };

  const sortedClasses = [...classes].sort((a, b) => {
    let valA = a[classSortField] || "";
    let valB = b[classSortField] || "";

    if (classSortField === "instructorId") {
      valA = users.find(u => u.id === a.instructorId)?.displayName || "";
      valB = users.find(u => u.id === b.instructorId)?.displayName || "";
    }

    if (valA < valB) return classSortAsc ? -1 : 1;
    if (valA > valB) return classSortAsc ? 1 : -1;
    return 0;
  });

  // 👈 New: collapse classes that share name + schedule + instructor + level
  // into a single row. Each still keeps its own doc/room/roster underneath.
  const getGroupKey = (cls) => [cls.className, cls.schedule, cls.instructorId, cls.classLevel || "unset"].join("::");

  const classGroups = [];
  const groupIndex = {};
  sortedClasses.forEach(cls => {
    const key = getGroupKey(cls);
    if (!groupIndex[key]) {
      groupIndex[key] = { key, className: cls.className, schedule: cls.schedule, instructorId: cls.instructorId, classLevel: cls.classLevel, items: [] };
      classGroups.push(groupIndex[key]);
    }
    groupIndex[key].items.push(cls);
  });

  const toggleGroup = (key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleStudentEnrollment = (uid) => {
    const student = users.find(u => u.id === uid);
    setEnrolledStudents(prev => {
      if (prev.includes(uid)) return prev.filter(id => id !== uid);
      setEnrollmentDetails(details => ({
        ...details,
        [uid]: { dateJoined: student?.joinedDate || new Date().toISOString().slice(0, 10) },
      }));
      return [...prev, uid];
    });
  };

  const updateEnrollmentDetail = (uid, field, value) => {
    setEnrollmentDetails(details => ({
      ...details,
      [uid]: { ...details[uid], [field]: value },
    }));
  };

  const getEnrollment = (cls, studentId) => (
    (cls.enrollments || []).find(enrollment => enrollment.studentId === studentId) || {}
  );

  const getDuration = (dateJoined) => {
    if (!dateJoined) return "Not recorded";
    const joined = new Date(`${dateJoined}T00:00:00`);
    if (Number.isNaN(joined.getTime())) return "Not recorded";
    const now = new Date();
    let months = (now.getFullYear() - joined.getFullYear()) * 12 + now.getMonth() - joined.getMonth();
    if (now.getDate() < joined.getDate()) months -= 1;
    if (months < 1) return "Less than 1 month";
    const years = Math.floor(months / 12);
    months %= 12;
    return [years ? `${years} year${years === 1 ? "" : "s"}` : "", months ? `${months} month${months === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
  };

  // 👈 One batch's detail card, shown when its group row is expanded
  const renderBatchCard = (cls) => (
    <div key={cls.id} className="border rounded-xl p-3 bg-slate-50/60 space-y-2">
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div>
          <p className="text-xs font-bold text-slate-700">Room: <span className="font-semibold text-slate-600">{cls.classRoom || "N/A"}</span></p>
          {cls.worksheetUrl && (
            <a href="#" onClick={(e) => { e.preventDefault(); alert(`Opening Demo Worksheet: ${cls.worksheetUrl}`); }} className="text-[10px] text-indigo-600 font-semibold hover:underline">📄 View Worksheet</a>
          )}
        </div>
        <button onClick={() => handleDeleteClass(cls.id)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-600 transition text-xs shrink-0">Delete Batch</button>
      </div>

      <p className="font-bold text-xs text-slate-700">{(cls.studentIds || []).length} enrolled</p>
      <div className="space-y-2">
        {(cls.studentIds || []).map(studentId => {
          const student = users.find(user => user.id === studentId);
          const enrollment = getEnrollment(cls, studentId);
          return (
            <div key={studentId} className="text-xs border-l-2 border-indigo-200 pl-2 flex justify-between items-start gap-2">
              <div>
                <p className="font-semibold text-slate-700">{student?.displayName || "Unknown student"}</p>
                <p className="text-slate-500">Joined: {enrollment.dateJoined || "Not recorded"} · {getDuration(enrollment.dateJoined)}</p>
              </div>
              <button
                onClick={() => handleRemoveStudentFromClass(cls, studentId)}
                className="text-[9px] font-bold text-red-500 hover:text-red-700 hover:underline shrink-0"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {enrollingIntoClassId === cls.id ? (
        <form onSubmit={e => handleAddStudentToClass(cls.id, e)} className="mt-2 space-y-2 border rounded-lg p-2.5 bg-white">
          <select value={addStudentId} onChange={e => setAddStudentId(e.target.value)} className="w-full p-2 border rounded-lg bg-white text-xs" required>
            <option value="">Select student...</option>
            {unenrolledStudents.map(stud => (
              <option key={stud.id} value={stud.id}>
                {stud.displayName}{stud.currentLevel && stud.currentLevel !== (cls.classLevel || "warrior") ? ` (currently ${stud.currentLevel})` : ""}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2 items-end">
            <input type="date" value={addDateJoined} onChange={e => setAddDateJoined(e.target.value)} className="w-full p-2 border rounded-lg bg-white text-xs" required />
            <p className="text-[10px] font-bold text-slate-500 uppercase">
              Level: <span className="normal-case font-semibold text-slate-700">{cls.classLevel || "Warrior"}</span>
              <span className="block normal-case font-normal text-slate-400">(locked to class)</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-[#1a3a8f] text-white px-3 py-1.5 rounded-lg font-bold text-xs">Enroll</button>
            <button type="button" onClick={() => setEnrollingIntoClassId(null)} className="flex-1 bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-xs">Cancel</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => { setEnrollingIntoClassId(cls.id); setAddStudentId(""); }}
          disabled={unenrolledStudents.length === 0}
          className="mt-1 text-[10px] font-bold text-[#1a3a8f] hover:underline disabled:text-slate-300 disabled:no-underline disabled:cursor-not-allowed"
        >
          {unenrolledStudents.length === 0 ? "No unenrolled students available" : "+ Add Student"}
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 max-w-5xl mx-auto text-sm space-y-4 shadow-sm">
      {/* Sub-Tab Switcher */}
      <div className="flex gap-2 border-b pb-2 font-bold text-xs uppercase select-none">
        <button onClick={() => setClassSubTab("schedule")} className={`px-3 py-1.5 rounded-lg transition duration-150 ${classSubTab === "schedule" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-slate-100 text-slate-600 border"}`}>📅 Schedule Class</button>
        <button onClick={() => setClassSubTab("list")} className={`px-3 py-1.5 rounded-lg transition duration-150 ${classSubTab === "list" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-slate-100 text-slate-600 border"}`}>📊 Active Classes Table</button>
      </div>

      {classSubTab === "schedule" && (
        <form onSubmit={handleCreateClass} className="space-y-3.5 max-w-xl mx-auto">
          <h3 className="font-bold text-slate-800 text-base mb-2">Schedule Class Group</h3>
          <input type="text" placeholder="Class Name" value={className} onChange={e => setClassName(e.target.value)} className="w-full p-2.5 border rounded-lg" required />
          
          <label className="block text-[10px] font-bold text-slate-500 uppercase">Class Room / Location</label>
          <input type="text" placeholder="e.g., Room A, Lab 2" value={classRoom} onChange={e => setClassRoom(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white" required />

          <label className="block text-[10px] font-bold text-slate-500 uppercase">Assign Instructor</label>
          <select value={assignedInstructor} onChange={e => setAssignedInstructor(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white font-bold" required>
            <option value="">Select Instructor...</option>
            {instructors.map(inst => <option key={inst.id} value={inst.id}>{inst.displayName}</option>)}
          </select>

          <label className="block text-[10px] font-bold text-slate-500 uppercase">Class Level</label>
          <select value={classLevel} onChange={e => setClassLevel(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white font-bold" required>
            {LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl.charAt(0).toUpperCase() + lvl.slice(1)}</option>)}
          </select>
          <p className="text-[10px] text-slate-400 -mt-2">Every student enrolled below will be recorded at this level.</p>
          
          <label className="block text-[10px] font-bold text-slate-500 uppercase">Select Schedule Days</label>
          <select value={classDay} onChange={e => setClassDay(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white font-bold">
            <option value="Mon/Wed">Mon/Wed</option>
            <option value="Tue/Thu">Tue/Thu</option>
            <option value="Sat/Sun">Sat/Sun</option>
            <option value="Private">Private</option>
          </select>

          <label className="block text-[10px] font-bold text-slate-500 uppercase">Class Start Date</label>
          <input type="date" value={classStartDate} onChange={e => setClassStartDate(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white" required />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white" required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2.5 border rounded-lg bg-white" required />
            </div>
          </div>

          <label className="block text-[10px] font-bold text-slate-500 uppercase">Attach Worksheet (Demo Upload)</label>
          <input type="file" onChange={e => setSelectedFile(e.target.files[0])} className="w-full p-2 border rounded bg-white text-sm" />

          <label className="block text-[10px] font-bold text-slate-500 uppercase">Enroll Students (Unenrolled Only)</label>
          <div className="border rounded-lg p-3 max-h-36 overflow-y-auto space-y-1 bg-slate-50">
            {unenrolledStudents.length === 0 ? (
              <p className="text-slate-400 italic text-xs py-2 text-center select-none">🎉 All active students are currently enrolled in classes!</p>
            ) : (
              unenrolledStudents.map(stud => (
                <label key={stud.id} className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                  <input type="checkbox" checked={enrolledStudents.includes(stud.id)} onChange={() => toggleStudentEnrollment(stud.id)} />
                  {stud.displayName}
                  {stud.currentLevel && stud.currentLevel !== classLevel && (
                    <span className="text-amber-600 font-bold text-[10px]">⚠ currently {stud.currentLevel}</span>
                  )}
                </label>
              ))
            )}
          </div>

          {enrolledStudents.length > 0 && (
            <div className="space-y-2 border rounded-lg p-3 bg-white">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Enrollment Details</p>
              {enrolledStudents.map(studentId => {
                const student = users.find(user => user.id === studentId);
                const details = enrollmentDetails[studentId] || {};
                return (
                  <div key={studentId} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end border-b last:border-b-0 pb-2 last:pb-0">
                    <p className="text-xs font-bold text-slate-700">{student?.displayName || "Student"}</p>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Date Joined
                      <input type="date" value={details.dateJoined || ""} onChange={e => updateEnrollmentDetail(studentId, "dateJoined", e.target.value)} className="w-full p-2 border rounded-lg bg-white text-xs" required />
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          <button type="submit" disabled={uploading} className="w-full bg-[#1a3a8f] text-white p-3 rounded-xl font-bold hover:bg-[#122b6e] transition">
            {uploading ? "⏳ Uploading Worksheet..." : "Create & Schedule Class"}
          </button>
        </form>
      )}

      {classSubTab === "list" && (
        <div className="overflow-x-auto">
          <h3 className="font-bold text-slate-800 text-base mb-1">Active Classes</h3>
          <p className="text-[11px] text-slate-400 mb-3">Classes with the same name, schedule, instructor and level are grouped into one row — click a row to expand and manage individual batches.</p>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-500 font-bold uppercase text-xs select-none">
                <th className="p-3 cursor-pointer hover:bg-slate-100 transition rounded-tl-lg" onClick={() => handleClassSort("className")}>
                  Class Name {classSortField === "className" && (classSortAsc ? " ▲" : " ▼")}
                </th>
                <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleClassSort("classLevel")}>
                  Level {classSortField === "classLevel" && (classSortAsc ? " ▲" : " ▼")}
                </th>
                <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleClassSort("instructorId")}>
                  Instructor {classSortField === "instructorId" && (classSortAsc ? " ▲" : " ▼")}
                </th>
                <th className="p-3">Schedule</th>
                <th className="p-3">Students</th>
                <th className="p-3 text-right rounded-tr-lg">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classGroups.map(group => {
                const teacher = users.find(u => u.id === group.instructorId);
                const totalStudents = group.items.reduce((sum, cls) => sum + (cls.studentIds || []).length, 0);
                const isExpanded = expandedGroups.has(group.key);
                return (
                  <Fragment key={group.key}>
                    <tr className="hover:bg-slate-50/50 transition cursor-pointer" onClick={() => toggleGroup(group.key)}>
                      <td className="p-3 font-bold text-slate-800">
                        {group.className}
                        {group.items.length > 1 && (
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{group.items.length} batches</p>
                        )}
                      </td>
                      <td className="p-3"><LevelBadge level={group.classLevel} /></td>
                      <td className="p-3 text-indigo-700 font-semibold">{teacher ? teacher.displayName : "Unassigned"}</td>
                      <td className="p-3 font-semibold text-slate-600">{group.schedule}</td>
                      <td className="p-3 font-semibold text-slate-700">{totalStudents} enrolled</td>
                      <td className="p-3 text-right text-slate-400 font-bold text-xs">{isExpanded ? "▾ Hide" : "▸ Manage"}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="p-3 bg-slate-50/40">
                          <div className="space-y-3">
                            {group.items.map(cls => renderBatchCard(cls))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
