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
    <div className="bg-white p-4 rounded-2xl border max-w-4xl mx-auto text-xs space-y-4">
      <div className="flex justify-between items-center gap-2">
        <h3 className="font-bold text-slate-700 text-sm">
          Student Applications {applications.length > 0 && `(${applications.length} pending)`}
        </h3>
        <a
          href="https://docs.google.com/spreadsheets/d/12FfhjJ_gxXLhII8LYLhOyeIbwcxXLNIlvZ2RbtdVgqQ/edit?resourcekey=&gid=800855144#gid=800855144"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#1a3a8f] text-white px-3 py-1.5 rounded-lg font-bold text-[10px] hover:bg-[#122b6e] transition shrink-0"
        >
          📊 View Full Applicant History
        </a>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-6">Loading...</p>
      ) : applications.length === 0 ? (
        <p className="text-gray-400 text-center py-6">No pending applications.</p>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {applications.map(app => (
            <div key={app.id} className="p-3 bg-gray-50 border rounded-lg">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-bold text-gray-800">{app.displayName}</p>
                  <p className="text-gray-500">Branch: {app.branch || "N/A"} | Program: {app.program || "N/A"} ({app.classType || "N/A"})</p>
                  <p className="text-gray-500">Phone: {app.phone || "N/A"} | DOB: {app.dob || "N/A"} | Gender: {app.gender || "N/A"}</p>
                  <p className="text-gray-500">Birthplace: {app.placeOfBirth || "N/A"} | Religion: {app.religion || "N/A"}</p>
                  <p className="text-gray-500">Address: {app.address || "N/A"}</p>
                  <p className="text-gray-500">Father: {app.fatherName || "N/A"} ({app.fatherJob || "N/A"}) — {app.fatherPhone || "N/A"}</p>
                  <p className="text-gray-500">Mother: {app.motherName || "N/A"} ({app.motherJob || "N/A"}) — {app.motherPhone || "N/A"}</p>
                  {(app.schoolOrJob || app.classOrSemester) && (
                    <p className="text-gray-500">School/Job: {app.schoolOrJob || "N/A"} | Class/Semester: {app.classOrSemester || "N/A"}</p>
                  )}
                  {app.referralSource && <p className="text-gray-500">Heard about us via: {app.referralSource}</p>}
                  <p className="text-gray-400 mt-1">Submitted: {app.submittedAt ? new Date(app.submittedAt).toLocaleString() : "Unknown"}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleApprove(app)}
                    disabled={processingId === app.id}
                    className="bg-green-600 text-white px-2 py-1 rounded font-bold hover:bg-green-700 transition text-[9px] disabled:opacity-50"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => handleReject(app)}
                    disabled={processingId === app.id}
                    className="bg-red-500 text-white px-2 py-1 rounded font-bold hover:bg-red-600 transition text-[9px] disabled:opacity-50"
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
