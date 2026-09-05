"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import Logo from "../components/logo";

export default function LoginPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!supabase) {
      setErrorMsg("App is not configured. Missing Supabase environment variables.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setInfoMsg("");

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        router.replace("/");
        return;
      }

      setInfoMsg("Account created. Check your email to confirm, then sign in.");
      setMode("signin");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    router.replace("/");
  };

  return (
    <div className="app-surface min-h-full flex items-center justify-center p-6">
      <div className="card-bubbly p-8 w-full max-w-md app-layer">
        <div className="flex justify-center mb-6">
          <Logo href={null} tone="onLight" markClassName="h-11 w-11" />
        </div>
        <p className="eyebrow text-center text-violet-200">{mode === "signup" ? "Get started" : "Welcome back"}</p>
        <h1 className="font-display text-3xl font-bold mt-2 mb-2 text-center text-[var(--ink)]">
          {mode === "signup" ? "Create your account" : "Sign in to WeekWise"}
        </h1>
        <p className="helper-text text-center mb-6">
          {mode === "signup"
            ? "Set up your week, streak and study tools in a few seconds."
            : "Pick up your schedule, streak, and focus where you left off."}
        </p>

        <div className="segmented w-full mb-5">
          <button type="button" className={`segmented-btn flex-1 ${mode === "signin" ? "active" : ""}`} onClick={() => setMode("signin")}>
            Sign in
          </button>
          <button type="button" className={`segmented-btn flex-1 ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-[var(--foreground)]">
            Email
            <input
              type="email"
              autoComplete="email"
              placeholder="you@university.ac.uk"
              className="w-full input-polish p-2.5 mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium text-[var(--foreground)]">
            Password
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="At least 6 characters"
              className="w-full input-polish p-2.5 mt-1"
              value={password}
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={loading} className="w-full btn-primary">
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        {errorMsg && <p className="text-rose-300 mt-3 text-sm">{errorMsg}</p>}
        {infoMsg && <p className="text-violet-200 mt-3 text-sm">{infoMsg}</p>}

        <p className="text-center text-sm text-[var(--muted)] mt-6">
          Curious about limits?{" "}
          <Link href="/pricing" className="text-violet-200 font-semibold hover:underline">
            See plans
          </Link>
        </p>
      </div>
    </div>
  );
}
