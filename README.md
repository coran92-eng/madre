# MADRE

**Plataforma de gestión de personal · Corte de Manga (Grupo Daco BCN SL)**

PWA responsive (Next.js + PostgreSQL) para centralizar la gestión de personal.
Autogestionable, multi-local desde el día 1, con log de actividad inmutable y
soft-delete para conservar el histórico 4 años.

## Estado actual — MVP (Fase 1)

| Módulo | Estado |
|---|---|
| Accesos + roles (superadmin / encargado / empleado / gestoría) | ✅ |
| Asistente de primer arranque | ✅ |
| Gestión de empleados (CRUD, alta/baja, histórico, provisión de acceso) | ✅ |
| Vacaciones — motor de reglas (anti-solapamiento, validador de capacidad, semanas bloqueadas, bolsa de días, flujo de aprobación, calendario compartido) | ✅ |
| Horarios — cuadrante semanal, publicación, horas planificadas vs. contrato | ✅ |
| Documentos — repositorio + confirmación de recepción (firma simple con fecha/hora/IP) | ✅ |
| Registro de actividad (log inmutable) | ✅ |
| Cambio de contraseña + recuperación autónoma | ✅ |

**Fase 2 — completada:**

| Módulo | Estado |
|---|---|
| Fichaje (tablet + PIN, sin biometría) + banco de horas + corrección anotada + export CSV | ✅ |
| Ausencias y permisos (con justificante) + flujo de aprobación | ✅ |
| Manual del bar (wiki editable, lectura confirmada, versionado → relectura) | ✅ |
| Tablón de anuncios (confirmación de lectura opcional) | ✅ |
| Alertas y caducidades (carnet, alérgenos, NIE, contrato, período de prueba) | ✅ |
| Registro de incidencias (solo admin, con adjunto) | ✅ |
| Cierre de caja (módulo interno + histórico) | ✅ |
| Gestión de usuarios/admins (superadmin) + recuperación de contraseña | ✅ |

**Fase 3 — completada:**

| Módulo | Estado |
|---|---|
| Multi-local activo: alta/edición de locales + selector de local para superadmin (scopea todas las vistas) | ✅ |
| Acceso de gestoría: subida de nóminas + export CSV de contratación y registro horario | ✅ |
| Email real (SMTP UE vía nodemailer, con fallback a consola en dev) | ✅ |
| Fichaje offline: cola local + reintento al reconectar + service worker | ✅ |
| Manual con texto enriquecido (Markdown seguro: títulos, listas, enlaces, imágenes) | ✅ |
| Idiomas: castellano / català con selector | ✅ |

> **Multi-local:** el superadmin usa el selector de la barra lateral para trabajar
> sobre un local concreto o «Todos». Empleados/encargados quedan fijados a su local.
>
> **i18n:** la navegación y el chrome están traducidos (es/ca); los cuerpos de
> página continúan en castellano y se migran por claves (`src/lib/i18n.ts`).
>
> **Fichaje offline:** las marcas se guardan en la tablet si no hay conexión y se
> sincronizan al volver (el PIN se re-verifica en el servidor al sincronizar).

**Cierre funcional (extras):**

| Función | Estado |
|---|---|
| Intercambio de turnos: propuesta → aceptación → visto bueno (§4.3) | ✅ |
| Plantillas de semana tipo (§4.3) | ✅ |
| Nóminas en lote con asignación por NIF (§4.5) | ✅ |
| Prioridad de conflictos de vacaciones (§4.2) | ✅ |
| Notificaciones por email (vacaciones, ausencias, documentos, horarios, turnos) | ✅ |
| Derechos ARCO: export JSON + borrado definitivo (§5) | ✅ |
| Imágenes en el manual (bucket privado + Markdown) | ✅ |
| Migraciones Prisma formales (`npm run db:migrate`) + tests (`npm test`) | ✅ |

Lo único pendiente es **infra de producción** y **decisiones de la propiedad** — ver `docs/DECISIONS.md`.

