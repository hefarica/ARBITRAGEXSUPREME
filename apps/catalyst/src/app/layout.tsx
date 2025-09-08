/**
 * ArbitrageX Supreme - Root Layout
 * Ingenio Pichichi S.A. - Layout principal de la aplicación
 */

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import Header from '@/components/layout/Header'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ArbitrageX Supreme - Ingenio Pichichi S.A.',
  description: 'Sistema Enterprise de Arbitraje DeFi más avanzado del mundo. 20+ blockchains, 200+ protocolos, 14 estrategias Flash Loan sin datos mock.',
  keywords: 'arbitraje, defi, flash loans, blockchain, ethereum, uniswap, aave, compound, ingenio pichichi',
  authors: [{ name: 'Ingenio Pichichi S.A.' }],
  creator: 'ArbitrageX Team',
  publisher: 'Ingenio Pichichi S.A.',
  robots: 'index, follow',
  viewport: 'width=device-width, initial-scale=1',
  openGraph: {
    title: 'ArbitrageX Supreme - Sistema Enterprise DeFi',
    description: 'El sistema de arbitraje más completo con 20+ blockchains y 200+ protocolos sin mocks',
    type: 'website',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArbitrageX Supreme',
    description: 'Sistema Enterprise de Arbitraje DeFi',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#1e40af" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          <div id="root">
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
        
        {/* Scripts de inicialización */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // ArbitrageX Supreme - Sistema de inicialización
              console.log('🚀 ArbitrageX Supreme v2.0.0 - Ingenio Pichichi S.A.');
              console.log('📊 Sistema Enterprise sin datos mock');
              console.log('⚡ 20+ Blockchains • 200+ Protocolos • 14 Estrategias');
              
              // Configuración de performance monitoring
              if (typeof window !== 'undefined') {
                window.arbitrageXConfig = {
                  version: '2.0.0',
                  environment: 'production',
                  apiBase: '/api',
                  refreshInterval: 30000, // 30 segundos
                  company: 'Ingenio Pichichi S.A.'
                };
                
                // Performance timing
                window.addEventListener('load', function() {
                  const perfData = performance.timing;
                  const loadTime = perfData.loadEventEnd - perfData.navigationStart;
                  console.log('⚡ Tiempo de carga:', loadTime + 'ms');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}