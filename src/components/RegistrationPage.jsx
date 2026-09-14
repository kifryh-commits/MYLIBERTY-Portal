import schoolLogo from "../assets/school-logo.webp";

// Your live "MY LIBERTY REGISTRATION FORM"
const GOOGLE_FORM_EMBED_URL = "https://docs.google.com/forms/d/e/1FAIpQLScYE1ZzBSa-qd4k_PVvFhZFyr8WIFzg3KCZlGrtAsaJXLe-dg/viewform?embedded=true";

export default function RegistrationPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <img src={schoolLogo} alt="My Liberty International English School" className="w-28 h-28 mb-3" />
      <h1 className="text-xl font-bold text-[#1a3a8f] mb-1 text-center">Student Registration</h1>
      <p className="text-gray-500 text-sm mb-6 text-center max-w-md">
        Fill out the form below to apply. Our team will review your application and get back to you.
      </p>

      <div className="w-full max-w-2xl bg-white rounded-2xl border shadow-sm overflow-hidden">
        <iframe
          src={GOOGLE_FORM_EMBED_URL}
          title="MY LIBERTY REGISTRATION FORM"
          width="100%"
          height="2700"
          className="block"
        >
          Loading form...
        </iframe>
      </div>

      <a href="/" className="text-xs text-gray-400 hover:underline mt-6">Staff login</a>
    </div>
  );
}
