# Panel de Administración de Condominios — Documentación Técnica Completa

## 1. Descripción General del Proyecto

**Condominium Admin Panel** (condominio-panel-admin) es un panel de administración web para gestionar edificios de condominios, residentes, pagos, facturación y unidades. Está diseñado para que los administradores del sistema (Super Admin) y los miembros de junta directiva (Board Member) supervisen los aspectos financieros y operativos de los condominios residenciales.

### Propósito Principal
El panel sirve como interfaz administrativa para un sistema de gestión de condominios. Los residentes interactúan a través de una aplicación móvil separada; este panel de administración es exclusivamente para administradores y miembros de junta. Se conecta a una API backend en Bun + ElysiaJS que maneja toda la lógica de negocio, persistencia de datos y autenticación.

### Stack Tecnológico
| Tecnología | Propósito |
|---|---|
| **Next.js 16** (App Router) | Framework React, renderizado del lado del servidor, enrutamiento basado en archivos |
| **React 19** | Librería de renderizado de interfaces de usuario |
| **TypeScript 5** | JavaScript con tipado estático |
| **Tailwind CSS 4** | Framework CSS utilitario |
| **shadcn/ui** (Radix UI) | Librería de componentes UI accesibles y componibles |
| **React Hook Form + Zod** | Manejo de formularios con validación basada en schemas |
| **Axios** | Cliente HTTP para comunicación con la API |
| **TanStack React Table** | Tabla de datos avanzada con ordenamiento, filtrado y paginación |
| **date-fns** | Formateo y manipulación de fechas |
| **Sonner** | Sistema de notificaciones tipo toast |
| **Lucide React** | Librería de íconos |

### Versión y Estado
- Versión actual: 0.1.0
- Licencia: Privada — Todos los derechos reservados

---

## 2. Arquitectura General

### Arquitectura de la Aplicación
La aplicación sigue un patrón de renderizado del lado del cliente usando Next.js App Router con directivas `'use client'`. Todas las páginas obtienen datos del lado del cliente vía Axios después de que el usuario se autentica.

```
┌─────────────────────────────────────────────────────┐
│                   Navegador (Cliente)               │
│                                                     │
│  ┌───────────┐  ┌────────────┐  ┌───────────────┐  │
│  │  Páginas   │──│ Componentes│──│  UI (shadcn)  │  │
│  │ (App      │  │ (módulos   │  │  primitivos   │  │
│  │  Router)  │  │  de feat.) │  │               │  │
│  └─────┬─────┘  └──────┬─────┘  └───────────────┘  │
│        │               │                            │
│  ┌─────┴───────────────┴─────┐                      │
│  │     Hooks y Contextos      │                      │
│  │  useAuth, usePermissions   │                      │
│  │  BuildingContext           │                      │
│  └─────────────┬─────────────┘                      │
│                │                                     │
│  ┌─────────────┴─────────────┐                      │
│  │      Capa de Servicios     │                      │
│  │  auth, buildings, users,   │                      │
│  │  payments, billing, units  │                      │
│  └─────────────┬─────────────┘                      │
│                │                                     │
│  ┌─────────────┴─────────────┐                      │
│  │   Cliente API (Axios)      │                      │
│  │  Interceptores para tokens │                      │
│  │  de auth y manejo errores  │                      │
│  └─────────────┬─────────────┘                      │
│                │                                     │
└────────────────┼────────────────────────────────────┘
                 │  HTTPS / Bearer JWT
                 ▼
┌─────────────────────────────────────────────────────┐
│          API Backend (Bun + ElysiaJS)               │
│       API REST con Autenticación JWT                │
│  Rutas públicas: /auth, /buildings (GET)            │
│  Rutas admin:    /api/v1/admin/*                    │
└─────────────────────────────────────────────────────┘
```

