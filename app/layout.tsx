import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FeedbackEffects } from "../components/ui/FeedbackEffects";

const uiFont = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AVTODOM Orders",
  description: "Премиальная система обработки и мониторинга заказов AVTODOM",
  applicationName: "AVTODOM",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        url: "/icon-192-dark.png",
        sizes: "192x192",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "AVTODOM Orders",
    description: "Премиальная система обработки и мониторинга заказов AVTODOM",
    images: [
      {
        url: "/icon-512.png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "/icon-512.png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#111827" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="AVTODOM" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/icon-192-dark.png"
          media="(prefers-color-scheme: dark)"
        />
      </head>
      <body className={uiFont.variable}>
        <FeedbackEffects />
        {children}
      </body>
    </html>
  );
}
