/**
 * @fileoverview Hook para gestión de simulaciones de arbitraje
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 * Hook para ejecutar y gestionar simulaciones complejas de arbitraje
 */

import { useState, useCallback, useEffect } from 'react'
import { useWallet } from './useWallet'
import type { SimulationParams, SimulationResult } from '@/types'

interface UseSimulationReturn {
  // Estado
  isRunning: boolean
  results: SimulationResult[]
  currentResult: SimulationResult | null
  error: string | null
  progress: number
  
  // Funciones
  runSimulation: (params: SimulationParams, onProgress?: (progress: number) => void) => Promise<void>
  runBatchSimulation: (paramsArray: SimulationParams[]) => Promise<void>
  saveResult: (name: string) => Promise<void>
  loadResults: () => Promise<void>
  clearResults: () => void
  getStatistics: () => any
  compareResults: (results: SimulationResult[]) => any
}

export function useSimulation(): UseSimulationReturn {
  const { isConnected, account } = useWallet()
  
  // Estado
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<SimulationResult[]>([])
  const [currentResult, setCurrentResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  // Validación de parámetros
  const validateParams = useCallback((params: SimulationParams): boolean => {
    if (!params.amount || params.amount === '') {
      setError('Invalid simulation parameters')
      return false
    }

    return true
  }, [])

  // Ejecutar simulación individual
  const runSimulation = useCallback(async (
    params: SimulationParams, 
    onProgress?: (progress: number) => void
  ) => {
    if (!isConnected) {
      setError('Wallet not connected')
      return
    }

    if (!validateParams(params)) {
      return
    }

    setIsRunning(true)
    setError(null)
    setProgress(0)

    try {
      const response = await fetch('/api/simulation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Simulation failed')
      }

      const result: SimulationResult = await response.json()
      
      setCurrentResult(result)
      setResults(prev => [result, ...prev])
      setProgress(100)
      
      if (onProgress) {
        onProgress(100)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
    } finally {
      setIsRunning(false)
    }
  }, [isConnected, validateParams])

  // Ejecutar simulaciones por lotes
  const runBatchSimulation = useCallback(async (paramsArray: SimulationParams[]) => {
    if (!isConnected) {
      setError('Wallet not connected')
      return
    }

    setIsRunning(true)
    setError(null)
    setProgress(0)

    const batchResults: SimulationResult[] = []
    let failedCount = 0

    try {
      for (let i = 0; i < paramsArray.length; i++) {
        const params = paramsArray[i]
        
        try {
          const response = await fetch('/api/simulation/run', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
          })

          if (response.ok) {
            const result: SimulationResult = await response.json()
            batchResults.push(result)
          } else {
            failedCount++
          }
        } catch {
          failedCount++
        }

        // Actualizar progreso
        const currentProgress = Math.round(((i + 1) / paramsArray.length) * 100)
        setProgress(currentProgress)
      }

      setResults(prev => [...batchResults, ...prev])
      
      if (failedCount > 0) {
        setError('Some simulations failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Batch simulation failed'
      setError(errorMessage)
    } finally {
      setIsRunning(false)
    }
  }, [isConnected])

  // Guardar resultado
  const saveResult = useCallback(async (name: string) => {
    if (!currentResult || !account) {
      setError('No result to save or wallet not connected')
      return
    }

    try {
      const response = await fetch('/api/simulation/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          result: currentResult,
          userId: account,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save result')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Save failed'
      setError(errorMessage)
    }
  }, [currentResult, account])

  // Cargar resultados guardados
  const loadResults = useCallback(async () => {
    if (!account) {
      setError('Wallet not connected')
      return
    }

    try {
      const response = await fetch(`/api/simulation/load?userId=${account}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load results')
      }

      const savedResults: SimulationResult[] = await response.json()
      setResults(savedResults)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Load failed'
      setError(errorMessage)
    }
  }, [account])

  // Limpiar resultados
  const clearResults = useCallback(() => {
    setResults([])
    setCurrentResult(null)
    setError(null)
    setProgress(0)
  }, [])

  // Calcular estadísticas
  const getStatistics = useCallback(() => {
    if (results.length === 0) {
      return null
    }

    const validResults = results.filter(r => r.success)
    const rois = validResults.map(r => r.scenarios.realistic.roi)
    const profits = validResults.map(r => parseFloat(r.scenarios.realistic.profit))

    return {
      totalSimulations: results.length,
      averageROI: rois.reduce((a, b) => a + b, 0) / rois.length,
      bestROI: Math.max(...rois),
      worstROI: Math.min(...rois),
      totalProfit: profits.reduce((a, b) => a + b, 0).toString(),
      successRate: validResults.length / results.length,
    }
  }, [results])

  // Comparar resultados
  const compareResults = useCallback((resultsToCompare: SimulationResult[]) => {
    if (resultsToCompare.length < 2) {
      return null
    }

    const profits = resultsToCompare.map(r => r.scenarios.realistic.profit)
    const rois = resultsToCompare.map(r => r.scenarios.realistic.roi)
    const risks = resultsToCompare.map(r => r.scenarios.realistic.priceImpact)

    return {
      profits,
      rois,
      risks,
      recommendations: [
        'Compare profit margins across scenarios',
        'Consider risk-adjusted returns',
        'Monitor market conditions',
      ]
    }
  }, [])

  // Persistencia local
  const saveToLocalStorage = useCallback(() => {
    try {
      localStorage.setItem('arbitrageX-simulations', JSON.stringify(results))
    } catch (err) {
      console.error('Failed to save to localStorage:', err)
    }
  }, [results])

  const loadFromLocalStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem('arbitrageX-simulations')
      if (saved) {
        const parsed = JSON.parse(saved)
        setResults(parsed)
      }
    } catch (err) {
      console.error('Failed to load from localStorage:', err)
    }
  }, [])

  // Cargar datos al montar el componente
  useEffect(() => {
    loadFromLocalStorage()
  }, [loadFromLocalStorage])

  // Guardar automáticamente cambios
  useEffect(() => {
    if (results.length > 0) {
      saveToLocalStorage()
    }
  }, [results, saveToLocalStorage])

  return {
    isRunning,
    results,
    currentResult,
    error,
    progress,
    runSimulation,
    runBatchSimulation,
    saveResult,
    loadResults,
    clearResults,
    getStatistics,
    compareResults,
  }
}