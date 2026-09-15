import { useState, useEffect, useCallback } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { useToast } from "./ui/useToast";
import { useConfirm } from "./ui/useConfirm";

export default function TeachingMaterial() {
  const toast = useToast();
  const confirm = useConfirm();
  const [materials, setMaterials] = useState([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  const fetchMaterials = useCallback(async () => {
    try {
      const q = query(collection(db, "materials"), where("createdBy", "==", uid));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMaterials(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => { (async () => { await fetchMaterials(); })(); }, [fetchMaterials]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    try {
      await addDoc(collection(db, "materials"), {
        title: title.trim(),
        url: url.trim(),
        createdBy: uid,
        createdAt: new Date().toISOString(),
      });
      setTitle(""); setUrl("");
      fetchMaterials();
    } catch (err) {
      toast("Error: " + err.message, "error");
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Remove this material?"))) return;
    await deleteDoc(doc(db, "materials", id));
    fetchMaterials();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl mx-auto text-xs">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
        <h3 className="font-bold text-gray-700 text-sm mb-2">Add Teaching Material</h3>
        <form onSubmit={handleAdd} className="space-y-2">
          <input type="text" placeholder="Title (e.g. Unit 3 Worksheet)" value={title} onChange={e => setTitle(e.target.value)} className="min-h-12 w-full p-2.5 border rounded-xl" required />
          <input type="url" placeholder="Link (Google Drive, YouTube, etc.)" value={url} onChange={e => setUrl(e.target.value)} className="min-h-12 w-full p-2.5 border rounded-xl" required />
          <button type="submit" className="min-h-12 w-full bg-[#1a3a8f] text-white p-2 rounded-xl font-bold hover:bg-[#122b6e] active:scale-[0.98]">Add Material</button>
        </form>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-gray-700 text-sm mb-3">Your Materials</h3>
        {loading ? (
          <p className="text-gray-400 text-center py-4">Loading...</p>
        ) : materials.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No materials added yet.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {materials.map(m => (
              <div key={m.id} className="flex justify-between items-center gap-3 p-3 bg-gray-50 border rounded-xl">
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 font-semibold hover:underline truncate pr-2">
                  {m.title}
                </a>
                <button onClick={() => handleDelete(m.id)} className="min-h-10 rounded-lg px-2 text-red-600 hover:bg-rose-50 text-xs font-bold shrink-0">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
