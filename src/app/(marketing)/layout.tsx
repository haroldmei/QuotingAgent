import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QuotingAgent — Fast AI Quoting for Western Sydney Trades",
  description:
    "Turn site photos into Bunnings-priced, NSW-compliant SMS quotes in under 5 minutes. Western Sydney trades. First 5 quotes free.",
  keywords: [
    "trade quoting app",
    "Western Sydney tradies",
    "AI quote generator",
    "NSW contractor licence",
    "roofing quote",
    "painting quote",
    "Bunnings pricing",
    "SMS quote",
    "fast quoting",
    "tradify alternative",
  ],
  openGraph: {
    title: "QuotingAgent — Quote in 5 minutes, Western Sydney trades",
    description:
      "Photo to SMS quote in under 5 minutes. Bunnings live prices, NSW licence bound, one-tap acceptance. For Western Sydney roofers and painters.",
    type: "website",
    url: "https://quoting.app",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QuotingAgent — site photo to SMS quote in 5 minutes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QuotingAgent — Quote in 5 minutes, Western Sydney trades",
    description:
      "Photo to SMS quote in under 5 minutes. Bunnings live prices, NSW licence bound, one-tap acceptance.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://quoting.app",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
