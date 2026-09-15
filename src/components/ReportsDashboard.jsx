import { useState, useEffect, useCallback } from "react";
import { auth, db } from "../firebase";
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore";
import { isShiftStale, autoCloseShift } from "../utils/shiftAutoClose";
import { computeMonthlyPunctuality } from "../utils/punctuality";

async function autoCloseStaleShifts(shifts) {
  const updated = [];
  for (const s of shifts) {
    if (isShiftStale(s)) {
      try {
        const estimatedClockOut = await autoCloseShift(s);
        updated.push({ ...s, clockOut: estimatedClockOut, autoClosed: true });
      } catch (err) {
        console.error("Failed to auto-close shift", s.id, err);
        updated.push(s);
      }
    } else {
      updated.push(s);
    }
  }
  return updated;
}

function uniqueClasses(classes) {
  const seen = new Set();
  return classes.filter(cls => {
    const signature = [cls.className, cls.instructorId, cls.schedule, cls.classRoom].join("|");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export default function ReportsDashboard({ isAdminView = false, isFrontOffice = false }) {
  const [subTab, setSubTab] = useState(isFrontOffice ? "students" : "staff");
  const [shifts, setShifts] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [analytics, setAnalytics] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const fetchShifts = useCallback(async () => {
    try {
      const shiftsQuery = isAdminView
        ? collection(db, "shifts")
        : query(collection(db, "shifts"), where("userId", "==", auth.currentUser?.uid));
      const shiftsSnap = await getDocs(shiftsQuery);
      const existingUserIds = new Set();

      if (isAdminView) {
        const usersSnap = await getDocs(collection(db, "users"));
        usersSnap.docs.forEach(userDoc => existingUserIds.add(userDoc.id));
      } else if (auth.currentUser?.uid) {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) existingUserIds.add(userDoc.id);
      }

      const raw = shiftsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(shift => existingUserIds.has(shift.userId));
      const cleaned = await autoCloseStaleShifts(raw);
      setShifts(cleaned);
    } catch (err) { console.error(err); }
  }, [isAdminView]);

  const fetchStudentProgress = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const classesQuery = isAdminView || isFrontOffice
        ? collection(db, "classes")
        : query(collection(db, "classes"), where("instructorId", "==", auth.currentUser?.uid));
      const progressQuery = isAdminView || isFrontOffice
        ? collection(db, "progressReports")
        : query(collection(db, "progressReports"), where("instructorId", "==", auth.currentUser?.uid));
      // Admin can read the full users collection unfiltered (their role
      // grants that outright). An instructor can only read documents
      // where role == "student" — but Firestore requires the QUERY
      // itself to carry that same filter, or it rejects the whole
      // request rather than silently returning a partial result.
      const usersQuery = isAdminView
        ? collection(db, "users")
        : query(collection(db, "users"), where("role", "in", isFrontOffice ? ["student", "instructor"] : ["student"]));
      const [usersSnap, classesSnap, attendanceSnap, progressSnap] = await Promise.all([
        getDocs(usersQuery),
        getDocs(classesQuery),
        getDocs(collection(db, "attendance")),
        getDocs(progressQuery),
      ]);

      const usersById = {};
      usersSnap.docs.forEach(d => { usersById[d.id] = d.data(); });

      const fetchedClasses = uniqueClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setClasses(fetchedClasses);
      const attendance = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const progress = progressSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Find all unique student IDs from attendance and progress reports
      // to ensure we catch students who have been deleted from the users roster.
      const allStudentIds = new Set([
        ...Object.keys(usersById).filter(id => usersById[id].role === "student"),
        ...attendance.map(a => a.userId),
        ...progress.map(p => p.studentId)
      ]);

      const relevantStudentIds = isAdminView
        ? null
        : new Set(fetchedClasses.flatMap(c => c.studentIds || []));

      const studentList = Array.from(allStudentIds)
        .filter(id => {
          // If we have a user profile, check roles and enrollment
          if (usersById[id]) {
            return usersById[id].role === "student" && (isAdminView || relevantStudentIds.has(id));
          }
          // If no profile (deleted student), only show in Admin/Front Office view 
          // to preserve historical data integrity.
          return isAdminView || isFrontOffice;
        })
        .map(id => {
          const u = usersById[id];
          
          const enrolledClasses = fetchedClasses
            .filter(c => (c.studentIds || []).includes(id))
            .map(c => ({
              classId: c.id,
              className: c.className,
              schedule: c.schedule,
              instructorName: usersById[c.instructorId]?.displayName || "Unassigned",
            }));

          const history = attendance
            .filter(a => a.userId === id)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          const assessments = progress
            .filter(report => report.studentId === id)
            .filter(report => selectedClassId === "all" || report.classId === selectedClassId)
            .sort((a, b) => new Date(b.examDate || b.submittedAt) - new Date(a.examDate || a.submittedAt));

          // Fallback to name captured in history if user profile is gone
          const capturedName = history[0]?.displayName || assessments[0]?.studentName || "Former Student";
          const displayName = u ? u.displayName : `${capturedName} (Archived)`;

          return {
            id,
            displayName,
            isArchived: !u,
            classes: enrolledClasses,
            attendanceCount: history.length,
            lastCheckIn: history[0]?.timestamp || null,
            history,
            assessments,
          };
        })
        .filter(student => selectedClassId === "all" || student.classes.some(cls => cls.classId === selectedClassId))
        .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

      setStudents(studentList);
    } catch (err) {
      console.error(err);
    } finally {
      setStudentsLoading(false);
    }
  }, [isAdminView, isFrontOffice, selectedClassId]);

  const fetchInstructorAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      // Admin sees every instructor's classes and shifts. An instructor
      // viewing their own analytics only ever fetches their own —
      // there's no reason (or permission) for them to see colleagues'.
      const classesQuery = isAdminView
        ? collection(db, "classes")
        : query(collection(db, "classes"), where("instructorId", "==", uid));
      const shiftsQuery = isAdminView
        ? collection(db, "shifts")
        : query(collection(db, "shifts"), where("userId", "==", uid));

      const [classesSnap, shiftsSnap] = await Promise.all([
        getDocs(classesQuery),
        getDocs(shiftsQuery),
      ]);

      const fetchedClasses = uniqueClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const fetchedShifts = shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      let instructorsById = {};
      if (isAdminView) {
        const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "instructor")));
        usersSnap.docs.forEach(d => { instructorsById[d.id] = d.data(); });
      } else {
        // Non-admins can't query for OTHER instructors' profiles at all —
        // only their own doc is readable. That's all this view needs anyway.
        const selfDoc = await getDoc(doc(db, "users", uid));
        if (selfDoc.exists()) instructorsById[uid] = selfDoc.data();
      }

      const results = computeMonthlyPunctuality(fetchedClasses, fetchedShifts, instructorsById, selectedYear, selectedMonth);
      setAnalytics(results.sort((a, b) => (a.instructorName || "").localeCompare(b.instructorName || "")));
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [isAdminView, selectedYear, selectedMonth]);

  useEffect(() => {
    (async () => {
      if (subTab === "staff") await fetchShifts();
      if (subTab === "students") await fetchStudentProgress();
      if (subTab === "instructors") await fetchInstructorAnalytics();
    })();
  }, [subTab, fetchShifts, fetchStudentProgress, fetchInstructorAnalytics]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-5 text-sm max-w-5xl mx-auto">
      {/* Sub-Tab Switcher - Styled to Navy Theme */}
      <div className="flex flex-col gap-3 border-b pb-3 print:hidden">
        <div className="grid grid-cols-2 gap-2 font-bold text-xs uppercase select-none">
        {!isFrontOffice && <button onClick={() => setSubTab("staff")} className={`min-h-12 px-3 py-1.5 rounded-xl transition duration-150 ${subTab === "staff" ? "bg-[#1a3a8f] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>💼 Staff Attendance</button>}
        <button onClick={() => setSubTab("students")} className={`min-h-12 px-3 py-1.5 rounded-xl transition duration-150 ${subTab === "students" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>🎓 Student Progress</button>
        <button onClick={() => setSubTab("instructors")} className={`min-h-12 px-3 py-1.5 rounded-xl transition duration-150 ${subTab === "instructors" ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>👩‍🏫 Instructor Analytics</button>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex-1 text-[10px] font-bold text-slate-500 uppercase">
            Class
            <select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} className="mt-1 min-h-11 w-full p-1.5 border rounded-xl bg-white text-sm normal-case font-normal">
              <option value="all">All classes</option>
              {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.className}</option>)}
            </select>
          </label>
          <button onClick={() => window.print()} className="min-h-11 bg-[#1a3a8f] text-white px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap hover:bg-[#122b6e]">🖨️ Print</button>
        </div>
      </div>

      {subTab === "staff" && (
        <div className="space-y-3">
          <h3 className="font-bold text-slate-800 text-base">Staff Clock-In/Out History</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {shifts.map(s => (
              <div key={s.id} className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center p-3 bg-slate-50 border border-slate-150 rounded-xl text-xs hover:bg-slate-100/50 transition">
                <div>
                  <p className="font-bold text-slate-800">{s.displayName} ({s.role})</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">In: {s.clockIn ? new Date(s.clockIn).toLocaleString() : "N/A"}</p>
                  {s.autoClosed && <p className="text-amber-600 font-semibold text-[10px] mt-0.5">⚠️ Auto-closed — no manual clock-out recorded</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase whitespace-nowrap ${
                  s.autoClosed ? "bg-amber-100 text-amber-800" : s.clockOut ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                }`}>
                  {s.autoClosed ? "Auto-Closed" : s.clockOut ? "Clocked Out" : "Active"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "students" && (
        <div className="space-y-3">
          <h3 className="font-bold text-slate-800 text-base">Student Attendance & Class Progress</h3>
          {studentsLoading ? (
            <p className="text-gray-400 text-center py-6 italic">Loading student database...</p>
          ) : students.length === 0 ? (
            <p className="text-gray-400 text-center py-6 italic">No students found.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {students.map(s => (
                <div key={s.id} className="p-4 bg-slate-50 border border-slate-150 rounded-xl hover:bg-slate-100/50 transition">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800 text-sm">{s.displayName}</p>
                      {s.classes.length === 0 ? (
                        <p className="text-slate-400 text-xs">Not enrolled in any class yet</p>
                      ) : (
                        s.classes
                          .filter(c => selectedClassId === "all" || c.classId === selectedClassId)
                          .map((c, i) => (
                          <p key={i} className="text-slate-500 text-xs">📚 {c.className} ({c.schedule}) — Instructor: {c.instructorName}</p>
                        ))
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-800">{s.attendanceCount} check-ins</p>
                      <p className="text-slate-400 text-xs mt-0.5">Last: {s.lastCheckIn ? new Date(s.lastCheckIn).toLocaleDateString() : "Never"}</p>
                      <p className="text-indigo-600 font-bold text-xs mt-1">{s.assessments.length} assessment{s.assessments.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  {s.assessments.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Latest assessment</p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-xs">
                        <p><span className="text-slate-400">Date</span><br /><strong>{s.assessments[0].examDate || "N/A"}</strong></p>
                        <p><span className="text-slate-400">Level</span><br /><strong className="capitalize">{s.assessments[0].level || "N/A"}</strong></p>
                        <p><span className="text-slate-400">Overall</span><br /><strong>{s.assessments[0].overallScore || "N/A"}</strong></p>
                        <p><span className="text-slate-400">Instructor</span><br /><strong>{s.assessments[0].instructorName || "N/A"}</strong></p>
                        <p><span className="text-slate-400">Notes</span><br /><strong className="font-normal">{s.assessments[0].notes || "None"}</strong></p>
                      </div>
                    </div>
                  )}
                  {s.history.length > 0 && (
                    <button
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      className="text-[#1a3a8f] font-bold hover:underline mt-2 text-xs"
                    >
                      {expandedId === s.id ? "Hide full history ▲" : "View full history ▼"}
                    </button>
                  )}
                  {expandedId === s.id && (
                    <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto border-t border-slate-200 pt-3">
                      {s.history.map(h => (
                        <p key={h.id} className="text-slate-400 text-xs">{new Date(h.timestamp).toLocaleString()}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "instructors" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h3 className="font-bold text-slate-800 text-base">Instructor Punctuality — Monthly</h3>
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="p-1.5 border rounded-lg bg-white text-xs"
              >
                {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="p-1.5 border rounded-lg bg-white text-xs"
              >
                {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <p className="text-slate-400 text-xs">
            Policy: an instructor must clock in at least 15 minutes before their class starts to count as on time — arriving any later, even before the class actually begins, counts as late.
          </p>

          {analyticsLoading ? (
            <p className="text-gray-400 text-center py-6 italic">Loading...</p>
          ) : analytics.length === 0 ? (
            <p className="text-gray-400 text-center py-6 italic">No recurring classes with a schedule found for this month.</p>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {analytics.map(a => (
                <article key={a.instructorId} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-black text-slate-800">{a.instructorName}</h4>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${a.punctualityRate === null ? "bg-gray-100 text-gray-500" : a.punctualityRate >= 90 ? "bg-green-100 text-green-800" : a.punctualityRate >= 70 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>{a.punctualityRate === null ? "N/A" : `${a.punctualityRate}% on time`}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs">
                    <div><dt className="text-slate-400">Scheduled</dt><dd className="mt-1 font-black text-slate-800">{a.sessionsScheduled}</dd></div>
                    <div><dt className="text-slate-400">Attended</dt><dd className="mt-1 font-black text-slate-800">{a.sessionsAttended}</dd></div>
                    <div><dt className="text-slate-400">Late</dt><dd className="mt-1 font-black text-amber-700">{a.late}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="p-2">Instructor</th>
                    <th className="p-2">Punctuality</th>
                    <th className="p-2">Scheduled</th>
                    <th className="p-2">Attended</th>
                    <th className="p-2">Late</th>
                    <th className="p-2">Absent</th>
                    <th className="p-2">Avg Min Late</th>
                    <th className="p-2">Auto-Closed</th>
                    <th className="p-2">Data quality</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map(a => (
                    <tr key={a.instructorId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-2 font-bold text-slate-800">{a.instructorName}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          a.punctualityRate === null ? "bg-gray-100 text-gray-500" :
                          a.punctualityRate >= 90 ? "bg-green-100 text-green-800" :
                          a.punctualityRate >= 70 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                        }`}>
                          {a.punctualityRate === null ? "N/A" : `${a.punctualityRate}%`}
                        </span>
                      </td>
                      <td className="p-2">{a.sessionsScheduled}</td>
                      <td className="p-2">{a.sessionsAttended}</td>
                      <td className="p-2 text-amber-700 font-semibold">{a.late}</td>
                      <td className="p-2 text-red-700 font-semibold">{a.absent}</td>
                      <td className="p-2">{a.avgMinutesLate > 0 ? `${a.avgMinutesLate} min` : "—"}</td>
                      <td className="p-2">{a.autoClosedCount}</td>
                      <td className="p-2">
                        {a.limitedAccuracy ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">Limited accuracy</span>
                        ) : (
                          <span className="text-green-700 font-semibold text-[10px]">Measured</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
          <p className="text-slate-300 text-[10px]">
            Limited accuracy means the row includes a legacy shift or a class without a saved start date. "Private" classes and classes without a saved start time aren't included.
          </p>
        </div>
      )}
    </div>
  );
}