> **Fichaje (tablet):** ruta `/kiosk` sin login, protegida por PIN individual
> (4-6 dígitos). El PIN se define desde la ficha del empleado. La tablet debe
> estar online (sincronización offline queda para una iteración posterior).
>
> **Recuperación de contraseña:** el flujo (token + caducidad 1 h) es completo;
> el envío de email usa un *mailer* conectable (`src/lib/mailer.ts`) que en dev
> escribe el enlace en la consola del servidor. En producción se conecta un
> proveedor SMTP/API de la UE.

## Principios (spec §2) — cómo están implementados

1. **Autogestión**: todo es dato. Locales, empleados, años de vacaciones, semanas
   bloqueadas, cupos y horarios se gestionan desde la interfaz. Cero hardcode.
2. **Multi-local**: cada entidad lleva `localId`. Solo se activa CDM; añadir un
   local es configuración.
3. **Trazabilidad**: `AuditLog` es append-only (`src/lib/audit.ts`) — la app nunca
   actualiza ni borra filas de log.
4. **Web responsive / PWA**: `manifest.webmanifest`, instalable, funciona en móvil,
   tablet y escritorio.

## Stack

- **Next.js 14** (App Router, Server Actions) + **TypeScript** + **Tailwind**
- **PostgreSQL** vía **Prisma**
- Autenticación propia: sesiones en BD con expiración + cookie httpOnly firmada
  (HMAC), contraseñas con **bcrypt**
- Documentos privados en disco (`STORAGE_DIR`), servidos por un route handler
  autenticado. En producción: bucket privado UE + URLs firmadas.

## Puesta en marcha (desarrollo)

```bash
# 1. PostgreSQL en marcha y una base de datos creada
#    (ej.: usuario "madre", base "madre")

# 2. Variables de entorno
cp .env.example .env
#    edita DATABASE_URL y genera SESSION_SECRET:
#    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Dependencias + esquema
npm install
npm run db:push          # crea las tablas

# 4a. Arranque limpio (asistente de primer arranque en /setup)
npm run dev

# 4b. …o con datos de demo + verificación del motor
npm run db:seed
npm run dev
```

### Credenciales de demo (tras `npm run db:seed`)

| Rol | Email | Contraseña |
|---|---|---|
| Superadmin | `admin@cortedemanga.es` | `madre1234` |
| Encargado | `ana@cortedemanga.es` | `madre1234` |
| Empleado | `bruno@cortedemanga.es` | `madre1234` |
| Empleado | `carla@cortedemanga.es` | `madre1234` |

El seed también **verifica el motor**: comprueba que la regla anti-solapamiento
se aplica a nivel de base de datos e imprime el informe de capacidad.

## Cómo funciona el motor de vacaciones

- **Anti-solapamiento ABSOLUTO** (`src/lib/vacations.ts`, `actions.ts`): al aprobar,
  cada semana escribe una clave única `local:año:semana` en `VacationWeek.approvedKey`.
  El índice `@unique` de la BD hace imposible que dos empleados tengan la misma
  semana — incluso ante aprobaciones concurrentes (se captura el error `P2002`).
- **Validador de capacidad** (`capacityCheck`): `nº empleados activos × semanas/persona`
  vs. `semanas del año − bloqueadas`. Avisa **antes** de abrir solicitudes.
- **Semanas bloqueadas**: configurables por año desde el panel (temporada alta).
- **Bolsa de días**: devengo 2,5 días/mes (ajustable) + ajustes manuales que
  requieren aprobación.

## Estructura

```
prisma/schema.prisma      Modelo de datos (todo con localId, soft-delete, audit)
prisma/seed.ts            Datos demo + verificación del motor
src/lib/                  db, auth, rbac, audit, vacations, storage, bootstrap
src/app/setup             Asistente de primer arranque
src/app/login             Acceso
src/app/(app)/            App autenticada (dashboard, employees, vacations,
                          schedule, documents, audit, account)
src/app/api/documents/…   Descarga autenticada de documentos
```

## Requisitos legales / RGPD

Ver `docs/DECISIONS.md` §RGPD. Resumen: HTTPS, contraseñas hasheadas, control por
rol, log de tratamiento (AuditLog), conservación ≥4 años (soft-delete), sin
biometría ni geolocalización. Pendiente en despliegue: DPA art. 28 con el hosting
(UE), backups diarios con retención ≥30 días.
