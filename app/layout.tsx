import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IMAX 70mm Alerts — Project Hail Mary",
  description:
    "Get notified the moment IMAX 70mm tickets drop for Project Hail Mary at AMC Lincoln Square 13, New York City.",
  openGraph: {
    title: "IMAX 70mm Alerts — Project Hail Mary",
    description:
      "Get notified the moment IMAX 70mm tickets drop for Project Hail Mary at AMC Lincoln Square 13.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