### Estructura del Proyecto
```
condominium-admin/
├── app/                          # Páginas del App Router de Next.js
│   ├── (auth)/
│   │   └── login/                # Página de inicio de sesión
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Layout del dashboard (sidebar + header + guard de auth)
│   │   ├── dashboard/            # Dashboard global (Super Admin)
│   │   ├── buildings/            # Lista de edificios + rutas anidadas [id]/
│   │   │   └── [id]/
│   │   │       ├── dashboard/    # Dashboard específico del edificio
│   │   │       ├── users/        # Usuarios del edificio
│   │   │       ├── payments/     # Pagos del edificio
│   │   │       ├── billing/      # Facturación del edificio
│   │   │       └── units/        # Gestión de unidades del edificio
│   │   ├── users/                # Página global de usuarios
│   │   ├── payments/             # Página global de pagos
│   │   └── billing/              # Página global de facturación
│   │       └── invoices/         # Gestión de facturas
│   ├── layout.tsx                # Layout raíz
│   ├── page.tsx                  # Inicio — redirige a /dashboard
│   ├── providers.tsx             # Wrappers de AuthProvider + BuildingProvider
│   └── globals.css               # Estilos globales y config de Tailwind
│
├── components/
│   ├── ui/                       # Primitivos de shadcn/ui (Button, Card, Dialog, etc.)
│   ├── layout/                   # Sidebar, Header
│   ├── dashboard/                # Componente DashboardView
│   ├── buildings/                # BuildingDialog, UnitsTab, CreateUnitDialog,
│   │                               BatchUnitWizard, UnitDetailsSheet
│   ├── billing/                  # InvoiceDialog, InvoiceDetailsDialog,
│   │                               ExcelInvoiceLoader
│   ├── payments/                 # PaymentDialog
│   └── users/                    # UserDialog, UserRoleManager,
│                                   UserUnitsManager, BuildingRoleBadge
│
├── lib/
│   ├── api/
│   │   └── client.ts             # Instancia de Axios con interceptores de auth
│   ├── contexts/
│   │   └── BuildingContext.tsx    # Estado de selección de edificio (React Context)
│   ├── hooks/
│   │   ├── useAuth.tsx           # Contexto + hook de autenticación
│   │   └── usePermissions.tsx    # Verificaciones de permisos basados en roles
│   ├── services/                 # Módulos de servicios de API
│   │   ├── auth.service.ts
│   │   ├── buildings.service.ts
│   │   ├── users.service.ts
│   │   ├── payments.service.ts
│   │   ├── billing.service.ts
│   │   └── units.service.ts
│   └── utils/
│       ├── constants.ts          # Constantes de la app, rutas, enums
│       ├── format.ts             # Formateadores de moneda, fecha, período
│       └── validation.ts         # Schemas de validación Zod
│
├── types/
│   └── models.ts                 # Todas las interfaces TypeScript y DTOs
│
├── swagger.json                  # Especificación de la API backend (OpenAPI 3.0)
└── .env.local                    # Variables de entorno
```

---

## 3. Modelo de Dominio

### Entidades Principales

#### Usuario (User)
Los usuarios representan a las personas que interactúan con el sistema de condominio. Cada usuario tiene un rol global y puede estar asociado a múltiples roles específicos por edificio.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string (UUID) | Identificador único |
| `email` | string | Correo electrónico de inicio de sesión |
| `name` | string | Nombre completo |
| `phone` | string (opcional) | Número de teléfono |
| `role` | `'resident' \| 'board' \| 'admin'` | Rol global en el sistema |
| `status` | `'pending' \| 'active' \| 'inactive' \| 'rejected'` | Estado de la cuenta |
| `units` | `UserUnit[]` | Unidades asignadas a este usuario |
| `buildingRoles` | `{ building_id, role }[]` | Asignaciones de rol por edificio |
| `building_id` | string (opcional, legado) | Asignación de edificio único (legacy) |
| `created_at` | string (ISO 8601) | Fecha de creación |
| `updated_at` | string (ISO 8601) | Fecha de última actualización |

#### Edificio (Building)
Los edificios representan los complejos residenciales de condominios gestionados dentro del sistema.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string (UUID) | Identificador único |
| `name` | string | Nombre del edificio |
| `address` | string | Dirección física |
| `rif` | string (opcional) | Número de identificación fiscal (RIF) |
| `total_units` | number (opcional) | Cantidad de unidades en el edificio |
| `monthly_fee` | number (opcional) | Cuota mensual estándar del condominio |
| `created_at` | string (opcional) | Fecha de creación |

#### Unidad (Unit)
Las unidades son apartamentos o espacios individuales dentro de un edificio.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string (UUID) | Identificador único |
| `name` | string | Identificador de la unidad (ej: "1A", "PH-2") |
| `floor` | string | Piso donde se encuentra |
| `aliquot` | number | Porcentaje de participación en gastos comunes (0-100) |
| `building_id` | string (UUID) | Edificio al que pertenece |

#### Factura (Invoice)
Las facturas representan recibos unificados del sistema: tanto deudas de condominio como gastos de caja chica. El campo `tag` diferencia entre recibos normales y de caja chica.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string (UUID) | Identificador único |
| `number` | string (opcional) | Número de factura |
| `amount` | number | Monto total de la factura |
| `paid_amount` | number | Monto ya pagado |
| `status` | `'PENDING' \| 'PAID' \| 'CANCELLED'` | Estado de la factura |
| `tag` | `'NORMAL' \| 'PETTY_CASH'` | Etiqueta: recibo de condominio o gasto de caja chica |
| `type` | `'EXPENSE' \| 'DEBT' \| 'EXTRAORDINARY'` (opcional) | Tipo de factura |
| `issue_date` | string (opcional) | Fecha de emisión |
| `due_date` | string (opcional) | Fecha límite de pago |
| `description` | string (opcional) | Descripción del concepto |
| `month` | number (opcional, legacy) | Mes de facturación (1-12) |
| `year` | number (opcional, legacy) | Año de facturación |
| `period` | string (opcional) | Período en formato YYYY-MM (preferido sobre month/year) |
| `receipt_number` | string (opcional) | Número de recibo generado por el backend |
| `user_id` | string (opcional) | Propietario de la factura |
| `unit_id` | string \| null (opcional) | Unidad a la que pertenece. Nullable para invoices a nivel de edificio (caja chica) |
| `building_id` | string \| null (opcional) | Edificio al que pertenece. Usado en invoices de caja chica |
| `unit` | Unit (opcional) | Detalles de la unidad relacionada |

