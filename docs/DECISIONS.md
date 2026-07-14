# Decisiones de diseño y roadmap

Este documento recoge (a) las decisiones que la spec dejaba abiertas y los
**valores por defecto** que asume la implementación actual, y (b) el estado por
fases. Todos los valores por defecto son configurables desde la interfaz o
triviales de cambiar; ninguno bloquea el arranque.

## Decisiones pendientes (spec §9) — defaults asumidos

| Tema | Default en el MVP | Cómo cambiarlo |
|---|---|---|
| **Hosting** | No decidido. La app solo requiere PostgreSQL (UE) + un `STORAGE_DIR` (bucket privado UE en prod). | Variable de entorno / infra en despliegue. |
| **Fichaje / cierre de caja** | No integrados aún (Fase 2). El modelo de fichaje se reconstruirá dentro de MADRE (opción *c* de la spec §8) para garantizar el registro legal de 4 años en la misma BD. | Módulo Fase 2. |
| **Flujo de aprobación** | **Encargado aprueba, superadmin supervisa.** Ambos roles pueden aprobar vacaciones/ausencias de su ámbito; el superadmin ve todos los locales. | `src/lib/rbac.ts` (`canApprove`). |
| **Superadmin** | Se crea en el asistente de primer arranque. Un solo superadmin inicial; puede crear encargados. (La transferencia de rol por gobernanza societaria queda para el contrato.) | `/setup`; gestión de admins = Fase 2. |
| **Días de vacaciones** | **30 días naturales/año**, devengo **2,5/mes** (Convenio Hostelería CAT). Configurable por año y con override por empleado. | `/vacations/config` y ficha de empleado. |

## Modelo de roles y permisos

- **Superadmin**: todos los locales, configuración, logs. No atado a un `localId`.
- **Encargado**: su local. Aprueba vacaciones/ajustes, gestiona empleados,
  horarios y documentos de su local.
- **Empleado**: solo su información (vacaciones, horario, documentos propios).
- **Gestoría** (parcial): puede subir documentos. Descarga de registro horario y
  datos de contratación = Fase 2/3.

El *scoping* por local se aplica en cada consulta (`localScope` / `canAccessLocal`).

## RGPD y requisitos legales (spec §5)

Implementado:
- Contraseñas hasheadas (bcrypt, coste 12).
- Control de acceso por rol en cada página, acción y descarga de documento.
- **Registro de actividades de tratamiento**: `AuditLog` append-only (login,
  aprobaciones, cambios de ficha, subida/lectura de documentos, etc.).
- **Conservación ≥ 4 años**: baja = soft-delete (`deletedAt`); los datos y el
  histórico se conservan y son consultables por el admin.
- Confirmación de recepción de documentos con **fecha/hora/IP** (firma simple).
- Sin biometría ni geolocalización.

Pendiente en despliegue (no es código):
- **HTTPS** (terminación TLS en el hosting).
- **Cifrado en reposo** de la BD y del bucket.
- **DPA art. 28 RGPD** con el proveedor de hosting (servidores UE).
- **Backups diarios** con retención ≥ 30 días + prueba de restauración.
- Procedimiento de **derechos ARCO** (exportar/eliminar datos de exempleado).
- Recuperación de contraseña autónoma: flujo completo (token + caducidad 1 h en
  `User.resetToken`); falta conectar el proveedor de email (`src/lib/mailer.ts`
  registra el enlace en consola en dev).
- **Fichaje sin biometría ni geolocalización**: tablet con PIN individual
  (criterio AEPD). Registro inmutable; correcciones solo con motivo + autor.

## Estado por fases

**Fase 1 (MVP) — completada**
1. Gestión de empleados + accesos ✅
2. Vacaciones con motor de reglas ✅
3. Horarios ✅
4. Repositorio de documentos con confirmación de recepción ✅

**Fase 2 — completada**
5. Fichaje reconstruido en MADRE (tablet `/kiosk` + PIN, sin biometría),
   registro inmutable con correcciones anotadas, export CSV para Inspección,
   y banco de horas (fichado vs. planificado). *Sincronización offline: pendiente.*
6. Cierre de caja como módulo interno bajo el login (histórico consultable).
   *Nota: no había app externa que integrar; se construyó nativo.*
7. Manual del bar: wiki editable, confirmación de lectura por sección con
   registro (fecha/hora/IP), versionado que obliga a relectura.
8. Ausencias y permisos (con justificante y aprobación), alertas de caducidad
   (carnet manipulador, alérgenos, NIE/DNI, contrato temporal, período de prueba),
   tablón de anuncios, registro de incidencias, gestión de usuarios/admins y
   recuperación de contraseña autónoma (token 1 h; envío por *mailer* conectable).

**Fase 3 — completada**
- **Multi-local activo**: alta/edición de locales (`/locals`) y selector de local
  para superadmin que scopea todas las vistas (empleados, vacaciones, horarios,
  documentos, fichajes, etc.). Empleados/encargados quedan fijados a su local.
