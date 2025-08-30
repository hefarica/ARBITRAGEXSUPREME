'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Download, 
  ExternalLink, 
  Chrome, 
  Firefox,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetaMaskInstallerProps {
  onInstallClick?: () => void
  className?: string
}

// Detectar navegador
const getBrowserInfo = () => {
  if (typeof window === 'undefined') return { name: 'unknown', version: '' }
  
  const userAgent = window.navigator.userAgent
  
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    return { name: 'chrome', version: userAgent.match(/Chrome\/(\d+)/)?.[1] || '' }
  } else if (userAgent.includes('Firefox')) {
    return { name: 'firefox', version: userAgent.match(/Firefox\/(\d+)/)?.[1] || '' }
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return { name: 'safari', version: userAgent.match(/Safari\/(\d+)/)?.[1] || '' }
  } else if (userAgent.includes('Edg')) {
    return { name: 'edge', version: userAgent.match(/Edg\/(\d+)/)?.[1] || '' }
  }
  
  return { name: 'other', version: '' }
}

// Enlaces de instalación seguros
const getInstallationLinks = (browserName: string) => {
  const links = {
    chrome: {
      primary: 'https://metamask.io/download/',
      alternative: 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
      directDownload: 'https://github.com/MetaMask/metamask-extension/releases'
    },
    firefox: {
      primary: 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/',
      alternative: 'https://metamask.io/download/',
      directDownload: 'https://github.com/MetaMask/metamask-extension/releases'
    },
    safari: {
      primary: 'https://metamask.io/download/',
      alternative: 'https://apps.apple.com/us/app/metamask/id1438144202',
      directDownload: null
    },
    edge: {
      primary: 'https://microsoftedge.microsoft.com/addons/detail/metamask/ejbalbakoplchlghecdalmeeeajnimhm',
      alternative: 'https://metamask.io/download/',
      directDownload: 'https://github.com/MetaMask/metamask-extension/releases'
    },
    other: {
      primary: 'https://metamask.io/download/',
      alternative: null,
      directDownload: 'https://github.com/MetaMask/metamask-extension/releases'
    }
  }
  
  return links[browserName as keyof typeof links] || links.other
}

