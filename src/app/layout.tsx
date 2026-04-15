import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elfster AI — prototype",
  description: "Natural-language gift discovery prototype",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
