import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { SWRConfig } from 'swr';

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const montserratMono = Montserrat({
  variable: "--font-montserrat-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ArbitrageX Pro 2025 - Dashboard",
  description: "Enterprise DeFi Arbitrage Platform with Real-Time Blockchain Data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${montserratMono.variable} antialiased font-montserrat`}
      >
        <SWRConfig 
          value={{
            refreshInterval: 10000, // Global refresh every 10 seconds
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 5000,
            errorRetryCount: 3,
            errorRetryInterval: 2000,
          }}
        >
          {children}
        </SWRConfig>
      </body>
    </html>
  );
}
