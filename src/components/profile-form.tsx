"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({ user }: { user: {
  name: string;
  email?: string | null;
  image?: string | null;
  username?: string | null;
  bio?: string | null;
  shippingName?: string | null;
  shippingStreet1?: string | null;
  shippingStreet2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZip?: string | null;
  shippingCountry?: string | null;
  shippingPhone?: string | null;
} }) {
  const [message, setMessage] = useState("");
  const [shippingAddress, setShippingAddress] = useState({
    shippingName: user.shippingName ?? user.name,
    shippingPhone: user.shippingPhone ?? "",
    shippingStreet1: user.shippingStreet1 ?? "",
    shippingStreet2: user.shippingStreet2 ?? "",
    shippingCity: user.shippingCity ?? "",
    shippingState: user.shippingState ?? "CO",
    shippingZip: user.shippingZip ?? "",
    shippingCountry: user.shippingCountry ?? "US"
  });
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);

  useEffect(() => {
    const query = shippingAddress.shippingStreet1.trim();
    if (query.length < 5) {
      setAddressSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: { accept: "application/json" }
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!Array.isArray(data)) return;
        setAddressSuggestions(data.map(readAddressSuggestion).filter(Boolean).slice(0, 5) as AddressSuggestion[]);
      } catch {
        if (!controller.signal.aborted) setAddressSuggestions([]);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [shippingAddress.shippingStreet1]);

  function updateShippingAddress(field: keyof typeof shippingAddress, value: string) {
    const selectedSuggestion = field === "shippingStreet1"
      ? addressSuggestions.find((suggestion) => suggestion.label === value || suggestion.street1 === value)
      : null;

    if (selectedSuggestion) {
      setShippingAddress((current) => ({
        ...current,
        shippingStreet1: selectedSuggestion.street1,
        shippingCity: selectedSuggestion.city || current.shippingCity,
        shippingState: selectedSuggestion.state || current.shippingState,
        shippingZip: selectedSuggestion.zip || current.shippingZip
      }));
      return;
    }
    setShippingAddress((current) => ({ ...current, [field]: value }));
  }

  async function submit(formData: FormData) {
    setMessage("");
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        image: String(formData.get("image") ?? ""),
        username: String(formData.get("username") ?? ""),
        bio: String(formData.get("bio") ?? ""),
        ...shippingAddress
      })
    });
    setMessage(response.ok ? "Profile updated." : (await response.json().catch(() => null))?.error ?? "Profile update failed.");
  }

  return (
    <form action={submit} className="space-y-4 rounded border bg-card p-5 text-card-foreground shadow-sm">
      <div className="grid gap-2">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" name="name" defaultValue={user.name} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" defaultValue={user.username ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="image">Profile image URL</Label>
        <Input id="image" name="image" defaultValue={user.image ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bio">Bio</Label>
        <textarea id="bio" name="bio" defaultValue={user.bio ?? ""} className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <h3 className="font-semibold">Saved shipping address</h3>
          <p className="mt-1 text-sm text-muted-foreground">Used for product checkout and Shippo labels. Start typing the street to pick an address.</p>
        </div>
        <AddressInput label="Name" name="shippingName" value={shippingAddress.shippingName} autoComplete="shipping name" onChange={(value) => updateShippingAddress("shippingName", value)} />
        <AddressInput label="Phone" name="shippingPhone" value={shippingAddress.shippingPhone} autoComplete="shipping tel" onChange={(value) => updateShippingAddress("shippingPhone", value)} />
        <AddressInput label="Street" name="shippingStreet1" value={shippingAddress.shippingStreet1} autoComplete="shipping address-line1" list="profile-address-suggestions" onChange={(value) => updateShippingAddress("shippingStreet1", value)} />
        <datalist id="profile-address-suggestions">
          {addressSuggestions.map((suggestion) => (
            <option key={`${suggestion.street1}-${suggestion.zip}`} value={suggestion.label} />
          ))}
        </datalist>
        <AddressInput label="Apt / suite" name="shippingStreet2" value={shippingAddress.shippingStreet2} autoComplete="shipping address-line2" onChange={(value) => updateShippingAddress("shippingStreet2", value)} />
        <AddressInput label="City" name="shippingCity" value={shippingAddress.shippingCity} autoComplete="shipping address-level2" onChange={(value) => updateShippingAddress("shippingCity", value)} />
        <AddressInput label="State" name="shippingState" value={shippingAddress.shippingState} autoComplete="shipping address-level1" onChange={(value) => updateShippingAddress("shippingState", value)} />
        <AddressInput label="ZIP" name="shippingZip" value={shippingAddress.shippingZip} autoComplete="shipping postal-code" onChange={(value) => updateShippingAddress("shippingZip", value)} />
        <AddressInput label="Country" name="shippingCountry" value={shippingAddress.shippingCountry} autoComplete="shipping country" onChange={(value) => updateShippingAddress("shippingCountry", value)} />
      </div>
      <Button type="submit">Save profile</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

function AddressInput({
  label,
  name,
  value,
  autoComplete,
  list,
  onChange
}: {
  label: string;
  name: string;
  value: string;
  autoComplete?: string;
  list?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} value={value} autoComplete={autoComplete} list={list} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

type AddressSuggestion = {
  label: string;
  street1: string;
  city: string;
  state: string;
  zip: string;
};

function readAddressSuggestion(item: unknown): AddressSuggestion | null {
  if (!item || typeof item !== "object") return null;
  const result = item as { display_name?: string; address?: Record<string, string | undefined> };
  const address = result.address ?? {};
  const streetName = address.road ?? address.pedestrian ?? address.footway ?? address.cycleway;
  const street1 = [address.house_number, streetName].filter(Boolean).join(" ").trim();
  const city = address.city ?? address.town ?? address.village ?? address.hamlet ?? "";
  const state = address.state_code ?? stateNameToCode(address.state ?? "");
  const zip = address.postcode ?? "";
  if (!street1 || !city || !state || !zip) return null;
  return {
    label: result.display_name ?? `${street1}, ${city}, ${state} ${zip}`,
    street1,
    city,
    state,
    zip
  };
}

function stateNameToCode(value: string) {
  const states: Record<string, string> = {
    "Alabama": "AL",
    "Alaska": "AK",
    "Arizona": "AZ",
    "Arkansas": "AR",
    "California": "CA",
    "Colorado": "CO",
    "Connecticut": "CT",
    "Delaware": "DE",
    "District of Columbia": "DC",
    "Florida": "FL",
    "Georgia": "GA",
    "Hawaii": "HI",
    "Idaho": "ID",
    "Illinois": "IL",
    "Indiana": "IN",
    "Iowa": "IA",
    "Kansas": "KS",
    "Kentucky": "KY",
    "Louisiana": "LA",
    "Maine": "ME",
    "Maryland": "MD",
    "Massachusetts": "MA",
    "Michigan": "MI",
    "Minnesota": "MN",
    "Mississippi": "MS",
    "Missouri": "MO",
    "Montana": "MT",
    "Nebraska": "NE",
    "Nevada": "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    "Ohio": "OH",
    "Oklahoma": "OK",
    "Oregon": "OR",
    "Pennsylvania": "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    "Tennessee": "TN",
    "Texas": "TX",
    "Utah": "UT",
    "Vermont": "VT",
    "Virginia": "VA",
    "Washington": "WA",
    "West Virginia": "WV",
    "Wisconsin": "WI",
    "Wyoming": "WY"
  };
  return states[value] ?? value.toUpperCase();
}