#### Crédito por Unidad (UnitCreditResponse)
Registro de saldo a favor acumulado por sobrepagos.

| Campo | Tipo | Descripción |
|---|---|---|
| `balance` | number | Saldo a favor actual de la unidad |
| `history` | `CreditLedgerEntry[]` | Historial de movimientos de crédito |

#### Entrada de Crédito (CreditLedgerEntry)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string (UUID) | Identificador único |
| `unit_id` | string (UUID) | Unidad que tiene el crédito |
| `amount` | number | Monto (positivo = crédito, negativo = consumo) |
| `reason` | string | Razón del crédito (ej: "Overpayment on invoice X") |
| `reference_type` | string (opcional) | Tipo de referencia (ej: payment) |
| `reference_id` | string (opcional) | ID de la referencia |
| `created_at` | string | Fecha de creación |

#### Pago (Payment)
Los pagos representan el dinero enviado por los residentes para cubrir facturas.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string (UUID) | Identificador único |
| `user_id` | string (UUID) | Quién realizó el pago |
| `amount` | number | Monto del pago |
| `payment_date` | string (ISO 8601) | Fecha en que se realizó el pago |
| `method` | `'PAGO_MOVIL' \| 'TRANSFER' \| 'CASH'` | Método de pago |
| `reference` | string (opcional) | Número de referencia de la transacción |
| `bank` | string (opcional) | Nombre del banco |
| `proof_url` | string (opcional) | URL de la imagen del comprobante de pago |
| `status` | `'PENDING' \| 'APPROVED' \| 'REJECTED'` | Estado de aprobación |
| `notes` | string (opcional) | Notas del administrador o motivo de rechazo |
| `allocations` | `Allocation[]` | Facturas que cubre este pago |
| `unit_id` | string (opcional) | Unidad relacionada |
| `processed_at` | string (opcional) | Auditoría: cuándo fue revisado |
| `processed_by` | string (opcional) | Auditoría: quién lo revisó |

#### Asignación (Allocation)
Las asignaciones vinculan pagos con facturas específicas, representando la relación contable.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string (UUID) | Identificador único |
| `payment_id` | string (UUID) | Pago asociado |
| `invoice_id` | string (UUID) | Factura asociada |
| `amount` | number | Monto asignado del pago a la factura |

### Relaciones entre Entidades
```
Edificio 1──* Unidad 1──* Factura
                │            │
                │            │ (vía Asignación/Allocation)
                │            │
Usuario *──* Unidad   Pago 1──* Asignación *──1 Factura
  │        (vía UserUnit)
  │
  └── buildingRoles (asignación de rol por edificio)
```

- Un **Edificio** contiene muchas **Unidades**.
- Un **Usuario** puede estar asignado a múltiples **Unidades** (vía `UserUnit`), cada una con una bandera `is_primary`.
- Un **Usuario** puede tener diferentes roles en diferentes edificios (vía `buildingRoles`).
- Una **Factura** pertenece a una **Unidad** y a un **Usuario**.
- Un **Pago** pertenece a un **Usuario** y puede cubrir múltiples **Facturas** (vía `Allocation`).
- Una **Asignación** vincula un monto específico de un **Pago** a una **Factura** específica.

---

## 4. Sistema de Roles y Permisos

### Definición de Roles

#### Super Admin (`role: 'admin'`, sin `building_id`)
El administrador con acceso total al sistema, a todos los edificios y todos los datos.

**Capacidades:**
- Ver todos los edificios, usuarios y pagos de todo el sistema
- Crear, editar y eliminar edificios
- Gestionar todos los usuarios de cualquier edificio y cambiar sus roles
- Aprobar o rechazar cualquier pago de cualquier edificio
- Gestionar facturación para cualquier edificio
- Crear y gestionar unidades en cualquier edificio
- Acceder al dashboard global con estadísticas de todo el sistema
- No tiene restricción de contexto de edificio — opera en "Modo Global"

#### Miembro de Junta / Board Member (`role: 'board'` o `role: 'admin'` con `building_id`)
Un administrador a nivel de edificio responsable de gestionar su(s) edificio(s) asignado(s).

**Capacidades:**
- Ver solamente su(s) edificio(s) asignado(s)
- Gestionar usuarios dentro de su(s) edificio(s)
- Aprobar o rechazar pagos de los residentes de su edificio
- Gestionar facturación para su edificio
- Ver unidades y su estado financiero
- NO puede crear ni eliminar edificios
- NO puede cambiar los roles globales de los usuarios
- Si está asignado a un solo edificio, se redirige automáticamente al dashboard de ese edificio

#### Residente (`role: 'resident'`)
Usuarios finales que pagan sus cuotas de condominio. Los residentes **NO** tienen acceso al panel de administración — usan una aplicación móvil separada.

### Lógica de Resolución de Permisos
El hook `usePermissions` es la autoridad central de permisos:

