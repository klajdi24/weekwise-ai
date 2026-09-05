"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";
import { extractAiError, isPlanLimitError, type AiClientErrorPayload } from "@/lib/ai/client";
import Mascot from "../components/mascot";

type NotesMode = "summarize" | "quiz";

interface NotesResponse {
  summary: string;
  bullets: string[];
  quizQuestions: string[];
  keyTerms: string[];
  xpReward: number;
  remaining: number | null;
  error?: string;
}

export default function Notes() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [module, setModule] = useState("General");
  const [mode, setMode] = useState<NotesMode>("summarize");
  const [inputText, setInputText] = useState("");

  const [result, setResult] = useState<NotesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateNotes = async () => {
    if (!inputText.trim()) {
      setError("Paste your notes first.");
      return;
    }

    if (!supabase) {
      setError("App is not configured. Missing Supabase environment variables.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { user, accessToken } = await getClientAuth(supabase);

      if (!user || !accessToken) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/ai/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          text: inputText,
          module,
          mode,
        }),
      });

      const data = (await res.json()) as NotesResponse & AiClientErrorPayload;
      if (!res.ok) {
        const message = extractAiError(data, "Failed to generate notes");
        throw new Error(isPlanLimitError(data) ? `${message} Upgrade in Pricing to continue.` : message);
      }
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate notes";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-surface p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6 app-layer">
        <Mascot mood={result ? "celebrate" : "happy"} message="Drop your lecture notes and I’ll turn them into revision fuel." />

        <section className="hero-panel p-6 md:p-8">
          <p className="eyebrow text-violet-300">Notes</p>
          <h1 className="page-title mt-2">Lecture notes studio</h1>
          <p className="text-[var(--muted)] mt-3">Turn raw class notes into summary bullets, key terms, and quiz-ready revision prompts.</p>
        </section>

        <section className="card-bubbly rounded-2xl border border-violet-400/30 shadow p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">Module</label>
              <input value={module} onChange={(e) => setModule(e.target.value)} className="w-full input-polish p-2 rounded-lg" placeholder="e.g. Economics 201" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as NotesMode)} className="w-full input-polish p-2 rounded-lg">
                <option value="summarize">Summarize</option>
                <option value="quiz">Quiz me (5 questions)</option>
              </select>
            </div>
          </div>

          <textarea
            placeholder="Paste lecture notes, reading notes, or tutorial notes here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full input-polish p-4 rounded-lg h-56 resize-none"
          />

          <button
            onClick={generateNotes}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Generating..." : mode === "quiz" ? "Generate Quiz Pack" : "Generate Study Notes"}
          </button>

          {error && <p className="text-rose-300">{error}</p>}
        </section>

        {result && (
          <section className="bg-white/[0.05] backdrop-blur-xl rounded-2xl card-hover shadow border border-violet-400/30 p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <h2 className="text-2xl font-bold text-violet-200">Your Study Output</h2>
              <div className="flex gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-200 font-semibold">+{result.xpReward} XP</span>
                {result.remaining !== null && <span className="px-3 py-1 rounded-full bg-white/10 text-[var(--foreground)]">Free AI left: {result.remaining}</span>}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Summary</h3>
              <p className="text-[var(--foreground)] whitespace-pre-wrap">{result.summary}</p>
            </div>

            {result.bullets.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Key Bullets</h3>
                <ul className="list-disc pl-5 text-[var(--foreground)] space-y-1">
                  {result.bullets.map((line, idx) => (
                    <li key={`${line}-${idx}`}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.keyTerms.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Key Terms</h3>
                <div className="flex flex-wrap gap-2">
                  {result.keyTerms.map((term, idx) => (
                    <span key={`${term}-${idx}`} className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-400/30 text-violet-200 text-sm">{term}</span>
                  ))}
                </div>
              </div>
            )}

            {result.quizQuestions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Quiz Me</h3>
                <ol className="list-decimal pl-5 text-[var(--foreground)] space-y-1">
                  {result.quizQuestions.map((q, idx) => (
                    <li key={`${q}-${idx}`}>{q}</li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
