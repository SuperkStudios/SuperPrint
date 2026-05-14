import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const materialProcessSettings = {
  PLA: {
    filament_type: ["PLA"],
    filament_density: ["1.24"],
    sparse_infill_density: "17%",
    outer_wall_speed: "160",
    inner_wall_speed: "200",
    sparse_infill_speed: "200",
    internal_solid_infill_speed: "250",
    top_surface_speed: "200",
    initial_layer_speed: "50",
    initial_layer_infill_speed: "105"
  },
  PETG: {
    filament_type: ["PETG"],
    filament_density: ["1.27"],
    sparse_infill_density: "20%",
    outer_wall_speed: "110",
    inner_wall_speed: "140",
    sparse_infill_speed: "140",
    internal_solid_infill_speed: "150",
    top_surface_speed: "90",
    initial_layer_speed: "35",
    initial_layer_infill_speed: "55"
  },
  ABS: {
    filament_type: ["ABS"],
    filament_density: ["1.04"],
    sparse_infill_density: "18%",
    outer_wall_speed: "135",
    inner_wall_speed: "170",
    sparse_infill_speed: "170",
    internal_solid_infill_speed: "190",
    top_surface_speed: "120",
    initial_layer_speed: "40",
    initial_layer_infill_speed: "70"
  },
  TPU: {
    filament_type: ["TPU"],
    filament_density: ["1.21"],
    sparse_infill_density: "18%",
    outer_wall_speed: "55",
    inner_wall_speed: "65",
    sparse_infill_speed: "65",
    internal_solid_infill_speed: "70",
    top_surface_speed: "45",
    initial_layer_speed: "25",
    initial_layer_infill_speed: "30"
  },
  NYLON: {
    filament_type: ["PA"],
    filament_density: ["1.14"],
    sparse_infill_density: "18%",
    outer_wall_speed: "95",
    inner_wall_speed: "120",
    sparse_infill_speed: "120",
    internal_solid_infill_speed: "135",
    top_surface_speed: "85",
    initial_layer_speed: "35",
    initial_layer_infill_speed: "50"
  },
  RESIN: {
    filament_type: ["RESIN"],
    filament_density: ["1.10"],
    sparse_infill_density: "100%",
    outer_wall_speed: "40",
    inner_wall_speed: "40",
    sparse_infill_speed: "40",
    internal_solid_infill_speed: "40",
    top_surface_speed: "35",
    initial_layer_speed: "20",
    initial_layer_infill_speed: "20"
  }
};

export async function materializeSlicerProfileSet({ slicer, material, tmpDir }) {
  const normalizedMaterial = normalizeMaterial(material);
  const patch = {
    machine: slicer.patch?.machine ?? {},
    process: {
      ...(slicer.patch?.process ?? {}),
      ...materialProcessSettings[normalizedMaterial]
    }
  };

  return {
    ...slicer,
    machine: Object.keys(patch.machine).length
      ? await patchedProfile(slicer.machine, patch.machine, path.join(tmpDir, "machine-profile.json"))
      : slicer.machine,
    process: Object.keys(patch.process).length
      ? await patchedProfile(slicer.process, patch.process, path.join(tmpDir, "process-profile.json"))
      : slicer.process,
    filament: await resolveFilamentProfile(slicer, normalizedMaterial)
  };
}

export async function resolveFilamentProfile(slicer, material, exists = existsSync) {
  const normalizedMaterial = normalizeMaterial(material);
  const explicit = process.env[`HOST_SLICER_FILAMENT_PROFILE_${normalizedMaterial}`];
  if (explicit && exists(explicit)) return explicit;

  const configured = slicer.filaments?.[normalizedMaterial];
  if (configured && exists(configured)) return configured;

  const directories = [
    ...(slicer.filamentDirectories ?? []),
    slicer.filament ? path.dirname(slicer.filament) : null
  ].filter(Boolean);

  for (const directory of directories) {
    const discovered = await findMaterialProfile(directory, normalizedMaterial, exists);
    if (discovered) return discovered;
  }

  return slicer.filament;
}

function normalizeMaterial(material = "PLA") {
  const normalized = String(material).trim().toUpperCase();
  return materialProcessSettings[normalized] ? normalized : "PLA";
}

async function findMaterialProfile(directory, material, exists) {
  if (!exists(directory)) return null;
  const entries = await readdir(directory).catch(() => []);
  const normalizedMaterial = material.toLowerCase();
  const exact = entries.find((entry) => {
    const lower = entry.toLowerCase();
    return lower.endsWith(".json") && lower.includes(normalizedMaterial) && !lower.includes("generic");
  });
  const generic = entries.find((entry) => {
    const lower = entry.toLowerCase();
    return lower.endsWith(".json") && lower.includes(normalizedMaterial);
  });
  return exact || generic ? path.join(directory, exact ?? generic) : null;
}

async function patchedProfile(source, patch, destination) {
  const profile = JSON.parse(await readFile(source, "utf8"));
  Object.assign(profile, patch);
  await writeFile(destination, JSON.stringify(profile, null, 2));
  return destination;
}
