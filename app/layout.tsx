import type { Metadata } from "next";
import { Poppins, Lora } from "next/font/google";
import "./globals.css";
import SyncProvider from "@/components/SyncProvider";

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
  title: "Focusflow - AI-Powered Task Management",
  description: "AI-based student scheduling system to automate schedules, alleviate cognitive load, and provide emotional upliftment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${lora.variable} antialiased`}
      >
        <SyncProvider>
          <div className="min-h-screen">
            {children}
          </div>
        </SyncProvider>
      </body>
    </html>
  );
}
