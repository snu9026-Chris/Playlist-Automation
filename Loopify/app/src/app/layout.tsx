import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { YouTubeAuthProvider } from "@/hooks/useYouTubeAuth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loopify",
  description: "Spotify 트렌드 분석 기반 AI 음악 쇼츠 자동 생성·업로드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full">
        <YouTubeAuthProvider>
          <Header />
          <Sidebar />
          <main className="ml-72 mt-20 min-h-[calc(100vh-5rem)] overflow-y-auto bg-pearl-100 p-8 pb-16">
            {children}
          </main>
        </YouTubeAuthProvider>
      </body>
    </html>
  );
}
