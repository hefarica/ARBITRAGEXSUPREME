import { NextRequest, NextResponse } from 'next/server'
import { arbitrageService } from '@/services/arbitrageService'

// =============================================
// ENDPOINT DE DIAGNÓSTICO DE CONFIGURACIÓN
// =============================================

export async function GET(request: NextRequest) {
  try {
    console.log('='.repeat(80))
    console.log('🔍 DIAGNÓSTICO DE CONFIGURACIÓN - ARBITRAGEX PRO 2025')
    console.log('='.repeat(80))

    // Obtener información de diagnóstico del servicio
    const diagnosticInfo = arbitrageService.getDiagnosticInfo()
    
    // Verificar variables de entorno
    const envCheck = {
      // Backend Configuration
      NEXT_PUBLIC_BACKEND_HOST: process.env.NEXT_PUBLIC_BACKEND_HOST || 'NO CONFIGURADO',
      NEXT_PUBLIC_BACKEND_PORT: process.env.NEXT_PUBLIC_BACKEND_PORT || 'NO CONFIGURADO',
      NEXT_PUBLIC_BACKEND_PROTOCOL: process.env.NEXT_PUBLIC_BACKEND_PROTOCOL || 'NO CONFIGURADO',
      BACKEND_URL: process.env.BACKEND_URL || 'NO CONFIGURADO',
      NEXT_PUBLIC_USE_PROXY: process.env.NEXT_PUBLIC_USE_PROXY || 'NO CONFIGURADO',

      // Authentication (mostrar solo si están configuradas)
      NEXT_PUBLIC_ARBITRAGEX_API_KEY: process.env.NEXT_PUBLIC_ARBITRAGEX_API_KEY ? 
        `✅ CONFIGURADO (***${process.env.NEXT_PUBLIC_ARBITRAGEX_API_KEY.slice(-4)})` : 
        '❌ NO CONFIGURADO',
      NEXT_PUBLIC_ARBITRAGEX_CLIENT_ID: process.env.NEXT_PUBLIC_ARBITRAGEX_CLIENT_ID || '❌ NO CONFIGURADO',
      NEXT_PUBLIC_ARBITRAGEX_CLIENT_SECRET: process.env.NEXT_PUBLIC_ARBITRAGEX_CLIENT_SECRET ? 
        `✅ CONFIGURADO (***${process.env.NEXT_PUBLIC_ARBITRAGEX_CLIENT_SECRET.slice(-4)})` : 
        '❌ NO CONFIGURADO',

      // Blockchain Configuration
      NEXT_PUBLIC_WALLET_ADDRESS: process.env.NEXT_PUBLIC_WALLET_ADDRESS || '⚠️ OPCIONAL - NO CONFIGURADO',
      NEXT_PUBLIC_NETWORK_ID: process.env.NEXT_PUBLIC_NETWORK_ID || '⚠️ OPCIONAL - USANDO mainnet',

      // RPC URLs
      NEXT_PUBLIC_ETHEREUM_RPC_URL: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
      NEXT_PUBLIC_POLYGON_RPC_URL: process.env.NEXT_PUBLIC_POLYGON_RPC_URL ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
      NEXT_PUBLIC_BSC_RPC_URL: process.env.NEXT_PUBLIC_BSC_RPC_URL ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
      NEXT_PUBLIC_ARBITRUM_RPC_URL: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
      NEXT_PUBLIC_OPTIMISM_RPC_URL: process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',

      // External Services
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
      NEXT_PUBLIC_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
      NEXT_PUBLIC_COINGECKO_API_KEY: process.env.NEXT_PUBLIC_COINGECKO_API_KEY ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
      NEXT_PUBLIC_1INCH_API_KEY: process.env.NEXT_PUBLIC_1INCH_API_KEY ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO',
    }

    // Credenciales críticas faltantes
    const criticalMissing = []
    if (!process.env.NEXT_PUBLIC_ARBITRAGEX_API_KEY) criticalMissing.push('NEXT_PUBLIC_ARBITRAGEX_API_KEY')
    if (!process.env.NEXT_PUBLIC_ARBITRAGEX_CLIENT_ID) criticalMissing.push('NEXT_PUBLIC_ARBITRAGEX_CLIENT_ID')
    if (!process.env.NEXT_PUBLIC_ARBITRAGEX_CLIENT_SECRET) criticalMissing.push('NEXT_PUBLIC_ARBITRAGEX_CLIENT_SECRET')

    // Credenciales recomendadas faltantes
    const recommendedMissing = []
    if (!process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL) recommendedMissing.push('NEXT_PUBLIC_ETHEREUM_RPC_URL')
    if (!process.env.NEXT_PUBLIC_POLYGON_RPC_URL) recommendedMissing.push('NEXT_PUBLIC_POLYGON_RPC_URL')
    if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) recommendedMissing.push('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID')
    if (!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY) recommendedMissing.push('NEXT_PUBLIC_ALCHEMY_API_KEY')

    const diagnosticResult = {
      timestamp: new Date().toISOString(),
      status: criticalMissing.length === 0 ? 'READY' : 'CONFIGURATION_INCOMPLETE',
      arbitrageService: diagnosticInfo,
      environment: envCheck,
      critical: {
        missing: criticalMissing,
        count: criticalMissing.length,
        isComplete: criticalMissing.length === 0
      },
      recommended: {
        missing: recommendedMissing,
        count: recommendedMissing.length,
        isComplete: recommendedMissing.length === 0
      },
      instructions: {
        nextSteps: criticalMissing.length > 0 ? [
          '1. Copiar .env.example a .env.local',
          '2. Configurar las credenciales críticas faltantes',
          '3. Reiniciar el servidor de desarrollo',
          '4. Volver a ejecutar este diagnóstico'
        ] : [
          '✅ Configuración crítica completa',
          'Opcionalmente configurar credenciales recomendadas',
          'El sistema está listo para usar'
        ]
      }
    }

    // Log en consola del servidor
    console.log('📊 ESTADO DE CONFIGURACIÓN:')
    console.log(`Status: ${diagnosticResult.status}`)
    console.log(`Backend URL: ${diagnosticInfo.backendUrl}`)
    console.log(`Configuración completa: ${diagnosticInfo.isConfigured ? '✅ SÍ' : '❌ NO'}`)
    
    if (criticalMissing.length > 0) {
      console.log('❌ CREDENCIALES CRÍTICAS FALTANTES:')
      criticalMissing.forEach(cred => console.log(`   - ${cred}`))
    }

    if (recommendedMissing.length > 0) {
      console.log('⚠️ CREDENCIALES RECOMENDADAS FALTANTES:')
      recommendedMissing.forEach(cred => console.log(`   - ${cred}`))
    }

    console.log('='.repeat(80))

    return NextResponse.json(diagnosticResult, { status: 200 })

  } catch (error: any) {
    console.error('❌ Error en diagnóstico:', error)
    return NextResponse.json(
      { 
        error: 'Diagnostic failed',
        message: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}