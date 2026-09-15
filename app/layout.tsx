import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import UserMoviesProvider from "@/components/UserMoviesProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Movie Guardian — track films, find what to watch next",
    template: "%s · Movie Guardian",
  },
  description:
    "Track the films you've watched, rate them, keep a watchlist, and discover what to watch next.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-scroll-behavior="smooth": globals.css scrolls smoothly, and this
    // tells Next.js 16 to switch that off while changing pages, so a new page
    // appears at the top instantly instead of visibly scrolling up.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        {/* Header and footer live here, so every page gets them automatically. */}
        {/* Loads "which films have I marked?" once, for every card below. */}
        <UserMoviesProvider>
          <ScrollToTop />
          <Header />
          <div className="pageBody">{children}</div>
          <Footer />
        </UserMoviesProvider>
      </body>
    </html>
  );
}
