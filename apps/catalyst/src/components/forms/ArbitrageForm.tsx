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
import { useWeb3, formatEther, parseEther, isAddress } from '@/lib/web3'
import { createTokenValidator, createEIP712Validator } from '@/lib/validation'
import type { ArbitrageOpportunity, ArbitrageStrategy, ExecutionResult } from '@/types/arbitrage'
import { toast } from 'sonner'

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
  const { isConnected, account, network, loading, connect, switchNetwork, web3Manager } = useWeb3()
  
  // Derived values for compatibility
  const address = account
  const chainId = network?.chainId
  const signer = web3Manager?.getSigner()

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
    if (!isConnected || !address) {
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
  }, [formData, address, tokenValidator, isConnected])

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
    if (!web3Manager?.isConnected()) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsLoading(true)
    try {
      // Create strategy for simulation
      const strategies = [{
        id: `strat_${Date.now()}`,
        name: `${formData.strategy} Strategy`,
        type: formData.strategy,
        enabled: true,
        minProfitBps: 50, // 0.5%
        maxSlippageBps: formData.slippageTolerance * 100,
        gasLimit: parseInt(formData.gasLimit)
      }]

      // Simulate arbitrage using Web3Manager
      const simulation = await web3Manager.simulateArbitrage(
        formData.tokenIn,
        formData.tokenOut,
        parseEther(formData.amountIn).toString(),
        strategies
      )

      setSimulationResult(simulation)
      setGasEstimate({
        gasLimit: simulation.gasEstimate,
        gasPrice: formData.gasPrice,
        totalCost: (simulation.gasEstimate * parseFloat(formData.gasPrice)) / 1e9 // Convert to ETH
      })

      if (simulation.success) {
        toast.success(`Simulation successful! Potential profit: ${formatEther(simulation.profitAmount)} tokens`)
      } else {
        toast.warning('Simulation shows no profit opportunity')
      }

    } catch (error: any) {
      console.error('Simulation error:', error)
      toast.error(`Simulation failed: ${error.message}`)
      setErrors({ simulation: error.message })
    } finally {
      setIsLoading(false)
    }
  }, [formData, validateForm, web3Manager])

  // ============================================
  // EXECUTION
  // ============================================

  const executeTransaction = useCallback(async () => {
    if (!await validateForm() || !simulationResult) return
    if (!web3Manager?.isConnected()) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!simulationResult.success) {
      toast.error('Cannot execute - simulation shows no profit')
      return
    }

    setIsLoading(true)
    try {
      // Check token allowances first
      const engineContract = web3Manager.getContract('arbitrageEngine')
      if (!engineContract) {
        throw new Error('ArbitrageEngine contract not available')
      }

      const allowance = await web3Manager.getAllowance(
        formData.tokenIn,
        network?.arbitrageEngine || ''
      )

      const amountInWei = parseEther(formData.amountIn)
      
      // Approve if needed
      if (BigInt(allowance) < amountInWei) {
        toast.info('Approving token spending...')
        await web3Manager.approveToken(
          formData.tokenIn,
          network?.arbitrageEngine || '',
          amountInWei.toString()
        )
      }

      // Create strategy for execution
      const strategies = [{
        id: `strat_${Date.now()}`,
        name: `${formData.strategy} Strategy`,
        type: formData.strategy,
        enabled: true,
        minProfitBps: 50, // 0.5%
        maxSlippageBps: formData.slippageTolerance * 100,
        gasLimit: parseInt(formData.gasLimit)
      }]

      // Execute arbitrage
      toast.info('Executing arbitrage transaction...')
      const txHash = await web3Manager.executeArbitrage(
        formData.tokenIn,
        formData.tokenOut,
        amountInWei.toString(),
        strategies,
        50 // 0.5% minimum profit
      )

      toast.success(`Arbitrage executed successfully! TX: ${txHash}`)
      
      // Reset form after successful execution
      setSimulationResult(null)
      setGasEstimate(null)

    } catch (error: any) {
      console.error('Execution error:', error)
      toast.error(`Execution failed: ${error.message}`)
      setErrors({ execution: error.message })
    } finally {
      setIsLoading(false)
    }
  }, [formData, simulationResult, web3Manager, network, validateForm])

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
        {!isConnected ? (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
            <Wallet className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="font-medium text-blue-800">Connect Wallet</p>
              <p className="text-sm text-blue-600">Connect your wallet to start trading</p>
            </div>
            <Button onClick={connect} disabled={loading}>
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <Badge variant="default" className="bg-green-600">Connected</Badge>
            <span className="text-sm text-green-800">
              {address?.slice(0, 6)}...{address?.slice(-4)} on {network?.name}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => switchNetwork(1)}
              className="ml-auto"
            >
              Switch Network
            </Button>
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
            disabled={isLoading || !isConnected || !address}
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
            disabled={isLoading || !isConnected || !address || !simulationResult || !simulationResult.success}
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