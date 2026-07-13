# Despliegue de MADRE

## "Application error: a server-side exception has occurred" en Netlify

Es el mensaje genérico que da Next.js cuando algo falla en el servidor. Con
MADRE, casi siempre es una de estas tres causas — **en este orden de
probabilidad**:

### 1. Falta `DATABASE_URL` o apunta a `localhost`

Netlify Functions corre en la nube: no puede alcanzar un Postgres en
`localhost` de tu ordenador. Necesitas una base de datos PostgreSQL
**alcanzable desde internet**.

- Ve a **Site settings → Environment variables** en Netlify y añade
  `DATABASE_URL` con la cadena de conexión de un Postgres real (UE):
  [Neon](https://neon.tech), [Supabase](https://supabase.com),
  [Railway](https://railway.app) tienen capa gratuita y dan la URL lista.
- Si el proveedor usa PgBouncer en modo transacción (habitual en
  serverless), añade `?pgbouncer=true&connection_limit=1` al final de la URL.
- Después de añadir/cambiar variables de entorno, **hay que volver a
  desplegar** (Netlify no las aplica a builds ya hechos).

### 2. El motor de Prisma no coincide con el runtime de Netlify

Ya corregido en el repo (`prisma/schema.prisma` declara
`binaryTargets = ["native", "rhel-openssl-3.0.x"]`). Si sigues viendo el
error tras fijar `DATABASE_URL`, confirma que el build ejecuta
`prisma generate` (lo hace `npm run build` por defecto) y vuelve a desplegar
sin caché (**Deploys → Trigger deploy → Clear cache and deploy**).

### 3. Falta `SESSION_SECRET`

Añádela también en las variables de entorno de Netlify: 48+ bytes
aleatorios. Genera una con:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Comprobar qué falla exactamente

Con el código actual, visita `https://tu-sitio.netlify.app/api/health`
(no requiere login). Devuelve qué variables están configuradas y si la base
de datos responde — así se ve la causa real en vez del error genérico.

## Checklist de variables de entorno (Netlify → Site settings → Environment variables)

| Variable | Obligatoria | Notas |
|---|---|---|
| `DATABASE_URL` | Sí | Postgres alcanzable desde internet, no `localhost` |
| `SESSION_SECRET` | Sí | 48+ bytes aleatorios |
| `STORAGE_DIR` | No | En Netlify se ignora: los documentos usan **Netlify Blobs** automáticamente (ver abajo) |
| `SMTP_URL`, `MAIL_FROM` | No | Sin ellas, los emails se registran en los logs de función en vez de enviarse |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | No | Sin ellas, las notificaciones push quedan desactivadas (el email sigue funcionando) |

## Almacenamiento de documentos en Netlify

Netlify Functions tiene el disco de solo lectura (salvo `/tmp`, que se borra
entre invocaciones). Por eso `src/lib/storage.ts` detecta automáticamente
Netlify (`process.env.NETLIFY`) y usa **Netlify Blobs** en su lugar — no
requiere configuración ni credenciales adicionales, y los documentos
(nóminas, contratos, certificados de formación, adjuntos de incidencias)
persisten entre despliegues.

Fuera de Netlify (Docker, VPS, local) se sigue usando `STORAGE_DIR` en disco.
Para otro proveedor serverless sin Blobs, sustituye `saveFile`/`readFile`/
`deleteFile` por un bucket S3-compatible con URLs firmadas (spec §5/§8).

## Primer arranque tras desplegar

La app arranca vacía. Netlify aplica el esquema automáticamente: el comando
de build (`npm run build:netlify`, configurado en `netlify.toml`) ejecuta
`prisma migrate deploy` antes de compilar, en cada despliegue. No hay que
ejecutar nada a mano.

1. Añade `DATABASE_URL` y `SESSION_SECRET` en Netlify (ver checklist arriba)
   y despliega — el build creará las tablas solo.
2. Visita el sitio: como no hay superadmin, redirige a `/setup`.
3. Completa el asistente (superadmin, local, año de vacaciones) — todo desde
   la interfaz, sin tocar código.

Si el build falla en el paso de `prisma migrate deploy`, revisa el log de
Netlify: normalmente significa que `DATABASE_URL` no es alcanzable desde el
build (host mal copiado, `sslmode=require` que falta, o el proveedor exige
IP allowlisting — Neon/Supabase no lo requieren por defecto).

## Alternativa: Vercel

Next.js es el framework de Vercel, así que el despliegue es más directo (sin
plugin, sin Blobs — pero sí necesita reemplazar el almacenamiento en disco
por un bucket igualmente, ya que Vercel Functions también es de solo
lectura). El resto de la checklist (`DATABASE_URL`, `SESSION_SECRET`,
`binaryTargets`) aplica igual.

## Self-hosting (Docker / VPS)

Ahí sí hay disco persistente de verdad, así que `STORAGE_DIR` en disco
funciona sin más. Ver `docker-compose.yml` y `Dockerfile` (si ya se han
añadido al repo) para un despliegue con Postgres incluido.
