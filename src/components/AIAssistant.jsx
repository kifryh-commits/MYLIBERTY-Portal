import { useState } from "react";
import { useToast } from "./ui/useToast";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-flash-latest";

const MODES = {
  draft: {
    label: "Draft a Message",
    placeholder: "e.g. Tell parents that Saturday's class is moved to 10am due to a holiday",
    instruction: "Write a polite, clear message based on the following request. Keep it concise and appropriate to send directly to parents or staff at a small English course business:",
  },
  summarize: {
    label: "Summarize Notes",
    placeholder: "Paste rough notes, evaluation comments, or meeting notes here",
    instruction: "Summarize the following notes into a few clear, well-organized bullet points:",
  },
};

export default function AIAssistant() {
  const toast = useToast();
  const [mode, setMode] = useState("draft");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setOutput("");

    try {
      if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your .env file.");
      }
      const prompt = `${MODES[mode].instruction}\n\n${input}`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Request failed");
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      setOutput(text || "No response text returned — try rephrasing your request.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    toast("Copied to clipboard!");
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto text-sm space-y-4">
      <h3 className="font-bold text-slate-800 text-base">✨ AI Assistant</h3>

      <div className="flex gap-2 select-none">
        {Object.entries(MODES).map(([key, m]) => (
          <button
            key={key}
            onClick={() => { setMode(key); setOutput(""); setError(""); }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition duration-150 ${
              mode === key ? "bg-[#1a3a8f] text-white shadow-sm" : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleGenerate} className="space-y-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={MODES[mode].placeholder}
          rows={4}
          className="w-full p-3 border border-slate-200 rounded-xl text-sm"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1a3a8f] text-white p-3 rounded-xl font-bold hover:bg-[#122b6e] transition duration-150 disabled:opacity-50"
        >
          {loading ? "⏳ Generating with AI..." : "Generate Content"}
        </button>
      </form>

      {error && (
        <p className="text-red-600 font-semibold text-xs">Error: {error}</p>
      )}

      {output && (
        <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3 transition">
          <p className="whitespace-pre-wrap text-slate-700 text-sm leading-relaxed">{output}</p>
          <button
            onClick={handleCopy}
            className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-300 text-xs transition duration-150"
          >
            📋 Copy Output
          </button>
        </div>
      )}
    </div>
  );
}
