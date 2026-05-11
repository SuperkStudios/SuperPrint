import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.split("=");
    return [key.replace(/^--/, ""), value.join("=") || "true"];
  })
);

const bundle = args.get("bundle");
const confirm = args.get("confirm") === "true";
const dryRun = args.get("dry-run") === "true" || !confirm;
const dataRoot = process.env.SUPERPRINT_DATA_ROOT ?? "/data";
const restoreDir = path.join(dataRoot, "backup-staging", "restore");

if (!bundle) {
  throw new Error("Usage: tsx scripts/restore-disaster-recovery.ts --bundle=/path/to/backup.tar.gz.enc --confirm=true");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for restore");
}

if (!process.env.BACKUP_ENCRYPTION_PASSPHRASE) {
  throw new Error("BACKUP_ENCRYPTION_PASSPHRASE is required for restore");
}

console.log(dryRun ? "Dry run restore plan:" : "Running disaster recovery restore:");
console.log(`- bundle: ${bundle}`);
console.log(`- staging: ${restoreDir}`);
console.log(`- data root: ${dataRoot}`);
console.log("- database restore: pg_restore --clean --if-exists");
console.log("- media restore: uploads, sliced, videos, timelapses, thumbnails, logs");

if (dryRun) {
  console.log("Pass --confirm=true to execute destructive restore steps.");
  process.exit(0);
}

await rm(restoreDir, { recursive: true, force: true });
await mkdir(restoreDir, { recursive: true });

run("openssl", [
  "enc",
  "-d",
  "-aes-256-cbc",
  "-pbkdf2",
  "-pass",
  "env:BACKUP_ENCRYPTION_PASSPHRASE",
  "-in",
  bundle,
  "-out",
  path.join(restoreDir, "bundle.tar.gz")
]);
run("tar", ["-xzf", path.join(restoreDir, "bundle.tar.gz"), "-C", restoreDir]);
run("pg_restore", ["--clean", "--if-exists", "--dbname", process.env.DATABASE_URL, path.join(restoreDir, "postgres.dump")]);
run("tar", ["-xzf", path.join(restoreDir, "media.tar.gz"), "-C", "/"]);

console.log("Restore complete.");

function run(command: string, commandArgs: string[]) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status}`);
  }
}
