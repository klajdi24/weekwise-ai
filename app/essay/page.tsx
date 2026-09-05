"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";
import { extractAiError, isPlanLimitError, type AiClientErrorPayload } from "@/lib/ai/client";
import Mascot from "../components/mascot";

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
      const { user, accessToken } = await getClientAuth(supabase);

      if (!user || !accessToken) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/ai/essay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
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
    <div className="min-h-screen app-surface p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Mascot mood={result ? "celebrate" : "focus"} message="Structure first, then polish — I’ll help you build a stronger argument." />
        <section className="hero-panel p-6 md:p-8">
          <p className="eyebrow text-violet-300">Essay</p>
          <h1 className="page-title mt-2">Essay coach</h1>
          <p className="text-[var(--muted)] mt-3">Generate outlines, drafts, and improved rewrites with academic structure and study checklists.</p>
        </section>

        <section className="bg-white/[0.05] backdrop-blur-xl rounded-2xl card-hover border border-violet-400/30 shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">Essay question / brief</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full input-polish p-3 min-h-24"
              placeholder="Example: To what extent did the Industrial Revolution improve quality of life?"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">Your notes / sources / constraints (optional)</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full input-polish p-3 min-h-20"
              placeholder="Paste points from lectures, required structure, or feedback from your tutor."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">Task</label>
              <select value={essayType} onChange={(e) => setEssayType(e.target.value as EssayType)} className="w-full input-polish p-2">
                <option value="outline">Detailed outline</option>
                <option value="draft">First draft</option>
                <option value="improve">Improve existing writing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value as EssayTone)} className="w-full input-polish p-2">
                <option value="academic">Academic</option>
                <option value="clear">Clear & simple</option>
                <option value="persuasive">Persuasive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">Target words</label>
              <input
                type="number"
                value={wordCount}
                min={200}
                max={2500}
                onChange={(e) => setWordCount(Number(e.target.value || 900))}
                className="w-full input-polish p-2"
              />
            </div>
          </div>

          <button
            onClick={generateEssay}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Generating..." : "Generate Essay Support"}
          </button>

          {error && <p className="text-rose-300">{error}</p>}
        </section>

        {result && (
          <section className="bg-white/[0.05] backdrop-blur-xl rounded-2xl card-hover border border-violet-400/30 shadow p-6 space-y-4">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--ink)]">{result.title}</h2>
              <div className="flex gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-200 font-semibold">+{result.xpReward} XP</span>
                <button onClick={copyResult} className="btn-secondary text-sm py-1.5 px-3">{copied ? "Copied" : "Copy"}</button>
              </div>
            </div>

            {!!result.thesis && (
              <div>
                <h3 className="font-semibold mb-1">Thesis</h3>
                <p className="text-[var(--foreground)]">{result.thesis}</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-1">Output</h3>
              <p className="whitespace-pre-wrap text-[var(--foreground)]">{result.output}</p>
            </div>

            {result.checklist.length > 0 && (
              <div>
                <h3 className="font-semibold mb-1">Submission Checklist</h3>
                <ul className="list-disc pl-5 text-[var(--foreground)] space-y-1">
                  {result.checklist.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.referencesNeeded.length > 0 && (
              <div>
                <h3 className="font-semibold mb-1">Evidence to Research</h3>
                <ul className="list-disc pl-5 text-[var(--foreground)] space-y-1">
                  {result.referencesNeeded.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.remaining !== null && (
              <p className="text-xs text-[var(--muted)]">Free AI uses remaining: {result.remaining}</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
