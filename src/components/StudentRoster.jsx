import { useState } from "react";
import PaymentModal from "./PaymentModal";
import { printHtmlTable } from "../utils/printTable";
import { useToast } from "./ui/useToast";

export default function StudentRoster({ students, getStudentClasses, setSelectedStudent, handleEdit, handleDelete, fetchData, readOnly = false }) {
  const toast = useToast();
  const [paymentStudent, setPaymentStudent] = useState(null);
  // Sort states live cleanly inside this sub-component now!
  const [studentSortField, setStudentSortField] = useState("displayName");
  const [studentSortAsc, setStudentSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const handleStudentSort = (field) => {
    if (studentSortField === field) {
      setStudentSortAsc(!studentSortAsc);
    } else {
      setStudentSortField(field);
      setStudentSortAsc(true);
    }
  };

  const sortedStudents = [...students]
    .map(s => {
      const studentClasses = getStudentClasses(s.id);
      // "Joined" is supposed to reflect the date set in a class's Enrollment
      // Details, not the original profile/application date — fall back to
      // the profile date only when the student isn't enrolled in a class yet.
      const enrollmentJoinedDate = studentClasses.find(c => c.dateJoined)?.dateJoined || "";
      return { ...s, studentClasses, effectiveJoinedDate: enrollmentJoinedDate || s.joinedDate || "" };
    })
    .filter(s => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (s.displayName || "").toLowerCase().includes(q) || (s.phone || "").includes(q);
    })
    .sort((a, b) => {
      const field = studentSortField === "joinedDate" ? "effectiveJoinedDate" : studentSortField;
      let valA = a[field] || "";
      let valB = b[field] || "";

      if (valA < valB) return studentSortAsc ? -1 : 1;
      if (valA > valB) return studentSortAsc ? 1 : -1;
      return 0;
    });

  const handlePrint = () => {
    const headers = ["Student Name", "Parent Contact", "Education", "DOB", "Joined", "Payment", "Class", "Instructor"];
    const rows = sortedStudents.map(s => [
      s.displayName || "",
      `${s.parentName || "N/A"} (${s.parentPhone || "N/A"})`,
      s.educationLevel || s.schoolOrJob || "N/A",
      s.dob || "N/A",
      s.effectiveJoinedDate || "N/A",
      s.paymentStatus === "paid" ? "Paid" : "Pending",
      s.studentClasses.length ? s.studentClasses.map(c => c.className).join(", ") : "Unassigned",
      s.studentClasses.length ? s.studentClasses.map(c => c.instructorName || "Unassigned").join(", ") : "—",
    ]);
    printHtmlTable("Student Roster", headers, rows, toast);
  };

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 max-w-6xl mx-auto">
      {/* Header Panel */}
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-150">
        <h3 className="font-bold text-slate-800 text-base">🎓 Student Roster</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="bg-slate-100 text-slate-600 border px-3 py-1 rounded-full font-bold text-xs hover:bg-slate-200 transition"
          >
            🖨️ Print
          </button>
          <span className="bg-[#1a3a8f]/10 text-[#1a3a8f] px-3 py-1 rounded-full font-bold text-xs uppercase">
            {students.length} Active Students
          </span>
        </div>
      </div>

      <input
        type="text"
        placeholder="🔍 Search students by name or phone..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full p-2.5 border rounded-lg mb-4 text-sm"
      />

      {/* Table Panel */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-slate-500 font-bold uppercase text-xs select-none">
              <th className="p-3 cursor-pointer hover:bg-slate-100 transition rounded-tl-lg" onClick={() => handleStudentSort("displayName")}>
                Student Name {studentSortField === "displayName" && (studentSortAsc ? " ▲" : " ▼")}
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleStudentSort("parentName")}>
                Parent Contact {studentSortField === "parentName" && (studentSortAsc ? " ▲" : " ▼")}
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleStudentSort("educationLevel")}>
                Education {studentSortField === "educationLevel" && (studentSortAsc ? " ▲" : " ▼")}
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleStudentSort("dob")}>
                DOB {studentSortField === "dob" && (studentSortAsc ? " ▲" : " ▼")}
              </th>
              <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleStudentSort("joinedDate")}>
                Joined {studentSortField === "joinedDate" && (studentSortAsc ? " ▲" : " ▼")}
              </th>
              <th className="p-3">Payment</th>
              <th className="p-3">Class</th>
              <th className="p-3">Instructor</th>
              {(!readOnly || setSelectedStudent) && (
                <th className="p-3 text-right rounded-tr-lg">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedStudents.map(s => {
              const studentClasses = s.studentClasses;
              return (
                <tr key={s.id} className="hover:bg-slate-50/50 transition">
                  <td className="p-3 font-bold text-slate-800">
                    <p>{s.displayName}</p>
                    <p className="text-xs text-slate-400 font-normal">ID: {s.id}</p>
                  </td>
                  <td className="p-3 text-slate-600">
                    <p className="font-semibold text-slate-700">{s.parentName || "N/A"}</p>
                    <p className="text-xs text-slate-400">{s.parentPhone || "N/A"}</p>
                  </td>
                  <td className="p-3 text-slate-600 font-semibold whitespace-nowrap">
                    {s.educationLevel || s.schoolOrJob || "N/A"}
                  </td>
                  <td className="p-3 text-slate-600 whitespace-nowrap text-xs">
                    {s.dob || "N/A"}
                  </td>
                  <td className="p-3 text-slate-600 font-bold whitespace-nowrap">
                    {s.effectiveJoinedDate || "N/A"}
                  </td>
                  <td className="p-3">
                    {readOnly ? (
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${s.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-rose-100 text-rose-700 border border-rose-200"}`}>
                        {s.paymentStatus === "paid" ? "💰 Paid" : "⚠️ Pending"}
                      </span>
                    ) : (
                      <button
                        onClick={() => setPaymentStudent(s)}
                        title="Click to record payment, view history, or issue receipt"
                        className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition shadow-sm hover:ring-2 hover:ring-offset-1 ${s.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700 border border-emerald-200 hover:ring-emerald-400" : "bg-rose-100 text-rose-700 border border-rose-200 hover:ring-rose-400"}`}
                      >
                        {s.paymentStatus === "paid" ? "💰 Paid" : "⚠️ Pending"}
                      </button>
                    )}
                    {s.lastPaymentPeriod && (
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium whitespace-nowrap">
                        {s.lastPaymentPeriod}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    {studentClasses.length === 0 ? (
                      <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded text-xs whitespace-nowrap">⚠️ Unassigned</span>
                    ) : (
                      studentClasses.map((c, idx) => (
                        <div key={idx} className="mb-1 last:mb-0 whitespace-nowrap">
                          <span className="text-[#1a3a8f] font-bold text-xs">📚 {c.className}</span>
                        </div>
                      ))
                    )}
                  </td>
                  <td className="p-3">
                    {studentClasses.length === 0 ? (
                      <span className="text-slate-400 text-xs">—</span>
                    ) : (
                      studentClasses.map((c, idx) => (
                        <div key={idx} className="mb-1 last:mb-0 whitespace-nowrap">
                          <span className="text-slate-700 font-medium text-xs">🧑‍🏫 {c.instructorName || "Unassigned"}</span>
                        </div>
                      ))
                    )}
                  </td>
                  {(!readOnly || setSelectedStudent) && (
                    <td className="p-3 text-right font-bold">
                      <div className="flex gap-2 justify-end">
                        {setSelectedStudent && (
                          <button onClick={() => setSelectedStudent(s)} className="bg-green-600 text-white px-3 py-1 rounded font-bold hover:bg-green-700 text-xs transition shadow-sm">Badge</button>
                        )}
                        {!readOnly && (
                          <>
                            <button onClick={() => handleEdit(s)} className="bg-blue-500 text-white px-3 py-1 rounded font-bold hover:bg-blue-600 text-xs transition shadow-sm">Edit</button>
                            <button onClick={() => handleDelete(s.id)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded font-bold hover:bg-red-500 hover:text-white text-xs transition shadow-sm">Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && paymentStudent && (
        <PaymentModal
          student={students.find(s => s.id === paymentStudent.id) || paymentStudent}
          onClose={() => setPaymentStudent(null)}
          onPaymentUpdated={() => {
            if (fetchData) fetchData();
          }}
        />
      )}
    </div>
  );
}
