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

**Corazón del bar · nivel 1 (operativa diaria):**

| Función | Estado |
|---|---|
| APPCC / seguridad alimentaria: puntos de control configurables (umbral/sí-no/texto), registro inmutable, alerta si sale de rango, CSV para Sanidad | ✅ |
| Checklists de apertura/cierre configurables, con quién y cuándo | ✅ |
| Parte de turno (relevo) con autor/hora y confirmación de lectura | ✅ |
| Notificaciones **push** (PWA, web-push/VAPID) además de email | ✅ |
| Propinas: bote por turno con reparto igual / por horas fichadas / manual | ✅ |

> **Push:** cada usuario las activa en *Mi cuenta*; requiere HTTPS en producción y
> las claves `VAPID_*` (ver `.env.example`). Sin claves, el push queda desactivado
> y las notificaciones siguen llegando por email.

**Nivel 2 (dirección y personas):**

| Función | Estado |
|---|---|
| Panel de dirección: ventas (de caja) vs. horas → productividad, absentismo, rotación, propinas y tendencia de 6 meses | ✅ |
| Onboarding de altas: plantilla de incorporación configurable + progreso por empleado | ✅ |
| Formación + PRL: cursos con validez y renovaciones que entran en las alertas de caducidad | ✅ |

**Seguridad de accesos y coste real:**

| Función | Estado |
|---|---|
| Bloqueo de cuenta tras 5 intentos fallidos de login (15 min) | ✅ |
| Límite de solicitudes de recuperación de contraseña (3 / 15 min) | ✅ |
| 2FA opcional (TOTP + códigos de respaldo de un solo uso), activable desde *Mi cuenta* | ✅ |
| Cabeceras de seguridad HTTP (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) | ✅ |
| Coste real de personal en el Panel de dirección: coste/hora por local (por defecto) y por empleado (override), € y % sobre ventas | ✅ |
| Días sueltos además de semanas completas en vacaciones (con anti-solapamiento día a día) | ✅ |
| No se puede solicitar más días de vacaciones de los que quedan de saldo | ✅ |
| **Autorregistro de empleados**: el admin invita por email con un enlace de un solo uso; el empleado rellena todos sus datos (DNI, IBAN, contrato...); el admin aprueba y el acceso se crea y se envía solo | ✅ |

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

## Despliegue en producción

- **Netlify**: incluye `netlify.toml` (plugin oficial de Next.js) y detecta el
  entorno automáticamente para usar **Netlify Blobs** como almacenamiento de
  documentos (sin disco persistente en Functions). Guía completa, checklist de
  variables de entorno y solución al error
  *"Application error: a server-side exception has occurred"* en
  **[`docs/DEPLOY.md`](docs/DEPLOY.md)**.
- **Docker / self-hosting**: `Dockerfile` + `docker-compose.yml` (app +
  PostgreSQL, con healthcheck). `scripts/backup.sh` para backups diarios con
  retención configurable (cron).
- **Diagnóstico**: `/api/health` (sin login) muestra qué variables de entorno
  faltan y si la base de datos responde — úsalo primero ante cualquier error
  tras desplegar.

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

- **Semanas completas o días sueltos**: el calendario compartido selecciona
  semanas enteras (lunes-domingo, atajo "Semana completa") o días individuales
  — útil cuando el derecho anual no encaja en semanas completas (p. ej. 30
  días = 4 semanas + 2 sueltos) o para coger días de la bolsa de uno en uno.
  Ambos modos conviven en la misma solicitud.
- **Anti-solapamiento ABSOLUTO, día a día** (`src/lib/vacations.ts`, `actions.ts`):
  al aprobar, cada semana escribe una clave única `local:año:semana`
  (`VacationWeek.approvedKey`) y cada día suelto `local:fecha`
  (`VacationDay.approvedKey`). Los índices `@unique` de la BD hacen imposible
  que dos empleados tengan el mismo slot — incluso ante aprobaciones
  concurrentes (`P2002`). El cruce entre granularidades (un día suelto que cae
  dentro de una semana ya aprobada de otro empleado, o viceversa) se
  comprueba con aislamiento `SERIALIZABLE` dentro de la misma transacción.
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
