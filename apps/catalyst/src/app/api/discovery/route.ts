/**
 * ArbitrageX Supreme - Protocol Discovery API
 * Ingenio Pichichi S.A. - API para motor de descubrimiento
 */

import { NextRequest, NextResponse } from 'next/server'
import { protocolDiscoveryEngine } from '../../../lib/services/protocol-discovery'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    switch (action) {
      case 'stats':
        const stats = await protocolDiscoveryEngine.getEngineStats()
        return NextResponse.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString()
        })
        
      case 'health':
        const health = await protocolDiscoveryEngine.getProtocolsHealth()
        return NextResponse.json({
          success: true,
          data: health,
          timestamp: new Date().toISOString()
        })
        
      case 'top-protocols':
        const limit = parseInt(searchParams.get('limit') || '10')
        const topProtocols = await protocolDiscoveryEngine.getTopProtocols(limit)
        return NextResponse.json({
          success: true,
          data: topProtocols,
          timestamp: new Date().toISOString()
        })
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action parameter',
          availableActions: ['stats', 'health', 'top-protocols']
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('❌ Discovery API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    
    switch (action) {
      case 'start':
        await protocolDiscoveryEngine.startDiscovery()
        return NextResponse.json({
          success: true,
          message: 'Protocol Discovery Engine started',
          timestamp: new Date().toISOString()
        })
        
      case 'stop':
        await protocolDiscoveryEngine.stopDiscovery()
        return NextResponse.json({
          success: true,
          message: 'Protocol Discovery Engine stopped',
          timestamp: new Date().toISOString()
        })
        
      case 'scan':
        await protocolDiscoveryEngine.forceScan()
        return NextResponse.json({
          success: true,
          message: 'Manual scan completed',
          timestamp: new Date().toISOString()
        })
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          availableActions: ['start', 'stop', 'scan']
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('❌ Discovery API POST error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}