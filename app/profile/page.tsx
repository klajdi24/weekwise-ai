"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) return <p>Loading...</p>;
  if (!user)
    return (
      <p className="p-6 text-red-600">You are not logged in. Please log in to view your profile.</p>
    );

  return (
    <main className="flex-1 p-8 min-h-screen bg-gray-50 flex flex-col items-center">
      <h1 className="text-3xl font-bold text-gray-700 mb-6">👤 Profile</h1>

      <div className="bg-white p-6 rounded-xl shadow w-full max-w-md">
        <label className="block text-gray-600 font-semibold mb-1">Name</label>
        <input
          type="text"
          value={user.user_metadata?.full_name || ""}
          onChange={() => {}}
          className="w-full border p-2 rounded mb-4"
          disabled
        />

        <label className="block text-gray-600 font-semibold mb-1">Email</label>
        <input
          type="email"
          value={user.email}
          onChange={() => {}}
          className="w-full border p-2 rounded mb-4"
          disabled
        />

        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          Log Out
        </button>

        {message && <p className="text-green-600 mt-4">{message}</p>}
      </div>
    </main>
  );
}




