'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  HelpCircle,
  Search,
  Book,
  MessageCircle,
  FileText,
  Video,
  Phone,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Star,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react'

// Datos estáticos para la página de ayuda
const faqData = [
  {
    id: 1,
    category: 'Primeros Pasos',
    question: '¿Cómo empiezo a usar ArbitrageX Pro?',
    answer: 'Para comenzar, necesitas: 1) Conectar tus billeteras, 2) Configurar las redes blockchain de tu interés, 3) Definir tus parámetros de trading, 4) Activar el monitoreo automático. El sistema comenzará a detectar oportunidades de arbitraje automáticamente.',
    tags: ['setup', 'inicio', 'configuración']
  },
  {
    id: 2,
    category: 'Configuración',
    question: '¿Qué redes blockchain están soportadas?',
    answer: 'ArbitrageX Pro soporta 12 redes principales: Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche, Solana, Fantom, Base, Cardano, Bitcoin y Cosmos. Cada red puede ser habilitada/deshabilitada individualmente en la configuración.',
    tags: ['redes', 'blockchain', 'soporte']
  },
  {
    id: 3,
    category: 'Trading',
    question: '¿Cómo funciona el arbitraje automático?',
    answer: 'El sistema monitorea precios en múltiples DEXs y exchanges, identifica diferencias de precio rentables, calcula gas fees y slippage, y ejecuta las operaciones automáticamente si cumplen tus parámetros de rentabilidad mínima.',
    tags: ['arbitraje', 'automático', 'trading']
  },
  {
    id: 4,
    category: 'Seguridad',
    question: '¿Cómo protege ArbitrageX mis fondos?',
    answer: 'Utilizamos encriptación end-to-end, nunca almacenamos claves privadas, implementamos 2FA opcional, monitoreo de actividad sospechosa, y todas las transacciones requieren confirmación explícita a menos que actives el modo automático.',
    tags: ['seguridad', 'protección', 'fondos']
  },
  {
    id: 5,
    category: 'Fees y Costos',
    question: '¿Cuáles son las comisiones del sistema?',
    answer: 'ArbitrageX cobra una comisión del 2-5% sobre las ganancias exitosas únicamente. No hay costos fijos ni comisiones por transacciones fallidas. Los gas fees de red se pagan por separado según la red utilizada.',
    tags: ['fees', 'comisiones', 'costos']
  },
  {
    id: 6,
    category: 'Problemas Técnicos',
    question: 'Mi transacción falló, ¿qué puedo hacer?',
    answer: 'Las transacciones pueden fallar por: gas insuficiente, slippage alto, o condiciones de mercado cambiantes. Revisa el historial de transacciones para ver el error específico. El sistema aprende de estos fallos para mejorar futuras operaciones.',
    tags: ['errores', 'transacciones', 'fallos']
  }
]

const guideData = [
  {
    id: 1,
    title: 'Guía de Inicio Rápido',
    description: 'Configuración inicial completa en 10 minutos',
    duration: '10 min',
    difficulty: 'Principiante',
    sections: [
      'Registro y verificación de cuenta',
      'Conexión de primera billetera',
      'Configuración de redes preferidas',
      'Primera oportunidad de arbitraje'
    ]
  },
  {
    id: 2,
    title: 'Configuración Avanzada de Trading',
    description: 'Optimización de parámetros para trading profesional',
    duration: '25 min',
    difficulty: 'Avanzado',
    sections: [
      'Parámetros de riesgo y rentabilidad',
      'Configuración multi-red',
      'Alertas y notificaciones',
      'Análisis de rendimiento'
    ]
  },
  {
    id: 3,
    title: 'Gestión de Riesgos',
    description: 'Estrategias para minimizar riesgos en DeFi',
    duration: '15 min',
    difficulty: 'Intermedio',
    sections: [
      'Límites de exposición por red',
      'Diversificación de assets',
      'Stop-loss automático',
      'Monitoreo de impermanent loss'
    ]
  }
]

const contactData = [
  {
    type: 'email',
    title: 'Soporte por Email',
    description: 'Respuesta en 24 horas',
    contact: 'support@arbitragex.pro',
    icon: Mail,
    available: '24/7'
  },
  {
    type: 'chat',
    title: 'Chat en Vivo',
    description: 'Soporte inmediato',
    contact: 'Iniciar chat',
    icon: MessageCircle,
    available: 'Lun-Vie 9:00-18:00 UTC'
  },
  {
    type: 'phone',
    title: 'Soporte Telefónico',
    description: 'Para cuentas Premium',
    contact: '+1 (555) 123-4567',
    icon: Phone,
    available: 'Lun-Vie 9:00-17:00 UTC'
  }
]

