"use client";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">WeekWise AI</h1>
        <div className="space-x-4">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <Link href="/schedule" className="hover:underline">
            Schedule
          </Link>
          <Link href="/fitness" className="hover:underline">
            Fitness
          </Link>
          <Link href="/profile" className="hover:underline">
            Profile
          </Link>
        </div>
      </div>
    </nav>
  );
}
