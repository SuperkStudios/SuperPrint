import { z } from "zod";

export const filamentMaterials = ["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"] as const;
const filamentMaterialSet = new Set<string>(filamentMaterials);

export const printerProfileSchema = z.object({
  name: z.string().trim().min(1),
  publicName: z.string().trim().min(1),
  modelName: z.string().trim().min(1).default("Elegoo Centauri Carbon"),
  nozzleSizeMm: z.coerce.number().positive().max(2),
  buildVolumeXmm: z.coerce.number().int().positive().max(1000),
  buildVolumeYmm: z.coerce.number().int().positive().max(1000),
  buildVolumeZmm: z.coerce.number().int().positive().max(1000),
  supportedMaterials: z
    .array(z.string())
    .min(1)
    .superRefine((materials, context) => {
      for (const [index, material] of materials.entries()) {
        if (!filamentMaterialSet.has(material)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index],
            message: `Unsupported material: ${material}`
          });
        }
      }
    })
    .transform((materials) => [...new Set(materials)] as Array<(typeof filamentMaterials)[number]>),
  currentFilamentId: z.string().trim().min(1).optional().nullable(),
  cameraSource: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => value || null)
    .refine((value) => !value || /^(https?:|rtsp:|rtsps:)/.test(value), "Camera source must be HTTP(S) or RTSP(S)"),
  maintenanceProfile: z.string().trim().min(1),
  internalIp: z.string().trim().min(1),
  controlApiUrl: z
    .string()
    .trim()
    .min(1)
    .refine((value) => /^(https?|wss?):\/\//.test(value), "Control API URL must be HTTP(S) or WS(S)"),
  healthDescription: z.string().trim().default("Waiting for first SuperNode heartbeat"),
  status: z.enum(["HEALTHY", "WARNING", "OFFLINE", "MAINTENANCE"]).default("OFFLINE"),
  heartbeatStatus: z.enum(["UNKNOWN", "ONLINE", "STALE", "OFFLINE"]).default("UNKNOWN"),
  totalRuntimeMinutes: z.coerce.number().int().min(0).default(0),
  completedPrintCount: z.coerce.number().int().min(0).default(0),
  failedPrintCount: z.coerce.number().int().min(0).default(0)
});

export type PrinterProfileInput = z.input<typeof printerProfileSchema>;
export type PrinterProfile = z.output<typeof printerProfileSchema>;

export function validatePrinterProfile(input: PrinterProfileInput): PrinterProfile {
  const parsed = printerProfileSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Printer profile is invalid: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return parsed.data;
}

export function encodeSupportedMaterials(materials: string[]) {
  return [...new Set(materials.filter((material) => filamentMaterials.includes(material as (typeof filamentMaterials)[number])))];
}
