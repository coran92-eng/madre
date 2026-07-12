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

**Fase 3 — pendiente**
- Activación multi-local real (Sastrería BCN y Madrid) — el modelo ya lo soporta
- Acceso completo de gestoría (descarga de registro horario y contratación)
- Sincronización offline del fichaje; envío real de emails (SMTP UE)
- Manual con imágenes/vídeo embebido (hoy: texto enriquecido con saltos de línea)
- ¿Catalán como segundo idioma?

## Notas de implementación

- **Anti-solapamiento** garantizado por índice único en BD, no solo en código:
  robusto ante concurrencia. Ver `README.md`.
- **Sin migración de datos**: la app arranca vacía; el asistente de primer
  arranque crea superadmin + local + año de vacaciones.
- **Exportación / evitar dependencia del desarrollador** (spec §6): los datos
  viven en PostgreSQL estándar (exportable a CSV/JSON con herramientas comunes) y
  el código es la fuente de verdad. Recomendable cláusula de escrow en contrato.
