# ✅ CHECKLIST VALIDACIÓN ARQUITECTURAL - ArbitrageX Supreme V3.0

> **📋 CHECKLIST OBLIGATORIO PARA TODOS LOS AGENTES IA**  
> **COMPLETAR ANTES DE ESCRIBIR CUALQUIER CÓDIGO**

## 🎯 INSTRUCCIONES DE USO

**PROCESO OBLIGATORIO:**
1. **EJECUTAR** este checklist ANTES de programar
2. **VALIDAR** todas las secciones  
3. **CONFIRMAR** 100% de verificaciones ✅
4. **SOLO ENTONCES** proceder con desarrollo

**SI CUALQUIER ÍTEM ES ❌ → DETENER TRABAJO Y CORREGIR**

---

## 📍 SECCIÓN 1: IDENTIFICACIÓN DE REPOSITORIO

### **🔍 Verificación de Ubicación**

- [ ] **He ejecutado `pwd`** y conozco mi ubicación actual
- [ ] **He ejecutado `git remote -v`** y confirmé el repositorio  
- [ ] **He identificado correctamente** el propósito del repositorio actual
- [ ] **He leído el README** del repositorio donde estoy trabajando

### **📊 Tabla de Identificación**

| Repositorio | Ubicación Esperada | Propósito | Mi Ubicación |
|-------------|-------------------|-----------|--------------|
| **CONTABO** | `ARBITRAGEX-CONTABO-BACKEND` | Backend Rust + DB | [ ] ✅ / [ ] ❌ |
| **EDGE** | `ARBITRAGEXSUPREME` | Cloudflare Edge | [ ] ✅ / [ ] ❌ |  
| **FRONTEND** | `show-my-github-gems` | React Dashboard | [ ] ✅ / [ ] ❌ |

**VALIDACIÓN:**
- [ ] ✅ **Estoy en el repositorio correcto** para mi tarea
- [ ] ✅ **El propósito de mi código** coincide con el repositorio

---

## 🛠️ SECCIÓN 2: VALIDACIÓN DE TECNOLOGÍAS

### **🔧 Tecnologías por Repositorio**

#### **🖥️ Si estoy en ARBITRAGEX-CONTABO-BACKEND:**
- [ ] ✅ **Voy a usar Rust** (.rs files)
- [ ] ✅ **Voy a trabajar con PostgreSQL** (SQL queries)  
- [ ] ✅ **Voy a usar Docker/Infrastructure** (DevOps)
- [ ] ✅ **Es lógica de negocio backend** (MEV, arbitrage)
- [ ] ❌ **NO voy a usar TypeScript** (va en otros repos)
- [ ] ❌ **NO voy a crear React components** (va en LOVABLE)
- [ ] ❌ **NO voy a usar Cloudflare Workers** (va en ARBITRAGEXSUPREME)

#### **☁️ Si estoy en ARBITRAGEXSUPREME:**  
- [ ] ✅ **Voy a usar TypeScript** (.ts files)
- [ ] ✅ **Voy a crear Cloudflare Workers** (edge functions)
- [ ] ✅ **Voy a usar D1/KV/R2** (edge storage)
- [ ] ✅ **Es optimización edge/cache** (performance)
- [ ] ❌ **NO voy a usar Rust** (va en CONTABO) 
- [ ] ❌ **NO voy a crear React components** (va en LOVABLE)
- [ ] ❌ **NO voy a hacer PostgreSQL queries** (va en CONTABO)

#### **💻 Si estoy en show-my-github-gems:**
- [ ] ✅ **Voy a usar React/TSX** (.tsx files)
- [ ] ✅ **Voy a crear componentes UI** (user interface)
- [ ] ✅ **Voy a usar hooks/stores** (state management)  
- [ ] ✅ **Es interfaz de usuario** (UX/UI)
- [ ] ❌ **NO voy a usar Rust** (va en CONTABO)
- [ ] ❌ **NO voy a crear Workers** (va en ARBITRAGEXSUPREME)
- [ ] ❌ **NO voy a implementar lógica MEV** (va en CONTABO)

---

## 🎯 SECCIÓN 3: VALIDACIÓN DE RESPONSABILIDADES

### **📋 Matriz de Responsabilidades**

| Tipo de Código | CONTABO | ARBITRAGEXSUPREME | LOVABLE |
|----------------|---------|-------------------|---------|
| **Lógica MEV Engine** | ✅ SÍ | ❌ NO | ❌ NO |
| **Base de Datos PostgreSQL** | ✅ SÍ | ❌ NO | ❌ NO |
| **Auditorías Seguridad** | ✅ SÍ | ❌ NO | ❌ NO |
| **Cloudflare Workers** | ❌ NO | ✅ SÍ | ❌ NO |
| **D1/KV/R2 Storage** | ❌ NO | ✅ SÍ | ❌ NO |
| **Edge Optimization** | ❌ NO | ✅ SÍ | ❌ NO |
| **React Components** | ❌ NO | ❌ NO | ✅ SÍ |
| **Dashboard UI** | ❌ NO | ❌ NO | ✅ SÍ |
| **User Experience** | ❌ NO | ❌ NO | ✅ SÍ |

