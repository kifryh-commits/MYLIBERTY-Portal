import { useState, useRef } from "react";
import { useToast } from "./ui/useToast";

export default function ClassPhotoShare() {
  const toast = useToast();
  const [photo, setPhoto] = useState(null); // { file, previewUrl }
  const fileInputRef = useRef(null);

  const handleCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto({ file, previewUrl: URL.createObjectURL(file) });
  };

  const handleShare = async () => {
    if (!photo) return;
    // navigator.share with files only works on supporting mobile
    // browsers (Chrome/Safari on Android/iOS) served over HTTPS.
    if (navigator.canShare && navigator.canShare({ files: [photo.file] })) {
      try {
        await navigator.share({
          files: [photo.file],
          title: "Class Photo",
          text: "Today's class photo 📸",
        });
      } catch (err) {
        if (err.name !== "AbortError") toast("Share failed: " + err.message, "error");
      }
    } else {
      toast("Sharing directly isn't supported on this device/browser. Try this on a phone, or use the download button below and send it manually via WhatsApp.", "error");
    }
  };

  const handleReset = () => {
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="bg-white p-4 rounded-xl border max-w-md mx-auto text-center space-y-3">
      <h3 className="font-bold text-gray-800 text-sm">Class Photo</h3>
      <p className="text-gray-400 text-[10px]">Take a photo, then share it straight to WhatsApp — pick the parent or class group from your phone's share menu.</p>

      {!photo ? (
        <label className="block bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-bold w-full text-xs cursor-pointer">
          📷 Take Photo
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            className="hidden"
          />
        </label>
      ) : (
        <div className="space-y-3">
          <img src={photo.previewUrl} alt="Class" className="w-full rounded-lg border max-h-64 object-cover" />
          <button onClick={handleShare} className="w-full bg-green-600 text-white p-2.5 rounded-lg font-bold hover:bg-green-700 text-xs">
            📲 Share via WhatsApp
          </button>
          <a
            href={photo.previewUrl}
            download="class-photo.jpg"
            className="block w-full bg-gray-100 text-gray-700 p-2 rounded-lg font-semibold text-[10px] border"
          >
            ⬇️ Download instead
          </a>
          <button onClick={handleReset} className="text-red-600 hover:underline text-[10px]">Retake Photo</button>
        </div>
      )}
    </div>
  );
}
