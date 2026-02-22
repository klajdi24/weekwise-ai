import Navbar from "./components/navbar";
import Footer from "./components/footer";
import "./globals.css";

export const metadata = {
  title: "WeekWise AI — Student Momentum OS",
  description: "Plan smarter, study consistently, and build momentum at university.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col text-gray-900">
        <Navbar />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
