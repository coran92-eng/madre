import "server-only";
import { promises as fs } from "fs";
import path from "path";

// Local dev: STORAGE_DIR on disk. Production: swap for an EU private bucket with
// signed URLs (spec §5/§8). The rest of the app only touches these helpers.
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

export async function saveFile(key: string, data: Buffer): Promise<void> {
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function readFile(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key));
}
