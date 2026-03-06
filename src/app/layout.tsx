import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwiftInvoice",
  description: "Buat invoice profesional dalam hitungan detik",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()` }} />
      </head>
      <body className="bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 min-h-screen transition-colors">{children}</body>
    </html>
  );
}
