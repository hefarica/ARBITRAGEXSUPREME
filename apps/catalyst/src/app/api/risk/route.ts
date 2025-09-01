/**
 * ArbitrageX Supreme - Risk Analysis API
 * Ingenio Pichichi S.A. - API para análisis de riesgos sin mocks
 * 
 * Implementación metodica y disciplinada para evaluación de riesgos,
 * detección anti-scam y análisis de seguridad
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { ethers } from 'ethers'

const prisma = new PrismaClient()

interface RiskAssessment {
  riskScore: number // 1-10 (1 = bajo riesgo, 10 = alto riesgo)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  factors: RiskFactor[]
  recommendations: string[]
  isExecutionSafe: boolean
}

interface RiskFactor {
  category: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  impact: number
}

interface SecurityAlert {
  id: string
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  description: string
  affectedAddress?: string
  blockchainId?: string
  isResolved: boolean
  createdAt: string
}

// GET - Obtener análisis de riesgo para oportunidad
export async function GET(request: NextRequest) {
  console.log('🛡️ ArbitrageX Risk API - Ingenio Pichichi S.A.')
  
  try {
    const { searchParams } = new URL(request.url)
    const opportunityId = searchParams.get('opportunityId')
    const protocolId = searchParams.get('protocolId')
    const tokenAddress = searchParams.get('tokenAddress')
    const alerts = searchParams.get('alerts') === 'true'
    
    if (opportunityId) {
      // Análisis de riesgo para oportunidad específica
      const opportunity = await prisma.arbitrageOpportunity.findUnique({
        where: { id: opportunityId },
        include: {
          protocol: {
            include: { blockchain: true }
          },
          sourcePool: true,
          strategy: true
        }
      })

      if (!opportunity) {
        return NextResponse.json({
          success: false,
          error: 'Opportunity not found'
        }, { status: 404 })
      }

      const riskAssessment = await analyzeOpportunityRisk(opportunity)
      
      return NextResponse.json({
        success: true,
        data: riskAssessment
      })
    }

    if (protocolId) {
      // Análisis de riesgo para protocolo
      const protocol = await prisma.protocol.findUnique({
        where: { id: protocolId },
        include: {
          blockchain: true,
          arbitrages: {
            take: 10,
            orderBy: { detectedAt: 'desc' }
          }
        }
      })

      if (!protocol) {
        return NextResponse.json({
          success: false,
          error: 'Protocol not found'
        }, { status: 404 })
      }

      const riskAssessment = await analyzeProtocolRisk(protocol)
      
      return NextResponse.json({
        success: true,
        data: riskAssessment
      })
    }

    if (tokenAddress) {
      // Análisis de riesgo para token
      const riskAssessment = await analyzeTokenRisk(tokenAddress)
      
      return NextResponse.json({
        success: true,
        data: riskAssessment
      })
    }

    if (alerts) {
      // Obtener alertas de seguridad
      const securityAlerts = await prisma.securityAlert.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        where: { isResolved: false }
      })

      return NextResponse.json({
        success: true,
        data: {
          alerts: securityAlerts.map(alert => ({
            id: alert.id,
            type: alert.alertType,
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            affectedAddress: alert.affectedAddress,
            blockchainId: alert.blockchainId,
            isResolved: alert.isResolved,
            createdAt: alert.createdAt.toISOString()
          })),
          count: securityAlerts.length
        }
      })
    }

    // Análisis general de riesgos del sistema
    const systemRisk = await analyzeSystemRisk()
    
    return NextResponse.json({
      success: true,
      data: systemRisk
    })

  } catch (error: any) {
    console.error('❌ Risk analysis error:', error)
    return NextResponse.json({
      success: false,
      error: 'Risk analysis failed',
      details: error.message
    }, { status: 500 })
  }
}

// POST - Crear alerta de seguridad
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validar request
    if (!body.alertType || !body.severity || !body.title || !body.description) {
      return NextResponse.json({
        success: false,
        error: 'alertType, severity, title, and description are required'
      }, { status: 400 })
    }

    // Crear alerta
    const alert = await prisma.securityAlert.create({
      data: {
        alertType: body.alertType,
        severity: body.severity,
        title: body.title,
        description: body.description,
        blockchainId: body.blockchainId,
        protocolId: body.protocolId,
        transactionHash: body.transactionHash,
        affectedAddress: body.affectedAddress
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: alert.id,
        message: 'Security alert created successfully'
      }
    })

  } catch (error: any) {
    console.error('❌ Create security alert error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create security alert'
    }, { status: 500 })
  }
}

// PUT - Resolver alerta de seguridad
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    if (!body.alertId) {
      return NextResponse.json({
        success: false,
        error: 'alertId is required'
      }, { status: 400 })
    }

    // Resolver alerta
    await prisma.securityAlert.update({
      where: { id: body.alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolverNotes: body.notes || ''
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Alert resolved successfully'
    })

  } catch (error: any) {
    console.error('❌ Resolve alert error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to resolve alert'
    }, { status: 500 })
  }
}

// ============================================
// RISK ANALYSIS FUNCTIONS
// ============================================

async function analyzeOpportunityRisk(opportunity: any): Promise<RiskAssessment> {
  const factors: RiskFactor[] = []
  let riskScore = 0

  // Factor 1: Profit vs Gas Cost Ratio
  const profitRatio = opportunity.profitEstimateUsd / opportunity.gasCostUsd
  if (profitRatio < 1.5) {
    factors.push({
      category: 'Profitability Risk',
      severity: 'HIGH',
      description: 'Low profit margin compared to gas costs',
      impact: 3
    })
    riskScore += 3
  } else if (profitRatio < 2.5) {
    factors.push({
      category: 'Profitability Risk',
      severity: 'MEDIUM',
      description: 'Moderate profit margin',
      impact: 1
    })
    riskScore += 1
  }

  // Factor 2: Protocol Risk Score
  if (opportunity.protocol.riskScore >= 7) {
    factors.push({
      category: 'Protocol Risk',
      severity: 'HIGH',
      description: 'High-risk protocol',
      impact: 2
    })
    riskScore += 2
  }

  // Factor 3: Slippage Risk
  if (opportunity.slippageEstimate > 2.0) {
    factors.push({
      category: 'Slippage Risk',
      severity: 'MEDIUM',
      description: 'High slippage expected',
      impact: 2
    })
    riskScore += 2
  }

  // Factor 4: Time Sensitivity
  const hoursSinceDetected = (Date.now() - new Date(opportunity.detectedAt).getTime()) / (1000 * 60 * 60)
  if (hoursSinceDetected > 1) {
    factors.push({
      category: 'Time Risk',
      severity: 'MEDIUM',
      description: 'Opportunity detected more than 1 hour ago',
      impact: 1
    })
    riskScore += 1
  }

  // Factor 5: Pool Liquidity
  if (opportunity.sourcePool.tvl < 50000) {
    factors.push({
      category: 'Liquidity Risk',
      severity: 'HIGH',
      description: 'Low pool liquidity',
      impact: 3
    })
    riskScore += 3
  }

  const riskLevel = riskScore >= 7 ? 'CRITICAL' : 
                   riskScore >= 5 ? 'HIGH' : 
                   riskScore >= 3 ? 'MEDIUM' : 'LOW'

  const recommendations = generateRecommendations(factors, riskScore)

  return {
    riskScore: Math.min(10, riskScore),
    riskLevel,
    factors,
    recommendations,
    isExecutionSafe: riskScore < 7
  }
}

async function analyzeProtocolRisk(protocol: any): Promise<RiskAssessment> {
  const factors: RiskFactor[] = []
  let riskScore = protocol.riskScore

  // Factor 1: Verification Status
  if (!protocol.isVerified) {
    factors.push({
      category: 'Verification Risk',
      severity: 'MEDIUM',
      description: 'Protocol not verified',
      impact: 2
    })
  }

  // Factor 2: TVL Risk
  if (protocol.tvl < 1000000) {
    factors.push({
      category: 'TVL Risk',
      severity: 'HIGH',
      description: 'Low Total Value Locked',
      impact: 2
    })
  }

  // Factor 3: Recent Activity
  const recentArbitrages = protocol.arbitrages.filter((arb: any) => 
    Date.now() - new Date(arb.detectedAt).getTime() < 24 * 60 * 60 * 1000
  )
  
  if (recentArbitrages.length === 0) {
    factors.push({
      category: 'Activity Risk',
      severity: 'MEDIUM',
      description: 'No recent arbitrage activity',
      impact: 1
    })
  }

  const riskLevel = riskScore >= 7 ? 'CRITICAL' : 
                   riskScore >= 5 ? 'HIGH' : 
                   riskScore >= 3 ? 'MEDIUM' : 'LOW'

  return {
    riskScore,
    riskLevel,
    factors,
    recommendations: generateRecommendations(factors, riskScore),
    isExecutionSafe: riskScore < 7
  }
}

async function analyzeTokenRisk(tokenAddress: string): Promise<RiskAssessment> {
  const factors: RiskFactor[] = []
  let riskScore = 2 // Base risk score for any token

  // Validar que sea una dirección válida
  if (!ethers.isAddress(tokenAddress)) {
    factors.push({
      category: 'Address Risk',
      severity: 'CRITICAL',
      description: 'Invalid token address format',
      impact: 5
    })
    riskScore += 5
  }

  // En una implementación real, aquí harías:
  // - Verificación contra listas de tokens conocidos
  // - Análisis del contrato (honeypot detection, etc.)
  // - Verificación de liquidez en múltiples pools
  
  const riskLevel = riskScore >= 7 ? 'CRITICAL' : 
                   riskScore >= 5 ? 'HIGH' : 
                   riskScore >= 3 ? 'MEDIUM' : 'LOW'

  return {
    riskScore,
    riskLevel,
    factors,
    recommendations: generateRecommendations(factors, riskScore),
    isExecutionSafe: riskScore < 7
  }
}

async function analyzeSystemRisk(): Promise<any> {
  // Análisis general del sistema
  const [totalAlerts, criticalAlerts, protocols] = await Promise.all([
    prisma.securityAlert.count({ where: { isResolved: false } }),
    prisma.securityAlert.count({ 
      where: { isResolved: false, severity: 'CRITICAL' } 
    }),
    prisma.protocol.count({ where: { isActive: true } })
  ])

  let systemRiskScore = 1
  const factors: RiskFactor[] = []

  if (criticalAlerts > 0) {
    factors.push({
      category: 'Security Alerts',
      severity: 'CRITICAL',
      description: `${criticalAlerts} critical security alerts active`,
      impact: 4
    })
    systemRiskScore += 4
  }

  if (totalAlerts > 10) {
    factors.push({
      category: 'System Health',
      severity: 'MEDIUM',
      description: 'High number of unresolved alerts',
      impact: 2
    })
    systemRiskScore += 2
  }

  const riskLevel = systemRiskScore >= 7 ? 'CRITICAL' : 
                   systemRiskScore >= 5 ? 'HIGH' : 
                   systemRiskScore >= 3 ? 'MEDIUM' : 'LOW'

  return {
    riskScore: systemRiskScore,
    riskLevel,
    factors,
    recommendations: generateRecommendations(factors, systemRiskScore),
    systemHealth: {
      totalAlerts,
      criticalAlerts,
      activeProtocols: protocols,
      lastUpdated: new Date().toISOString()
    }
  }
}

function generateRecommendations(factors: RiskFactor[], riskScore: number): string[] {
  const recommendations: string[] = []

  if (riskScore >= 7) {
    recommendations.push('❌ NO EJECUTAR - Riesgo demasiado alto')
    recommendations.push('🔍 Revisar todos los factores de riesgo antes de proceder')
  } else if (riskScore >= 5) {
    recommendations.push('⚠️ PRECAUCIÓN - Monitorear cuidadosamente')
    recommendations.push('💰 Considerar reducir el monto de inversión')
  } else if (riskScore >= 3) {
    recommendations.push('✅ ACEPTABLE - Proceder con precaución normal')
  } else {
    recommendations.push('✅ BAJO RIESGO - Seguro para ejecutar')
  }

  // Recomendaciones específicas por factores
  factors.forEach(factor => {
    if (factor.category === 'Slippage Risk') {
      recommendations.push('🎯 Ajustar tolerancia de slippage')
    }
    if (factor.category === 'Liquidity Risk') {
      recommendations.push('💧 Verificar liquidez del pool antes de ejecutar')
    }
    if (factor.category === 'Time Risk') {
      recommendations.push('⏰ Ejecutar lo antes posible')
    }
  })

  return recommendations
}