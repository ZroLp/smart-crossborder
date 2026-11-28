import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/lib/client-providers";
import { BRAND_NAME } from "@/lib/brand";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: `${BRAND_NAME} — AI-Powered Cross-Border E-Commerce Platform`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.variable} font-['Inter','Microsoft_YaHei',sans-serif]`}>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
