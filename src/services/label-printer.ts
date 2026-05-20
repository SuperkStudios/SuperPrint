import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { defaultShippoPrintCommand, type ResolvedShippoSettings } from "@/domain/shippo-settings";

const execFileAsync = promisify(execFile);

export const superprintBleA42BtPrintCommand = defaultShippoPrintCommand;

const arrvelPpdPath = "/etc/cups/ppd/Arrvel_A42BT.ppd";
const arrvelRasterToLabelPath = "/Library/Printers/Arrvel/Filter/rastertolabel";
const defaultBleHelperAppPath = "/tmp/SuperPrintBLESender.app";
const bleTargetPrefix = "A42BT";
const bleChunkSize = "30";
const bleDelayMs = "0";
const defaultBlePrintTimeoutMs = 240_000;

type BlePrintOptions = {
  helperAppPath?: string;
  timeoutMs?: number;
};

export function isInternalLabelPrintCommand(command: string) {
  return command.trim() === superprintBleA42BtPrintCommand;
}

export async function printShippingLabelFile(filePath: string, settings: Pick<ResolvedShippoSettings, "printCommand">) {
  if (isInternalLabelPrintCommand(settings.printCommand)) {
    await printPdfWithArrvelA42BtBle(filePath);
    return;
  }
  await runExternalPrintCommand(settings.printCommand, filePath);
}

export async function printPdfWithArrvelA42BtBle(pdfPath: string, options: BlePrintOptions = {}) {
  if (path.extname(pdfPath).toLowerCase() !== ".pdf") {
    throw new Error(`${superprintBleA42BtPrintCommand} requires Shippo labels in PDF_4x6 or PDF format.`);
  }
  if (process.platform !== "darwin") {
    throw new Error(`${superprintBleA42BtPrintCommand} requires the macOS host. Docker Desktop Linux containers cannot access Mac CoreBluetooth directly.`);
  }

  await Promise.all([
    access(arrvelPpdPath),
    access(arrvelRasterToLabelPath)
  ]);

  const workDir = await mkdtemp(path.join(tmpdir(), "superprint-label-"));
  const cupsRasterPath = path.join(workDir, "label.cupsraster");
  const rawTsplPath = path.join(workDir, "label.raw.tspl");
  const tsplPath = path.join(workDir, "label.tspl");

  try {
    await runCommandToFile("cupsfilter", [
      "-p", arrvelPpdPath,
      "-m", "application/vnd.cups-raster",
      "-o", "PageSize=w283h425",
      "-o", "Resolution=203dpi",
      pdfPath
    ], cupsRasterPath);

    await runCommandToFile(arrvelRasterToLabelPath, [
      "1",
      "superprint",
      "shipping-label",
      "1",
      "PageSize=w283h425 Darkness=8 zePrintRate=4 GapOrMarkHeight=3 GapOrMarkOffset=0 zeMediaTracking=Gap",
      cupsRasterPath
    ], rawTsplPath, { PPD: arrvelPpdPath });

    await writeFile(tsplPath, stripLeadingNullsFromTsplBuffer(await readFile(rawTsplPath)));
    await sendTsplWithBleHelper(tsplPath, options);
  } finally {
    if (process.env.SUPERPRINT_KEEP_LABEL_PRINT_ARTIFACTS !== "1") {
      await rm(workDir, { force: true, recursive: true });
    }
  }
}

export function stripLeadingNullsFromTsplBuffer(buffer: Buffer) {
  const start = buffer.indexOf(Buffer.from("SIZE "));
  if (start < 0) throw new Error("Arrvel raster filter did not produce a TSPL SIZE command.");
  return buffer.subarray(start);
}

async function runExternalPrintCommand(printCommand: string, filePath: string) {
  const commandParts = printCommand.trim().split(/\s+/).filter(Boolean);
  const command = commandParts[0] ?? "lpr";
  const args = [...commandParts.slice(1), filePath];
  await execFileAsync(command, args);
}

