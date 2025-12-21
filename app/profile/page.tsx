"use client";

import { useState } from "react";

export default function Profile() {
  // Mocked user data
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john.doe@student.com");
  const [message, setMessage] = useState("");

  const handleSave = () => {
    // For now, just show a success message
    setMessage("Profile updated successfully!");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleLogout = () => {
    // Placeholder for logout logic
    alert("Logging out...");
  };

  return (
    <main className="flex-1 p-8 min-h-screen bg-gray-50 flex flex-col items-center">
      <h1 className="text-3xl font-bold text-gray-700 mb-6">👤 Profile</h1>

      <div className="bg-white p-6 rounded-xl shadow w-full max-w-md">
        <label className="block text-gray-600 font-semibold mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border p-2 rounded mb-4"
        />

        <label className="block text-gray-600 font-semibold mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded mb-4"
        />

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition mb-2"
        >
          Save Changes
        </button>

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



