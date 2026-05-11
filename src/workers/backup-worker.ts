import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { createBackupPlan } from "./backup-planner";

type BackupManifest = {
  runId: string;
  createdAt: string;
  databaseDumpPath: string;
  mediaArchivePath: string;
  bundlePath: string;
  mediaSources: string[];
};

async function runBackup() {
  const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dataRoot = process.env.SUPERPRINT_DATA_ROOT ?? "/data";
  const plan = createBackupPlan({
    runId,
    dataRoot,
    databaseUrl: process.env.DATABASE_URL ?? "",
    socialBladeBucket: process.env.SOCIAL_BLADE_BUCKET ?? "",
    encryptionPassphrase: process.env.BACKUP_ENCRYPTION_PASSPHRASE ?? ""
  });

  await mkdir(plan.stagingDir, { recursive: true });
  await mkdir(path.join(dataRoot, "logs", "backups"), { recursive: true });
  const logFile = createWriteStream(path.join(dataRoot, "logs", "backups", `${runId}.log`), { flags: "a" });

  await log(logFile, `Starting backup ${runId}`);
  await run("pg_dump", ["--format=custom", `--file=${plan.databaseDumpPath}`, process.env.DATABASE_URL!], logFile);
  await run("tar", ["-czf", plan.mediaArchivePath, ...plan.mediaSources], logFile);

  const manifest: BackupManifest = {
    runId,
    createdAt: new Date().toISOString(),
    databaseDumpPath: "postgres.dump",
    mediaArchivePath: "media.tar.gz",
    bundlePath: path.basename(plan.bundlePath),
    mediaSources: plan.mediaSources.map((source) => path.basename(source))
  };
  await writeFile(plan.manifestPath, JSON.stringify(manifest, null, 2));

  await run(
    "tar",
    ["-czf", "-", "-C", plan.stagingDir, "postgres.dump", "media.tar.gz", "manifest.json"],
    logFile,
    {
      pipeTo: {
        command: "openssl",
        args: [
          "enc",
          "-aes-256-cbc",
          "-pbkdf2",
          "-salt",
          "-pass",
          `env:BACKUP_ENCRYPTION_PASSPHRASE`,
          "-out",
          plan.bundlePath
        ]
      }
    }
  );

  await uploadToSocialBlade(plan.bundlePath, logFile);
  await log(logFile, `Backup complete ${plan.bundlePath}`);
  logFile.end();
}

async function main() {
  if (process.env.BACKUP_RUN_ONCE === "true") {
    await runBackup();
    return;
  }

  await runBackup();
  scheduleNextBackup();
}

function scheduleNextBackup() {
  const cron = process.env.BACKUP_CRON ?? "0 2 * * *";
  const [minute = "0", hour = "2"] = cron.split(" ");
  const next = new Date();
  next.setHours(Number(hour), Number(minute), 0, 0);
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }

  const delay = next.getTime() - Date.now();
  console.log(`Next backup scheduled for ${next.toISOString()}`);
  setTimeout(async () => {
    try {
      await runBackup();
    } finally {
      scheduleNextBackup();
    }
  }, delay);
}

async function uploadToSocialBlade(bundlePath: string, logFile: NodeJS.WritableStream) {
  const uploadCommand = process.env.SOCIAL_BLADE_UPLOAD_COMMAND;
  const bucket = process.env.SOCIAL_BLADE_BUCKET;

  if (!uploadCommand || !bucket) {
    await log(logFile, `Social Blade upload skipped: set SOCIAL_BLADE_UPLOAD_COMMAND and SOCIAL_BLADE_BUCKET`);
    return;
  }

  await run(uploadCommand, [bundlePath, bucket], logFile, { shell: true });
}

function run(
  command: string,
  args: string[],
  logFile: NodeJS.WritableStream,
  options: { shell?: boolean; pipeTo?: { command: string; args: string[] } } = {}
) {
  return new Promise<void>((resolve, reject) => {
    logFile.write(`$ ${command} ${args.join(" ")}\n`);
    const child = spawn(command, args, {
      env: process.env,
      stdio: options.pipeTo ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
      shell: options.shell
    });

    let downstream: ReturnType<typeof spawn> | null = null;
    if (options.pipeTo) {
      downstream = spawn(options.pipeTo.command, options.pipeTo.args, {
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"]
      });
      if (!downstream.stdin) {
        reject(new Error(`${options.pipeTo.command} stdin unavailable`));
        return;
      }
      child.stdout.pipe(downstream.stdin);
      downstream.stdout?.on("data", (data) => logFile.write(data));
      downstream.stderr?.on("data", (data) => logFile.write(data));
    } else {
      child.stdout.on("data", (data) => logFile.write(data));
    }

    child.stderr.on("data", (data) => logFile.write(data));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with ${code}`));
        return;
      }
      if (!downstream) {
        resolve();
      }
    });
    downstream?.on("error", reject);
    downstream?.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${options.pipeTo!.command} exited with ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function log(stream: NodeJS.WritableStream, message: string) {
  stream.write(`[${new Date().toISOString()}] ${message}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
