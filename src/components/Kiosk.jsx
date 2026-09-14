import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, doc, getDoc, addDoc, getDocs, query, where, updateDoc } from "firebase/firestore";
import { Html5QrcodeScanner } from "html5-qrcode";
import { isShiftStale, autoCloseShift } from "../utils/shiftAutoClose";
import { getTodaysClasses, getInstantPunctuality } from "../utils/punctuality";

export default function Kiosk({ title = "Kiosk Station", studentsOnly = false }) {
  const [kioskScanning, setKioskScanning] = useState(false);
  const [pendingClockIn, setPendingClockIn] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [status, setStatus] = useState({ message: "", type: "" });

  const showStatus = (message, type = "success") => {
    setStatus({ message, type });
    // Auto-clear after 4 seconds so the next person doesn't have to touch the screen
    setTimeout(() => setStatus({ message: "", type: "" }), 4000);
  };

  const createShift = async () => {
    const selectedClass = pendingClockIn?.classes.find(cls => cls.id === selectedClassId);
    if (!pendingClockIn || !selectedClass) return;
    try {
      const clockIn = new Date();
      const punctuality = getInstantPunctuality(selectedClass, clockIn);

      await addDoc(collection(db, "shifts"), {
        userId: pendingClockIn.uid,
        displayName: pendingClockIn.userData.displayName,
        role: pendingClockIn.userData.role,
        classId: selectedClass.id,
        className: selectedClass.className || "",
        clockIn: clockIn.toISOString(),
        clockOut: null,
        scheduledStart: punctuality.scheduledStart,
        requiredArrival: punctuality.requiredArrival,
        punctualityStatus: punctuality.status,
        minutesEarlyOrLate: punctuality.minutesEarlyOrLate,
      });
      setPendingClockIn(null);
      setSelectedClassId("");
      showStatus(`⏰ Clocked IN: ${pendingClockIn.userData.displayName} (${punctuality.status})`);
    } catch (err) {
      showStatus("Error: " + err.message, "error");
    }
  };

  useEffect(() => {
    if (!kioskScanning) return;
    const scanner = new Html5QrcodeScanner("kiosk-reader", { fps: 10, qrbox: 250 });
    scanner.render(async (uid) => {
      scanner.clear(); setKioskScanning(false);
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (!userDoc.exists()) return showStatus("Error: Invalid ID Badge.", "error");
        const userData = userDoc.data();
        if (studentsOnly && userData.role !== "student") {
          return showStatus("🚫 This kiosk only accepts student badges.", "error");
        }

        if (userData.role === "student") {
          await addDoc(collection(db, "attendance"), {
            userId: uid, displayName: userData.displayName, role: "student", timestamp: new Date().toISOString(), method: "KIOSK"
          });
          showStatus(`✅ Student Checked In: ${userData.displayName}`);
        } else {
          const q = query(collection(db, "shifts"), where("userId", "==", uid), where("clockOut", "==", null));
          const snap = await getDocs(q);

          let openShift = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
          if (openShift && isShiftStale(openShift)) {
            await autoCloseShift(openShift);
            openShift = null;
          }

          if (!openShift) {
            const classSnap = await getDocs(query(collection(db, "classes"), where("instructorId", "==", uid)));
            const todayClasses = getTodaysClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            
            if (todayClasses.length > 0) {
              setPendingClockIn({ uid, userData, classes: todayClasses });
            } else {
              const clockIn = new Date();
              await addDoc(collection(db, "shifts"), {
                userId: uid,
                displayName: userData.displayName,
                role: userData.role,
                classId: "general",
                className: "General Duty",
                clockIn: clockIn.toISOString(),
                clockOut: null,
                scheduledStart: null,
                requiredArrival: null,
                punctualityStatus: "Present",
                minutesEarlyOrLate: 0,
              });
              showStatus(`⏰ Clocked IN (General Duty): ${userData.displayName}`);
            }
            return;
          } else {
            await updateDoc(doc(db, "shifts", openShift.id), { clockOut: new Date().toISOString() });
            showStatus(`⏰ Clocked OUT: ${userData.displayName}`);
          }
        }
      } catch (err) { showStatus("Scanner Error: " + err.message, "error"); }
    }, (err) => console.log(err));
    return () => scanner.clear();
  }, [kioskScanning, studentsOnly]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-md mx-auto text-center space-y-4 relative overflow-hidden">
      {/* 👈 Success/Error Message Overlay */}
      {status.message && (
        <div className={`absolute inset-0 z-50 flex items-center justify-center p-6 text-white font-bold animate-in fade-in zoom-in duration-300 ${status.type === "error" ? "bg-red-600/95" : "bg-emerald-600/95"}`}>
          <div className="text-center">
            <p className="text-4xl mb-2">{status.type === "error" ? "⚠️" : "✨"}</p>
            <p className="text-lg">{status.message}</p>
          </div>
        </div>
      )}

      <h3 className="font-bold text-slate-800 text-base">{title}</h3>
      {!kioskScanning ? (
        <button onClick={() => setKioskScanning(true)} className="bg-[#1a3a8f] text-white px-6 py-3 rounded-xl hover:bg-[#122b6e] font-bold w-full text-sm transition duration-150 shadow-sm">
          📷 Open Kiosk Camera
        </button>
      ) : (
        <div className="space-y-4">
          <div id="kiosk-reader" className="w-full rounded-xl overflow-hidden border border-slate-200"></div>
          <button onClick={() => setKioskScanning(false)} className="text-sm text-red-600 hover:text-red-700 font-bold hover:underline transition">
            Close Camera
          </button>
        </div>
      )}
      {pendingClockIn && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4 text-left shadow-xl">
            <div>
              <h4 className="font-bold text-slate-800">Confirm instructor class</h4>
              <p className="text-xs text-slate-500 mt-1">Select the class {pendingClockIn.userData.displayName} is teaching today.</p>
            </div>
            <select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} className="w-full p-2.5 border rounded-lg bg-white text-sm">
              <option value="">Select class...</option>
              {pendingClockIn.classes.map(cls => <option key={cls.id} value={cls.id}>{cls.className} · {cls.startTime || "Time not set"}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => { setPendingClockIn(null); setSelectedClassId(""); }} className="flex-1 p-2.5 rounded-lg bg-slate-100 text-slate-700 font-bold">Cancel</button>
              <button onClick={createShift} disabled={!selectedClassId} className="flex-1 p-2.5 rounded-lg bg-[#1a3a8f] text-white font-bold disabled:opacity-50">Confirm Clock-In</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