export function MetaMaskInstaller({ onInstallClick, className }: MetaMaskInstallerProps) {
  const [browser, setBrowser] = useState({ name: 'unknown', version: '' })
  const [installAttempted, setInstallAttempted] = useState(false)
  const [checkingInstall, setCheckingInstall] = useState(false)

  useEffect(() => {
    setBrowser(getBrowserInfo())
  }, [])

  const links = getInstallationLinks(browser.name)

  // Verificar si MetaMask se instaló después de un intento
  const checkInstallation = async () => {
    setCheckingInstall(true)
    
    // Esperar un momento para que la extensión se cargue
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const isInstalled = typeof window !== 'undefined' && window.ethereum?.isMetaMask
    
    if (isInstalled) {
      window.location.reload() // Recargar para detectar MetaMask
    } else {
      setCheckingInstall(false)
      // Mostrar mensaje de que podría necesitar recargar manualmente
    }
  }

  const handleInstallClick = (url: string, method: string) => {
    setInstallAttempted(true)
    onInstallClick?.()
    
    // Abrir enlace en nueva pestaña
    window.open(url, '_blank', 'noopener,noreferrer')
    
    // Iniciar verificación después de un tiempo
    setTimeout(() => {
      checkInstallation()
    }, 3000)
  }

  const getBrowserIcon = (browserName: string) => {
    switch (browserName) {
      case 'chrome': return <Chrome className="w-5 h-5 text-blue-600" />
      case 'firefox': return <Firefox className="w-5 h-5 text-orange-600" />
      case 'safari': return <Globe className="w-5 h-5 text-blue-500" />
      case 'edge': return <Globe className="w-5 h-5 text-blue-600" />
      default: return <Globe className="w-5 h-5 text-gray-600" />
    }
  }

  const getBrowserName = (browserName: string) => {
    switch (browserName) {
      case 'chrome': return 'Google Chrome'
      case 'firefox': return 'Mozilla Firefox'
      case 'safari': return 'Safari'
      case 'edge': return 'Microsoft Edge'
      default: return 'Tu navegador'
    }
  }

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardHeader className="text-center">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full">
          <Download className="w-8 h-8 text-orange-600" />
        </div>
        <CardTitle className="font-montserrat uppercase tracking-wide text-gray-900">
          INSTALAR METAMASK
        </CardTitle>
        <p className="text-sm text-gray-600 font-montserrat uppercase tracking-wider">
          WALLET REQUERIDO PARA ARBITRAJE
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Información del navegador */}
        <div className="flex items-center justify-center p-3 bg-gray-50 rounded-lg">
          {getBrowserIcon(browser.name)}
          <span className="ml-2 text-sm font-medium text-gray-700">
            {getBrowserName(browser.name)}
            {browser.version && (
              <span className="text-gray-500 ml-1">v{browser.version}</span>
            )}
          </span>
        </div>

        {/* Estado de verificación */}
        {checkingInstall && (
          <div className="flex items-center justify-center p-3 bg-blue-50 rounded-lg">
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin mr-2" />
            <span className="text-sm text-blue-700 font-montserrat uppercase tracking-wide">
              VERIFICANDO INSTALACIÓN...
            </span>
          </div>
        )}

        {/* Mensaje post-instalación */}
        {installAttempted && !checkingInstall && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-700">
                <p className="font-medium mb-1">¿MetaMask instalado?</p>
                <p className="text-xs">
                  Si la instalación fue exitosa, recarga esta página para continuar.
                </p>
              </div>
            </div>
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              RECARGAR PÁGINA
            </Button>
          </div>
        )}

        {/* Opciones de instalación */}
        <div className="space-y-3">
          {/* Método principal */}
          <div>
            <p className="text-xs text-gray-500 font-montserrat uppercase tracking-wider mb-2">
              MÉTODO RECOMENDADO
            </p>
            <Button
              onClick={() => handleInstallClick(links.primary, 'primary')}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
              disabled={checkingInstall}
            >
              <Download className="w-4 h-4 mr-2" />
              INSTALAR DESDE SITIO OFICIAL
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </div>

          {/* Método alternativo */}
          {links.alternative && (
            <div>
              <p className="text-xs text-gray-500 font-montserrat uppercase tracking-wider mb-2">
                MÉTODO ALTERNATIVO
              </p>
              <Button
                onClick={() => handleInstallClick(links.alternative, 'alternative')}
                variant="outline"
                className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
                disabled={checkingInstall}
              >
                {browser.name === 'chrome' && <Chrome className="w-4 h-4 mr-2" />}
                {browser.name === 'firefox' && <Firefox className="w-4 h-4 mr-2" />}
                {browser.name === 'safari' && <Smartphone className="w-4 h-4 mr-2" />}
                {browser.name === 'edge' && <Globe className="w-4 h-4 mr-2" />}
                {browser.name === 'other' && <Globe className="w-4 h-4 mr-2" />}
                TIENDA DEL NAVEGADOR
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </div>
          )}

          {/* Descarga directa como último recurso */}
          {links.directDownload && (
            <div>
              <p className="text-xs text-gray-500 font-montserrat uppercase tracking-wider mb-2">
                DESCARGA MANUAL
              </p>
              <Button
                onClick={() => handleInstallClick(links.directDownload!, 'direct')}
                variant="outline"
                size="sm"
                className="w-full text-gray-600 border-gray-200 hover:bg-gray-50"
                disabled={checkingInstall}
              >
                <Download className="w-3 h-3 mr-2" />
                DESCARGAR DESDE GITHUB
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </div>
          )}
        </div>

        {/* Información adicional */}
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700">
              <p className="font-medium mb-1">Después de la instalación:</p>
              <ul className="space-y-1 text-xs">
                <li>• Recarga esta página</li>
                <li>• Acepta los términos de MetaMask</li>
                <li>• Crea o importa tu wallet</li>
                <li>• Conecta con ArbitrageX</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Información de seguridad */}
        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-center">
          <p className="text-xs text-yellow-700 font-montserrat uppercase tracking-wide">
            ⚠️ SOLO DESCARGA DESDE FUENTES OFICIALES
          </p>
        </div>
      </CardContent>
    </Card>
  )
}