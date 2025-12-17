"use client";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 shadow-md">
        <h1 className="text-3xl font-bold text-center">WeekWise AI</h1>
        <p className="text-center mt-1 text-sm opacity-80">
          Smart scheduling & fitness tracking for students
        </p>
      </header>

      <main className="flex-1 p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Academic Schedule Card */}
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
          <h2 className="text-xl font-semibold mb-2">📚 Academic Schedule</h2>
          <p className="text-gray-600 mb-4">
            View, add, and manage your classes and assignments easily.
          </p>
          <Link href="/schedule">
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
              Go to Schedule
            </button>
          </Link>
        </div>

        {/* Fitness Tracker Card */}
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
          <h2 className="text-xl font-semibold mb-2">🏃 Fitness Tracker</h2>
          <p className="text-gray-600 mb-4">
            Log workouts, track steps, and monitor your progress.
          </p>
          <Link href="/fitness">
            <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">
              Go to Fitness
            </button>
          </Link>
        </div>

        {/* Profile Card */}
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
          <h2 className="text-xl font-semibold mb-2">👤 Profile</h2>
          <p className="text-gray-600 mb-4">
            Manage your account and settings.
          </p>
          <Link href="/profile">
            <button className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 transition">
              Go to Profile
            </button>
          </Link>
        </div>
      </main>

      <footer className="bg-gray-800 text-white p-6 text-center">
        &copy; 2025 WeekWise AI. All rights reserved.
      </footer>
    </div>
  );
}






