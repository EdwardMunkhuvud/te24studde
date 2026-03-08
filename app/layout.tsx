import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";

import "./globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Studde | Klasskassa",
  description: "Klasskassa för studenten med elevinloggning och adminläge.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Studde",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#04101f",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${headingFont.variable} ${bodyFont.variable}`} lang="sv">
      <body>{children}</body>
    </html>
  );
}
