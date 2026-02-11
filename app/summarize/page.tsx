"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

type SummaryMode = "quick" | "exam" | "deep";
type SummaryFormat = "bullets" | "paragraph" | "flashcards";

interface SummarizeResponse {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  quizQuestions: string[];
  xpReward: number;
  remaining: number | null;
  error?: string;
}

export default function Summarize() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SummaryMode>("quick");
  const [format, setFormat] = useState<SummaryFormat>("bullets");

  const [summary, setSummary] = useState<string>("");
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<string[]>([]);
  const [xpReward, setXpReward] = useState<number>(0);
  const [remaining, setRemaining] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const estimatedReadMinutes = useMemo(() => {
    if (!summary) return 0;
    const words = summary.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 180));
  }, [summary]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Upload a PDF first.");
      return;
    }

    if (!supabase) {
      setError("App is not configured. Missing Supabase environment variables.");
      return;
    }

    setLoading(true);
    setError("");
    setSummary("");
    setKeyPoints([]);
    setActionItems([]);
    setQuizQuestions([]);
    setXpReward(0);
    setCopied(false);

    try {
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      if (!userData?.user || !sessionData?.session?.access_token) {
        router.replace("/login");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      formData.append("format", format);

      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: formData,
      });

      const data = (await res.json()) as SummarizeResponse;
      if (!res.ok) throw new Error(data.error || "Failed to summarize PDF");

      setSummary(data.summary || "");
      setKeyPoints(data.keyPoints || []);
      setActionItems(data.actionItems || []);
      setQuizQuestions(data.quizQuestions || []);
      setXpReward(data.xpReward || 0);
      setRemaining(data.remaining ?? null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    const full = [
      "Summary",
      summary,
      "",
      "Key Points",
      ...keyPoints.map((k) => `- ${k}`),
      "",
      "Action Items",
      ...actionItems.map((a) => `- ${a}`),
      "",
      "Quiz Questions",
      ...quizQuestions.map((q) => `- ${q}`),
    ].join("\n");

    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-100 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <section className="rounded-2xl bg-slate-900 text-white p-6 md:p-8 shadow-xl">
          <h1 className="text-3xl font-bold">📄 Smart PDF Summarizer</h1>
          <p className="text-slate-300 mt-2">
            Turn lecture slides into study-ready summaries, key points, action tasks, and quiz prompts.
          </p>
        </section>

        <section className="bg-white rounded-2xl border border-violet-100 shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Upload PDF</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="border p-2 rounded-lg w-full"
            />
            {file && <p className="text-xs text-slate-500 mt-2">Selected: {file.name}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Summary mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as SummaryMode)}
                className="w-full border rounded-lg p-2"
              >
                <option value="quick">Quick review</option>
                <option value="exam">Exam prep</option>
                <option value="deep">Deep understanding</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Output format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as SummaryFormat)}
                className="w-full border rounded-lg p-2"
              >
                <option value="bullets">Bullet points</option>
                <option value="paragraph">Concise paragraphs</option>
                <option value="flashcards">Flashcard style</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition disabled:opacity-60"
          >
            {loading ? "Summarizing..." : "Generate Study Summary"}
          </button>

          {remaining !== null && <p className="text-xs text-slate-500">Free AI uses remaining: {remaining}</p>}
          {error && <p className="text-red-600">{error}</p>}
        </section>

        {summary && (
          <section className="bg-white rounded-2xl shadow border border-violet-100 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-violet-900">Your Study Pack</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">+{xpReward} XP earned</span>
                <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800">~{estimatedReadMinutes} min read</span>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1 rounded-full bg-slate-900 text-white hover:bg-black transition"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Summary</h3>
              <p className="text-slate-700 whitespace-pre-wrap">{summary}</p>
            </div>

            {keyPoints.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Key Points</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  {keyPoints.map((point, index) => (
                    <li key={`${point}-${index}`}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {actionItems.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Action Items</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  {actionItems.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {quizQuestions.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Quiz Yourself</h3>
                <ul className="list-decimal pl-5 space-y-1 text-slate-700">
                  {quizQuestions.map((q, index) => (
                    <li key={`${q}-${index}`}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
