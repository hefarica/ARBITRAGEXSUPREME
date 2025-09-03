# 🏗️ ArbitrageX Supreme - Arquitectura de Repositorios Actualizada

## 📋 REPOSITORIOS SEPARADOS

### **🔧 Backend Repository**
```
https://github.com/hefarica/ARBITRAGEXSUPREME.git
```
- **Función**: API Server con datos de arbitraje
- **Tecnología**: Node.js + Cloudflare Pages Functions
- **Contenido**: Endpoints, lógica de negocio, datos mock
- **Despliegue**: `arbitragex-supreme-backend.pages.dev`

### **🎨 Frontend Repository**
```
https://github.com/hefarica/show-my-github-gems.git
```
- **Función**: Dashboard UI para trading
- **Tecnología**: React + TypeScript + Tailwind CSS
- **Contenido**: Componentes UI, cliente API, hooks
- **Despliegue**: `show-my-github-gems.pages.dev`

---

## 🔗 ARQUITECTURA COMPLETA

```
┌─────────────────────────────────────────────────────────────┐
│  🎨 FRONTEND (show-my-github-gems)                          │
│  Repository: hefarica/show-my-github-gems.git               │
│  URL: https://show-my-github-gems.pages.dev                 │
│  Tech: React + TypeScript + Tailwind CSS                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                   📡 HTTPS API Calls
                      │
┌─────────────────────┴───────────────────────────────────────┐
│  🔧 BACKEND (ARBITRAGEXSUPREME)                             │
│  Repository: hefarica/ARBITRAGEXSUPREME.git                 │
│  URL: https://arbitragex-supreme-backend.pages.dev          │
│  Tech: Node.js + Cloudflare Pages Functions                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 URLS FINALES CORREGIDAS

### **Backend API:**
```
Base URL: https://arbitragex-supreme-backend.pages.dev
Health:   https://arbitragex-supreme-backend.pages.dev/health
API v2:   https://arbitragex-supreme-backend.pages.dev/api/v2/arbitrage/*
```

### **Frontend App:**
```
Main URL: https://show-my-github-gems.pages.dev
```

---

## 📋 CONFIGURACIÓN ACTUALIZADA

### **Frontend (show-my-github-gems) - API Client:**
```typescript
// src/services/api.ts
const BASE_URL = "https://arbitragex-supreme-backend.pages.dev";

export class ArbitrageAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = BASE_URL; // Apunta al backend desplegado
  }
  
  // ... resto del código API client
}
```

### **Backend (ARBITRAGEXSUPREME) - Configuración CORS:**
```javascript
// functions/*.js  
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://show-my-github-gems.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client',
  'Content-Type': 'application/json'
};
```

---

## 🚀 DEPLOYMENT WORKFLOW

### **1️⃣ Backend Deployment (ARBITRAGEXSUPREME)**
```bash
# En repositorio: hefarica/ARBITRAGEXSUPREME.git
cd ARBITRAGEXSUPREME
wrangler pages deploy . --project-name arbitragex-supreme-backend

# Resultado: https://arbitragex-supreme-backend.pages.dev
```

### **2️⃣ Frontend Deployment (show-my-github-gems)**  
```bash
# En repositorio: hefarica/show-my-github-gems.git
cd show-my-github-gems
npm run build
wrangler pages deploy dist --project-name show-my-github-gems

# Resultado: https://show-my-github-gems.pages.dev
```

---

## 📁 ESTRUCTURA DE ARCHIVOS POR REPO

### **Backend (ARBITRAGEXSUPREME):**
```
ARBITRAGEXSUPREME/
├── functions/
│   ├── health.js
│   └── api/v2/arbitrage/
│       ├── network-status.js
│       ├── opportunities.js
│       └── dashboard/summary.js
├── deployment/
│   └── stable-server.js (sandbox version)
├── wrangler.toml
├── package.json
└── README.md
```

### **Frontend (show-my-github-gems):**
```
show-my-github-gems/
├── src/
│   ├── services/
│   │   └── api.ts (client para backend)
│   ├── hooks/
│   │   └── useArbitrageData.ts
│   ├── components/
│   │   └── ArbitrageDashboard.tsx
│   └── App.tsx
├── public/
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 🔄 SINCRONIZACIÓN ENTRE REPOS

### **Desarrollo Local:**
1. **Backend**: Sandbox URL actual para desarrollo
2. **Frontend**: Conecta al sandbox para testing

### **Producción:**
1. **Backend**: Desplegado en Cloudflare Pages Functions  
2. **Frontend**: Desplegado en Cloudflare Pages, conecta al backend prod

### **Variables de Entorno:**
```typescript
// Frontend: src/services/api.ts
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? "https://arbitragex-supreme-backend.pages.dev"
  : "https://3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev"; // sandbox
```