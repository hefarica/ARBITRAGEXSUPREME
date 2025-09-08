'use client'

import { BlockchainTables } from '@/components/BlockchainTables'

export default function Home() {
  return (
    <div className="p-8 space-y-8">
      {/* Header Principal */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          ArbitrageX Supreme Dashboard
        </h1>
        <p className="text-lg text-gray-600">
          Plataforma Enterprise de Arbitraje DeFi con Datos Blockchain en Tiempo Real
        </p>
      </div>

      {/* KPIs Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <h2 className="font-semibold text-green-700 text-lg flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Status
          </h2>
          <p className="text-2xl font-bold text-green-800 mt-2">✅ Online</p>
          <p className="text-sm text-green-600 mt-1">Sistema Operativo</p>
        </div>
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <h2 className="font-semibold text-blue-700 text-lg">Oportunidades</h2>
          <p className="text-2xl font-bold text-blue-800 mt-2">En Tiempo Real</p>
          <p className="text-sm text-blue-600 mt-1">Actualización cada 5s</p>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
          <h2 className="font-semibold text-purple-700 text-lg">Blockchains</h2>
          <p className="text-2xl font-bold text-purple-800 mt-2">20+ Redes</p>
          <p className="text-sm text-purple-600 mt-1">Multi-chain Support</p>
        </div>
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200">
          <h2 className="font-semibold text-orange-700 text-lg">Protocolos</h2>
          <p className="text-2xl font-bold text-orange-800 mt-2">200+ DEX/Lending</p>
          <p className="text-sm text-orange-600 mt-1">Flash Loans Ready</p>
        </div>
      </div>

      {/* Matriz Blockchain - Módulo Principal */}
      <BlockchainTables />
    </div>
  )
}