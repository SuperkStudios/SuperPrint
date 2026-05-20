"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/utils";

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeLike;
  }
}

type StripeLike = {
  elements: (options: { clientSecret: string; appearance?: Record<string, unknown>; loader?: "auto" }) => StripeElementsLike;
  confirmPayment: (options: {
    elements: StripeElementsLike;
    confirmParams: { return_url: string };
  }) => Promise<{ error?: { message?: string } }>;
};

type StripeElementsLike = {
  create: (type: "payment" | "linkAuthentication", options?: Record<string, unknown>) => { mount: (selector: string) => void; destroy?: () => void };
};

type CheckoutSummary = {
  items: Array<{ id: string; name: string; quantity: number; selectedColor?: string | null; selectedMaterial?: string | null; subtotalCents: number }>;
  subtotalCents: number;
  rewardDiscountCents: number;
  taxCents: number;
  shippingCents: number;
  paymentFeeCents: number;
  totalCents: number;
};

type StripeThemeMode = "light" | "dark";

type Address = {
  name: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
};

export function CheckoutForm({
  initialSummary,
  savedAddress,
  customerEmail
}: {
  initialSummary: CheckoutSummary;
  savedAddress: Partial<Address>;
  customerEmail: string;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [summariesByFulfillment, setSummariesByFulfillment] = useState<Record<"SHIP" | "PICKUP", CheckoutSummary | null>>({
    SHIP: null,
    PICKUP: initialSummary
  });
  const [address, setAddress] = useState<Address>({
    name: savedAddress.name ?? "",
    street1: savedAddress.street1 ?? "",
    street2: savedAddress.street2 ?? "",
    city: savedAddress.city ?? "",
    state: savedAddress.state ?? "CO",
    zip: savedAddress.zip ?? "",
    country: savedAddress.country ?? "US",
    phone: savedAddress.phone ?? "",
    email: savedAddress.email ?? customerEmail
  });
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"SHIP" | "PICKUP">("SHIP");
  const [savePaymentMethod, setSavePaymentMethod] = useState(true);
  const [clientSecret, setClientSecret] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [stripe, setStripe] = useState<StripeLike | null>(null);
  const [elements, setElements] = useState<StripeElementsLike | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [stripeThemeMode, setStripeThemeMode] = useState<StripeThemeMode>("light");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const addressReady = fulfillmentMethod === "PICKUP"
    ? Boolean(address.name)
    : Boolean(address.name && address.street1 && address.city && address.state && address.zip && address.country);

  function resetPreparedPayment() {
    setClientSecret("");
    setPublishableKey("");
    setStripe(null);
    setElements(null);
    setMessage("");
  }

  function selectFulfillmentMethod(method: "SHIP" | "PICKUP") {
    setFulfillmentMethod(method);
    setSummary(summariesByFulfillment[method] ?? initialSummary);
    resetPreparedPayment();
  }

  function updateAddressField(field: keyof Address, value: string) {
    setAddress((current) => ({ ...current, [field]: value }));
    if (fulfillmentMethod === "SHIP") {
      setSummariesByFulfillment((current) => ({ ...current, SHIP: null }));
      setSummary(initialSummary);
    }
    if (clientSecret) resetPreparedPayment();
  }
  useEffect(() => {
    if (window.Stripe) {
      setStripeReady(true);
      return;
    }
    const existing = document.querySelector("script[data-stripe-js]");
    if (existing) {
      existing.addEventListener("load", () => setStripeReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.dataset.stripeJs = "true";
    script.addEventListener("load", () => setStripeReady(true), { once: true });
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const updateThemeMode = () => {
      setStripeThemeMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };
    updateThemeMode();
    const observer = new MutationObserver(updateThemeMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", updateThemeMode);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", updateThemeMode);
    };
  }, []);

  useEffect(() => {
    if (!clientSecret || !publishableKey || !stripeReady || !window.Stripe) return;
    const stripeInstance = window.Stripe(publishableKey);
    const elementsInstance = stripeInstance.elements({
      clientSecret,
      loader: "auto",
      appearance: buildStripeAppearance(stripeThemeMode)
    });
    const link = elementsInstance.create("linkAuthentication", { defaultValues: { email: address.email } });
    const payment = elementsInstance.create("payment", {
      layout: { type: "accordion", defaultCollapsed: false },
      defaultValues: {
        billingDetails: {
          name: address.name,
          phone: address.phone,
          email: address.email,
          address: {
            line1: address.street1,
            line2: address.street2,
            city: address.city,
            state: address.state,
            postal_code: address.zip,
            country: address.country
          }
        }
      }
    });
    link.mount("#link-authentication-element");
    payment.mount("#payment-element");
    setStripe(stripeInstance);
    setElements(elementsInstance);
    return () => {
      link.destroy?.();
      payment.destroy?.();
    };
  }, [address.city, address.country, address.email, address.name, address.phone, address.state, address.street1, address.street2, address.zip, clientSecret, publishableKey, stripeReady, stripeThemeMode]);

  async function startPayment() {
    setLoading(true);
    setMessage("");
    const fulfillmentAddress = fulfillmentMethod === "PICKUP"
      ? { ...address, street1: address.street1 || "Local pickup", city: "Fort Collins", state: "CO", zip: address.zip || "80521" }
      : address;
    const response = await fetch("/api/checkout/payment-intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        savePaymentMethod,
        fulfillment: { method: fulfillmentMethod, address: fulfillmentAddress }
      })
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Could not start payment.");
      return;
    }
    setSummary(body.summary);
    setSummariesByFulfillment((current) => ({ ...current, [fulfillmentMethod]: body.summary }));
    setClientSecret(body.clientSecret);
    setPublishableKey(body.publishableKey);
  }

  async function pay() {
    if (!stripe || !elements) return;
    setLoading(true);
    setMessage("");
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders?checkout=success` }
    });
    setLoading(false);
    if (result.error) setMessage(result.error.message ?? "Payment could not be completed.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <section className="grid gap-4">
        <div className="rounded-md border bg-card p-4 text-card-foreground">
          <p className="font-semibold">Delivery</p>
          <div className="mt-3 grid grid-cols-2 rounded-md border p-1 text-sm">
            <button type="button" onClick={() => selectFulfillmentMethod("SHIP")} className={`rounded px-3 py-2 font-medium ${fulfillmentMethod === "SHIP" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Ship</button>
            <button type="button" onClick={() => selectFulfillmentMethod("PICKUP")} className={`rounded px-3 py-2 font-medium ${fulfillmentMethod === "PICKUP" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>Pickup</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={address.name} onChange={(value) => updateAddressField("name", value)} />
            {fulfillmentMethod === "SHIP" ? (
              <>
                <Field label="Street" value={address.street1} onChange={(value) => updateAddressField("street1", value)} />
                <Field label="Apt / suite" value={address.street2} onChange={(value) => updateAddressField("street2", value)} />
                <Field label="City" value={address.city} onChange={(value) => updateAddressField("city", value)} />
                <Field label="State" value={address.state} onChange={(value) => updateAddressField("state", value)} />
                <Field label="ZIP" value={address.zip} onChange={(value) => updateAddressField("zip", value)} />
                <Field label="Phone" value={address.phone} onChange={(value) => updateAddressField("phone", value)} />
              </>
            ) : null}
          </div>
          {!clientSecret ? (
            <Button className="mt-4" disabled={!addressReady || loading} onClick={startPayment}>
              <CreditCard className="size-4" />
              {loading ? "Preparing..." : "Continue to payment"}
            </Button>
          ) : null}
        </div>

        {clientSecret ? (
          <div className="rounded-md border bg-card p-4 text-card-foreground">
            <p className="font-semibold">Payment</p>
            <div id="link-authentication-element" className="mt-4" />
            <div id="payment-element" className="mt-4" />
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={savePaymentMethod} onChange={(event) => setSavePaymentMethod(event.target.checked)} />
              Save this payment method to my account
            </label>
            <Button className="mt-4" disabled={loading || !stripe || !elements} onClick={pay}>
              {loading ? "Processing..." : "Pay now"}
            </Button>
          </div>
        ) : null}
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </section>
      <aside className="h-fit rounded-md border bg-card p-4 text-card-foreground">
        <p className="font-semibold">Order summary</p>
        <div className="mt-3 grid gap-3 border-b pb-3">
          {summary.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
              <div>
                <p className="font-medium">{item.quantity} x {item.name}</p>
                <p className="text-muted-foreground">{item.selectedColor} {item.selectedMaterial}</p>
              </div>
              <span>{money(item.subtotalCents)}</span>
            </div>
          ))}
        </div>
        <SummaryLine label="Subtotal" value={summary.subtotalCents} />
        {summary.rewardDiscountCents ? <SummaryLine label="Rewards" value={-summary.rewardDiscountCents} /> : null}
        <SummaryLine label="Taxes" value={summary.taxCents} />
        <SummaryLine label="Shipping" value={summary.shippingCents} />
        <SummaryLine label="Payment processor fee" value={summary.paymentFeeCents} />
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-lg font-semibold">
          <span>Total</span>
          <span>{money(summary.totalCents)}</span>
        </div>
        <Button asChild variant="outline" className="mt-4 w-full"><Link href="/cart">Back to cart</Link></Button>
      </aside>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value < 0 ? `-${money(Math.abs(value))}` : money(value)}</span>
    </div>
  );
}

function buildStripeAppearance(mode: StripeThemeMode) {
  const styles = getComputedStyle(document.documentElement);
  const color = (name: string) => hslCssVarToColor(styles.getPropertyValue(name));
  const dark = mode === "dark";
  return {
    theme: dark ? "night" : "stripe",
    variables: {
      colorPrimary: color("--primary"),
      colorBackground: color("--card"),
      colorText: color("--card-foreground"),
      colorTextSecondary: color("--muted-foreground"),
      colorTextPlaceholder: color("--muted-foreground"),
      colorDanger: color("--destructive"),
      colorIcon: color("--muted-foreground"),
      colorLine: color("--border"),
      colorSuccess: color("--primary"),
      borderRadius: "8px",
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      spacingUnit: "4px"
    },
    rules: {
      ".Input": {
        backgroundColor: color("--background"),
        borderColor: color("--input"),
        color: color("--foreground")
      },
      ".Input:focus": {
        borderColor: color("--ring"),
        boxShadow: `0 0 0 1px ${color("--ring")}`
      },
      ".Tab": {
        backgroundColor: color("--background"),
        borderColor: color("--border"),
        color: color("--foreground")
      },
      ".Tab--selected": {
        borderColor: color("--primary"),
        boxShadow: `0 0 0 1px ${color("--primary")}`
      },
      ".Label": {
        color: color("--foreground")
      }
    }
  };
}

function hslCssVarToColor(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "#000000";
  if (trimmed.startsWith("#") || trimmed.startsWith("rgb") || trimmed.startsWith("hsl")) return trimmed;
  return `hsl(${trimmed})`;
}
