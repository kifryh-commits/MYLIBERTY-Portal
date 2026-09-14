import { useState } from "react";
import { auth } from "../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import schoolLogo from "../assets/school-logo.webp";

export default function LoginPage({ onLogin, loading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Forgot Password States
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState({ text: "", type: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage({ text: "", type: "" });
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage({ text: "Success! Check your email for a reset link.", type: "success" });
      setTimeout(() => {
        setShowResetModal(false);
        setResetMessage({ text: "", type: "" });
        setResetEmail("");
      }, 3000);
    } catch (err) {
      setResetMessage({ text: "Error: " + err.message, type: "error" });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f0f2f5] font-sans relative">
      {/* 👈 Forgot Password Modal Overlay */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm p-8 rounded-2xl shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-2">Reset Password</h3>
            <p className="text-slate-500 text-xs mb-6 font-medium leading-relaxed">
              Enter your registered email address and we'll send you a secure link to reset your password.
            </p>
            
            {resetMessage.text && (
              <div className={`p-3 rounded-lg text-xs font-bold mb-4 ${resetMessage.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
                {resetMessage.text}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input 
                type="email" 
                placeholder="teacher@myliberty.com" 
                value={resetEmail} 
                onChange={e => setResetEmail(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#1a3a8f] transition"
                required 
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowResetModal(false)} className="flex-1 p-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition text-xs">Cancel</button>
                <button type="submit" disabled={resetLoading} className="flex-[2] bg-[#1a3a8f] text-white p-3 rounded-xl font-bold hover:bg-[#122b6e] transition text-xs shadow-md disabled:opacity-50">
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Left Panel: Brand Gradient (Visible on MD screens and up) */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#0c235f] via-[#122b6e] to-[#1a3a8f] items-center justify-center p-12 shadow-inner relative overflow-hidden">
        {/* Decorative background blur circles for a modern look */}
        <div className="absolute w-[500px] h-[500px] bg-white/5 rounded-full -top-40 -left-40 blur-2xl"></div>
        <div className="absolute w-[400px] h-[400px] bg-white/5 rounded-full -bottom-20 -right-20 blur-2xl"></div>

        <div className="text-center space-y-6 z-10 max-w-sm">
          <img 
            src={schoolLogo} 
            alt="My Liberty International English School" 
            className="w-64 h-64 mx-auto drop-shadow-2xl animate-fade-in" 
          />
          <div className="space-y-2 select-none">
            <h1 className="text-white font-extrabold text-2xl tracking-wide">My Liberty</h1>
            <p className="text-indigo-100/90 text-sm font-medium leading-relaxed">
              Staff, Teacher & Admin Workspace Portal
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel: Clean Floating Login Card */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-150 space-y-6 transition">
          
          {/* Logo shows here instead on small/mobile screens */}
          <div className="text-center md:hidden space-y-3">
            <img 
              src={schoolLogo} 
              alt="My Liberty International English School" 
              className="w-24 h-24 mx-auto drop-shadow-md" 
            />
            <h1 className="text-xl font-bold text-slate-800">My Liberty Portal</h1>
          </div>

          <div className="space-y-1.5 hidden md:block select-none">
            <h2 className="text-2xl font-extrabold text-slate-800">Welcome Back</h2>
            <p className="text-slate-400 text-sm font-medium">Please enter your credentials to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                placeholder="teacher@myliberty.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none transition font-medium" 
                required 
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none transition font-medium" 
                required 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#1a3a8f] text-white p-3.5 rounded-xl font-bold hover:bg-[#122b6e] transition duration-150 shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-50 text-sm select-none"
            >
              {loading ? "⏳ Authenticating..." : "Sign In to Dashboard"}
            </button>
          </form>

          <div className="text-center pt-2">
            <button 
              onClick={() => setShowResetModal(true)}
              className="text-xs text-[#1a3a8f] font-bold hover:underline select-none"
            >
              Forgot password? Click here to reset.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
