"use client";

import { useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async () => {
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

    router.replace("/schedule");
  };

  return (
    <main className="min-h-screen app-surface flex items-center justify-center p-6">
      <div className="card-bubbly card-hover p-8 w-full max-w-md app-layer">
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 font-semibold text-center">WeekWise AI</p>
        <h1 className="text-3xl font-black mt-2 mb-6 text-center text-slate-900">🔑 Welcome back</h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full input-polish p-2.5 mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full input-polish p-2.5 mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleLogin} disabled={loading} className="w-full btn-primary disabled:opacity-60">
          {loading ? "Logging in..." : "Login"}
        </button>

        {errorMsg && <p className="text-red-600 mt-3 text-sm">{errorMsg}</p>}
      </div>
    </main>
  );
}