1. **`isSuperAdmin`**: Verdadero si `user.role` es `'admin'` o `'superadmin'` (sin distinguir mayúsculas).
2. **`isBoardMember`**: Verdadero si `user.role` es `'board'`.
3. **Verificaciones por edificio** (`canManageBuilding`, `canManageUsers`, `canApprovePayments`): Aceptan un parámetro opcional `buildingId`. Los Super Admin siempre pasan. Los Board Members pasan solo para sus edificios asignados.
4. **Resolución de rol por edificio**: Primero revisa el array `user.buildingRoles[]`. Si no encuentra, usa el campo legacy `user.building_id` como respaldo de compatibilidad.

### Sistema de Contexto de Edificio
El `BuildingContext` gestiona qué edificio está viendo el usuario actualmente:

- **Super Admins** inician en "Modo Global" (`selectedBuildingId: null`) y pueden ver todos los edificios. Pueden entrar a edificios específicos.
- **Board Members** se asignan automáticamente a su primer edificio de junta. Si tienen un solo edificio, se redirigen directamente al dashboard de ese edificio.
- **Lógica de auto-selección**: Usa primero el edificio de la unidad primaria del usuario, luego cae al primer edificio disponible.

---

## 5. Sistema de Autenticación

### Flujo de Autenticación
1. El usuario envía email + contraseña a `POST /auth/login`.
2. El backend devuelve `{ token: { access_token, refresh_token, expires_in }, user }`.
3. El frontend almacena `access_token` y `refresh_token` en `localStorage`.
4. El frontend valida el rol del usuario — solo los roles `admin` y `board` pueden acceder al panel.
5. El frontend valida el estado de la cuenta — cuentas `pending`, `rejected` e `inactive` son bloqueadas.
6. En cargas de página subsiguientes, el `AuthProvider` verifica si existe un token y llama a `GET /api/v1/admin/users/me` para validar la sesión.

### Gestión de Tokens
- **Almacenamiento**: `localStorage` (claves `access_token`, `refresh_token`)
- **Inyección**: El interceptor de peticiones de Axios agrega automáticamente `Authorization: Bearer {token}` a cada petición API.
- **Manejo de expiración**: El interceptor de respuestas vigila errores 401 en endpoints de auth (`/auth/me` o `/users/me`). Al recibir un 401, los tokens se eliminan y el usuario se redirige a `/login`.
- **Cierre de sesión**: Limpia ambos tokens del localStorage y redirige a `/login`.

### Mensajes de Error de Control de Acceso
| Condición | Mensaje de Error |
|---|---|
| Rol no es admin/board | "Access denied. Only administrators and board members can access this panel." |
| Estado es `pending` | "Your account is pending approval." |
| Estado es `rejected` | "Your account has been rejected." |
| Estado es `inactive` | "Your account is inactive." |

---

## 6. Integración con la API

### Configuración del Cliente API
El cliente Axios está configurado con:
- **URL Base**: Desde la variable de entorno `NEXT_PUBLIC_API_URL` (por defecto: `http://localhost:3001`)
- **Prefijo Admin**: Las rutas administrativas usan el prefijo `/api/v1/admin` (constante `ADMIN_API_PREFIX` en `constants.ts`)
- **Headers por defecto**: `Content-Type: application/json`
- **Interceptor de auth**: Adjunta automáticamente el token Bearer desde localStorage
- **Interceptor de errores**: Transforma errores de la API en mensajes amigables para el usuario, maneja 401 en endpoints de auth

### Estructura de Rutas de la API
El backend organiza los endpoints en tres niveles:
- **Rutas Públicas** (sin prefijo): `/auth/login`, `GET /buildings`, `GET /buildings/{id}/units` — no requieren autenticación o son de lectura pública.
- **Rutas APK** (`/api/v1/app/`): Exclusivas para la aplicación móvil de residentes. No usadas por el panel admin.
- **Rutas Admin** (`/api/v1/admin/`): Exclusivas para el panel de administración (Board y Admin). Todas las operaciones de gestión pasan por aquí.

### Referencia Completa de Endpoints de la API

#### Autenticación (Rutas Públicas)
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Autenticar usuario, devuelve tokens JWT + datos del usuario |
| `POST` | `/auth/register` | Registrar una nueva cuenta de usuario |

#### Usuarios (Rutas Admin — `/api/v1/admin/users`)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/admin/users/me` | Obtener perfil del usuario autenticado actual |
| `GET` | `/api/v1/admin/users` | Listar todos los usuarios (filtrable por building_id, unit_id, role, status) |
| `GET` | `/api/v1/admin/users/{id}` | Obtener un usuario específico por ID |
| `PATCH` | `/api/v1/admin/users/{id}` | Actualizar usuario (nombre, teléfono, rol, estado, buildingRoles) |
| `POST` | `/api/v1/admin/users/{id}/approve` | Aprobar el registro pendiente de un usuario |
| `POST` | `/api/v1/admin/users` | Crear usuario (solo Admin) |
| `DELETE` | `/api/v1/admin/users/{id}` | Eliminar un usuario (solo Admin) |
| `GET` | `/api/v1/admin/users/{id}/units` | Obtener todas las unidades asignadas a un usuario |
| `POST` | `/api/v1/admin/users/{id}/units` | Asignar o actualizar una unidad para un usuario |
| `DELETE` | `/api/v1/admin/users/{id}/units/{unitId}` | Eliminar la asignación de una unidad de un usuario |
| `POST` | `/api/v1/admin/users/{id}/roles` | Actualizar el rol de un usuario en un edificio específico |

