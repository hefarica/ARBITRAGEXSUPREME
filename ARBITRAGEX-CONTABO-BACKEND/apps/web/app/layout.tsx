import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import "../styles/themes.css";
import { SWRConfig } from 'swr';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ArbitrageX Pro 2025 - Dashboard",
  description: "Enterprise DeFi Arbitrage Platform with Real-Time Blockchain Data - Sistema Híbrido JavaScript/Solidity",
  keywords: "DeFi, Arbitrage, Blockchain, Cryptocurrency, Trading, Real-time",
  authors: [{ name: "ArbitrageX Team" }],
};

// Separar viewport según recomendación de Next.js 14+
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`
          ${montserrat.variable} ${inter.variable} 
          antialiased 
          font-[var(--font-family)]
          bg-[var(--color-bg)]
          text-[var(--color-text)]
          transition-colors duration-300
        `}
      >
        <SWRConfig 
          value={{
            refreshInterval: 15000, // Reducir frecuencia para mejorar performance
            revalidateOnFocus: false, // Evitar recargas constantes al cambiar de tab
            revalidateOnReconnect: true,
            dedupingInterval: 10000, // Aumentar deduplicación
            errorRetryCount: 2, // Reducir reintentos
            errorRetryInterval: 3000,
            // Cache más agresivo
            keepPreviousData: true,
            // Usar suspense para mejor UX
            suspense: false,
          }}
        >
          <div className="flex h-screen w-screen overflow-hidden">
            {/* Sidebar */}
            <Sidebar />
            
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <Header />
              
              {/* Page Content */}
              <main className="
                flex-1 overflow-y-auto
                bg-[var(--color-bg)]
                p-6
                font-[var(--font-family)]
              ">
                {children}
              </main>
            </div>
          </div>
        </SWRConfig>
      </body>
    </html>
  );
}
