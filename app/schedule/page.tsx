"use client";
import { useState } from "react";
import Navbar from "../components/navbar";
import Footer from "../components/footer";

interface Event {
  id: number;
  title: string;
  date: string;
  time: string;
}

export default function Schedule() {
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const addEvent = () => {
    if (!title || !date || !time) return;
    setEvents([...events, { id: Date.now(), title, date, time }]);
    setTitle("");
    setDate("");
    setTime("");
  };

  const deleteEvent = (id: number) => {
    setEvents(events.filter((event) => event.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 p-6">
      <Navbar />

      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-blue-600">📚 Academic Schedule</h1>
        <p className="text-gray-600 mt-1">Manage your classes and assignments</p>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-md mb-6 max-w-xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">Add New Event</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            type="text"
            placeholder="Event Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border p-2 rounded"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="border p-2 rounded"
          />
        </div>
        <button
          onClick={addEvent}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Add Event
        </button>
      </div>

      <div className="max-w-xl mx-auto">
        {events.length === 0 ? (
          <p className="text-gray-500 text-center">No events added yet.</p>
        ) : (
          <ul className="space-y-4">
            {events.map((event) => (
              <li
                key={event.id}
                className="bg-white p-4 rounded-xl shadow flex justify-between items-center"
              >
                <div>
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="text-gray-600 text-sm">
                    {event.date} at {event.time}
                  </p>
                </div>
                <button
                  onClick={() => deleteEvent(event.id)}
                  className="text-red-600 hover:text-red-800 font-bold"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Footer />
    </div>
  );
}



