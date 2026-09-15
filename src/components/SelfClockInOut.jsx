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
    <div className="bg-white p-4 rounded-xl border max-w-md mx-auto text-center space-y-2">
      <h3 className="font-bold text-gray-700 text-sm">Your Shift</h3>
      {!activeShift && (
        <select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} className="w-full p-2 border rounded-lg bg-white text-xs" required>
          <option value="">Select today&apos;s class...</option>
          {todayClasses.map(cls => <option key={cls.id} value={cls.id}>{cls.className} · {cls.startTime || "Time not set"}</option>)}
        </select>
      )}
      {!activeShift && todayClasses.length === 0 && <p className="text-xs text-slate-400">No fixed class is scheduled for today.</p>}
      <p className={`font-bold uppercase text-[10px] ${activeShift ? "text-green-700" : "text-gray-400"}`}>
        {activeShift ? `Clocked in since ${new Date(activeShift.clockIn).toLocaleTimeString()}` : "Not clocked in"}
      </p>
      {activeShift?.punctualityStatus && <p className={`text-xs font-bold ${activeShift.punctualityStatus === "On time" ? "text-green-700" : "text-amber-700"}`}>{activeShift.punctualityStatus} · {activeShift.className}</p>}
      <button
        onClick={handleToggle}
        disabled={!activeShift && !selectedClassId}
        className={`w-full p-2 rounded-lg font-bold text-white ${activeShift ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
      >
        {activeShift ? "⏰ Clock Out" : "⏰ Clock In"}
      </button>
    </div>
  );
}
