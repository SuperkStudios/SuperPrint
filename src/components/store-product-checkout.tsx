"use client";

import { useState } from "react";
import { StoreBuyButton } from "@/components/store-buy-button";
import { StlModelViewer } from "@/components/stl-model-viewer";
import { Badge } from "@/components/ui/badge";
import { filamentColorToHex } from "@/lib/filament-colors";
import { money } from "@/lib/utils";

type MaterialOption = {
  id: string;
  material: string;
  color: string;
  brand: string;
  remainingGrams: number;
  requiresAdminApproval: boolean;
  estimatedPrintMinutes: number;
  finalCustomerPriceCents: number;
  unavailableReason: string | null;
  marginWarning: string | null;
};

export function StoreProductCheckout({
  product,
  materials,
  signedIn,
  savedShippingAddress
}: {
  product: {
    id: string;
    slug: string;
    name: string;
    description: string;
    imageUrl: string;
    modelUrl: string | null;
    priceCents: number;
    estimatedPrintMinutes: number;
    estimatedGrams: number;
    defaultMaterial: string;
  };
  materials: MaterialOption[];
  signedIn: boolean;
  savedShippingAddress?: {
    name?: string | null;
    street1?: string | null;
    street2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}) {
  const materialOptions = materials.length ? materials : [{
    id: product.defaultMaterial,
    material: product.defaultMaterial,
    color: product.defaultMaterial,
    brand: "Default",
    remainingGrams: 0,
    requiresAdminApproval: false,
    estimatedPrintMinutes: product.estimatedPrintMinutes,
    finalCustomerPriceCents: product.priceCents,
    unavailableReason: null,
    marginWarning: null
  }];
  const [selectedFilamentId, setSelectedFilamentId] = useState(materialOptions[0].id);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"SHIP" | "PICKUP">("SHIP");
  const shippingAddress = {
    name: savedShippingAddress?.name ?? "",
    street1: savedShippingAddress?.street1 ?? "",
    street2: savedShippingAddress?.street2 ?? "",
    city: savedShippingAddress?.city ?? "",
    state: savedShippingAddress?.state ?? "CO",
    zip: savedShippingAddress?.zip ?? "",
    country: savedShippingAddress?.country ?? "US",
    phone: savedShippingAddress?.phone ?? "",
    email: savedShippingAddress?.email ?? ""
  };
  const savedAddressReady = Boolean(
    savedShippingAddress?.name &&
    savedShippingAddress?.street1 &&
    savedShippingAddress?.city &&
    savedShippingAddress?.state &&
    savedShippingAddress?.zip
  );
  const selectedOption = materialOptions.find((option) => option.id === selectedFilamentId) ?? materialOptions[0];
  const selectedMaterial = selectedOption.material;
  const selectedColor = selectedOption.color;
  const previewColor = filamentColorToHex(selectedColor);
  const fulfillmentAddress = fulfillmentMethod === "PICKUP"
    ? {
        ...shippingAddress,
        street1: shippingAddress.street1 || "Local pickup",
        city: "Fort Collins",
        state: "CO",
        zip: shippingAddress.zip || "80521"
      }
    : shippingAddress;
  const addressReady = fulfillmentMethod === "PICKUP"
    ? Boolean(fulfillmentAddress.name && fulfillmentAddress.city && fulfillmentAddress.state)
    : savedAddressReady;
  const checkoutDisabled = Boolean(selectedOption.unavailableReason || selectedOption.requiresAdminApproval || (signedIn && !addressReady));
  const savedAddressSummary = formatSavedAddress(shippingAddress);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="min-h-[420px] overflow-hidden rounded-lg border bg-muted/20">
        {product.modelUrl ? (
          <StlModelViewer src={product.modelUrl} color={previewColor} className="h-[420px] border-0" />
        ) : (
          <img src={product.imageUrl} alt="" className="h-[420px] w-full object-cover" />
        )}
      </div>
      <section className="grid content-start gap-6">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-primary/10 text-primary">Queue-ready</Badge>
            <Badge className="bg-secondary">Tested product</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-3 text-muted-foreground">{product.description}</p>
        </div>

        <div className="grid gap-3 rounded-md border bg-card p-4 text-card-foreground shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold">{money(selectedOption.finalCustomerPriceCents)}</p>
              <p className="text-sm text-muted-foreground">{selectedOption.estimatedPrintMinutes} min · {product.estimatedGrams}g estimate</p>
            </div>
            <StoreBuyButton
              productId={product.id}
              signedIn={signedIn}
              selectedFilamentMaterialId={selectedFilamentId}
              selectedMaterial={selectedMaterial}
              selectedColor={selectedColor}
              fulfillment={{ method: fulfillmentMethod, address: fulfillmentAddress }}
              loginNext={`/store/${product.slug}`}
              disabled={checkoutDisabled}
            />
          </div>
          {selectedOption.unavailableReason ? <p className="text-sm text-destructive">{selectedOption.unavailableReason}</p> : null}
          {selectedOption.requiresAdminApproval ? <p className="text-sm text-secondary-foreground">This material requires approval before checkout.</p> : null}
          {!signedIn ? <p className="text-sm text-muted-foreground">Create an account or sign in before checkout so we can attach the order to your queue and media.</p> : null}
        </div>

        <div className="grid gap-4 rounded-md border bg-card p-4 text-card-foreground shadow-sm">
          <div>
            <p className="text-sm font-medium">Filament</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {materialOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedFilamentId(option.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm font-medium ${selectedFilamentId === option.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  <span className="block">{option.color} {option.material}</span>
                  <span className="block text-xs opacity-75">{option.brand} · {money(option.finalCustomerPriceCents)}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Selected material</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-5 rounded-full border" style={{ backgroundColor: filamentColorToHex(selectedColor) }} />
              {selectedColor} {selectedMaterial} · {selectedOption.remainingGrams}g in stock
            </p>
          </div>
        </div>

        <div className="grid gap-4 rounded-md border bg-card p-4 text-card-foreground shadow-sm">
          <div>
            <p className="text-sm font-medium">Delivery</p>
            <div className="mt-2 grid grid-cols-2 rounded-md border p-1 text-sm">
              <button
                type="button"
                onClick={() => setFulfillmentMethod("SHIP")}
                className={`rounded px-3 py-2 font-medium ${fulfillmentMethod === "SHIP" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                Ship
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentMethod("PICKUP")}
                className={`rounded px-3 py-2 font-medium ${fulfillmentMethod === "PICKUP" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                Pickup
              </button>
            </div>
          </div>

          {fulfillmentMethod === "SHIP" && savedAddressReady ? (
            <div className="rounded-md border bg-background p-3 text-sm">
              <p className="font-medium">Using saved delivery address</p>
              <p className="mt-1 text-muted-foreground">{savedAddressSummary}</p>
              <a href="/profile" className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">Change in profile</a>
            </div>
          ) : fulfillmentMethod === "SHIP" ? (
            <div className="rounded-md border border-dashed bg-background p-3 text-sm">
              <p className="font-medium">Add a delivery address in your profile before checkout.</p>
              <a href="/profile" className="mt-2 inline-flex text-sm font-medium text-primary hover:underline">Open profile settings</a>
            </div>
          ) : (
            <div className="rounded-md border bg-background p-3 text-sm">
              <p className="font-medium">Free pickup in Fort Collins, CO</p>
              <p className="mt-1 text-muted-foreground">We will use your account name and email for pickup orders.</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {fulfillmentMethod === "PICKUP" ? "Pickup is free for Fort Collins, CO customers." : "Shipping is quoted at checkout with the lowest Shippo rate available."}
          </p>
        </div>
      </section>
    </div>
  );
}

function formatSavedAddress(address: {
  name: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}) {
  const cityLine = [
    address.city,
    [address.state, address.zip].filter(Boolean).join(" ")
  ].filter(Boolean).join(", ");
  return [
    address.name,
    address.street1,
    address.street2,
    cityLine,
    address.phone
  ].filter(Boolean).join(" · ");
}
