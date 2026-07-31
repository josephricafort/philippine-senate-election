import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const title = "BotoSenado — Philippine Senate Election Results (2007 - 2025)";
const description = "Explore every Philippine senatorial election from 2007–2025, broken down to the municipality level. Look up any candidate's vote share, rank, strongholds, and trend over time.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  applicationName: title,
  manifest: "/manifest.json",
  openGraph: {
    title,
    description,
    url: SITE_URL,
    siteName: title,
    locale: "en_PH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${ibmPlexMono.variable} h-full antialiased dark`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: title,
              description,
              url: SITE_URL,
              inLanguage: 'en-PH',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${SITE_URL}/?candidate={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      </body>
    </html>
  );
}
