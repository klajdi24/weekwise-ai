"use client";
import { useState } from "react";
import Navbar from "../components/navbar";
import Footer from "../components/footer";

export default function Notes() {
  const [inputText, setInputText] = useState("");
  const [generatedNotes, setGeneratedNotes] = useState("");

  const generateNotes = () => {
    if (!inputText) return;
    // Placeholder AI logic for now
    setGeneratedNotes(
      `📌 Generated Notes (placeholder):\n\n${inputText
        .split("\n")
        .map((line) => "- " + line)
        .join("\n")}`
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 p-8 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-600 mb-4">📝 AI Notes Generator</h1>
        <p className="text-gray-600 mb-6">
          Type your lecture notes or paste content here, then click "Generate Notes".
        </p>

        <textarea
          placeholder="Type or paste your lecture notes..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="w-full border p-4 rounded mb-4 h-48 resize-none"
        />

        <button
          onClick={generateNotes}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition mb-6"
        >
          Generate Notes
        </button>

        {generatedNotes && (
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-xl font-semibold mb-2">Generated Notes:</h2>
            <pre className="whitespace-pre-wrap text-gray-800">{generatedNotes}</pre>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