- **Acceso de gestoría**: subida de nóminas + descarga CSV de datos de
  contratación (`/api/employees/export`) y registro horario (`/api/timeclock/export`).
- **Email real**: `src/lib/mailer.ts` usa nodemailer cuando `SMTP_URL` está
  definido (proveedor UE); si no, registra en consola (dev).
- **Fichaje offline**: cola en `localStorage` con marca de tiempo, reintento al
  reconectar (el PIN se re-verifica en el servidor) y service worker (`public/sw.js`)
  para cargar el shell del kiosko sin conexión.
- **Manual enriquecido**: renderizador Markdown seguro (escapa HTML y reintroduce
  solo etiquetas conocidas) con títulos, listas, enlaces e imágenes.
- **Idiomas**: castellano / català con selector (`src/lib/i18n.ts`); navegación y
  chrome traducidos, cuerpos de página migrables por claves.

**Extras completados (cierre funcional de la spec)**
- **Intercambio de turnos** (§4.3): propuesta → aceptación del compañero → visto
  bueno del encargado, con reasignación automática del cuadrante. En `/swaps`.
- **Plantillas de semana tipo** (§4.3): guardar una semana y aplicarla a otra.
- **Nóminas en lote por NIF** (§4.5): subida múltiple con asignación automática.
- **Prioridad de conflictos de vacaciones** (§4.2): detección de solapamientos
  pendientes y orden por regla (orden de solicitud / antigüedad).
- **Notificaciones por email** en vacaciones, ausencias, documentos, publicación
  de horarios y cambios de turno (vía el mailer conectable).
- **Derechos ARCO** (§5): export JSON completo por empleado y borrado definitivo
  (superadmin, solo sobre bajas, con purga de archivos).
- **Manual con imágenes**: subida al bucket privado + inserción en Markdown.
- **Migraciones Prisma** formales (baseline en `prisma/migrations/`, `db:migrate`).
- **Tests** unitarios de la lógica pura (`vitest`: ISO week, fichaje, markdown, i18n).

**Corazón del bar · nivel 1 (operativa diaria del local)**
- **APPCC / seguridad alimentaria**: puntos de control configurables por el admin
  (numérico con umbral, sí/no, texto) y registro diario inmutable con conforme/no
  conforme; si un valor sale de umbral, avisa a los encargados. Export CSV para
  Sanidad. Reaprovecha los patrones de confirmación y de caducidades.
- **Checklists de apertura/cierre**: plantillas y tareas configurables; ejecución
  diaria con quién marcó cada tarea y a qué hora.
- **Parte de turno (relevo)**: notas por turno con autor/hora y confirmación de
  lectura del siguiente turno.
- **Notificaciones push (PWA)**: `web-push` + VAPID; cada usuario las activa por
  dispositivo en *Mi cuenta*. Integradas en `notify()` (email + push). Sin claves
  `VAPID_*`, el push se desactiva y sólo se envía email.
- **Propinas**: bote por turno con reparto a partes iguales, por horas fichadas o
  manual; cuadre exacto por redondeo; el empleado ve su acumulado.

**Nivel 2 (dirección y personas)**
- **Panel de dirección** (`/panel`): cruza datos ya recogidos por local/mes —
  ventas (neto de cierres de caja) vs. horas trabajadas/planificadas →
  productividad (ventas por hora), horas extra, propinas, absentismo, rotación
  (altas/bajas) y empleados activos, con tendencia de 6 meses. Sin esquema nuevo.
  El coste real de personal en € se calcula a partir de un coste/hora
  configurable por local (`defaultHourlyCost`, por defecto) con override por
  empleado (`hourlyCostOverride`) — mismo patrón que `vacationDaysOverride` — y
  se aplica a las horas realmente fichadas. Si no hay coste/hora configurado, o
  el superadmin está viendo "todos los locales" a la vez, el panel muestra
  "sin configurar" en vez de una cifra engañosa; no rompe el render.
- **Onboarding de altas** (`/onboarding`): plantilla de incorporación configurable
  y progreso por empleado (contrato, uniformidad, PIN, lectura del manual,
  formación…), gestionable por el admin.
- **Formación + PRL** (`/training`): cursos con validez configurable y registro de
  formación completada con certificado; las renovaciones (manipulador, alérgenos,
  PRL…) se integran en las alertas de caducidad (`/alerts` + dashboard).

**Seguridad de accesos**
- **Anti fuerza bruta + bloqueo temporal**: 5 intentos fallidos de login
  bloquean la cuenta 15 minutos (`User.failedLoginCount`/`lockedUntil`); con la
  cuenta bloqueada no se llega a comprobar la contraseña (evita dar pistas por
  timing). Contador a 0 tras login correcto.
- **Límite de recuperación de contraseña**: máximo 3 solicitudes por email en
  15 minutos (contadas sobre `AuditLog`, sin estado en memoria — necesario
  porque el runtime serverless no comparte memoria entre invocaciones), con la
  misma respuesta genérica de siempre (no revela si el email existe).
