"use client";

import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-fuchsia-100 p-6 md:p-10">
      <section className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-3xl bg-slate-900 text-white p-8 shadow-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">WeekWise Plans</p>
          <h1 className="text-4xl font-bold mt-2">Choose your momentum plan</h1>
          <p className="text-slate-300 mt-3">Start free and upgrade when you want unlimited AI planning power.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Free</h2>
            <p className="text-3xl font-extrabold mt-2">£0<span className="text-base font-medium text-gray-500"> / month</span></p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>• Schedule + fitness tracking</li>
              <li>• Momentum dashboard</li>
              <li>• 3 AI actions total</li>
              <li>• Basic summaries</li>
            </ul>
          </article>

          <article className="rounded-2xl border-2 border-fuchsia-400 bg-white p-6 shadow-lg relative">
            <span className="absolute -top-3 right-4 text-xs px-2 py-1 bg-fuchsia-600 text-white rounded-full">Recommended</span>
            <h2 className="text-2xl font-bold">Premium</h2>
            <p className="text-3xl font-extrabold mt-2">£7.99<span className="text-base font-medium text-gray-500"> / month</span></p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>• Unlimited AI schedule optimization</li>
              <li>• Unlimited AI suggestions</li>
              <li>• Priority feature access</li>
              <li>• Advanced momentum insights</li>
            </ul>
            <button className="mt-6 w-full rounded-lg bg-fuchsia-600 text-white px-4 py-2 font-semibold hover:bg-fuchsia-700 transition">
              Upgrade (coming soon)
            </button>
          </article>
        </div>

        <div className="rounded-2xl bg-white border border-indigo-100 p-5 shadow flex flex-wrap gap-3 items-center justify-between">
          <p className="text-gray-700">Need to compare first? Keep using Free and upgrade any time.</p>
          <div className="flex gap-3">
            <Link href="/profile" className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Back to Profile</Link>
            <Link href="/schedule" className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Open Schedule</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
