"use client";

import { useState } from "react";
import Navbar from "../components/navbar";
import Footer from "../components/footer";

export default function Summarize() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/ai/summarize", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setSummary(data.summary || "No summary generated.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 p-8 text-center">
        <h1 className="text-3xl font-bold text-blue-600 mb-4">📄 Summarize Lecture PDF</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            {loading ? "Summarizing..." : "Summarize PDF"}
          </button>
        </form>
        {summary && (
          <div className="mt-6 p-4 bg-white rounded shadow max-w-xl mx-auto text-left">
            <h2 className="text-xl font-semibold mb-2">Summary:</h2>
            <p>{summary}</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

