import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, doc, updateDoc, onSnapshot } from "firebase/firestore";
import SelfClockInOut from "./SelfClockInOut";
import { useToast } from "./ui/useToast";

export default function OfficeBoyDashboard() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We look for tasks specifically tagged for "officeboy" or "all"
    const q = query(collection(db, "todos"), where("assignee", "in", ["officeboy", "all"]));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const taskList = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).filter(t => !t.completed); // Only show active tasks
      
      setTasks(taskList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleComplete = async (taskId) => {
    try {
      await updateDoc(doc(db, "todos", taskId), {
        completed: true,
        completedAt: new Date().toISOString()
      });
    } catch (err) {
      toast("Error completing task: " + err.message, "error");
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800">My Tasks</h2>
        <p className="text-xs text-slate-500 mt-1">Tap a task when you have finished it.</p>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-10 animate-pulse">Checking tasks...</p>
      ) : tasks.length === 0 ? (
        <div className="bg-slate-50 p-10 rounded-2xl border border-dashed border-slate-300 text-center">
          <p className="text-3xl mb-2">✨</p>
          <p className="text-sm font-bold text-slate-500">All caught up! No tasks right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <button
              key={task.id}
              onClick={() => handleComplete(task.id)}
              className="w-full bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group active:scale-95 transition"
            >
              <div className="text-left">
                <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded mb-2 inline-block">
                  {task.type || "TASK"}
                </span>
                <p className="font-bold text-slate-800 text-lg">{task.text}</p>
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-[#1a3a8f] group-hover:bg-indigo-50 transition">
                <span className="text-transparent group-hover:text-[#1a3a8f] text-xs">✓</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-6">
        <p className="text-[10px] font-bold text-blue-700 uppercase mb-3 text-center">Office Boy Attendance</p>
        <SelfClockInOut />
      </div>
    </div>
  );
}