### **🔍 Validación de Mi Tarea:**
- [ ] ✅ **Mi funcionalidad** está marcada con ✅ en el repositorio correcto
- [ ] ❌ **Mi funcionalidad** NO está marcada con ❌ en este repositorio
- [ ] ✅ **He confirmado** que pertenece a esta capa arquitectural

---

## 📂 SECCIÓN 4: VALIDACIÓN DE ESTRUCTURA DE ARCHIVOS

### **🗂️ Estructura Esperada por Repositorio**

#### **🖥️ CONTABO - Archivos Permitidos:**
```
✅ PERMITIDO:
- *.rs (Rust source)
- Cargo.toml / Cargo.lock  
- *.sql (Database)
- docker-compose.yml
- Dockerfile.*
- *.sh (Scripts)
- security/audits/*

❌ PROHIBIDO:  
- *.tsx (React)
- wrangler.toml (Cloudflare)
- package.json (si es para frontend/edge)
```

#### **☁️ ARBITRAGEXSUPREME - Archivos Permitidos:**
```
✅ PERMITIDO:
- *.ts (TypeScript Workers)
- *.js (JavaScript Edge)  
- wrangler.toml
- package.json (edge dependencies)
- *.json (D1 schemas)

❌ PROHIBIDO:
- *.rs (Rust)
- Cargo.toml / Cargo.lock
- *.tsx (React)
- docker-compose.yml (Backend)
- security/audits/* (Backend)
```

#### **💻 LOVABLE - Archivos Permitidos:**  
```
✅ PERMITIDO:
- *.tsx *.jsx (React)
- *.ts (TypeScript utilities)
- *.css *.scss (Styles)
- package.json (frontend deps)
- vite.config.ts

❌ PROHIBIDO:
- *.rs (Rust)
- wrangler.toml (Cloudflare)
- docker-compose.yml (Backend)
```

### **📁 Mi Validación:**
- [ ] ✅ **Los archivos que voy a crear** están en la lista ✅ PERMITIDO
- [ ] ❌ **Los archivos que voy a crear** NO están en la lista ❌ PROHIBIDO

---

## 🔐 SECCIÓN 5: VALIDACIÓN DE DEPENDENCIAS

### **📦 Dependencias por Repositorio**

#### **🖥️ CONTABO - Dependencies Rust:**
```toml
✅ PERMITIDO en Cargo.toml:
- tokio, serde, ethers
- sqlx, diesel (database)
- reqwest, hyper (HTTP)

❌ PROHIBIDO:
- react, @types/react 
- @cloudflare/workers-types
- vite, webpack
```

#### **☁️ ARBITRAGEXSUPREME - Dependencies Edge:**
```json
✅ PERMITIDO en package.json:
- @cloudflare/workers-types
- hono, itty-router
- TypeScript edge libraries

❌ PROHIBIDO:
- react, react-dom
- @types/react
- vite (si es para React)
```

#### **💻 LOVABLE - Dependencies Frontend:**
```json  
✅ PERMITIDO en package.json:
- react, react-dom
- @types/react
- vite, tailwindcss
- @radix-ui/* (shadcn/ui)

❌ PROHIBIDO:
- @cloudflare/workers-types  
- hono (si es para backend)
- ethers (backend logic)
```

### **📋 Mi Validación:**
- [ ] ✅ **Las dependencias que necesito** están permitidas
- [ ] ❌ **NO necesito** dependencias prohibidas para este repositorio

---

## 🧪 SECCIÓN 6: VALIDACIÓN DE COMANDOS

### **⚡ Comandos por Repositorio**

#### **🖥️ CONTABO - Comandos Backend:**
```bash
✅ PERMITIDO:
- cargo build, cargo run, cargo test
- docker-compose up, docker build  
- sqlx migrate, diesel migration

❌ PROHIBIDO:
- npm run dev (frontend)
- npx wrangler deploy (edge)  
- vite build (frontend bundler)
```

#### **☁️ ARBITRAGEXSUPREME - Comandos Edge:**
```bash
✅ PERMITIDO:
- npx wrangler pages dev
- npx wrangler deploy
- npm run build (para Workers)

❌ PROHIBIDO:
- cargo build (Rust backend)
- docker-compose up (Backend)
- npm run dev (si es React dev server)
```

