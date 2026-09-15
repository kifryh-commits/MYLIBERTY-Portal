import { useState, useEffect, useCallback } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { useToast } from "./ui/useToast";

const CLASS_DAY_MAP = {
  "Mon/Wed": [1, 3],
  "Tue/Thu": [2, 4],
  "Sat/Sun": [0, 6],
};

export default function SelfClockInOut() {
  const toast = useToast();
  const [activeShift, setActiveShift] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid;

  const fetchStatus = useCallback(async () => {
    try {
      const [shiftSnap, classSnap] = await Promise.all([
        getDocs(query(collection(db, "shifts"), where("userId", "==", uid), where("clockOut", "==", null))),
        getDocs(query(collection(db, "classes"), where("instructorId", "==", uid))),
      ]);
      setActiveShift(shiftSnap.empty ? null : { id: shiftSnap.docs[0].id, ...shiftSnap.docs[0].data() });
      setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { (async () => { await fetchStatus(); })(); }, [fetchStatus]);

  const todayWeekday = new Date().getDay();
  const todayClasses = classes.filter(cls => CLASS_DAY_MAP[cls.classDay]?.includes(todayWeekday));
  const selectedClass = todayClasses.find(cls => cls.id === selectedClassId);

  const getTodayStart = (classRecord) => {
    if (!classRecord?.startTime) return null;
    const [hours, minutes] = classRecord.startTime.split(":").map(Number);
    const start = new Date();
    start.setHours(hours, minutes, 0, 0);
    return start;
  };

  const getPunctuality = (classRecord, clockIn) => {
    const scheduledStart = getTodayStart(classRecord);
    if (!scheduledStart) return { status: "Unscheduled", scheduledStart: null, requiredArrival: null, minutesEarlyOrLate: null };
    const requiredArrival = new Date(scheduledStart.getTime() - 15 * 60000);
    const differenceMinutes = Math.round((scheduledStart - clockIn) / 60000);
    return {
      status: clockIn <= requiredArrival ? "On time" : "Late",
      scheduledStart: scheduledStart.toISOString(),
      requiredArrival: requiredArrival.toISOString(),
      minutesEarlyOrLate: differenceMinutes,
    };
  };

  const handleToggle = async () => {
    try {
      if (activeShift) {
        await updateDoc(doc(db, "shifts", activeShift.id), { clockOut: new Date().toISOString() });
      } else {
        if (!selectedClass) return;
        const clockIn = new Date();
        const punctuality = getPunctuality(selectedClass, clockIn);
        await addDoc(collection(db, "shifts"), {
          userId: uid,
          role: "instructor",
          classId: selectedClass.id,
          className: selectedClass.className || "",
          clockIn: clockIn.toISOString(),
          clockOut: null,
          scheduledStart: punctuality.scheduledStart,
          requiredArrival: punctuality.requiredArrival,
          punctualityStatus: punctuality.status,
          minutesEarlyOrLate: punctuality.minutesEarlyOrLate,
        });
      }
      fetchStatus();
    } catch (err) {
      toast("Error: " + err.message, "error");
    }
  };

  if (loading) return null;

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm max-w-md mx-auto text-center space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1a3a8f]">Personal attendance</p>
        <h3 className="mt-1 font-black text-slate-800 text-base">Your Shift</h3>
      </div>
      {!activeShift && (
        <select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} className="min-h-12 w-full p-2.5 border rounded-xl bg-white text-sm" required>
          <option value="">Select today&apos;s class...</option>
          {todayClasses.map(cls => <option key={cls.id} value={cls.id}>{cls.className} · {cls.startTime || "Time not set"}</option>)}
        </select>
      )}
      {!activeShift && todayClasses.length === 0 && <p className="text-xs text-slate-400">No fixed class is scheduled for today.</p>}
      <p className={`rounded-full px-3 py-1.5 font-black uppercase text-[10px] ${activeShift ? "bg-emerald-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
        {activeShift ? `Clocked in since ${new Date(activeShift.clockIn).toLocaleTimeString()}` : "Not clocked in"}
      </p>
      {activeShift?.punctualityStatus && <p className={`text-xs font-bold ${activeShift.punctualityStatus === "On time" ? "text-green-700" : "text-amber-700"}`}>{activeShift.punctualityStatus} · {activeShift.className}</p>}
      <button
        onClick={handleToggle}
        disabled={!activeShift && !selectedClassId}
        className={`min-h-14 w-full rounded-2xl p-2 font-black text-base text-white shadow-sm active:scale-[0.98] ${activeShift ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
      >
        {activeShift ? "⏰ Clock Out" : "⏰ Clock In"}
      </button>
    </div>
  );
}
