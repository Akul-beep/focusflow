import type { Metadata } from "next";
import LandingPageContent from "@/components/landing/LandingPageContent";

function siteUrlFromEnv(): URL | undefined {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit);
    } catch {
      /* ignore invalid */
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    try {
      return new URL(`https://${vercel}`);
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

const siteUrl = siteUrlFromEnv();

const title = "Flowly — What do I do next?";
const description =
  "Student planner with adaptive AI scheduling: rebalance when you fall behind, task breakdowns on your calendar, syllabus exam prep, and focus mode with timer and forest growth. Free to start.";

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: siteUrl } : {}),
  title,
  description,
  keywords: [
    "student planner",
    "study schedule",
    "adaptive scheduling",
    "exam prep",
    "focus timer",
    "task breakdown",
    "syllabus planner",
  ],
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Flowly",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  alternates: siteUrl ? { canonical: "/" } : undefined,
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Flowly",
  description,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  ...(siteUrl ? { url: siteUrl.origin } : {}),
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPageContent />
    </>
  );
}