// Componente de FAQ expandible
function FAQItem({ faq }: { faq: typeof faqData[0] }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-0">
        <button
          className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">{faq.question}</h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {faq.category}
              </Badge>
              {faq.tags.map((tag) => (
                <span key={tag} className="text-xs text-gray-500">#{tag}</span>
              ))}
            </div>
          </div>
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {isOpen && (
          <div className="px-4 pb-4 border-t bg-gray-50">
            <p className="text-gray-700 mt-3 leading-relaxed">{faq.answer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Componente de guías
function GuideItem({ guide }: { guide: typeof guideData[0] }) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Principiante': return 'bg-green-100 text-green-800'
      case 'Intermedio': return 'bg-yellow-100 text-yellow-800'
      case 'Avanzado': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{guide.title}</CardTitle>
            <CardDescription className="mt-1">{guide.description}</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4 mr-2" />
            Ver Guía
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="outline" className={`text-xs ${getDifficultyColor(guide.difficulty)}`}>
            {guide.difficulty}
          </Badge>
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            {guide.duration}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600 mb-2">Contenido:</p>
          {guide.sections.map((section, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>{section}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente de contacto
function ContactItem({ contact }: { contact: typeof contactData[0] }) {
  const Icon = contact.icon

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-medium text-gray-900 mb-1">{contact.title}</h3>
          <p className="text-gray-600 text-sm mb-3">{contact.description}</p>
          <p className="font-medium text-blue-600 mb-2">{contact.contact}</p>
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            {contact.available}
          </div>
        </div>
        <Button className="w-full mt-4">
          Contactar
        </Button>
      </CardContent>
    </Card>
  )
}

// Componente principal de la página de Ayuda
export function RealTimeHelpPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const categories = ['all', ...Array.from(new Set(faqData.map(faq => faq.category)))]
  
  const filteredFAQs = faqData.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <HelpCircle className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Centro de Ayuda</h1>
            <p className="text-gray-600 mt-2">
              Encuentra respuestas, guías detalladas y soporte técnico
            </p>
          </div>
        </div>

        {/* Búsqueda */}
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-3.5 text-gray-400" />
              <Input
                placeholder="Buscar en la ayuda..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 text-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas de ayuda */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{faqData.length}</p>
              <p className="text-gray-600">Preguntas Frecuentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Book className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{guideData.length}</p>
              <p className="text-gray-600">Guías Detalladas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <MessageCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">24/7</p>
              <p className="text-gray-600">Soporte Disponible</p>
            </CardContent>
          </Card>
        </div>

        {/* Contenido Principal con Tabs */}
        <Tabs defaultValue="faq" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="guides">Guías</TabsTrigger>
            <TabsTrigger value="contact">Contacto</TabsTrigger>
          </TabsList>

          <TabsContent value="faq" className="space-y-6">
            {/* Filtros de categoría */}
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-600">Categorías:</span>
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category === 'all' ? 'Todas' : category}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Lista de FAQ */}
            <div className="space-y-4">
              {filteredFAQs.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No se encontraron resultados
                    </h3>
                    <p className="text-gray-500">
                      Intenta con otros términos de búsqueda o explora nuestras guías
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredFAQs.map((faq) => (
                  <FAQItem key={faq.id} faq={faq} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="guides" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {guideData.map((guide) => (
                <GuideItem key={guide.id} guide={guide} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ¿Necesitas ayuda adicional?
              </h2>
              <p className="text-gray-600">
                Nuestro equipo de soporte está aquí para ayudarte
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {contactData.map((contact, index) => (
                <ContactItem key={index} contact={contact} />
              ))}
            </div>

            {/* Información adicional */}
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-center">Antes de Contactarnos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Revisa las FAQ</p>
                      <p className="text-sm text-gray-600">
                        La mayoría de preguntas están respondidas en nuestras FAQ
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Información necesaria</p>
                      <p className="text-sm text-gray-600">
                        Ten a mano tu ID de usuario, detalles del problema y capturas de pantalla
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Tiempos de respuesta</p>
                      <p className="text-sm text-gray-600">
                        Email: 24h | Chat: Inmediato | Teléfono: Solo Premium
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}