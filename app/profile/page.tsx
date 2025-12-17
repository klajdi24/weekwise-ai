"use client";
import Navbar from "../components/navbar";
import Footer from "../components/footer";

export default function Profile() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-700 mb-4">👤 Profile</h1>
        <p className="text-gray-600">Manage your account and settings here.</p>
      </main>
      <Footer />
    </div>
  );
}

