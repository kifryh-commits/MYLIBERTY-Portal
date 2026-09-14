/**
 * BadgeModal.jsx
 * Student / Staff ID badge print modal — extracted from AdminDashboard for maintainability.
 * Displays a printable ID card with a locally-generated QR code.
 */

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function BadgeModal({ person, onClose }) {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    QRCode.toDataURL(person.id, { width: 240, margin: 1 })
      .then(url => { if (!cancelled) setQrUrl(url); })
      .catch(err => console.error("QR generation failed:", err));
    return () => { cancelled = true; };
  }, [person]);

  if (!person) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-2xl shadow-xl max-w-xs w-full text-center border relative">
        <div className="border-2 border-indigo-600 p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-white text-xs space-y-3">
          <h4 className="font-black text-indigo-900 text-sm tracking-wider uppercase">
            {person.role === "student" ? "Student ID Badge" : "Staff ID Badge"}
          </h4>
          <div className="flex justify-center bg-white p-1.5 rounded-lg inline-block mx-auto border shadow-sm">
            {qrUrl && <img src={qrUrl} alt="QR Code" className="w-24 h-24" />}
          </div>
          <div>
            <p className="font-extrabold text-slate-800 text-sm uppercase">{person.displayName}</p>
            <p className="text-slate-500 font-semibold">{person.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-600 pt-2 border-t border-indigo-100">
            <p className="text-left font-bold">DOB: <span className="font-normal">{person.dob || "N/A"}</span></p>
            <p className="text-right font-bold">Edu: <span className="font-normal">{person.educationLevel || "N/A"}</span></p>
          </div>
        </div>
        <div className="flex gap-2 mt-4 text-sm">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-indigo-600 text-white p-2.5 rounded-xl font-bold hover:bg-indigo-700"
          >
            🖨️ Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-200 text-slate-700 p-2.5 rounded-xl font-bold hover:bg-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
