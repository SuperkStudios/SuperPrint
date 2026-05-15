export type MaintenancePlanInput = {
  printerId: string;
  now?: Date;
  totalRuntimeMinutes: number;
  failedPrintCount: number;
  existingOpenTaskTitles?: string[];
};

export type PlannedMaintenanceTask = {
  printerId: string;
  title: string;
  description: string;
  dueAt: Date;
};

const maintenanceTemplates = [
  {
    title: "Clean build plate and verify camera view",
    everyRuntimeMinutes: 24 * 60,
    description: "Clean the build plate, remove purge/waste material, and confirm the camera can see the full bed before unattended printing."
  },
  {
    title: "Inspect nozzle, hotend, belts, fans, and filament path",
    everyRuntimeMinutes: 60 * 60,
    description: "Inspect nozzle buildup, hotend sock, belt tension, cooling fans, filament path, spool drag, and first-layer reliability."
  },
  {
    title: "Clean and lubricate approved motion components",
    everyRuntimeMinutes: 120 * 60,
    description: "Clean rods/rails and apply manufacturer-approved grease only to approved motion components such as lead screws or rails specified by the printer manual."
  }
];

export function planMaintenanceTasks(input: MaintenancePlanInput): PlannedMaintenanceTask[] {
  const now = input.now ?? new Date();
  const existingTitles = new Set(input.existingOpenTaskTitles ?? []);
  const tasks = maintenanceTemplates
    .filter((template) => input.totalRuntimeMinutes >= template.everyRuntimeMinutes)
    .filter((template) => !existingTitles.has(template.title))
    .map((template) => ({
      printerId: input.printerId,
      title: template.title,
      description: template.description,
      dueAt: now
    }));

  if (input.failedPrintCount > 0 && !existingTitles.has("Failure recovery inspection")) {
    tasks.push({
      printerId: input.printerId,
      title: "Failure recovery inspection",
      description: "After spaghetti or failed printing, clear the bed, inspect the nozzle and hotend, verify belts and bed surface, clean debris, and run calibration before queue resume.",
      dueAt: now
    });
  }

  return tasks;
}

export function recommendedMaintenanceChecklist() {
  return [
    "Clear bed and remove all loose plastic",
    "Clean build plate with approved cleaner",
    "Inspect nozzle and hotend for blobs or leaks",
    "Check belts, pulleys, fans, and filament path",
    "Clean rods/rails and lubricate only manufacturer-approved parts",
    "Verify camera view and lighting",
    "Run bed mesh or calibration if the failure touched the bed",
    "Confirm the correct filament is loaded before resuming queue"
  ];
}