#### Edificios (Rutas mixtas — lectura pública, escritura admin)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/buildings` | Listar todos los edificios (pública) |
| `GET` | `/buildings/{id}` | Obtener detalles de un edificio por ID (pública) |
| `POST` | `/api/v1/admin/buildings` | Crear un nuevo edificio |
| `PATCH` | `/api/v1/admin/buildings/{id}` | Actualizar un edificio |
| `DELETE` | `/api/v1/admin/buildings/{id}` | Eliminar un edificio |

#### Unidades (Rutas mixtas — lectura pública, escritura admin)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/buildings/{id}/units` | Listar todas las unidades de un edificio (pública) |
| `GET` | `/buildings/units/{id}` | Obtener una unidad específica por ID (pública) |
| `POST` | `/api/v1/admin/buildings/{id}/units` | Crear una unidad individual en un edificio |
| `POST` | `/api/v1/admin/buildings/{id}/units/batch` | Creación masiva de unidades (por pisos y unidades por piso) |

#### Pagos (Rutas Admin — `/api/v1/admin/payments`)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/admin/payments` | Listar los pagos propios del usuario (filtrable) |
| `GET` | `/api/v1/admin/payments/{id}` | Obtener detalles de un pago por ID |
| `POST` | `/api/v1/admin/payments` | Crear un pago (multipart/form-data para subir comprobante) |
| `GET` | `/api/v1/admin/payments/admin/payments` | Admin: listar todos los pagos (filtrable por building_id, status, period, year, unit_id) |
| `PATCH` | `/api/v1/admin/payments/admin/payments/{id}` | Admin: actualizar estado del pago (aprobar/rechazar) |
| `GET` | `/api/v1/admin/payments/summary` | Obtener resumen de pagos con estado de solvencia |

#### Facturación (Rutas Admin — `/api/v1/admin/billing`)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/admin/billing/invoices` | Listar facturas (filtrable por building_id, unit_id, status, month, year, user_id, **tag**) |
| `GET` | `/api/v1/admin/billing/invoices/{id}` | Obtener detalles de una factura |
| `GET` | `/api/v1/admin/billing/invoices/{id}/payments` | Obtener pagos asignados a una factura específica |
| `POST` | `/api/v1/admin/billing/invoices/preview` | Vista previa de facturas desde carga de Excel (multipart/form-data) |
| `POST` | `/api/v1/admin/billing/invoices/confirm` | Confirmar y crear las facturas previsualizadas |
| `GET` | `/api/v1/admin/billing/payments/{id}/invoices` | Obtener facturas cubiertas por un pago específico |
| `GET` | `/api/v1/admin/billing/units/{id}/invoices` | Obtener facturas de una unidad (filtrable por **tag**: NORMAL, PETTY_CASH) |
| `GET` | `/api/v1/admin/billing/units/{id}/balance` | Obtener resumen de saldo de una unidad (deuda total, facturas pendientes) |
| `GET` | `/api/v1/admin/billing/units/{id}/credit` | Obtener crédito/saldo a favor de una unidad |
| `POST` | `/api/v1/admin/billing/debt` | Cargar/crear una deuda para una unidad |

#### Caja Chica (Backend disponible, aún no integrado en el Frontend)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/v1/admin/petty-cash/funds/{buildingId}` | Obtener saldo de caja chica de un edificio |
| `GET` | `/api/v1/admin/petty-cash/funds/{buildingId}/transactions` | Historial de transacciones (filtros: type, category, page, limit) |
| `POST` | `/api/v1/admin/petty-cash/funds/{buildingId}/transactions` | Crear transacción (INCOME o EXPENSE) |
| `GET` | `/api/v1/admin/petty-cash/funds/{buildingId}/assessments` | Preview de excedente y distribución por unidad |
| `POST` | `/api/v1/admin/petty-cash/funds/{buildingId}/assessments` | Generar facturas de cobro por excedente a cada unidad |

