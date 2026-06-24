import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ToroAI — ICT Design Workspace",
  description: "AI-powered ICT/ISP design platform for RCDDs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Minimal universal shell. Auth/app layouts add their own chrome.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
