import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import schoolLogo from "../assets/school-logo.webp";

export default function StaffSignup() {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(window.location.pathname.split("/").filter(Boolean).pop()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    gender: "male",
    phone: "",
    dob: "",
    educationLevel: "Universitas",
    password: ""
  });

  useEffect(() => {
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const inviteToken = pathParts[pathParts.length - 1];
    if (!inviteToken) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "invites", inviteToken));
        if (!snap.exists() || snap.data().used) {
          setError("This invitation link is invalid or has already been used.");
        } else {
          setInvite({ id: snap.id, ...snap.data() });
        }
      } catch (err) {
        setError("Error verifying invitation: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // 1. Create Auth Account
      const cred = await createUserWithEmailAndPassword(auth, invite.email, formData.password);
      const uid = cred.user.uid;

      // 👈 ADDED: Small delay to let Auth state "settle" across different browsers
      await new Promise(resolve => setTimeout(resolve, 800));

      // 2. Create User Profile in Firestore
      const userProfile = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        nickname: formData.nickname,
        gender: formData.gender,
        displayName: `${formData.firstName} ${formData.lastName}`.trim(),
        email: invite.email,
        role: invite.role,
        phone: formData.phone,
        dob: formData.dob,
        educationLevel: formData.educationLevel,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "users", uid), userProfile);

      // 3. Delete the invitation now that the account is created
      await deleteDoc(doc(db, "invites", invite.id));

      setSuccess(true);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("An account with this email already exists in our system. If you've already registered, please try logging in. If you were recently deleted and are trying to re-register, an administrator must manually clear your old account from the Firebase Console first.");
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500 animate-pulse font-bold">Verifying invitation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border shadow-sm max-w-md">
          <div className="text-red-500 text-4xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Invitation</h2>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <a href="/" className="bg-[#1a3a8f] text-white px-6 py-2 rounded-lg font-bold">Go to Login</a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border shadow-sm max-w-md">
          <div className="text-emerald-500 text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Account Created!</h2>
          <p className="text-gray-500 text-sm mb-6">Your profile has been set up successfully. You can now log in to the portal.</p>
          <a href="/" className="bg-[#1a3a8f] text-white px-6 py-2 rounded-lg font-bold w-full block">Log In Now</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <img src={schoolLogo} alt="School Logo" className="w-20 h-20 mb-4" />
      <h1 className="text-2xl font-bold text-[#1a3a8f] mb-1">Staff Registration</h1>
      <p className="text-gray-500 text-sm mb-8 text-center">
        Complete your profile to join the <span className="font-bold text-slate-700">{invite.role}</span> team.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-6 rounded-2xl border shadow-sm space-y-4">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <label className="block text-[10px] font-bold text-slate-400 uppercase">Registered Email</label>
          <p className="font-bold text-slate-700">{invite.email}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">First Name</label>
            <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Last Name</label>
            <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nickname</label>
            <input type="text" value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gender</label>
            <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm bg-white font-bold">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
          <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Birth</label>
            <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Education</label>
            <select value={formData.educationLevel} onChange={e => setFormData({...formData, educationLevel: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm bg-white font-bold">
              <option value="SMA/SMK">SMA/SMK</option>
              <option value="Universitas">Universitas</option>
              <option value="S2">S2 (Master)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Create Password</label>
          <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-2.5 border rounded-lg text-sm" minLength="6" required />
        </div>

        <button 
          type="submit" 
          disabled={submitting}
          className="w-full bg-[#1a3a8f] text-white p-3 rounded-xl font-bold hover:bg-[#122b6e] transition disabled:opacity-50"
        >
          {submitting ? "Creating Account..." : "Complete Registration"}
        </button>
      </form>
    </div>
  );
}
