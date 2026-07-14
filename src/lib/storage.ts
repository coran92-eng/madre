import "server-only";
import { promises as fs } from "fs";
import path from "path";

// Dos backends, misma interfaz (saveFile/readFile/deleteFile):
//  - Netlify Blobs, cuando la app corre en Netlify — persiste entre
//    despliegues, sin credenciales que configurar.
//  - Disco local (STORAGE_DIR), para desarrollo y self-hosting (Docker/VPS).
// En producción fuera de Netlify, sustituir por un bucket privado con URLs
// firmadas (spec §5/§8) implementando el mismo trío de funciones.
//
// Detección: NETLIFY_BLOBS_CONTEXT es la variable que la propia librería
// @netlify/blobs usa para autoconfigurarse (ver getEnvironmentContext en
// node_modules/@netlify/blobs) — es la señal correcta, a diferencia de la
// variable genérica NETLIFY, que no está garantizado que llegue al runtime
// de la función (solo al build) y dejaría esto escribiendo en disco de solo
// lectura en producción sin avisar.
const useNetlifyBlobs = !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY);

function baseDir(): string {
  return path.resolve(process.env.STORAGE_DIR || "./storage");
}

function resolveKey(key: string): string {
  const dir = baseDir();
  const full = path.resolve(dir, key);
  // Prevent path traversal.
  if (!full.startsWith(dir + path.sep) && full !== dir) {
    throw new Error("Ruta de almacenamiento no válida.");
  }
  return full;
}

async function getBlobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "madre-documents", consistency: "strong" });
}

export async function saveFile(key: string, data: Buffer): Promise<void> {
  if (useNetlifyBlobs) {
    const store = await getBlobStore();
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    await store.set(key, arrayBuffer);
    return;
  }
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function readFile(key: string): Promise<Buffer> {
  if (useNetlifyBlobs) {
    const store = await getBlobStore();
    const data = await store.get(key, { type: "arrayBuffer" });
    if (!data) throw new Error("Archivo no encontrado.");
    return Buffer.from(data);
  }
  return fs.readFile(resolveKey(key));
}

/** Best-effort delete (ARCO / retention purge). Never throws on missing file. */
export async function deleteFile(key: string): Promise<void> {
  try {
    if (useNetlifyBlobs) {
      const store = await getBlobStore();
      await store.delete(key);
      return;
    }
    await fs.unlink(resolveKey(key));
  } catch {
    /* already gone */
  }
}
