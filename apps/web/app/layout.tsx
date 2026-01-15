import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { RouteProgressBar } from "@/components/transitions/RouteProgressBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CCW ERP - Equipment Supplier",
  description: "Premium ERP system for equipment suppliers",
  other: {
    'grammarly': 'false',
    'grammarly-extension': 'off',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <RouteProgressBar />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
