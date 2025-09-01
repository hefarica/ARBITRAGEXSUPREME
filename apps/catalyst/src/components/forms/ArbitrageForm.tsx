/**
 * ArbitrageX Supreme - Arbitrage Form Component
 * Ingenio Pichichi S.A. - Formulario para configuración de arbitraje
 * 
 * Implementación metodica y disciplinada para input de tokens,
 * montos, gas fees y parámetros de arbitraje
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Wallet, 
  ArrowRightLeft, 
  Settings, 
  Play, 
  Pause, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  DollarSign, 
  Clock,
  Zap,
  Shield,
  Target
} from 'lucide-react'
import { useWallet, useArbitrage, useSimulation } from '@/hooks'
import { createTokenValidator, createEIP712Validator } from '@/lib/validation'
import type { ArbitrageOpportunity, ArbitrageStrategy, ExecutionResult } from '@/types/arbitrage'

// Types específicos del formulario
interface ArbitrageFormData {
  tokenIn: string
  tokenOut: string
  amountIn: string
  minAmountOut: string
  slippageTolerance: number
  gasPrice: string
  gasLimit: string
  strategy: string
  blockchain: number
  deadline: number
}

interface FormErrors {
  [key: string]: string
}

export const ArbitrageForm = () => {
  const { address, chainId, signer, signTypedData } = useWallet()
  const { executeArbitrage, simulateExecution } = useArbitrage()
  const { simulateOpportunity, estimateGas } = useSimulation()

  // Form state
  const [formData, setFormData] = useState<ArbitrageFormData>({
    tokenIn: '',
    tokenOut: '',
    amountIn: '',
    minAmountOut: '',
    slippageTolerance: 1.0, // 1%
    gasPrice: '20', // 20 Gwei
    gasLimit: '300000',
    strategy: 'INTRA_DEX',
    blockchain: chainId || 1,
    deadline: Math.floor(Date.now() / 1000) + 300 // 5 minutes
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [simulationResult, setSimulationResult] = useState<any>(null)
  const [gasEstimate, setGasEstimate] = useState<any>(null)

  // Validators
  const [tokenValidator, setTokenValidator] = useState<any>(null)
  const [eip712Validator, setEip712Validator] = useState<any>(null)

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    if (chainId) {
      setTokenValidator(createTokenValidator(chainId, 'MODERATE'))
      setEip712Validator(createEIP712Validator(chainId))
      setFormData(prev => ({ ...prev, blockchain: chainId }))
    }
  }, [chainId])

  // ============================================
  // FORM VALIDATION
  // ============================================

  const validateForm = useCallback(async (): Promise<boolean> => {
    const newErrors: FormErrors = {}

    // Validate wallet connection
    if (!address) {
      newErrors.wallet = 'Wallet not connected'
    }

    // Validate token addresses
    if (!formData.tokenIn) {
      newErrors.tokenIn = 'Token In is required'
    } else if (tokenValidator) {
      const validation = await tokenValidator.validateToken(formData.tokenIn)
      if (!validation.isValid) {
        newErrors.tokenIn = validation.reasons.join(', ')
      }
    }

    if (!formData.tokenOut) {
      newErrors.tokenOut = 'Token Out is required'
    } else if (tokenValidator) {
      const validation = await tokenValidator.validateToken(formData.tokenOut)
      if (!validation.isValid) {
        newErrors.tokenOut = validation.reasons.join(', ')
      }
    }

    // Validate token pair
    if (formData.tokenIn && formData.tokenOut && tokenValidator) {
      const pairValidation = await tokenValidator.validateTokenPair(
        formData.tokenIn,
        formData.tokenOut
      )
      if (!pairValidation.pairValid) {
        newErrors.tokenPair = pairValidation.reasons.join(', ')
      }
    }

    // Validate amounts
    if (!formData.amountIn) {
      newErrors.amountIn = 'Amount In is required'
    } else {
      const amount = parseFloat(formData.amountIn)
      if (isNaN(amount) || amount <= 0) {
        newErrors.amountIn = 'Amount must be greater than 0'
      }
    }

    if (!formData.minAmountOut) {
      newErrors.minAmountOut = 'Min Amount Out is required'
    } else {
      const amount = parseFloat(formData.minAmountOut)
      if (isNaN(amount) || amount <= 0) {
        newErrors.minAmountOut = 'Min Amount must be greater than 0'
      }
    }

    // Validate slippage
    if (formData.slippageTolerance < 0.1 || formData.slippageTolerance > 10) {
      newErrors.slippageTolerance = 'Slippage must be between 0.1% and 10%'
    }

    // Validate gas parameters
    const gasPrice = parseFloat(formData.gasPrice)
    if (isNaN(gasPrice) || gasPrice <= 0) {
      newErrors.gasPrice = 'Valid gas price is required'
    }

    const gasLimit = parseInt(formData.gasLimit)
    if (isNaN(gasLimit) || gasLimit < 21000) {
      newErrors.gasLimit = 'Gas limit must be at least 21,000'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, address, tokenValidator])

  // ============================================
  // FORM HANDLERS
  // ============================================

  const handleInputChange = useCallback((field: keyof ArbitrageFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }, [errors])

  const handleTokenSwap = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      tokenIn: prev.tokenOut,
      tokenOut: prev.tokenIn,
      amountIn: prev.minAmountOut,
      minAmountOut: prev.amountIn
    }))
  }, [])

  // ============================================
  // SIMULATION & ESTIMATION
  // ============================================

  const runSimulation = useCallback(async () => {
    if (!await validateForm()) return

    setIsLoading(true)
    try {
      // Create mock opportunity for simulation
      const mockOpportunity: ArbitrageOpportunity = {
        id: `sim_${Date.now()}`,
        strategy: {
          id: `strat_${Date.now()}`,
          type: formData.strategy as any,
          name: `${formData.strategy} Strategy`,
          complexity: 'Intermedia',
          roiMin: 0.5,
          roiExpected: [0.5, 5.0],
          executionTime: [5, 30],
          gasCost: formData.gasPrice,
          riskLevel: 'Medio',
          description: 'Simulation opportunity',
          isActive: true
        },
        tokenIn: formData.tokenIn,
        tokenOut: formData.tokenOut,
        amountIn: parseFloat(formData.amountIn),
        expectedAmountOut: parseFloat(formData.minAmountOut),
        expectedProfit: 0, // Will be calculated
        path: [formData.tokenIn, formData.tokenOut],
        pools: [],
        chainId: formData.blockchain,
        gasEstimate: parseInt(formData.gasLimit),
        confidenceScore: 85,
        timestamp: Date.now(),
        expiresAt: Date.now() + 300000 // 5 minutes
      }

      const [simulation, gasEst] = await Promise.all([
        simulateOpportunity(mockOpportunity),
        estimateGas(mockOpportunity)
      ])

      setSimulationResult(simulation)
      setGasEstimate(gasEst)

    } catch (error: any) {
      console.error('Simulation error:', error)
      setErrors({ simulation: error.message })
    } finally {
      setIsLoading(false)
    }
  }, [formData, validateForm, simulateOpportunity, estimateGas])

  // ============================================
  // EXECUTION
  // ============================================

  const executeTransaction = useCallback(async () => {
    if (!await validateForm() || !simulationResult) return
    if (!address || !signer || !eip712Validator) {
      setErrors({ execution: 'Wallet not properly connected' })
      return
    }

    setIsLoading(true)
    try {
      // Create EIP-712 payload
      const payload = {
        opportunityId: `exec_${Date.now()}`,
        tokenIn: formData.tokenIn,
        tokenOut: formData.tokenOut,
        amountIn: formData.amountIn,
        minAmountOut: formData.minAmountOut,
        deadline: formData.deadline,
        recipient: address,
        nonce: Date.now()
      }

      // Sign payload
      const signature = await eip712Validator.signArbitragePayload(payload, signer)

      // Execute arbitrage (this would call the actual execution API)
      console.log('Executing with signed payload:', { payload, signature })

    } catch (error: any) {
      console.error('Execution error:', error)
      setErrors({ execution: error.message })
    } finally {
      setIsLoading(false)
    }
  }, [formData, simulationResult, address, signer, eip712Validator, validateForm])

  // ============================================
  // RENDER
  // ============================================

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          ArbitrageX Supreme - Trading Form
        </CardTitle>
        <CardDescription>
          Configure and execute arbitrage opportunities with enterprise security
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Wallet Status */}
        {address && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <Badge variant="default" className="bg-green-600">Connected</Badge>
            <span className="text-sm text-green-800">
              {address.slice(0, 6)}...{address.slice(-4)} on Chain {chainId}
            </span>
          </div>
        )}

        {/* Token Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tokenIn">Token In</Label>
            <Input
              id="tokenIn"
              placeholder="0x... Token address"
              value={formData.tokenIn}
              onChange={(e) => handleInputChange('tokenIn', e.target.value)}
              className={errors.tokenIn ? 'border-red-500' : ''}
            />
            {errors.tokenIn && (
              <p className="text-sm text-red-600">{errors.tokenIn}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tokenOut">Token Out</Label>
            <div className="flex gap-2">
              <Input
                id="tokenOut"
                placeholder="0x... Token address"
                value={formData.tokenOut}
                onChange={(e) => handleInputChange('tokenOut', e.target.value)}
                className={errors.tokenOut ? 'border-red-500' : ''}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={handleTokenSwap}
                title="Intercambiar tokens"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            </div>
            {errors.tokenOut && (
              <p className="text-sm text-red-600">{errors.tokenOut}</p>
            )}
          </div>
        </div>

        {errors.tokenPair && (
          <p className="text-sm text-red-600">{errors.tokenPair}</p>
        )}

        {/* Amount Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amountIn">Amount In</Label>
            <Input
              id="amountIn"
              type="number"
              placeholder="0.0"
              value={formData.amountIn}
              onChange={(e) => handleInputChange('amountIn', e.target.value)}
              className={errors.amountIn ? 'border-red-500' : ''}
            />
            {errors.amountIn && (
              <p className="text-sm text-red-600">{errors.amountIn}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="minAmountOut">Min Amount Out</Label>
            <Input
              id="minAmountOut"
              type="number"
              placeholder="0.0"
              value={formData.minAmountOut}
              onChange={(e) => handleInputChange('minAmountOut', e.target.value)}
              className={errors.minAmountOut ? 'border-red-500' : ''}
            />
            {errors.minAmountOut && (
              <p className="text-sm text-red-600">{errors.minAmountOut}</p>
            )}
          </div>
        </div>

        {/* Strategy & Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="strategy">Strategy</Label>
            <Select value={formData.strategy} onValueChange={(value) => handleInputChange('strategy', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTRA_DEX">Intra-DEX</SelectItem>
                <SelectItem value="INTER_DEX">Inter-DEX</SelectItem>
                <SelectItem value="CROSS_CHAIN">Cross-Chain</SelectItem>
                <SelectItem value="FLASH_LOAN">Flash Loan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slippageTolerance">Slippage (%)</Label>
            <Input
              id="slippageTolerance"
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={formData.slippageTolerance}
              onChange={(e) => handleInputChange('slippageTolerance', parseFloat(e.target.value))}
              className={errors.slippageTolerance ? 'border-red-500' : ''}
            />
            {errors.slippageTolerance && (
              <p className="text-sm text-red-600">{errors.slippageTolerance}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gasPrice">Gas Price (Gwei)</Label>
            <Input
              id="gasPrice"
              type="number"
              value={formData.gasPrice}
              onChange={(e) => handleInputChange('gasPrice', e.target.value)}
              className={errors.gasPrice ? 'border-red-500' : ''}
            />
            {errors.gasPrice && (
              <p className="text-sm text-red-600">{errors.gasPrice}</p>
            )}
          </div>
        </div>

        {/* Simulation Results */}
        {simulationResult && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Simulation Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium">Success Rate</p>
                  <p className="text-blue-600">{simulationResult.confidence}%</p>
                </div>
                <div>
                  <p className="font-medium">Est. Profit</p>
                  <p className="text-green-600">${simulationResult.estimatedProfit?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="font-medium">Gas Used</p>
                  <p>{simulationResult.gasUsed?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-medium">Risk Score</p>
                  <Badge variant={simulationResult.riskScore > 7 ? 'destructive' : 'default'}>
                    {simulationResult.riskScore}/10
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={runSimulation}
            disabled={isLoading || !address}
            className="flex-1 flex items-center gap-2"
            variant="outline"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Target className="h-4 w-4" />
                Simulate
              </>
            )}
          </Button>
          
          <Button 
            onClick={executeTransaction}
            disabled={isLoading || !address || !simulationResult}
            className="flex-1 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Execute
              </>
            )}
          </Button>
        </div>

        {/* Error Display */}
        {Object.keys(errors).length > 0 && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-4">
              <h4 className="font-medium text-red-800 mb-2">Validation Errors:</h4>
              <ul className="text-sm text-red-600 space-y-1">
                {Object.entries(errors).map(([field, error]) => (
                  <li key={field}>• {error}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  )
}