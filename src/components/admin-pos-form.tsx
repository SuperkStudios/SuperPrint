"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, DollarSign, Plus, RadioTower, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/utils";

type ProductOption = {
  id: string;
  name: string;
  priceCents: number;
  colorSlotCount: number;
  allowedFilaments: Array<{ filamentMaterialId: string; filamentMaterial: { color: string; material: string } }>;
};

type LineDraft = {
  productId: string;
  quantity: number;
  printedQuantity: number;
  unitPrice: string;
  selectedFilamentMaterialIds: string[];
};

declare global {
  interface Window {
    StripeTerminal?: {
      create: (options: {
        onFetchConnectionToken: () => Promise<string>;
        onUnexpectedReaderDisconnect?: () => void;
      }) => TerminalLike;
    };
  }
}

type TerminalReader = {
  id: string;
  label?: string;
  serial_number?: string;
  device_type?: string;
  status?: string;
};

type TerminalPaymentIntent = {
  id: string;
  status?: string;
};

type TerminalLike = {
  discoverReaders: (options?: { simulated?: boolean }) => Promise<{ error?: { message?: string }; discoveredReaders?: TerminalReader[] }>;
  connectReader: (reader: TerminalReader) => Promise<{ error?: { message?: string }; reader?: TerminalReader }>;
  collectPaymentMethod: (clientSecret: string, options?: Record<string, unknown>) => Promise<{ error?: { message?: string }; paymentIntent?: TerminalPaymentIntent }>;
  processPayment: (paymentIntent: TerminalPaymentIntent) => Promise<{ error?: { message?: string }; paymentIntent?: TerminalPaymentIntent }>;
  getConnectionStatus: () => string;
};

