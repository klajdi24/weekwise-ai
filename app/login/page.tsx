"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import Logo from "../components/logo";

export default function LoginPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!supabase) {
      setErrorMsg("App is not configured. Missing Supabase environment variables.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

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
        <p className="eyebrow text-center text-teal-700">Welcome back</p>
        <h1 className="font-display text-3xl font-bold mt-2 mb-2 text-center text-slate-900">Sign in to WeekWise</h1>
        <p className="helper-text text-center mb-6">Pick up your schedule, streak, and focus where you left off.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
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

          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full input-polish p-2.5 mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={loading} className="w-full btn-primary">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {errorMsg && <p className="text-rose-600 mt-3 text-sm">{errorMsg}</p>}

        <p className="text-center text-sm text-slate-500 mt-6">
          New here?{" "}
          <Link href="/pricing" className="text-teal-700 font-semibold hover:underline">
            See plans
          </Link>
        </p>
      </div>
    </div>
  );
}
