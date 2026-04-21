import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { PrototypeDiskGate } from "@/components/prototype-disk-gate";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "sirus.ai — Settings",
  description: "Settings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} font-sans antialiased`}>
        <PrototypeDiskGate>{children}</PrototypeDiskGate>
      </body>
    </html>
  );
}
