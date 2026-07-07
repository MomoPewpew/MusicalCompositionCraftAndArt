#!/usr/bin/env node
/**
 * Generate an SFTP batch file that uploads every file under out/ individually.
 * Works on hosts where `rm -r` is unavailable and `put -r ./*` skips updates.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const outDir = resolve(webRoot, "out");

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files.sort();
}

function quoteSftpPath(path) {
  return `"${path.replace(/"/g, '\\"')}"`;
}

function main() {
  const targetDir = process.argv[2] ?? "files";
  const files = walkFiles(outDir);
  const lines = [
    `cd ${quoteSftpPath(targetDir)}`,
    `lcd ${quoteSftpPath(outDir)}`
  ];

  for (const file of files) {
    const rel = relative(outDir, file).replace(/\\/g, "/");
    lines.push(`put ${quoteSftpPath(rel)} ${quoteSftpPath(rel)}`);
  }

  lines.push("bye");

  const batchPath = resolve(webRoot, "sftp-batch.txt");
  writeFileSync(batchPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${batchPath} (${files.length} files)`);
}

main();
