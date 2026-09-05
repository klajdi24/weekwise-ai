"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";
import { extractAiError, isPlanLimitError, type AiClientErrorPayload } from "@/lib/ai/client";
import Mascot from "../components/mascot";

type SummaryMode = "quick" | "exam" | "deep";
type SummaryFormat = "bullets" | "paragraph" | "flashcards";

interface SummarizeResponse {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  quizQuestions: string[];
  xpReward: number;
  remaining: number | null;
  isUnlimitedAi?: boolean;
  error?: string;
}

type UserPlan = "free" | "pro" | "unlimited";

interface SubscriptionStatus {
  plan: UserPlan;
}

type UiState = "idle" | "loading" | "success" | "error";

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

  const [uiState, setUiState] = useState<UiState>("idle");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [plan, setPlan] = useState<UserPlan>("free");

  const estimatedReadMinutes = useMemo(() => {
    if (!summary) return 0;
    const words = summary.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 180));
  }, [summary]);

  const modeHint = useMemo(() => {
    if (mode === "exam") return "Exam prep mode prioritizes likely questions and memory cues.";
    if (mode === "deep") return "Deep mode gives conceptual links and pitfalls.";
    return "Quick mode is best for fast daily revision.";
  }, [mode]);

  const maxMbForPlan = useMemo(() => (plan === "unlimited" ? 50 : plan === "pro" ? 25 : 10), [plan]);

  useEffect(() => {
    if (!supabase) return;

    const loadPlan = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/subscription/status", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;
      const payload = (await res.json()) as SubscriptionStatus;
      if (payload?.plan) setPlan(payload.plan);
    };

    loadPlan();
  }, [supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const selected = e.target.files[0];
    const fileMb = Number((selected.size / (1024 * 1024)).toFixed(2));

    if (selected.type && selected.type !== "application/pdf") {
      setFile(null);
      setError("Only PDF files are supported.");
      setUiState("error");
      return;
    }

    if (fileMb > maxMbForPlan) {
      setFile(null);
      setError(`Your file is ${fileMb} MB. Max for ${plan} is ${maxMbForPlan} MB.`);
      setUiState("error");
      return;
    }

    setFile(selected);
    setError("");
    if (uiState === "error") setUiState("idle");
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Upload a PDF first.");
      setUiState("error");
      return;
    }

    if (!supabase) {
      setError("App is not configured. Missing Supabase environment variables.");
      setUiState("error");
      return;
    }

    setUiState("loading");
    setError("");
    setSummary("");
    setKeyPoints([]);
    setActionItems([]);
    setQuizQuestions([]);
    setXpReward(0);
    setCopied(false);

    try {
      const { user, accessToken } = await getClientAuth(supabase);

      if (!user || !accessToken) {
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
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const data = (await res.json()) as SummarizeResponse & AiClientErrorPayload & {
        maxMb?: number;
        plan?: UserPlan;
        fileMb?: number;
      };
      if (!res.ok) {
        if (data.code === "FILE_TOO_LARGE") {
          const serverPlan = data.plan ?? plan;
          const serverMax = data.maxMb ?? maxMbForPlan;
          const uploaded = data.fileMb ?? Number(((file?.size ?? 0) / (1024 * 1024)).toFixed(2));
          throw new Error(`Your file is ${uploaded} MB. Max for ${serverPlan} is ${serverMax} MB.`);
        }
        const message = extractAiError(data, "Failed to summarize PDF");
        throw new Error(isPlanLimitError(data) ? `${message} Upgrade in Pricing to continue.` : message);
      }

      setSummary(data.summary || "");
      setKeyPoints(data.keyPoints || []);
      setActionItems(data.actionItems || []);
      setQuizQuestions(data.quizQuestions || []);
      setXpReward(data.xpReward || 0);
      setRemaining(data.remaining ?? null);
      setUiState("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      setUiState("error");
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
    <div className="min-h-screen app-surface p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Mascot
          mood={uiState === "success" ? "celebrate" : uiState === "loading" ? "focus" : "happy"}
          message={
            uiState === "success"
              ? "Great run. Turn this into one short revision block today."
              : "Upload one lecture PDF — we’ll convert it into a study pack."
          }
        />

        <section className="hero-panel p-6 md:p-8">
          <p className="eyebrow text-violet-300">Summarize</p>
          <h1 className="page-title mt-2">Smart PDF summarizer</h1>
          <p className="text-[var(--muted)] mt-3">
            Turn lecture slides into key concepts, actions, and quiz prompts in minutes.
          </p>
        </section>

        <section className="bg-white/[0.05] backdrop-blur-xl rounded-2xl card-hover border border-violet-400/30 shadow p-6 space-y-4">
          <div>
            <label htmlFor="pdf-upload" className="block text-sm font-semibold text-[var(--foreground)] mb-2">Upload PDF</label>
            <input
              id="pdf-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="border p-2 rounded-lg w-full"
              aria-label="Upload lecture PDF"
            />
            {file && <p className="text-xs text-[var(--muted)] mt-2">Selected: {file.name}</p>}
            <p className="text-xs text-[var(--muted)] mt-2">Plan upload limit: {maxMbForPlan} MB ({plan} plan)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="summary-mode" className="block text-sm font-semibold text-[var(--foreground)] mb-2">Summary mode</label>
              <select
                id="summary-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as SummaryMode)}
                className="w-full input-polish p-2"
              >
                <option value="quick">Quick review</option>
                <option value="exam">Exam prep</option>
                <option value="deep">Deep understanding</option>
              </select>
              <p className="text-xs text-[var(--muted)] mt-1">{modeHint}</p>
            </div>

            <div>
              <label htmlFor="summary-format" className="block text-sm font-semibold text-[var(--foreground)] mb-2">Output format</label>
              <select
                id="summary-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as SummaryFormat)}
                className="w-full input-polish p-2"
              >
                <option value="bullets">Bullet points</option>
                <option value="paragraph">Concise paragraphs</option>
                <option value="flashcards">Flashcard style</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSubmit}
              disabled={uiState === "loading"}
              className="btn-primary disabled:opacity-60"
            >
              {uiState === "loading" ? "Summarizing..." : "Generate Study Summary"}
            </button>

            {uiState === "error" && file && (
              <button onClick={handleSubmit} className="btn-secondary" aria-label="Retry summarize request">
                Retry
              </button>
            )}
          </div>

          {remaining !== null && <p className="text-xs text-[var(--muted)]">Free AI uses remaining today: {remaining}</p>}

          {uiState === "error" && (
            <div className="space-y-2" role="alert">
              <p className="text-rose-300">{error}</p>
              {(error.includes("Max for free") || error.includes("Max for pro") || error.includes("Upgrade")) && (
                <Link href="/pricing" className="inline-block text-sm text-violet-200 underline">Upgrade plan for larger PDFs</Link>
              )}
            </div>
          )}
        </section>

        {uiState === "idle" && !summary && (
          <section className="card-soft p-6 text-center">
            <p className="text-[var(--foreground)]">No summary yet. Upload your lecture PDF and generate your first study pack.</p>
          </section>
        )}

        {uiState === "loading" && (
          <section className="bg-white/[0.05] backdrop-blur-xl rounded-2xl card-hover shadow border border-violet-400/30 p-6 space-y-4">
            <div className="h-6 w-44 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-11/12 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-10/12 bg-white/10 rounded animate-pulse" />
          </section>
        )}

        {summary && (
          <section className="bg-white/[0.05] backdrop-blur-xl rounded-2xl card-hover shadow border border-violet-400/30 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-violet-200">Your Study Pack</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-200 font-semibold">+{xpReward} XP earned</span>
                <span className="px-3 py-1 rounded-full bg-violet-500/15 text-violet-200">~{estimatedReadMinutes} min read</span>
                <button
                  onClick={handleCopy}
                  className="btn-secondary text-sm py-1.5 px-3"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-[var(--ink)] mb-2">Summary</h3>
              <p className="text-[var(--foreground)] whitespace-pre-wrap">{summary}</p>
            </div>

            {keyPoints.length > 0 && (
              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-2">Key Concepts</h3>
                <ul className="list-disc pl-5 space-y-1 text-[var(--foreground)]">
                  {keyPoints.map((point, index) => (
                    <li key={`${point}-${index}`}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {actionItems.length > 0 && (
              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-2">Revision Checklist</h3>
                <ul className="list-disc pl-5 space-y-1 text-[var(--foreground)]">
                  {actionItems.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {quizQuestions.length > 0 && (
              <div>
                <h3 className="font-semibold text-[var(--ink)] mb-2">Exam-style Quick Questions</h3>
                <ul className="list-decimal pl-5 space-y-1 text-[var(--foreground)]">
                  {quizQuestions.map((q, index) => (
                    <li key={`${q}-${index}`}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