#### **💻 LOVABLE - Comandos Frontend:**
```bash
✅ PERMITIDO:  
- npm run dev (Vite dev server)
- npm run build (Vite build)
- npm test, npm run storybook

❌ PROHIBIDO:
- cargo build (Rust)
- npx wrangler deploy (Cloudflare)
- docker-compose up (Backend)
```

### **🔧 Mi Validación:**
- [ ] ✅ **Los comandos que voy a usar** están permitidos  
- [ ] ❌ **NO usaré** comandos prohibidos para este repositorio

---

## 🚦 SECCIÓN 7: VALIDACIÓN FINAL

### **📊 Resumen de Validación**

- [ ] ✅ **Sección 1:** Identificación de repositorio CORRECTA
- [ ] ✅ **Sección 2:** Tecnologías APROPIADAS para este repo
- [ ] ✅ **Sección 3:** Responsabilidades COINCIDEN con mi tarea  
- [ ] ✅ **Sección 4:** Estructura de archivos PERMITIDA
- [ ] ✅ **Sección 5:** Dependencias APROPIADAS
- [ ] ✅ **Sección 6:** Comandos PERMITIDOS

### **🎯 DECISIÓN FINAL**

**Si TODOS los ítems anteriores son ✅:**
- [ ] ✅ **PROCEDER** con desarrollo en este repositorio

**Si CUALQUIER ítem es ❌:**  
- [ ] ❌ **DETENER** trabajo inmediatamente
- [ ] 🔄 **IR** al repositorio correcto
- [ ] 📚 **LEER** documentación apropiada  
- [ ] 🔄 **RE-EJECUTAR** este checklist

---

## 📞 SECCIÓN 8: RECURSOS DE AYUDA

### **📖 Documentación por Dudas**

**Si no estás seguro del repositorio:**
- 📄 `README.md` (este archivo - arquitectura general)
- 📄 `ESTRUCTURA_JERARQUICA_ARBITRAGEX_SUPREME_V3.md` (arquitectura detallada)

**Si tienes dudas sobre errores:**
- 📄 `ERRORES_CRITICOS_ARQUITECTURALES.md` (ejemplos reales)
- 📄 `PLAN_CORRECCION_ARQUITECTURAL_URGENTE.md` (lo que NO debes hacer)

**Si necesitas referencias específicas:**
- 📄 `ARBITRAGEX-CONTABO-BACKEND/README.md` (guía backend)
- 📄 `LOVABLE-FRONTEND-README.md` (guía frontend)

### **🆘 En Caso de Emergencia**

**SI ROMPES LA ARQUITECTURA:**
1. 🛑 **DETENER** trabajo inmediatamente
2. 📋 **LEER** `INFORME_MIGRACION_ARQUITECTURAL_COMPLETADA.md` 
3. 🔄 **APLICAR** procedimientos de corrección
4. ⚠️ **RECORDAR** que correcciones toman 3+ horas

---

## ⚖️ COMPROMISO ARQUITECTURAL

### **📜 DECLARACIÓN DEL AGENTE IA**

**YO, COMO AGENTE IA, ME COMPROMETO A:**

- [ ] ✅ **LEER** este checklist completamente antes de programar
- [ ] ✅ **VALIDAR** cada sección antes de continuar
- [ ] ✅ **RESPETAR** la separación de responsabilidades  
- [ ] ✅ **MANTENER** la integridad arquitectural
- [ ] ✅ **CONSULTAR** documentación ante cualquier duda
- [ ] ✅ **NUNCA** mezclar código de diferentes repositorios
- [ ] ✅ **SIEMPRE** verificar mi ubicación antes de trabajar

**FECHA DE COMPROMISO:** ___________  
**AGENTE IA:** ___________  
**REPOSITORIO OBJETIVO:** ___________

---

## 🏆 RECORDATORIO FINAL

### **🎯 MANTRA ARQUITECTURAL**

```
🏛️ UN REPOSITORIO = UNA RESPONSABILIDAD
🔄 ANTES DE PROGRAMAR = VALIDAR ARQUITECTURA  
📚 ANTE LA DUDA = CONSULTAR DOCUMENTACIÓN
⚡ 5 MINUTOS DE VALIDACIÓN = 3 HORAS DE AHORRO
```

### **✅ ÉXITO GARANTIZADO SI:**

1. **COMPLETAS** este checklist al 100%
2. **RESPETAS** la separación de capas  
3. **CONSULTAS** documentación regularmente
4. **MANTIENES** disciplina arquitectural

---

*Checklist v1.0 - Basado en corrección arquitectural real*  
*Metodología: Ingenio Pichichi S.A - Prevención proactiva*  
*Objetivo: Cero violaciones arquitecturales futuras*