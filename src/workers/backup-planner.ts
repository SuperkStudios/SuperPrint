import path from "node:path";

export type BackupStepKind =
  | "postgres-dump"
  | "media-archive"
  | "encrypt-bundle"
  | "upload-social-blade"
  | "write-manifest";

export type BackupPlanInput = {
  runId: string;
  dataRoot: string;
  databaseUrl: string;
  socialBladeBucket: string;
  encryptionPassphrase: string;
};

export type BackupPlan = {
  runId: string;
  stagingDir: string;
  databaseDumpPath: string;
  mediaArchivePath: string;
  bundlePath: string;
  manifestPath: string;
  mediaSources: string[];
  steps: Array<{
    kind: BackupStepKind;
    command: string;
  }>;
};

const mediaClasses = ["uploads", "sliced", "videos", "timelapses", "thumbnails", "logs"];

export function createBackupPlan(input: BackupPlanInput): BackupPlan {
  if (!input.databaseUrl) {
    throw new Error("DATABASE_URL is required for backups");
  }
  if (!input.encryptionPassphrase) {
    throw new Error("BACKUP_ENCRYPTION_PASSPHRASE is required for backups");
  }

  const stagingDir = path.join(input.dataRoot, "backup-staging", input.runId);
  const databaseDumpPath = path.join(stagingDir, "postgres.dump");
  const mediaArchivePath = path.join(stagingDir, "media.tar.gz");
  const manifestPath = path.join(stagingDir, "manifest.json");
  const bundlePath = path.join(input.dataRoot, "backup-staging", `superprint-${input.runId}.tar.gz.enc`);
  const mediaSources = mediaClasses.map((storageClass) => path.join(input.dataRoot, storageClass));

  return {
    runId: input.runId,
    stagingDir,
    databaseDumpPath,
    mediaArchivePath,
    bundlePath,
    manifestPath,
    mediaSources,
    steps: [
      {
        kind: "postgres-dump",
        command: `pg_dump --format=custom --file=${shell(databaseDumpPath)} ${shell(input.databaseUrl)}`
      },
      {
        kind: "media-archive",
        command: `tar -czf ${shell(mediaArchivePath)} ${mediaSources.map(shell).join(" ")}`
      },
      {
        kind: "encrypt-bundle",
        command: `tar -czf - ${shell(databaseDumpPath)} ${shell(mediaArchivePath)} ${shell(manifestPath)} | openssl enc -aes-256-cbc -pbkdf2 -salt -out ${shell(bundlePath)}`
      },
      {
        kind: "upload-social-blade",
        command: `social-blade-upload ${shell(bundlePath)} ${shell(input.socialBladeBucket)}`
      },
      {
        kind: "write-manifest",
        command: `write ${shell(manifestPath)}`
      }
    ]
  };
}

function shell(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
