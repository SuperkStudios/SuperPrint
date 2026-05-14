import http from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const port = Number(process.env.HOST_SLICER_PORT ?? 4317);
const host = process.env.HOST_SLICER_HOST ?? "127.0.0.1";
const homeDir = os.homedir();
const orcaDataDir = path.join(homeDir, "Library/Application Support/OrcaSlicer");
const elegooDataDir = path.join(homeDir, "Library/Application Support/ElegooSlicer");

const centauriEstimatePatch = {
  machine: {
    machine_max_acceleration_x: ["5300", "5300"],
    machine_max_acceleration_y: ["5300", "5300"],
    machine_max_acceleration_extruding: ["5300", "5300"],
    machine_max_acceleration_retracting: ["5300", "5300"]
  },
  process: {
    default_acceleration: "10000",
    outer_wall_acceleration: "10000",
    inner_wall_acceleration: "10000",
    sparse_infill_acceleration: "10000",
    top_surface_acceleration: "10000",
    outer_wall_speed: "160",
    inner_wall_speed: "200",
    sparse_infill_speed: "200",
    internal_solid_infill_speed: "250",
    gap_infill_speed: "250",
    top_surface_speed: "200",
    initial_layer_speed: "50",
    initial_layer_infill_speed: "105",
    sparse_infill_density: "17%"
  }
};

const slicers = [
  {
    name: "OrcaSlicer",
    bin: "/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer",
    datadir: orcaDataDir,
    machine: path.join(orcaDataDir, "system/Elegoo/machine/ECC/Elegoo Centauri Carbon 0.4 nozzle.json"),
    process: path.join(orcaDataDir, "system/Elegoo/process/ECC/0.20mm Standard @Elegoo CC 0.4 nozzle.json"),
    filament: path.join(orcaDataDir, "system/Elegoo/filament/ECC/Elegoo PLA @ECC.json"),
    patch: centauriEstimatePatch
  },
  {
    name: "ElegooSlicer",
    bin: "/Applications/ElegooSlicer.app/Contents/MacOS/ElegooSlicer",
    datadir: elegooDataDir,
    machine: path.join(elegooDataDir, "system/Elegoo/machine/ECC/Elegoo Centauri Carbon 0.4 nozzle.json"),
    process: path.join(elegooDataDir, "system/Elegoo/process/ECC/0.20mm Standard @Elegoo CC 0.4 nozzle.json"),
    filament: path.join(elegooDataDir, "system/Elegoo/filament/ECC/Elegoo PLA @ECC.json"),
    patch: centauriEstimatePatch
  },
  {
    name: "OrcaSlicer",
    bin: "/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer",
    machine: "/Applications/OrcaSlicer.app/Contents/Resources/profiles/Elegoo/machine/ECC/Elegoo Centauri Carbon 0.4 nozzle.json",
    process: "/Applications/OrcaSlicer.app/Contents/Resources/profiles/Elegoo/process/ECC/0.20mm Standard @Elegoo CC 0.4 nozzle.json",
    filament: "/Applications/OrcaSlicer.app/Contents/Resources/profiles/Elegoo/filament/ELEGOO/Elegoo PLA.json"
  }
];

const materialDensities = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  TPU: 1.21,
  NYLON: 1.14,
  RESIN: 1.1
};

const server = http.createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/estimate") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const body = await readJson(request);
    const fileName = safeFileName(String(body.fileName ?? "model.stl"));
    const dataBase64 = String(body.dataBase64 ?? "");
    if (!dataBase64) throw new Error("dataBase64 is required");

    const estimate = await estimateWithSlicer({
      fileName,
      material: String(body.material ?? "PLA"),
      buffer: Buffer.from(dataBase64, "base64")
    });

    sendJson(response, 200, estimate);
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Could not estimate print file" });
  }
});

server.listen(port, host, () => {
  console.log(`Host slicer estimator listening at http://${host}:${port}/estimate`);
});

