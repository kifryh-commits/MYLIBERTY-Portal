import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { uploadToCloudinary } from "../utils/cloudinaryUpload";

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

export default function ProfilePanel({ onClose, onUpdated }) {
  const uid = auth.currentUser?.uid;
  const email = auth.currentUser?.email;

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setName(data.displayName || "");
        setPhone(data.phone || "");
        setDob(data.dob || "");
      }
    })();
  }, [uid]);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      await updateDoc(doc(db, "users", uid), { photoURL: url });
      setProfile(p => ({ ...p, photoURL: url }));
      onUpdated?.();
    } catch (err) {
      alert("Photo upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", uid), { displayName: name, phone, dob });
      onUpdated?.();
      onClose();
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  if (!profile) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 text-xs space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-800 text-sm">My Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          {profile.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="w-20 h-20 rounded-full object-cover border" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#1a3a8f] text-white flex items-center justify-center font-bold text-xl">
              {getInitials(name)}
            </div>
          )}
          <label className="text-indigo-700 font-semibold cursor-pointer hover:underline">
            {uploading ? "Uploading..." : "Change Photo"}
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={uploading} />
          </label>
        </div>

        {/* Editable fields */}
        <form onSubmit={handleSave} className="space-y-2">
          <div>
            <label className="block text-[9px] font-bold text-gray-500 uppercase">Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded" required />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-500 uppercase">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-500 uppercase">Date of Birth</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} className="w-full p-2 border rounded" />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-gray-500 uppercase">Email (contact admin to change)</label>
            <input type="email" value={email} disabled className="w-full p-2 border rounded bg-gray-100 text-gray-400" />
          </div>
          <button type="submit" disabled={saving} className="w-full bg-red-600 text-white p-2 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>

        <hr className="border-gray-100" />

        {resetSent ? (
          <p className="text-green-700 font-semibold text-center">✅ Reset link sent to {email}</p>
        ) : (
          <button onClick={handlePasswordReset} className="w-full bg-gray-100 text-gray-700 p-2 rounded-lg font-semibold border hover:bg-gray-200">
            🔒 Send Password Reset Email
          </button>
        )}
      </div>
    </div>
  );
}
