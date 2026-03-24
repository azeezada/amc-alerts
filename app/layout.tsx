import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={roboto.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
