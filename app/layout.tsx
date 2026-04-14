import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/contexts/UserContext";

const geistSans = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cesta++ - Listas de la compra",
  description: "Gestiona tus listas de la compra y productos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body
        className={`${geistSans.className} min-h-full bg-gradient-to-br from-amber-50 via-orange-50 to-sky-100 text-slate-900 selection:bg-orange-200 selection:text-slate-900`}
      >
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
