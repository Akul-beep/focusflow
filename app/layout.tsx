import type { Metadata } from "next";
import { Poppins, Lora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import PostHogProvider from "@/components/PostHogProvider";
import { FeedbackProvider } from "@/components/FeedbackProvider";
import SyncProvider from "@/components/SyncProvider";
import AppChrome from "@/components/AppChrome";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Flowly - AI-Powered Task Management",
  description:
    "AI-based student scheduling: break down tasks, plan your day, run focus sessions, and track progress without the clutter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `
    (() => {
      try {
        const pathname = window.location.pathname || '/';
        const isLanding = pathname === '/' || pathname.startsWith('/landing');
        const saved = localStorage.getItem('focusflow-theme');
        const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        const apply = () => {
          if (isLanding) {
            document.documentElement.setAttribute('data-landing', 'true');
            document.documentElement.setAttribute('data-theme', 'light');
            return;
          }
          document.documentElement.removeAttribute('data-landing');
          if (saved === 'light' || saved === 'dark') {
            document.documentElement.setAttribute('data-theme', saved);
            return;
          }
          document.documentElement.setAttribute('data-theme', 'light');
        };
        apply();
        if (media && saved === 'system') {
          if (media.addEventListener) media.addEventListener('change', apply);
          else if (media.addListener) media.addListener(apply);
        }
      } catch {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  `;

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${poppins.variable} ${lora.variable} antialiased`}
      >
        <AuthProvider>
          <PostHogProvider>
            <FeedbackProvider>
              <SyncProvider>
                <AppChrome>{children}</AppChrome>
              </SyncProvider>
            </FeedbackProvider>
          </PostHogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
