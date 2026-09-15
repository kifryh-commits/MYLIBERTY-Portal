import { useState } from "react";
import { auth, db } from "../firebase";
import { addDoc, collection } from "firebase/firestore";

const LEVELS = ["warrior", "elite", "master", "grandmaster", "epic"];
const SCORE_FIELDS = [
  ["pronunciation", "Pronunciation"],
  ["fluency", "Fluency"],
  ["vocabulary", "Vocabulary"],
  ["comprehension", "Comprehension"],
];

export default function StudentProgressForm({ classes, students }) {
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10));
  const [level, setLevel] = useState("warrior");
  const [scores, setScores] = useState({ pronunciation: "", fluency: "", vocabulary: "", comprehension: "" });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const selectedClass = classes.find(cls => cls.id === classId);
  const classStudents = students.filter(student => (selectedClass?.studentIds || []).includes(student.id));
  const selectedStudent = classStudents.find(student => student.id === studentId);
  const numericScores = SCORE_FIELDS.map(([field]) => Number(scores[field])).filter(score => Number.isFinite(score));
  const overallScore = numericScores.length === SCORE_FIELDS.length
    ? Math.round(numericScores.reduce((total, score) => total + score, 0) / SCORE_FIELDS.length)
    : null;

  const handleClassChange = (event) => {
    setClassId(event.target.value);
    setStudentId("");
  };

  const handleScoreChange = (field, value) => {
    if (value === "" || (Number(value) >= 10 && Number(value) <= 100)) {
      setScores(current => ({ ...current, [field]: value }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedClass || !selectedStudent || numericScores.length !== SCORE_FIELDS.length) return;

    setSaving(true);
    setMessage("");
    try {
      const instructor = auth.currentUser;
      await addDoc(collection(db, "progressReports"), {
        studentId: selectedStudent.id,
        studentName: selectedStudent.displayName || "",
        classId: selectedClass.id,
        className: selectedClass.className || "",
        instructorId: instructor?.uid || "",
        instructorName: instructor?.displayName || instructor?.email || "",
        examDate,
        level,
        pronunciationScore: Number(scores.pronunciation),
        fluencyScore: Number(scores.fluency),
        vocabularyScore: Number(scores.vocabulary),
        comprehensionScore: Number(scores.comprehension),
        overallScore,
        notes: notes.trim(),
        submittedAt: new Date().toISOString(),
      });
      setScores({ pronunciation: "", fluency: "", vocabulary: "", comprehension: "" });
      setNotes("");
      setMessage("Progress report saved successfully.");
    } catch (error) {
      setMessage(`Unable to save report: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 max-w-3xl mx-auto space-y-5 text-sm">
      <div>
        <h3 className="font-bold text-slate-800 text-base">Student Progress</h3>
        <p className="text-slate-500 text-xs mt-1">Record the latest assessment for one student in your assigned class.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            Class
            <select value={classId} onChange={handleClassChange} className="min-h-12 w-full mt-1 p-2.5 border rounded-xl bg-white text-sm" required>
              <option value="">Select class...</option>
              {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.className}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            Student ID and name
            <select value={studentId} onChange={event => setStudentId(event.target.value)} className="min-h-12 w-full mt-1 p-2.5 border rounded-xl bg-white text-sm" disabled={!classId} required>
              <option value="">Select student...</option>
              {classStudents.map(student => <option key={student.id} value={student.id}>{student.id} - {student.displayName}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            Date of assessment
            <input type="date" value={examDate} onChange={event => setExamDate(event.target.value)} className="min-h-12 w-full mt-1 p-2.5 border rounded-xl bg-white text-sm" required />
          </label>
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            Course level
            <select value={level} onChange={event => setLevel(event.target.value)} className="min-h-12 w-full mt-1 p-2.5 border rounded-xl bg-white text-sm capitalize">
              {LEVELS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SCORE_FIELDS.map(([field, label]) => (
            <label key={field} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-[10px] font-bold text-slate-500 uppercase">
              {label} <span className="text-slate-400">(10-100)</span>
              <input type="number" min="10" max="100" inputMode="numeric" value={scores[field]} onChange={event => handleScoreChange(field, event.target.value)} className="min-h-12 w-full mt-1 p-2.5 border rounded-xl bg-white text-base" required />
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between bg-slate-50 border rounded-lg px-3 py-2">
          <span className="text-xs font-bold text-slate-600">Overall score</span>
          <span className="text-lg font-black text-[#1a3a8f]">{overallScore ?? "-"}</span>
        </div>

        <label className="text-[10px] font-bold text-slate-500 uppercase block">
          Instructor notes
          <textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Add strengths, areas to improve, or follow-up notes..." className="w-full mt-1 p-2.5 border rounded-xl text-base min-h-28" />
        </label>

        {message && <p className={`text-xs font-semibold ${message.startsWith("Unable") ? "text-red-600" : "text-green-600"}`}>{message}</p>}
        <button type="submit" disabled={saving || !classId || !studentId} className="min-h-14 w-full bg-[#1a3a8f] text-white p-3 rounded-2xl font-black hover:bg-[#122b6e] active:scale-[0.98] disabled:opacity-50">
          {saving ? "Saving report..." : "Save Progress Report"}
        </button>
      </form>
    </div>
  );
}
