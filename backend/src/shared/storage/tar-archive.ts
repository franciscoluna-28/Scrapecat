import fs from "node:fs/promises";
import { create, extract } from "tar";

/**
 * Packs a directory (including dotfiles such as `.git`) into a gzip-compressed
 * tar file. `create` streams from disk — the archive is never buffered in RAM.
 */
export async function packDirectory(srcDir: string, destFile: string): Promise<void> {
  await create({ cwd: srcDir, file: destFile, gzip: true, portable: true }, ["."]);
}

/**
 * Extracts a gzip tar into `destDir`, creating it if needed. Paths are
 * sanitized by tar by default (no `..`, no absolute writes).
 */
export async function unpackArchive(srcFile: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  await extract({ cwd: destDir, file: srcFile });
}
