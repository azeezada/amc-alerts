import type { Metadata } from "next";
import { Newsreader, Outfit } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IMAX 70mm Alerts — Project Hail Mary",
  description:
    "Get notified the moment IMAX 70mm tickets drop for Project Hail Mary at AMC Lincoln Square 13, New York City. April 2026.",
  openGraph: {
    title: "IMAX 70mm Alerts — Project Hail Mary",
    description:
      "Track ticket availability for Project Hail Mary in IMAX 70mm at AMC Lincoln Square 13, NYC.",
    type: "website",
    siteName: "IMAX 70mm Alerts",
  },
  twitter: {
    card: "summary_large_image",
    title: "IMAX 70mm Alerts — Project Hail Mary",
    description:
      "Track ticket availability for Project Hail Mary in IMAX 70mm at AMC Lincoln Square 13, NYC.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${newsreader.variable} ${outfit.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme');
                if (theme === 'light') {
                  document.documentElement.setAttribute('data-theme', 'light');
                } else if (theme === 'dark') {
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
