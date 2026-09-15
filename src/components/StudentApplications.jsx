import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useToast } from "./ui/useToast";
import { useConfirm } from "./ui/useConfirm";

export default function StudentApplications() {
  const toast = useToast();
  const confirm = useConfirm();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      // Only ever pending applications live here now — once a human
      // approves or rejects one, the record is deleted immediately
      // rather than archived, since the decision itself is the record
      // that matters, not the raw form submission.
      const snap = await getDocs(collection(db, "applications"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setApplications(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { (async () => { await fetchApplications(); })(); }, [fetchApplications]);

  const handleApprove = async (app) => {
    setProcessingId(app.id);
    try {
      // Creates the real roster entry — same shape as a manually-added
      // student, just sourced from the form instead of Add User.
      // Father's info fills the existing parentName/parentPhone fields
      // (what Directory/Roster already display); mother's info is kept
      // alongside it so nothing from the form gets silently dropped.
      await addDoc(collection(db, "users"), {
        displayName: app.displayName || "",
        phone: app.phone || "",
        dob: app.dob || "",
        gender: app.gender || "",
        placeOfBirth: app.placeOfBirth || "",
        religion: app.religion || "",
        address: app.address || "",
        branch: app.branch || "",
        program: app.program || "",
        classType: app.classType || "",
        schoolOrJob: app.schoolOrJob || "",
        classOrSemester: app.classOrSemester || "",
        referralSource: app.referralSource || "",
        parentName: app.fatherName || app.motherName || "",
        parentPhone: app.fatherPhone || app.motherPhone || "",
        joinedDate: new Date().toISOString().split("T")[0],
        fatherName: app.fatherName || "",
        fatherJob: app.fatherJob || "",
        fatherPhone: app.fatherPhone || "",
        motherName: app.motherName || "",
        motherJob: app.motherJob || "",
        motherPhone: app.motherPhone || "",
        role: "student",
        rating: "1",
        notes: "",
      });
      // The application's data now lives on permanently as a real
      // student record — the staging record itself is no longer needed.
      await deleteDoc(doc(db, "applications", app.id));
      fetchApplications();
    } catch (err) {
      toast("Error approving: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (app) => {
    if (!(await confirm(`Reject ${app.displayName}'s application? This deletes it permanently — there's no record kept afterward.`))) return;
    setProcessingId(app.id);
    try {
      await deleteDoc(doc(db, "applications", app.id));
      fetchApplications();
    } catch (err) {
      toast("Error rejecting: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 max-w-4xl mx-auto text-xs space-y-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1a3a8f]">Admissions</p>
          <h3 className="mt-1 font-black text-slate-800 text-base">
          Student Applications {applications.length > 0 && `(${applications.length} pending)`}
          </h3>
        </div>
        <a
          href="https://docs.google.com/spreadsheets/d/12FfhjJ_gxXLhII8LYLhOyeIbwcxXLNIlvZ2RbtdVgqQ/edit?resourcekey=&gid=800855144#gid=800855144"
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-11 bg-[#1a3a8f] text-white px-3 py-1.5 rounded-xl text-center font-bold text-xs hover:bg-[#122b6e] transition shrink-0"
        >
          📊 View Full Applicant History
        </a>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-6">Loading...</p>
      ) : applications.length === 0 ? (
        <p className="text-gray-400 text-center py-6">No pending applications.</p>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {applications.map(app => (
            <div key={app.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                <div className="min-w-0">
                  <p className="font-black text-slate-800 text-sm">{app.displayName || "Unnamed applicant"}</p>
                  <p className="mt-1 font-semibold text-[#1a3a8f]">{app.branch || "No branch"} · {app.program || "No program"}</p>
                  <p className="text-slate-500">{app.phone || "No phone"} · {app.classType || "No class type"}</p>
                  <p className="text-slate-400 mt-1">Submitted: {app.submittedAt ? new Date(app.submittedAt).toLocaleString() : "Unknown"}</p>
                  <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-slate-500">
                  <p>DOB: {app.dob || "N/A"} · Gender: {app.gender || "N/A"}</p>
                  <p className="text-gray-500">Birthplace: {app.placeOfBirth || "N/A"} | Religion: {app.religion || "N/A"}</p>
                  <p className="text-gray-500">Address: {app.address || "N/A"}</p>
                  <p className="text-gray-500">Father: {app.fatherName || "N/A"} ({app.fatherJob || "N/A"}) — {app.fatherPhone || "N/A"}</p>
                  <p className="text-gray-500">Mother: {app.motherName || "N/A"} ({app.motherJob || "N/A"}) — {app.motherPhone || "N/A"}</p>
                  {(app.schoolOrJob || app.classOrSemester) && (
                    <p className="text-gray-500">School/Job: {app.schoolOrJob || "N/A"} | Class/Semester: {app.classOrSemester || "N/A"}</p>
                  )}
                  {app.referralSource && <p className="text-gray-500">Heard about us via: {app.referralSource}</p>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 sm:flex-col">
                  <button
                    onClick={() => handleApprove(app)}
                    disabled={processingId === app.id}
                    className="min-h-11 flex-1 bg-green-600 text-white px-3 py-1 rounded-xl font-bold hover:bg-green-700 active:scale-[0.98] transition text-xs disabled:opacity-50"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => handleReject(app)}
                    disabled={processingId === app.id}
                    className="min-h-11 flex-1 bg-red-500 text-white px-3 py-1 rounded-xl font-bold hover:bg-red-600 active:scale-[0.98] transition text-xs disabled:opacity-50"
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
