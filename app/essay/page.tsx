"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { extractAiError, isPlanLimitError, type AiClientErrorPayload } from "@/lib/ai/client";

type EssayTone = "academic" | "clear" | "persuasive";
type EssayType = "outline" | "draft" | "improve";

interface EssayResponse {
  title: string;
  thesis: string;
  output: string;
  checklist: string[];
  referencesNeeded: string[];
  xpReward: number;
  remaining: number | null;
  error?: string;
}

export default function EssayPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [essayType, setEssayType] = useState<EssayType>("outline");
  const [tone, setTone] = useState<EssayTone>("academic");
  const [wordCount, setWordCount] = useState(900);

  const [result, setResult] = useState<EssayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generateEssay = async () => {
    if (!prompt.trim()) {
      setError("Enter your essay brief first.");
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
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      if (!userData?.user || !sessionData?.session?.access_token) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/ai/essay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          context: context.trim(),
          essayType,
          tone,
          wordCount,
        }),
      });

      const data = (await res.json()) as EssayResponse & AiClientErrorPayload;
      if (!res.ok) {
        const message = extractAiError(data, "Failed to generate essay output");
        throw new Error(isPlanLimitError(data) ? `${message} Upgrade in Pricing to continue.` : message);
      }
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate essay output");
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    const text = [
      result.title,
      `Thesis: ${result.thesis}`,
      "",
      result.output,
      "",
      "Checklist",
      ...result.checklist.map((item) => `- ${item}`),
      "",
      "Evidence to Research",
      ...result.referencesNeeded.map((item) => `- ${item}`),
    ].join("\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-indigo-100 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <section className="rounded-2xl bg-slate-900 text-white p-6 md:p-8 shadow-xl">
          <h1 className="text-3xl font-bold">✍️ Essay Coach</h1>
          <p className="text-slate-300 mt-2">Generate outlines, drafts, and improved rewrites with academic structure and study checklists.</p>
        </section>

        <section className="bg-white rounded-2xl border border-amber-100 shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Essay question / brief</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full border rounded-lg p-3 min-h-24"
              placeholder="Example: To what extent did the Industrial Revolution improve quality of life?"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Your notes / sources / constraints (optional)</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full border rounded-lg p-3 min-h-20"
              placeholder="Paste points from lectures, required structure, or feedback from your tutor."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Task</label>
              <select value={essayType} onChange={(e) => setEssayType(e.target.value as EssayType)} className="w-full border rounded-lg p-2">
                <option value="outline">Detailed outline</option>
                <option value="draft">First draft</option>
                <option value="improve">Improve existing writing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value as EssayTone)} className="w-full border rounded-lg p-2">
                <option value="academic">Academic</option>
                <option value="clear">Clear & simple</option>
                <option value="persuasive">Persuasive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Target words</label>
              <input
                type="number"
                value={wordCount}
                min={200}
                max={2500}
                onChange={(e) => setWordCount(Number(e.target.value || 900))}
                className="w-full border rounded-lg p-2"
              />
            </div>
          </div>

          <button
            onClick={generateEssay}
            disabled={loading}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate Essay Support"}
          </button>

          {error && <p className="text-red-600">{error}</p>}
        </section>

        {result && (
          <section className="bg-white rounded-2xl border border-amber-100 shadow p-6 space-y-4">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">{result.title}</h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">+{result.xpReward} XP</span>
                <button onClick={copyResult} className="px-3 py-1 rounded-full bg-slate-900 text-white hover:bg-black transition">{copied ? "Copied" : "Copy"}</button>
              </div>
            </div>

            {!!result.thesis && (
              <div>
                <h3 className="font-semibold mb-1">Thesis</h3>
                <p className="text-slate-700">{result.thesis}</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-1">Output</h3>
              <p className="whitespace-pre-wrap text-slate-700">{result.output}</p>
            </div>

            {result.checklist.length > 0 && (
              <div>
                <h3 className="font-semibold mb-1">Submission Checklist</h3>
                <ul className="list-disc pl-5 text-slate-700 space-y-1">
                  {result.checklist.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.referencesNeeded.length > 0 && (
              <div>
                <h3 className="font-semibold mb-1">Evidence to Research</h3>
                <ul className="list-disc pl-5 text-slate-700 space-y-1">
                  {result.referencesNeeded.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.remaining !== null && (
              <p className="text-xs text-slate-500">Free AI uses remaining: {result.remaining}</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
