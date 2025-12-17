"use client";
import Navbar from "../components/navbar";
import Footer from "../components/footer";

export default function Fitness() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 p-8 text-center">
        <h1 className="text-3xl font-bold text-green-600 mb-4">🏃 Fitness Tracker</h1>
        <p className="text-gray-600">Track workouts, steps, and monitor progress.</p>
      </main>
      <Footer />
    </div>
  );
}

