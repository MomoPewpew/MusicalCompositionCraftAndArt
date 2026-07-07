#!/usr/bin/env node
/**
 * Generate an SFTP batch file that uploads every file under out/ individually.
 * Works on hosts where `rm -r` is unavailable and `put -r ./*` skips updates.
 */
import { readdirSync, writeFileSync } from "node:fs";
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

function collectParentDirs(files) {
  const dirs = new Set();
  for (const file of files) {
    let dir = dirname(relative(outDir, file)).replace(/\\/g, "/");
    while (dir && dir !== ".") {
      dirs.add(dir);
      dir = dirname(dir).replace(/\\/g, "/");
    }
  }
  return [...dirs].sort((a, b) => {
    const depthDiff = a.split("/").length - b.split("/").length;
    return depthDiff !== 0 ? depthDiff : a.localeCompare(b);
  });
}

function main() {
  const targetDir = process.argv[2] ?? "files";
  const files = walkFiles(outDir);
  const dirs = collectParentDirs(files);
  const lines = [
    `cd ${quoteSftpPath(targetDir)}`,
    `lcd ${quoteSftpPath(outDir)}`
  ];

  // Leading `-` tells OpenSSH sftp to continue if mkdir already exists.
  for (const dir of dirs) {
    lines.push(`-mkdir ${quoteSftpPath(dir)}`);
  }

  for (const file of files) {
    const rel = relative(outDir, file).replace(/\\/g, "/");
    lines.push(`put ${quoteSftpPath(rel)} ${quoteSftpPath(rel)}`);
  }

  lines.push("bye");

  const batchPath = resolve(webRoot, "sftp-batch.txt");
  writeFileSync(batchPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${batchPath} (${dirs.length} dirs, ${files.length} files)`);
}

main();
