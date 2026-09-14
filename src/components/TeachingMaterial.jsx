import { useState, useEffect, useCallback } from "react";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";

export default function TeachingMaterial() {
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
      alert("Error: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this material?")) return;
    await deleteDoc(doc(db, "materials", id));
    fetchMaterials();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl mx-auto text-xs">
      <div className="bg-white p-4 rounded-xl border space-y-2">
        <h3 className="font-bold text-gray-700 text-sm mb-2">Add Teaching Material</h3>
        <form onSubmit={handleAdd} className="space-y-2">
          <input type="text" placeholder="Title (e.g. Unit 3 Worksheet)" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded" required />
          <input type="url" placeholder="Link (Google Drive, YouTube, etc.)" value={url} onChange={e => setUrl(e.target.value)} className="w-full p-2 border rounded" required />
          <button type="submit" className="w-full bg-red-600 text-white p-2 rounded-lg font-bold hover:bg-red-700">Add Material</button>
        </form>
      </div>

      <div className="bg-white p-4 rounded-xl border">
        <h3 className="font-bold text-gray-700 text-sm mb-3">Your Materials</h3>
        {loading ? (
          <p className="text-gray-400 text-center py-4">Loading...</p>
        ) : materials.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No materials added yet.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {materials.map(m => (
              <div key={m.id} className="flex justify-between items-center p-2.5 bg-gray-50 border rounded">
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 font-semibold hover:underline truncate pr-2">
                  {m.title}
                </a>
                <button onClick={() => handleDelete(m.id)} className="text-red-500 hover:underline text-[10px] shrink-0">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