async function sendTsplWithBleHelper(tsplPath: string, options: BlePrintOptions) {
  const appPath = await ensureBleHelperApp(options.helperAppPath);
  const logPath = path.join(tmpdir(), `superprint-ble-${process.pid}-${Date.now()}.log`);
  await rm(logPath, { force: true });

  await execFileAsync("open", [
    "-n",
    appPath,
    "--args",
    "--chunk", bleChunkSize,
    "--delay-ms", bleDelayMs,
    "--log", logPath,
    bleTargetPrefix,
    tsplPath
  ]);

  await waitForBleHelperLog(logPath, resolveBlePrintTimeoutMs(options.timeoutMs));
}

async function ensureBleHelperApp(explicitPath?: string) {
  const configuredPath = explicitPath ?? process.env.SUPERPRINT_BLE_SENDER_APP;
  if (configuredPath) {
    await access(path.join(configuredPath, "Contents/MacOS/SuperPrintBLESender"));
    return configuredPath;
  }

  const appPath = defaultBleHelperAppPath;
  const executablePath = path.join(appPath, "Contents/MacOS/SuperPrintBLESender");
  const sourcePath = path.join(process.cwd(), "scripts/ble-tspl-send.swift");
  const plistPath = path.join(process.cwd(), "scripts/ble-tspl-send-info.plist");
  const infoPlistPath = path.join(appPath, "Contents/Info.plist");

  if (await helperIsCurrent(executablePath, sourcePath, plistPath)) return appPath;

  await mkdir(path.dirname(executablePath), { recursive: true });
  await cp(plistPath, infoPlistPath);
  await execFileAsync("swiftc", [sourcePath, "-o", executablePath]);
  await execFileAsync("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  return appPath;
}

async function helperIsCurrent(executablePath: string, sourcePath: string, plistPath: string) {
  try {
    const [executable, source, plist] = await Promise.all([
      stat(executablePath),
      stat(sourcePath),
      stat(plistPath)
    ]);
    return executable.mtimeMs >= source.mtimeMs && executable.mtimeMs >= plist.mtimeMs;
  } catch {
    return false;
  }
}

async function waitForBleHelperLog(logPath: string, timeoutMs: number) {
  const startedAt = Date.now();
  let latestLog = "";
  while (Date.now() - startedAt < timeoutMs) {
    latestLog = await readTextIfExists(logPath);
    if (latestLog.includes("Disconnected after successful write")) return;
    const failure = [
      "Timed out",
      "Connect failed:",
      "Disconnected early",
      "Discover services failed:",
      "Discover characteristics failed:",
      "Write characteristic does not support writes:",
      "Write failed at",
      "Notify enable failed"
    ].find((marker) => latestLog.includes(marker));
    if (failure) throw new Error(`BLE label print failed: ${tailLog(latestLog)}`);
    await delay(500);
  }
  throw new Error(`BLE label print timed out: ${tailLog(latestLog)}`);
}

async function readTextIfExists(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

async function runCommandToFile(command: string, args: string[], outputPath: string, env: Record<string, string> = {}) {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    let childExited = false;
    let outputFinished = false;

    const finish = () => {
      if (childExited && outputFinished) resolve();
    };

    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      childExited = true;
      if (code !== 0) {
        reject(new Error(`${command} failed with exit code ${code}: ${stderr.trim()}`));
        return;
      }
      finish();
    });
    output.on("error", reject);
    output.on("finish", () => {
      outputFinished = true;
      finish();
    });
    child.stdout.pipe(output);
  });
}

function tailLog(log: string) {
  return log.trim().split("\n").slice(-8).join("\n");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBlePrintTimeoutMs(explicitTimeoutMs?: number) {
  if (typeof explicitTimeoutMs === "number" && Number.isFinite(explicitTimeoutMs)) return explicitTimeoutMs;
  const envTimeoutMs = Number(process.env.SUPERPRINT_BLE_PRINT_TIMEOUT_MS);
  return Number.isFinite(envTimeoutMs) && envTimeoutMs > 0 ? envTimeoutMs : defaultBlePrintTimeoutMs;
}
