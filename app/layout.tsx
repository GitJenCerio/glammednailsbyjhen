import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "glammednailsbyjhen - Professional Nail Services",
  description: "Premium nail art and manicure services. Book your appointment today!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

