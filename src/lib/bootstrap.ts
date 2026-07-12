import "server-only";
import { prisma } from "./db";

/** True when no superadmin exists yet → first-run wizard must run (spec §8). */
export async function needsSetup(): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: "SUPERADMIN" } });
  return count === 0;
}