async function estimateWithSlicer(input) {
  const selected = resolveSlicer();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "superprint-slicer-"));
  try {
    const inputPath = path.join(tmpDir, `${randomUUID()}-${input.fileName}`);
    await writeFile(inputPath, input.buffer);
    const profiles = await materializeProfiles(selected, tmpDir);

    const args = [
      "--slice",
      "0",
      "--outputdir",
      tmpDir,
      "--load-settings",
      `${profiles.machine};${profiles.process}`,
      "--load-filaments",
      profiles.filament,
      inputPath
    ];
    if (selected.datadir) args.unshift("--datadir", selected.datadir);
    await run(selected.bin, args);

    const gcodePath = await findGcode(tmpDir);
    const gcode = await readFile(gcodePath, "utf8");
    const parsed = parseSlicerGcode(gcode, input.material);
    if (!parsed.estimatedPrintMinutes || !parsed.estimatedGrams) {
      throw new Error(`${selected.name} sliced the file but did not report usable estimates`);
    }
    return {
      ...parsed,
      source: "slicer",
      message: `${selected.name} ${path.basename(selected.process)}`
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

function resolveSlicer() {
  const explicit = {
    name: process.env.HOST_SLICER_NAME ?? "ConfiguredSlicer",
    bin: process.env.HOST_SLICER_BIN,
    datadir: process.env.HOST_SLICER_DATADIR,
    machine: process.env.HOST_SLICER_MACHINE_PROFILE,
    process: process.env.HOST_SLICER_PROCESS_PROFILE,
    filament: process.env.HOST_SLICER_FILAMENT_PROFILE
  };
  if (explicit.bin && explicit.machine && explicit.process && explicit.filament) return explicit;

  const found = slicers.find((item) => [item.bin, item.machine, item.process, item.filament].every((file) => existsSync(file)));
  if (!found) {
    throw new Error("No configured ElegooSlicer or OrcaSlicer profile set was found. Set HOST_SLICER_BIN, HOST_SLICER_MACHINE_PROFILE, HOST_SLICER_PROCESS_PROFILE, and HOST_SLICER_FILAMENT_PROFILE.");
  }
  return found;
}

async function materializeProfiles(slicer, tmpDir) {
  if (!slicer.patch) return slicer;
  return {
    ...slicer,
    machine: await patchedProfile(slicer.machine, slicer.patch.machine, path.join(tmpDir, "machine-profile.json")),
    process: await patchedProfile(slicer.process, slicer.patch.process, path.join(tmpDir, "process-profile.json"))
  };
}

async function patchedProfile(source, patch, destination) {
  const profile = JSON.parse(await readFile(source, "utf8"));
  Object.assign(profile, patch);
  await writeFile(destination, JSON.stringify(profile, null, 2));
  return destination;
}

function parseSlicerGcode(text, material) {
  const directGrams =
    numericMatch(text, /;\s*(?:total\s+)?filament used \[g\]\s*[=:]\s*([0-9.]+)/i) ??
    numericMatch(text, /filament used \[g\]:\s*([0-9.]+)/i);
  const volumeCm3 = numericMatch(text, /;\s*filament used \[cm3\]\s*[=:]\s*([0-9.]+)/i);
  const density = materialDensities[String(material).toUpperCase()] ?? materialDensities.PLA;
  const grams = directGrams && directGrams > 0 ? directGrams : volumeCm3 ? volumeCm3 * density : null;
  const timeLine =
    text.match(/;\s*estimated printing time(?:\s*\([^)]+\))?\s*[:=]\s*([^\n\r]+)/i) ??
    text.match(/estimated printing time(?:\s*\([^)]+\))?\s*[:=]\s*([^\n\r]+)/i);

  return {
    estimatedPrintMinutes: timeLine ? parseDurationMinutes(timeLine[1]) : null,
    estimatedGrams: grams == null ? null : Math.max(1, Math.round(grams))
  };
}

function parseDurationMinutes(value) {
  const days = Number(value.match(/(\d+(?:\.\d+)?)\s*d/i)?.[1] ?? 0);
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+(?:\.\d+)?)\s*m/i)?.[1] ?? 0);
  const seconds = Number(value.match(/(\d+(?:\.\d+)?)\s*s/i)?.[1] ?? 0);
  const total = days * 1440 + hours * 60 + minutes + seconds / 60;
  return total > 0 ? Math.max(1, Math.round(total)) : null;
}

function numericMatch(text, regex) {
  const match = text.match(regex);
  return match ? Number(match[1]) : null;
}

async function findGcode(directory) {
  const files = await readdir(directory);
  const gcode = files.find((file) => /\.(gcode|gco|g)$/i.test(file));
  if (!gcode) throw new Error("Slicer did not produce a G-code file");
  return path.join(directory, gcode);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(command)} exited with ${code}: ${stderr.trim()}`));
      }
    });
  });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 80 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function safeFileName(fileName) {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
}
