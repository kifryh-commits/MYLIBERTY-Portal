import { useState } from "react";
import { db, demoUploadWorksheet } from "../firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc, arrayUnion } from "firebase/firestore";

export default function ClassManager({ classes, users, instructors, unenrolledStudents, fetchData }) {
  const [classSubTab, setClassSubTab] = useState("schedule");
  const [className, setClassName] = useState("");
  const [assignedInstructor, setAssignedInstructor] = useState("");
  const [classDay, setClassDay] = useState("Mon/Wed");
  const [classStartDate, setClassStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(""); 
  const [endTime, setEndTime] = useState("");     
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [enrollmentDetails, setEnrollmentDetails] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [classRoom, setClassRoom] = useState("");

  // Add-to-existing-class panel state
  const [enrollingIntoClassId, setEnrollingIntoClassId] = useState(null);
  const [addStudentId, setAddStudentId] = useState("");
  const [addDateJoined, setAddDateJoined] = useState(new Date().toISOString().slice(0, 10));
  const [addLevel, setAddLevel] = useState("warrior");
  
  const [classSortField, setClassSortField] = useState("className");
  const [classSortAsc, setClassSortAsc] = useState(true);

  const handleCreateClass = async (e) => {
    e.preventDefault();
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
        studentIds: enrolledStudents,
        enrollments: enrolledStudents.map(studentId => ({
          studentId,
          dateJoined: enrollmentDetails[studentId]?.dateJoined || new Date().toISOString().slice(0, 10),
          level: enrollmentDetails[studentId]?.level || "warrior",
        })),
        worksheetUrl: fileUrl,
        classRoom: classRoom || "N/A"
      });
      alert("Success! Class scheduled.");
      setClassName(""); setAssignedInstructor(""); setClassDay("Mon/Wed"); setClassStartDate(new Date().toISOString().slice(0, 10)); setStartTime(""); setEndTime(""); setEnrolledStudents([]); setEnrollmentDetails({});
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
    try {
      await updateDoc(doc(db, "classes", classId), {
        studentIds: arrayUnion(addStudentId),
        enrollments: arrayUnion({
          studentId: addStudentId,
          dateJoined: addDateJoined || new Date().toISOString().slice(0, 10),
          level: addLevel,
        }),
      });
      setEnrollingIntoClassId(null);
      setAddStudentId(""); setAddDateJoined(new Date().toISOString().slice(0, 10)); setAddLevel("warrior");
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

  const toggleStudentEnrollment = (uid) => {
    const student = users.find(u => u.id === uid);
    setEnrolledStudents(prev => {
      if (prev.includes(uid)) return prev.filter(id => id !== uid);
      setEnrollmentDetails(details => ({
        ...details,
        [uid]: { 
          dateJoined: student?.joinedDate || new Date().toISOString().slice(0, 10), 
          level: student?.educationLevel || "warrior" 
        },
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
                  <div key={studentId} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end border-b last:border-b-0 pb-2 last:pb-0">
                    <p className="text-xs font-bold text-slate-700">{student?.displayName || "Student"}</p>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Date Joined
                      <input type="date" value={details.dateJoined || ""} onChange={e => updateEnrollmentDetail(studentId, "dateJoined", e.target.value)} className="w-full p-2 border rounded-lg bg-white text-xs" required />
                    </label>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Level
                      <select value={details.level || "warrior"} onChange={e => updateEnrollmentDetail(studentId, "level", e.target.value)} className="w-full p-2 border rounded-lg bg-white text-xs">
                        <option value="warrior">Warrior</option>
                        <option value="elite">Elite</option>
                        <option value="master">Master</option>
                        <option value="grandmaster">Grandmaster</option>
                        <option value="epic">Epic</option>
                      </select>
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
          <h3 className="font-bold text-slate-800 text-base mb-3">Active Classes</h3>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-500 font-bold uppercase text-xs select-none">
                <th className="p-3 cursor-pointer hover:bg-slate-100 transition rounded-tl-lg" onClick={() => handleClassSort("className")}>
                  Class Name {classSortField === "className" && (classSortAsc ? " ▲" : " ▼")}
                </th>
                <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleClassSort("classRoom")}>
                  Room {classSortField === "classRoom" && (classSortAsc ? " ▲" : " ▼")}
                </th>
                <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleClassSort("instructorId")}>
                  Instructor {classSortField === "instructorId" && (classSortAsc ? " ▲" : " ▼")}
                </th>
                <th className="p-3">Schedule</th>
                <th className="p-3">Students & Enrollment</th>
                <th className="p-3 text-right rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedClasses.map(cls => {
                const teacher = users.find(u => u.id === cls.instructorId);
                return (
                  <tr key={cls.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 font-bold text-slate-800">
                      {cls.className}
                      {cls.worksheetUrl && (
                        <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                          <a href="#" onClick={(e) => { e.preventDefault(); alert(`Opening Demo Worksheet: ${cls.worksheetUrl}`); }} className="hover:underline">📄 View Worksheet</a>
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 font-semibold">{cls.classRoom || "N/A"}</td>
                    <td className="p-3 text-indigo-700 font-semibold">{teacher ? teacher.displayName : "Unassigned"}</td>
                    <td className="p-3 font-semibold text-slate-600">{cls.schedule}</td>
                    <td className="p-3 text-slate-700">
                      <p className="font-bold">{(cls.studentIds || []).length} enrolled</p>
                      <div className="mt-2 space-y-2">
                        {(cls.studentIds || []).map(studentId => {
                          const student = users.find(user => user.id === studentId);
                          const enrollment = getEnrollment(cls, studentId);
                          return (
                            <div key={studentId} className="text-xs border-l-2 border-indigo-200 pl-2 flex justify-between items-start gap-2">
                              <div>
                                <p className="font-semibold text-slate-700">{student?.displayName || "Unknown student"}</p>
                                <p className="text-slate-500">Joined: {enrollment.dateJoined || "Not recorded"} · {getDuration(enrollment.dateJoined)}</p>
                                <p className="text-indigo-700 font-bold capitalize">Level: {enrollment.level || "Not recorded"}</p>
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
                        <form onSubmit={e => handleAddStudentToClass(cls.id, e)} className="mt-3 space-y-2 border rounded-lg p-2.5 bg-slate-50">
                          <select value={addStudentId} onChange={e => setAddStudentId(e.target.value)} className="w-full p-2 border rounded-lg bg-white text-xs" required>
                            <option value="">Select student...</option>
                            {unenrolledStudents.map(stud => <option key={stud.id} value={stud.id}>{stud.displayName}</option>)}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={addDateJoined} onChange={e => setAddDateJoined(e.target.value)} className="w-full p-2 border rounded-lg bg-white text-xs" required />
                            <select value={addLevel} onChange={e => setAddLevel(e.target.value)} className="w-full p-2 border rounded-lg bg-white text-xs">
                              <option value="warrior">Warrior</option>
                              <option value="elite">Elite</option>
                              <option value="master">Master</option>
                              <option value="grandmaster">Grandmaster</option>
                              <option value="epic">Epic</option>
                            </select>
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
                          className="mt-2 text-[10px] font-bold text-[#1a3a8f] hover:underline disabled:text-slate-300 disabled:no-underline disabled:cursor-not-allowed"
                        >
                          {unenrolledStudents.length === 0 ? "No unenrolled students available" : "+ Add Student"}
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => handleDeleteClass(cls.id)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-600 transition text-xs">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
