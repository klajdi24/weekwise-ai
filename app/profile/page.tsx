"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Profile() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error("Get user error:", error);

      setUser(data?.user ?? null);
      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Redirecting to login...</p>;

  return (
    <main className="flex-1 p-8 min-h-screen bg-gray-50 flex flex-col items-center">
      <h1 className="text-3xl font-bold text-gray-700 mb-6">👤 Profile</h1>

      <div className="bg-white p-6 rounded-xl shadow w-full max-w-md">
        <label className="block text-gray-600 font-semibold mb-1">Email</label>
        <input
          type="email"
          value={user.email || ""}
          className="w-full border p-2 rounded mb-4"
          disabled
        />

        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          Log Out
        </button>
      </div>
    </main>
  );
}