#### Salud del Sistema
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/health` | Verificación de salud del backend |

---

## 7. Módulos Funcionales

### 7.1 Dashboard
**Ruta**: `/dashboard` (global) y `/buildings/{id}/dashboard` (por edificio)

El dashboard proporciona una vista general del estado del condominio:
- **Super Admins** ven el dashboard global con estadísticas de todo el sistema (total de edificios, total de usuarios, pagos pendientes, etc.).
- **Board Members** son redirigidos automáticamente al dashboard de su edificio.
- Estadísticas mostradas: cantidad de pagos pendientes, pagos aprobados, ingresos totales, tasa de solvencia.

### 7.2 Gestión de Edificios
**Ruta**: `/buildings` (lista) y `/buildings/{id}/*` (detalle con rutas anidadas)

- **Vista de Lista**: Grilla de tarjetas mostrando todos los edificios con nombre, dirección y cantidad de unidades.
- **Crear/Editar**: Componente `BuildingDialog` con formulario para nombre y dirección.
- **Eliminar**: Confirmación antes de eliminar (solo Super Admin).
- **Detalle del Edificio**: Interfaz con tabs y rutas anidadas para dashboard, usuarios, pagos, facturación y unidades.
- **Enrutamiento Inteligente**: Los Board Members con un solo edificio son redirigidos automáticamente al detalle de su edificio.

### 7.3 Gestión de Usuarios
**Ruta**: `/users` (global) y `/buildings/{id}/users` (por edificio)

Funcionalidades:
- **Lista de Usuarios**: Tabla de datos con información de rol, estado, edificio y unidad.
- **Crear/Editar Usuario**: `UserDialog` con formulario completo — nombre, email, rol, asignación de edificio, estado.
- **Aprobación de Usuarios**: Aprobación con un clic para registros pendientes. El rechazo actualiza el estado a `rejected`.
- **Gestión de Unidades**: Componente `UserUnitsManager` para asignar/eliminar unidades y establecer la unidad primaria.
- **Gestión de Roles**: Componente `UserRoleManager` para gestionar roles por edificio.
- **Badges de Rol por Edificio**: Indicador visual (`BuildingRoleBadge`) que muestra el rol del usuario en cada edificio.

### 7.4 Gestión de Pagos
**Ruta**: `/payments` (global) y `/buildings/{id}/payments` (por edificio)

Funcionalidades:
- **Lista de Pagos**: Tabla con filtrado por estado (PENDING, APPROVED, REJECTED), período y año.
- **Detalle del Pago**: `PaymentDialog` mostrando información completa del pago incluyendo imagen del comprobante, asignaciones a facturas y pista de auditoría.
- **Aprobar/Rechazar**: Flujo administrativo con notas opcionales. Los campos de auditoría registran quién procesó el pago y cuándo.
- **Métodos de Pago**: Soporta Pago Móvil, Transferencia Bancaria y Efectivo (Cash).
- **Creación de Pagos**: `multipart/form-data` para soportar la carga de imagen del comprobante.

### 7.5 Facturación
**Ruta**: `/billing` (global) y `/buildings/{id}/billing` (por edificio)

Funcionalidades:
- **Lista de Facturas**: Filtrable por estado, período y unidad.
- **Creación de Facturas**: `InvoiceDialog` para crear facturas individuales con monto, período, fecha de vencimiento y descripción.
- **Detalles de Factura**: `InvoiceDetailsDialog` mostrando pagos aplicados a la factura y saldo restante.
- **Importación desde Excel**: `ExcelInvoiceLoader` permite la creación masiva de facturas subiendo un archivo Excel. Soporta un paso de vista previa antes de la confirmación.
- **Carga de Deudas**: `POST /billing/debt` para crear deudas específicas para unidades determinadas.
- **Saldo de Unidad**: Ver resumen financiero por unidad (deuda total, facturas pendientes, detalle de facturas).

### 7.6 Gestión de Unidades
**Ruta**: `/buildings/{id}/units`

Funcionalidades:
- **Tab de Unidades**: Componente `UnitsTab` listando todas las unidades de un edificio con nombre, piso y alícuota.
- **Creación Individual**: `CreateUnitDialog` para crear unidades individuales con nombre, piso y alícuota.
- **Creación Masiva**: `BatchUnitWizard` para generar múltiples unidades especificando pisos y unidades por piso con alícuota por defecto opcional.
- **Detalles de Unidad**: Panel deslizable `UnitDetailsSheet` mostrando info de la unidad y facturas/saldo asociados.

---

## 8. Layout de UI y Navegación

### Estructura del Layout
El layout del dashboard usa un patrón de sidebar fijo + header:
- **Sidebar**: Panel izquierdo fijo (72rem / 288px de ancho en pantallas grandes). Contiene links de navegación, selector de edificio e información del usuario.
- **Header**: Barra superior con título de página y acciones contextuales.
- **Contenido Principal**: Área de contenido responsive con restricción de ancho máximo y padding.
- **Guard de Auth**: El layout del dashboard verifica el estado de autenticación. Los usuarios no autenticados son redirigidos a `/login`.

### Flujo de Navegación
```
/login → /dashboard (Super Admin)
       → /buildings/{id}/dashboard (Board Member, redirección automática)

/buildings → listar todos los edificios (tarjetas)
/buildings/{id}/dashboard → estadísticas del edificio
/buildings/{id}/users → gestión de usuarios del edificio
/buildings/{id}/payments → gestión de pagos del edificio
/buildings/{id}/billing → facturación del edificio
/buildings/{id}/units → gestión de unidades

/users → gestión global de usuarios (Super Admin)
/payments → gestión global de pagos
/billing → gestión global de facturación
/billing/invoices → gestión de facturas
```

---

## 9. Gestión de Estado

### Proveedores de Contexto React (en `providers.tsx`)
La aplicación envuelve todas las páginas en dos proveedores de contexto:

1. **`AuthProvider`** (`lib/hooks/useAuth.tsx`):
   - Almacena el objeto `User` autenticado.
   - Provee funciones `login()` y `logout()`.
   - Rastrea el estado `isLoading` durante la validación inicial del token.
   - Al montar, verifica si hay un token en localStorage y lo valida vía API.

2. **`BuildingProvider`** (`lib/contexts/BuildingContext.tsx`):
   - Gestiona `selectedBuildingId` y la lista `availableBuildings`.
   - Para Super Admins: obtiene todos los edificios; inicia en "Modo Global" (selección null).
   - Para Board Members: obtiene solo sus edificios asignados desde `buildingRoles[]`.
   - Auto-selecciona el primer edificio disponible para roles no-admin.
   - Valida la selección actual contra los edificios disponibles.

### Patrón de Obtención de Datos
Todas las páginas de funcionalidades siguen el mismo patrón:
1. El componente se monta → llama a la función del servicio en `useEffect`.
2. La función del servicio llama a `apiClient.get/post/patch/delete`.
3. El interceptor de Axios agrega el header de auth automáticamente.
4. La respuesta se almacena en estado local del componente (`useState`).
5. Los estados de carga y error se manejan con spinners y notificaciones toast.

---

## 10. Reglas de Negocio y Validación

### Reglas de Procesamiento de Pagos
- Los pagos inician como `PENDING` cuando son enviados por los residentes.
- Solo los administradores y miembros de junta pueden aprobar (`APPROVED`) o rechazar (`REJECTED`) pagos.
- Los pagos rechazados incluyen un campo `notes` explicando el motivo del rechazo.
- Los pagos aprobados se vinculan a facturas vía registros de `Allocation`.
- Los montos de pago siempre se convierten a `Number` para manejar inconsistencias de tipo string/decimal del backend.

### Reglas de Facturación
- Las facturas tienen tres estados: `PENDING`, `PAID`, `CANCELLED`.
- Cada factura rastrea `amount` (total) y `paid_amount` (suma de asignaciones).
- Las facturas usan el campo `period` en formato YYYY-MM como identificador de período (los campos `month`/`year` son legacy y opcionales).
- El campo `tag` diferencia entre recibos normales (`NORMAL`) y gastos de caja chica (`PETTY_CASH`). Los endpoints de invoices soportan filtro `?tag=` como query param.
- Las facturas pueden tener `unit_id` nullable — los invoices a nivel de edificio (caja chica) usan `building_id` en su lugar.
- La importación desde Excel soporta un paso de vista previa donde las facturas existentes muestran estado `EXISTS` y las nuevas muestran `TO_BE_CREATED`.
- Las facturas pueden tener advertencias del backend durante la vista previa.
- **Crédito por sobrepago**: Cuando un pago excede el monto de una factura, el excedente se acumula como crédito en `unit_credit_ledger`. Consultable vía `GET /api/v1/admin/billing/units/{id}/credit`.

### Reglas de Unidades
- Cada unidad tiene una `aliquot` (porcentaje de participación en gastos comunes).
- La creación masiva acepta arrays de pisos y unidades por piso.
- Las unidades pertenecen a un solo edificio.
- Los usuarios pueden ser asignados a múltiples unidades con una marcada como `is_primary`.

### Registro y Aprobación de Usuarios
- Los nuevos usuarios se registran a través de la aplicación móvil (o `/auth/register`).
- Los usuarios inician con estado `pending`.
- Los miembros de junta o administradores deben aprobar a los usuarios vía `POST /users/{id}/approve`.
- Los usuarios rechazados no pueden iniciar sesión.
- Solo los roles `admin` y `board` pueden acceder al panel de administración.

---

## 11. Configuración de Entorno

| Variable | Descripción | Valor por Defecto |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL base de la API backend | `http://localhost:3001` |
| `NEXT_PUBLIC_APP_NAME` | Nombre de la aplicación para mostrar | `Condominio Admin` |
| `NEXT_PUBLIC_USE_MOCK_API` | Habilitar API mock para desarrollo | `true` |

### URL de la API en Producción
El backend de producción está desplegado en: `https://condominio.api.diangogavidia.com`
(Alternativa/staging: `http://18.221.223.44:3000`)

---

## 12. Funciones de Formato y Utilidades

### Formato de Moneda (`formatCurrency`)
Formatea números como moneda USD (ej: `$1,234.56`).

### Formato de Fecha (`formatDate`)
Parsea cadenas ISO 8601 y las formatea como `MMM dd, yyyy` por defecto. Usa `date-fns`.

### Formato de Período (`formatPeriod`)
Convierte cadenas `YYYY-MM` a formato legible (ej: `2024-03` → `March 2024`).

### Formato de Método de Pago (`formatPaymentMethod`)
- `PAGO_MOVIL` → "Pago Móvil"
- `TRANSFER` → "Transferencia"
- `CASH` → "Efectivo"

### Formato de Rol de Usuario (`formatUserRole`)
- `admin` → "Super Admin"
- `board` → "Board Member"
- `resident` → "Resident"

---

## 13. Actualizaciones Recientes (Changelog)

### Migración a API v2 (Abril 2026)
- **Prefijo de rutas admin**: Todos los servicios administrativos migrados al prefijo `/api/v1/admin`. Las rutas públicas (GET buildings, GET units) mantienen sus paths originales.
- **Backend actualizado**: El backend migró de NestJS a Bun + ElysiaJS. Los formatos de respuesta se mantienen compatibles.
- **Modelo de Invoice unificado**: Nuevo campo `tag` (`NORMAL` | `PETTY_CASH`) para diferenciar recibos normales de gastos de caja chica. Campo `type` para categorizar (`EXPENSE`, `DEBT`, `EXTRAORDINARY`). `unit_id` ahora nullable, `building_id` agregado.
- **Período preferido sobre month/year**: El campo `period` (YYYY-MM) es ahora el identificador principal de período. `month` y `year` son legacy y opcionales.
- **Endpoint de crédito**: Nuevo `GET /api/v1/admin/billing/units/{id}/credit` para consultar saldo a favor por sobrepago.
- **Buildings update**: Método cambiado de `PUT` a `PATCH`.
- **Endpoints de caja chica actualizados**: Estructura RESTful con `/petty-cash/funds/{buildingId}/transactions` y `/petty-cash/funds/{buildingId}/assessments` (aún no integrado en frontend).

### Funcionalidades Previas
- **Gestión de Unidades**: Herramientas completas — crear unidades individuales, generación masiva, vistas de detalle de unidades.
- **Facturación**: Crear facturas, cargar deudas, importar desde Excel con flujo de vista previa/confirmación.
- **Experiencia de Board Member**: Permisos mejorados para miembros de junta con branding personalizado por edificio.

### Correcciones y Mejoras
- **Estabilidad**: Resuelto el parpadeo de tabs y bucles de carga infinita en el dashboard de edificios.
- **Integridad de Datos**: Corregidos desajustes de tipos en el diálogo de facturas y páginas de detalle.
- **Validación**: Mejorada la validación de alícuotas al crear unidades.
- **Pulido General**: Varias correcciones de UI y actualizaciones de servicios.

---

## 14. Decisiones Arquitectónicas y Patrones

### Renderizado Solo del Lado del Cliente
Todas las páginas usan directivas `'use client'`. No hay renderizado del lado del servidor ni Server Components. Esto simplifica el manejo de auth (acceso a localStorage) pero significa que no hay beneficios de SEO ni obtención de datos del lado del servidor.

### Patrón de Capa de Servicios
Cada entidad del dominio tiene un archivo de servicio dedicado (`*.service.ts`) que encapsula todas las llamadas a la API. Los componentes nunca llaman a `apiClient` directamente — siempre pasan por los servicios. Esto centraliza las definiciones de URLs y transformaciones de respuesta.

### Prefijo de Rutas Admin (`ADMIN_API_PREFIX`)
Los servicios usan la constante `ADMIN_API_PREFIX` (`/api/v1/admin`) para prefijar las rutas administrativas. Las rutas de lectura pública (listar edificios, listar unidades) no llevan prefijo. Este patrón separa claramente qué operaciones requieren autenticación admin vs cuáles son públicas.

### Compatibilidad con Versiones Anteriores (Legacy)
El código mantiene compatibilidad con versiones anteriores del backend:
- El tipo `User` soporta tanto `building_id` (legacy, edificio único) como `buildingRoles[]` (nuevo, multi-edificio).
- `usePermissions` revisa `buildingRoles` primero, luego cae al campo legacy `building_id`.
- La respuesta de auth maneja tanto `{ token: { access_token } }` como `{ access_token }`.
- El modelo `Invoice` soporta tanto `period` (YYYY-MM, preferido) como `month`/`year` (legacy) con fallbacks en los componentes.

### Patrón de Componentes shadcn/ui
Los primitivos de UI vienen de shadcn/ui (basados en Radix). Los nuevos componentes se agregan vía:
```bash
npx shadcn@latest add <nombre-del-componente>
```

### Manejo de Formularios
Los formularios usan React Hook Form con schemas de validación Zod. El patrón es:
1. Definir un schema Zod para los datos del formulario.
2. Usar `useForm` con `zodResolver`.
3. Renderizar campos del formulario con controllers.
4. El handler de envío llama a la función del servicio correspondiente.

---

## 15. Mejoras Futuras (Planificadas)
- Tablas de datos avanzadas con TanStack Table (ordenamiento, filtrado, paginación del lado del servidor)
- Visor de comprobantes de pago con zoom/lightbox
- Diálogos de confirmación para acciones destructivas (actualmente usa `confirm()` del navegador)
- Exportar datos a CSV
- Soporte de modo oscuro (Dark Mode)
- Notificaciones por email
- Logs de auditoría
- Analítica avanzada y reportes
- Módulo de Caja Chica — integración frontend (los endpoints RESTful del backend ya están disponibles en `/api/v1/admin/petty-cash/funds/`)
- Consumo de crédito (usar saldo a favor para pagar recibos futuros)
