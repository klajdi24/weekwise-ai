"use client";

import { useState } from "react";

export default function Summarize() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError("");
    setSummary("");

    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to summarize PDF");

      const data = await res.json();
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 p-6 max-w-3xl mx-auto min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">📄 PDF Summarizer</h1>
      <p className="text-gray-600 mb-6">
        Upload your lecture slides or notes and get a concise summary.
      </p>

      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="border p-2 rounded w-full mb-4"
      />

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
      >
        {loading ? "Summarizing..." : "Summarize PDF"}
      </button>

      {error && <p className="text-red-600 mt-4">{error}</p>}
      {summary && (
        <div className="mt-6 p-4 bg-white rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-2">Summary:</h2>
          <p className="text-gray-700">{summary}</p>
        </div>
      )}
    </main>
  );
}






