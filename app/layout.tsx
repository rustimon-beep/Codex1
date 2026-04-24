import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://bortoleto.vercel.app"),
  title: "Система заказов",
  description: "Система обработки и мониторинга заказов",
  manifest: "/manifest.json",
  themeColor: "#0f172a",
  openGraph: {
    title: "Система заказов",
    description: "Система обработки и мониторинга заказов",
    images: [
      {
        url: "https://bolt.new/static/og_default.png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "https://bolt.new/static/og_default.png",
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="apple-touch-icon" href="/avtodom-logo.png" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}