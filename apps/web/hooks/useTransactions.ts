'use client'

import { useState, useCallback, useRef } from 'react'
import { useWeb3Service } from '@/services/web3Service'

export interface TransactionState {
  hash?: string
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error'
  error?: string
  confirmations: number
  gasUsed?: string
  receipt?: any
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Map<string, TransactionState>>(new Map())
  const web3Service = useWeb3Service()
  const abortControllers = useRef<Map<string, AbortController>>(new Map())

  // Agregar nueva transacción al estado
  const addTransaction = useCallback((id: string, initialState?: Partial<TransactionState>) => {
    setTransactions(prev => {
      const newMap = new Map(prev)
      newMap.set(id, {
        status: 'idle',
        confirmations: 0,
        ...initialState
      })
      return newMap
    })
  }, [])

  // Actualizar estado de transacción
  const updateTransaction = useCallback((id: string, updates: Partial<TransactionState>) => {
    setTransactions(prev => {
      const newMap = new Map(prev)
      const current = newMap.get(id)
      if (current) {
        newMap.set(id, { ...current, ...updates })
      }
      return newMap
    })
  }, [])

  // Enviar transacción con manejo completo
  const sendTransaction = useCallback(async (
    id: string,
    transaction: any,
    options: {
      confirmations?: number
      timeout?: number
      onConfirmation?: (confirmations: number) => void
    } = {}
  ): Promise<any> => {
    const { confirmations = 1, timeout = 60000, onConfirmation } = options

    // Crear AbortController para cancelación
    const controller = new AbortController()
    abortControllers.current.set(id, controller)

    try {
      // Iniciar transacción
      addTransaction(id, { status: 'pending' })

      // Enviar transacción
      const tx = await web3Service.sendTransaction(transaction)
      
      updateTransaction(id, {
        hash: tx.hash,
        status: 'confirming'
      })

      // Configurar timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Transaction timeout')), timeout)
      })

      // Esperar confirmaciones
      const confirmationPromise = (async () => {
        const receipt = await web3Service.waitForTransaction(tx.hash, confirmations)
        
        // Verificar si fue cancelado
        if (controller.signal.aborted) {
          throw new Error('Transaction cancelled')
        }

        return receipt
      })()

      // Carrera entre timeout y confirmación
      const receipt = await Promise.race([confirmationPromise, timeoutPromise])

      updateTransaction(id, {
        status: receipt.status === 1 ? 'success' : 'error',
        confirmations: receipt.confirmations || confirmations,
        gasUsed: receipt.gasUsed?.toString(),
        receipt,
        error: receipt.status !== 1 ? 'Transaction failed' : undefined
      })

      // Callback de confirmación
      onConfirmation?.(receipt.confirmations || confirmations)

      // Cleanup
      abortControllers.current.delete(id)

      return receipt

    } catch (error: any) {
      console.error(`Transaction ${id} failed:`, error)
      
      updateTransaction(id, {
        status: 'error',
        error: error.message || 'Transaction failed'
      })

      // Cleanup
      abortControllers.current.delete(id)
      
      throw error
    }
  }, [addTransaction, updateTransaction, web3Service])

  // Cancelar transacción
  const cancelTransaction = useCallback((id: string) => {
    const controller = abortControllers.current.get(id)
    if (controller) {
      controller.abort()
      updateTransaction(id, {
        status: 'error',
        error: 'Transaction cancelled by user'
      })
      abortControllers.current.delete(id)
    }
  }, [updateTransaction])

  // Limpiar transacción del estado
  const removeTransaction = useCallback((id: string) => {
    cancelTransaction(id)
    setTransactions(prev => {
      const newMap = new Map(prev)
      newMap.delete(id)
      return newMap
    })
  }, [cancelTransaction])

  // Obtener estado de transacción
  const getTransaction = useCallback((id: string): TransactionState | undefined => {
    return transactions.get(id)
  }, [transactions])

  // Limpiar todas las transacciones
  const clearTransactions = useCallback(() => {
    // Cancelar todas las transacciones pendientes
    abortControllers.current.forEach(controller => controller.abort())
    abortControllers.current.clear()
    setTransactions(new Map())
  }, [])

  // Obtener transacciones por estado
  const getTransactionsByStatus = useCallback((status: TransactionState['status']) => {
    return Array.from(transactions.entries()).filter(([_, tx]) => tx.status === status)
  }, [transactions])

  // Verificar si hay transacciones pendientes
  const hasPendingTransactions = useCallback(() => {
    return Array.from(transactions.values()).some(tx => 
      tx.status === 'pending' || tx.status === 'confirming'
    )
  }, [transactions])

  // Estadísticas de transacciones
  const getTransactionStats = useCallback(() => {
    const stats = {
      total: transactions.size,
      idle: 0,
      pending: 0,
      confirming: 0,
      success: 0,
      error: 0
    }

    transactions.forEach(tx => {
      stats[tx.status]++
    })

    return stats
  }, [transactions])

  // Reenviar transacción fallida con mayor gas
  const retryTransaction = useCallback(async (
    id: string,
    gasMultiplier: number = 1.2
  ) => {
    const tx = getTransaction(id)
    if (!tx || !tx.hash) {
      throw new Error('Transaction not found or no hash available')
    }

    // Obtener transacción original del blockchain
    const provider = await web3Service.getProvider()
    const originalTx = await provider.getTransaction(tx.hash)
    
    if (!originalTx) {
      throw new Error('Original transaction not found')
    }

    // Crear nueva transacción con mayor gas
    const newTransaction = {
      ...originalTx,
      gasPrice: originalTx.gasPrice ? 
        BigInt(Math.floor(Number(originalTx.gasPrice) * gasMultiplier)) : 
        undefined,
      gasLimit: originalTx.gasLimit ? 
        BigInt(Math.floor(Number(originalTx.gasLimit) * gasMultiplier)) : 
        undefined,
      nonce: originalTx.nonce // Mismo nonce para reemplazar
    }

    // Enviar nueva transacción
    const newId = `${id}_retry_${Date.now()}`
    return await sendTransaction(newId, newTransaction)
  }, [getTransaction, sendTransaction, web3Service])

  return {
    transactions: Array.from(transactions.entries()),
    addTransaction,
    updateTransaction,
    sendTransaction,
    cancelTransaction,
    removeTransaction,
    getTransaction,
    clearTransactions,
    getTransactionsByStatus,
    hasPendingTransactions,
    getTransactionStats,
    retryTransaction
  }
}