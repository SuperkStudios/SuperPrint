export type ShippingPackagePreset = {
  id: string;
  name: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightOz: number;
  packagingCents: number;
};

export const shippingPackagePresets: ShippingPackagePreset[] = [
  { id: "polymailer_4x8", name: "4 x 8 poly mailer", lengthIn: 8, widthIn: 4, heightIn: 1, weightOz: 4, packagingCents: 75 },
  { id: "mailer_6x10", name: "6 x 10 mailer", lengthIn: 10, widthIn: 6, heightIn: 1, weightOz: 5, packagingCents: 95 },
  { id: "small_box", name: "Small box", lengthIn: 8, widthIn: 6, heightIn: 4, weightOz: 8, packagingCents: 150 },
  { id: "medium_box", name: "Medium box", lengthIn: 10, widthIn: 8, heightIn: 6, weightOz: 12, packagingCents: 225 },
  { id: "large_box", name: "Large box", lengthIn: 14, widthIn: 10, heightIn: 8, weightOz: 18, packagingCents: 350 }
];

export function shippingPackagePresetById(id?: string | null) {
  return shippingPackagePresets.find((preset) => preset.id === id) ?? shippingPackagePresets[0];
}
