import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-family",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WeekWise AI — Student Momentum OS",
  description: "Plan smarter, study consistently, and build momentum at university.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${jakarta.variable}`}>
      <body className="min-h-screen flex flex-col text-[var(--foreground)] font-sans">
        <Navbar />
        <div className="flex-1 pb-24 lg:pb-0">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
