import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/contexts/UserContext";
import { MeshBackground } from "@/components/auth/MeshBackground";

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
    <html lang="es" className="h-full antialiased dark">
      <body
        className={`${geistSans.className} min-h-screen bg-slate-950 text-slate-200 selection:bg-[#fb923c]/30 selection:text-white relative overflow-x-hidden`}
      >
        <MeshBackground />
        <UserProvider>
          <div className="relative z-10">
            {children}
          </div>
        </UserProvider>
      </body>
    </html>
  );
}