export function AdminPosForm({ products }: { products: ProductOption[] }) {
  const firstProduct = products[0];
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [source, setSource] = useState<"IN_PERSON" | "PAST_IMPORT">("IN_PERSON");
  const [queueNow, setQueueNow] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>(() => firstProduct ? [newLine(firstProduct)] : []);
  const [loading, setLoading] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const [terminal, setTerminal] = useState<TerminalLike | null>(null);
  const [readers, setReaders] = useState<TerminalReader[]>([]);
  const [connectedReader, setConnectedReader] = useState<TerminalReader | null>(null);
  const [terminalMessage, setTerminalMessage] = useState("");
  const [useSimulatedReader, setUseSimulatedReader] = useState(false);
  const [saveTerminalCard, setSaveTerminalCard] = useState(true);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);

  const totalCents = useMemo(() => lines.reduce((total, line) => total + dollarsToCents(line.unitPrice) * Math.max(1, line.quantity), 0), [lines]);
  const amountPaidCents = dollarsToCents(amountPaid);
  const balanceCents = Math.max(0, totalCents - amountPaidCents);

  useEffect(() => {
    setIsMobileBrowser(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    if (window.StripeTerminal) {
      setTerminalReady(true);
      return;
    }
    const existing = document.querySelector("script[data-stripe-terminal-js]");
    if (existing) {
      existing.addEventListener("load", () => setTerminalReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/terminal/v1/";
    script.async = true;
    script.dataset.stripeTerminalJs = "true";
    script.addEventListener("load", () => setTerminalReady(true), { once: true });
    document.head.appendChild(script);
  }, []);

  function productFor(line: LineDraft) {
    return products.find((product) => product.id === line.productId) ?? firstProduct;
  }

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const next = { ...line, ...patch };
      const product = products.find((item) => item.id === next.productId);
      if (patch.productId && product) return newLine(product, next.quantity);
      return next;
    }));
  }

  function getTerminal() {
    if (terminal) return terminal;
    if (!window.StripeTerminal) throw new Error("Stripe Terminal SDK has not loaded yet.");
    const instance = window.StripeTerminal.create({
      onFetchConnectionToken: async () => {
        const response = await fetch("/api/admin/pos/terminal/connection-token", { method: "POST" });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.secret) throw new Error(body?.error ?? "Could not fetch Terminal connection token.");
        return body.secret;
      },
      onUnexpectedReaderDisconnect: () => {
        setConnectedReader(null);
        setTerminalMessage("Reader disconnected.");
      }
    });
    setTerminal(instance);
    return instance;
  }

  function buildOrderPayload() {
    return {
      customerName,
      customerEmail,
      paymentMethod,
      paymentReference,
      cardBrand,
      cardLast4,
      internalNotes,
      orderDate: orderDate || null,
      source,
      queueNow,
      lines: lines.map((line) => {
        const product = productFor(line);
        const selectedColors = line.selectedFilamentMaterialIds.map((id) => product?.allowedFilaments.find((item) => item.filamentMaterialId === id)?.filamentMaterial.color ?? "");
        return {
          productId: line.productId,
          quantity: Math.max(1, line.quantity),
          printedQuantity: source === "PAST_IMPORT" ? 0 : Math.min(Math.max(1, line.quantity), Math.max(0, line.printedQuantity)),
          unitPriceCents: dollarsToCents(line.unitPrice),
          selectedFilamentMaterialIds: line.selectedFilamentMaterialIds,
          selectedColors
        };
      })
    };
  }

  function resetOrderForm() {
    setCustomerName("");
    setCustomerEmail("");
    setAmountPaid("");
    setPaymentReference("");
    setCardBrand("");
    setCardLast4("");
    setInternalNotes("");
    setOrderDate("");
    setLines(firstProduct ? [newLine(firstProduct)] : []);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("Saving order...");
    const response = await fetch("/api/admin/pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...buildOrderPayload(), amountPaidCents, depositCents: amountPaidCents })
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Order save failed.");
      return;
    }
    setMessage(`Saved ${body.order.orderNumber}.`);
    resetOrderForm();
  }

  async function discoverReaders() {
    setTerminalMessage("Looking for readers...");
    try {
      const instance = getTerminal();
      const result = await instance.discoverReaders({ simulated: useSimulatedReader });
      if (result.error) {
        setTerminalMessage(result.error.message ?? "Could not discover readers.");
        return;
      }
      setReaders(result.discoveredReaders ?? []);
      setTerminalMessage(result.discoveredReaders?.length ? "Select a reader." : "No readers found.");
    } catch (error) {
      setTerminalMessage(error instanceof Error ? error.message : "Could not discover readers.");
    }
  }

  async function connectReader(reader: TerminalReader) {
    setTerminalMessage("Connecting reader...");
    const instance = getTerminal();
    const result = await instance.connectReader(reader);
    if (result.error) {
      setTerminalMessage(result.error.message ?? "Could not connect reader.");
      return;
    }
    setConnectedReader(result.reader ?? reader);
    setTerminalMessage(`Connected to ${readerName(result.reader ?? reader)}.`);
  }

  async function chargeTerminal() {
    setMessage("");
    setTerminalMessage("Creating order and sending amount to reader...");
    setLoading(true);
    try {
      const instance = getTerminal();
      if (instance.getConnectionStatus() !== "connected" || !connectedReader) {
        throw new Error("Connect a Stripe Terminal reader first.");
      }
      const response = await fetch("/api/admin/pos/terminal/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildOrderPayload(), savePaymentMethod: saveTerminalCard })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not start Terminal payment.");
      setTerminalMessage("Waiting for customer card on reader...");
      const collected = await instance.collectPaymentMethod(body.clientSecret, {
        config_override: { enable_customer_cancellation: true }
      });
      if (collected.error || !collected.paymentIntent) throw new Error(collected.error?.message ?? "Could not collect card.");
      setTerminalMessage("Processing payment...");
      const processed = await instance.processPayment(collected.paymentIntent);
      if (processed.error || !processed.paymentIntent) throw new Error(processed.error?.message ?? "Could not process payment.");
      const complete = await fetch("/api/admin/pos/terminal/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: body.order.id, paymentIntentId: processed.paymentIntent.id, queueNow })
      });
      const completeBody = await complete.json().catch(() => null);
      if (!complete.ok) throw new Error(completeBody?.error ?? "Payment succeeded, but order update failed.");
      setTerminalMessage(`Paid ${completeBody.order.orderNumber}.`);
      resetOrderForm();
    } catch (error) {
      setTerminalMessage(error instanceof Error ? error.message : "Terminal payment failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!products.length) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Add products before taking in-person orders.</CardContent></Card>;
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="grid gap-4 rounded-md border bg-card p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Customer name (optional)"><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></Field>
            <Field label="Email (optional)"><Input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></Field>
          </div>

          <div className="grid gap-3">
            {lines.map((line, index) => {
              const product = productFor(line);
              const slotCount = Math.max(1, product?.colorSlotCount ?? 1);
              return (
                <div key={index} className="grid gap-3 rounded-md border bg-background p-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_96px_120px_120px_auto]">
                    <Field label="Product">
                      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value })}>
                        {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Qty"><Input type="number" min={1} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></Field>
                    <Field label="Unit price"><Input inputMode="decimal" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} /></Field>
                    <Field label="Already printed"><Input type="number" min={0} max={line.quantity} value={source === "PAST_IMPORT" ? 0 : line.printedQuantity} onChange={(event) => updateLine(index, { printedQuantity: Number(event.target.value) })} disabled={source === "PAST_IMPORT"} /></Field>
                    <div className="flex items-end">
                      <Button type="button" size="icon" variant="ghost" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} disabled={lines.length === 1} aria-label="Remove line">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {Array.from({ length: slotCount }, (_, slotIndex) => (
                      <Field key={slotIndex} label={slotCount === 1 ? "Color" : `Color ${slotIndex + 1}`}>
                        <select
                          className="h-10 rounded-md border bg-background px-3 text-sm"
                          value={line.selectedFilamentMaterialIds[slotIndex] ?? line.selectedFilamentMaterialIds[0] ?? ""}
                          onChange={(event) => {
                            const next = [...line.selectedFilamentMaterialIds];
                            next[slotIndex] = event.target.value;
                            updateLine(index, { selectedFilamentMaterialIds: next });
                          }}
                        >
                          {product?.allowedFilaments.map((item) => (
                            <option key={item.filamentMaterialId} value={item.filamentMaterialId}>{item.filamentMaterial.color} {item.filamentMaterial.material}</option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Button type="button" variant="outline" onClick={() => firstProduct && setLines((current) => [...current, newLine(firstProduct)])}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </section>

        <section className="grid gap-4 rounded-md border bg-card p-4">
          <CardTitle>Payment</CardTitle>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["UNPAID", DollarSign],
              ["CASH", DollarSign],
              ["STRIPE_TERMINAL", CreditCard],
              ["STRIPE_MANUAL", CreditCard]
            ].map(([method, Icon]) => (
              <Button key={String(method)} type="button" variant={paymentMethod === method ? "default" : "outline"} onClick={() => setPaymentMethod(String(method))}>
                <Icon className="h-4 w-4" />
                {method === "STRIPE_TERMINAL" ? "Terminal" : method === "STRIPE_MANUAL" ? "Manual" : method === "UNPAID" ? "Delivery" : "Cash"}
              </Button>
            ))}
          </div>

          {paymentMethod === "STRIPE_TERMINAL" ? (
            <div className="grid gap-3 rounded-md border bg-background p-3">
              {isMobileBrowser ? (
                <div className="flex gap-3 rounded-md border border-dashed bg-card p-3 text-sm text-muted-foreground">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    This phone can run the POS, but Tap to Pay on iPhone needs the native SuperPrint Admin or Merchant app with Apple approval. Browser mode can still connect to a Stripe reader on the same network.
                  </p>
                </div>
              ) : (
                <div className="flex gap-3 rounded-md border border-dashed bg-card p-3 text-sm text-muted-foreground">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    To use an iPhone itself as the reader, use the native SuperPrint Admin or Merchant app. This web POS already uses the same backend payment endpoints.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={discoverReaders} disabled={!terminalReady || loading}>
                  <RadioTower className="h-4 w-4" />
                  Find readers
                </Button>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useSimulatedReader} onChange={(event) => setUseSimulatedReader(event.target.checked)} />
                  Simulated
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={saveTerminalCard} onChange={(event) => setSaveTerminalCard(event.target.checked)} />
                  Save card to Stripe customer
                </label>
              </div>
              {readers.length ? (
                <div className="flex flex-wrap gap-2">
                  {readers.map((reader) => (
                    <Button key={reader.id} type="button" size="sm" variant={connectedReader?.id === reader.id ? "default" : "outline"} onClick={() => connectReader(reader)}>
                      {readerName(reader)}
                    </Button>
                  ))}
                </div>
              ) : null}
              <Button type="button" onClick={chargeTerminal} disabled={loading || !connectedReader || !customerEmail || !customerName}>
                <CreditCard className="h-4 w-4" />
                {loading ? "Processing..." : `Charge ${money(totalCents)} on reader`}
              </Button>
              {terminalMessage ? <p className="text-sm text-muted-foreground">{terminalMessage}</p> : null}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Paid now"><Input inputMode="decimal" placeholder={(totalCents / 100).toFixed(2)} value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} /></Field>
            <Field label="Reference"><Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Stripe PI, receipt, cash note" /></Field>
            <Field label="Card brand"><Input value={cardBrand} onChange={(event) => setCardBrand(event.target.value)} placeholder="Visa" /></Field>
            <Field label="Last 4"><Input inputMode="numeric" maxLength={4} value={cardLast4} onChange={(event) => setCardLast4(event.target.value.replace(/\D/g, "").slice(0, 4))} /></Field>
            <Field label="Order date"><Input type="datetime-local" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} /></Field>
            <Field label="Entry type">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={source} onChange={(event) => setSource(event.target.value as "IN_PERSON" | "PAST_IMPORT")}>
                <option value="IN_PERSON">New in-person</option>
                <option value="PAST_IMPORT">Past order</option>
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={queueNow} onChange={(event) => setQueueNow(event.target.checked)} />
            Queue paid items now
          </label>
          <Field label="Notes"><textarea className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm" value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></Field>
          <div className="grid gap-1 rounded-md bg-muted p-3 text-sm">
            <span>Total: <strong>{money(totalCents)}</strong></span>
            <span>Paid: <strong>{money(amountPaidCents)}</strong></span>
            <span>Balance: <strong>{money(balanceCents)}</strong></span>
          </div>
          <Button type="submit" disabled={loading}>{paymentMethod === "STRIPE_TERMINAL" ? "Save without charging" : "Save order"}</Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </section>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}

function newLine(product: ProductOption, quantity = 1): LineDraft {
  const selected = Array.from({ length: Math.max(1, product.colorSlotCount) }, (_, index) => product.allowedFilaments[index]?.filamentMaterialId ?? product.allowedFilaments[0]?.filamentMaterialId ?? "");
  return {
    productId: product.id,
    quantity,
    printedQuantity: 0,
    unitPrice: (product.priceCents / 100).toFixed(2),
    selectedFilamentMaterialIds: selected
  };
}

function dollarsToCents(value: string | number) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

function readerName(reader: TerminalReader) {
  return reader.label ?? reader.serial_number ?? reader.device_type ?? reader.id;
}
