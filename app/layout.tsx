import type { Metadata } from "next";
import { Figtree, Outfit } from "next/font/google";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WeekWise AI — Student Momentum OS",
  description: "Plan smarter, study consistently, and build momentum at university.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${figtree.variable}`}>
      <body className="min-h-screen flex flex-col text-[var(--foreground)] font-sans">
        <Navbar />
        <div className="flex-1 pb-24 lg:pb-0">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
