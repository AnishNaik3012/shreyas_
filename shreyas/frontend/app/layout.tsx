import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Savemom Hospital Assistant",
  description: "Maternal care assistant",
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
