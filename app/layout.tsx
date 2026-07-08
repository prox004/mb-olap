import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DashboardProvider } from "./DashboardContext";
import DashboardShell from "./components/DashboardShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MB OLAP - Retail BI Engine",
  description: "Enterprise High-Performance Inventory & Sales Analytics Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#09090B]">
        <DashboardProvider>
          <DashboardShell>{children}</DashboardShell>
        </DashboardProvider>
      </body>
    </html>
  );
}
