import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import ProfilePanel from "./components/ProfilePanel";
import LoginPage from "./components/LoginPage";
import RegistrationPage from "./components/RegistrationPage";
import { useToast } from "./components/ui/useToast";

// Import your role dashboard files!
import AdminDashboard from "./components/AdminDashboard";
import FrontOfficeDashboard from "./components/FrontOfficeDashboard";
import ManagerDashboard from "./components/ManagerDashboard";
import InstructorDashboard from "./components/InstructorDashboard";
import StaffDashboard from "./components/StaffDashboard";
import StaffSignup from "./components/StaffSignup";
import OfficeBoyDashboard from "./components/OfficeBoyDashboard";

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

// ── IDLE TIMEOUT CONFIG ──
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME = 30 * 1000;      // 30 seconds

function App() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState(""); 
  const [photoURL, setPhotoURL] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false); // 👈 Added state for idle warning

  useEffect(() => {
    if (!user) return;

    let warningTimer;
    let logoutTimer;

    const resetTimers = () => {
      setIdleWarning(false);
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      
      warningTimer = setTimeout(() => setIdleWarning(true), IDLE_TIMEOUT - WARNING_TIME);
      logoutTimer = setTimeout(() => {
        signOut(auth).then(() => {
          setUser(null);
          setIdleWarning(false);
        });
      }, IDLE_TIMEOUT);
    };

    // Events to watch for activity
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach(e => document.addEventListener(e, resetTimers));
    
    resetTimers(); // Initial start

    return () => {
      events.forEach(e => document.removeEventListener(e, resetTimers));
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
    };
  }, [user]);

  const refreshProfile = async (uid) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      setRole(data.role || "student");
      setDisplayName(data.displayName || "");
      setNickname(data.nickname || data.displayName || ""); 
      setPhotoURL(data.photoURL || "");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          await refreshProfile(currentUser.uid);
          setUser(currentUser);
        } catch (err) {
          console.error(err);
        }
      } else {
        setUser(null);
        setRole("");
        setNickname("");
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Public route — no login required.
  if (window.location.pathname === "/register") {
    return <RegistrationPage />;
  }

  // 👈 New Public route for staff invitation links
  if (window.location.pathname.startsWith("/join/")) {
    return <StaffSignup />;
  }

  // 👈 3. Re-engineered to receive inputs from LoginPage
  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) { 
      toast("Login Error: " + err.message, "error"); 
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  // 👈 4. Render your beautiful, dedicated LoginPage
  if (!user) {
    return <LoginPage onLogin={handleLogin} loading={loading} />;
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white p-4 md:p-6 shadow-sm">
        {/* Top Navigation Bar */}
        <div className="flex justify-between items-center max-w-[1800px] mx-auto gap-2">
          <button onClick={() => setProfileOpen(true)} className="flex items-center gap-3 text-left group min-w-0 flex-1">
            {photoURL ? (
              <img src={photoURL} alt="Profile" className="w-10 h-10 rounded-full object-cover border group-hover:ring-2 ring-[#1a3a8f] shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1a3a8f] text-white flex items-center justify-center font-bold text-sm group-hover:ring-2 ring-offset-1 ring-[#1a3a8f] shrink-0">
                {getInitials(nickname || displayName)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-gray-800 text-sm truncate">{nickname || displayName || user.email}</h3>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded uppercase">{role}</span>
            </div>
          </button>
          <button onClick={() => signOut(auth).then(() => setUser(null))} className="text-xs text-[#1a3a8f] hover:underline font-bold shrink-0">Logout</button>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-[1800px] mx-auto">
        {/* Dynamic Role Router Switcher */}
        {role === "admin" && <AdminDashboard />}
        {role === "manager" && <ManagerDashboard />}
        {role === "instructor" && <InstructorDashboard />}
        {role === "frontoffice" && <FrontOfficeDashboard />}
        {role === "marketing" && <StaffDashboard />}
        {role === "officeboy" && <OfficeBoyDashboard />}
        {!["admin", "manager", "instructor", "marketing", "frontoffice", "officeboy"].includes(role) && (
          <div className="bg-white p-6 rounded-xl border text-center text-gray-500 text-sm max-w-md mx-auto">
            This account doesn't have dashboard access. Please contact your administrator.
          </div>
        )}
      </div>

      {profileOpen && (
        <ProfilePanel
          onClose={() => setProfileOpen(false)}
          onUpdated={() => refreshProfile(user.uid)}
        />
      )}

      {/* 👈 Idle Warning Overlay */}
      {idleWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0c235f]/80 backdrop-blur-md p-6">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border-2 border-amber-400 animate-pulse">
            <p className="text-4xl mb-4">💤</p>
            <h2 className="text-xl font-black text-slate-800">Are you still there?</h2>
            <p className="text-slate-500 text-sm mt-2 mb-6 font-medium">You've been idle for a while. For security, you will be logged out in 30 seconds.</p>
            <button 
              onClick={() => { setIdleWarning(false); window.dispatchEvent(new Event("mousedown")); }} 
              className="w-full bg-[#1a3a8f] text-white p-3.5 rounded-xl font-bold hover:bg-[#122b6e] transition shadow-lg"
            >
              Yes, I'm still working!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