- **2FA (TOTP) opcional**: activable por cada usuario desde *Mi cuenta*
  (`otplib` + QR + 8 códigos de respaldo de un solo uso, hasheados con bcrypt).
  Al iniciar sesión con 2FA activo, la `Session` se crea con
  `twoFactorVerified=false` y `getCurrentUser()` la trata como no autenticada
  hasta pasar por `/login/verify-2fa` (código TOTP o código de respaldo).
- **Cabeceras de seguridad HTTP** (`next.config.mjs`): `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.

**Vacaciones: días sueltos además de semanas completas**
- Motivo: 30 días naturales no siempre son un múltiplo de 7 (p. ej. 4 semanas
  = 28 días + 2 sueltos), y hacía falta poder coger días de la bolsa de uno en
  uno. Nuevo modelo `VacationDay` (mismo patrón que `VacationWeek`: un
  `approvedKey` único por `local:fecha` que la BD hace imposible duplicar) —
  una solicitud puede combinar semanas completas y días sueltos.
- El cruce entre granularidades (un día suelto de una solicitud que cae dentro
  de una semana ya aprobada de OTRO empleado, o al revés) no lo cubre un único
  índice — se comprueba explícitamente dentro de la transacción de aprobación,
  con aislamiento `SERIALIZABLE` para que dos aprobaciones concurrentes que se
  solapen a través de ambas tablas no puedan colarse las dos a la vez.
- El calendario (`WeekCalendar.tsx`) muestra cada semana con sus 7 días; el
  atajo "Semana completa" solo aparece cuando los 7 días siguen libres — si no,
  se pueden seleccionar los días sueltos que queden en verde.

**Autorregistro de empleados**
- Motivo: quitarle al admin el trabajo de teclear cada dato de cada alta
  (DNI, IBAN, contrato, horas...) — que lo rellene el propio empleado, y el
  admin solo revise y apruebe.
- Flujo: el admin genera una invitación (`createInvite`, en
  `employees/registrations/actions.ts`) con un token de un solo uso (32 bytes
  aleatorios) ligada a un local y un email, con caducidad de 7 días —
  guardada en el nuevo modelo `EmployeeRegistration` (deliberadamente
  **separado** de `Employee`: mientras no se aprueba no existe ficha ni
  cuenta, así que un enlace nunca usado o rechazado no deja empleados a
  medias). El enlace se envía por email y también se muestra en pantalla al
  admin por si el email no llega.
- `/join/[token]` es una ruta pública (fuera de `(app)`, mismo patrón que
  `/login`/`/forgot`/`/reset`) sin autenticación — el futuro empleado rellena
  ahí sus datos. Un token solo puede enviarse una vez (`submittedAt`) y dejar
  de ser válido tras aprobarse, rechazarse o caducar.
- Al enviar el formulario, se avisa por email a superadmin + encargados del
  local para que sepan que hay algo que revisar.
- Al **aprobar** (`approveRegistration`): se crean el `Employee` y el `User`
  en una transacción, y — a diferencia del alta manual desde la ficha, donde
  el email de credenciales es un botón aparte a petición explícita — aquí SÍ
  se envía automáticamente en el mismo paso, porque es justo el punto de la
  función: cerrar el círculo sin que el admin tenga que hacer un segundo
  clic. La contraseña también se muestra en pantalla al admin como respaldo.
- `/join/[token]` lleva `dynamic = "force-dynamic"` explícito — tras el bug
  de `/api/health` (prerenderizada en build y congelada para siempre, ver
  más abajo) cualquier ruta pública nueva lo declara sin dar por hecho que
  Next.js la detecte sola como dinámica.

**Pendiente REAL (no es código de la app)**
- **Infra de producción**: hosting bajo control de la propiedad, HTTPS, cifrado en
  reposo, backups diarios + prueba de restauración, DPA art. 28, dominio, y
  configurar `SMTP_URL` para el envío real de emails.
- **Migración a Next 15** para cerrar los avisos residuales de `npm audit` (DoS a
  nivel de framework; requieren configuración de image-optimizer que no usamos).
- **Traducción completa al catalán** de los cuerpos de página (mecanismo listo;
  hoy traducidos navegación y chrome).
- **Sincronización offline avanzada** del fichaje (hoy: cola local + reintento).
- **Decisiones de la propiedad** (§9): superadmin/gobernanza, días de vacaciones
  (30 vs mejora), flujo de aprobación definitivo, tecnología de las apps actuales
  de fichaje/caja, y cláusula de escrow.

## Notas de implementación

- **Anti-solapamiento** garantizado por índice único en BD, no solo en código:
  robusto ante concurrencia. Ver `README.md`.
- **Sin migración de datos**: la app arranca vacía; el asistente de primer
  arranque crea superadmin + local + año de vacaciones.
- **Exportación / evitar dependencia del desarrollador** (spec §6): los datos
  viven en PostgreSQL estándar (exportable a CSV/JSON con herramientas comunes) y
  el código es la fuente de verdad. Recomendable cláusula de escrow en contrato.
