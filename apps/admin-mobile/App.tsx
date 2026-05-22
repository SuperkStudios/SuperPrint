import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";
import { StripeTerminalProvider, useStripeTerminal, type Reader, type PaymentIntent as TerminalPaymentIntent } from "@stripe/stripe-terminal-react-native";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
  LogBox
} from "react-native";

const brandLockupLight = require("./assets/superprint-compact-lockup-light.png");
const brandLockupDark = require("./assets/superprint-compact-lockup-dark.png");
const brandMark = require("./assets/superprint-mark.png");

type ScreenKey = "dashboard" | "pos" | "orders" | "queue" | "parts" | "products" | "customers" | "reports" | "settings";

type AdminSettings = {
  apiBaseUrl: string;
  adminCookie: string;
  adminEmail: string;
  adminPassword: string;
  publishableKey: string;
  terminalLocationId: string;
  appearance: AppearanceMode;
};

type AdminOrder = {
  id: string;
  orderNumber: string;
  status: string;
  shippingStatus?: string | null;
  fulfillmentMethod?: FulfillmentMethod | null;
  paymentStatus: string;
  totalCents: number;
  amountPaidCents?: number | null;
  balanceDueCents?: number | null;
  paymentMethod?: string | null;
  customer?: { name?: string | null; email: string } | null;
  product?: { name: string } | null;
};

type ProductOption = {
  id: string;
  name: string;
  priceCents: number;
  colorSlotCount?: number;
  defaultMaterial?: string;
  status?: string;
  maxBatchQuantity?: number;
  parts?: Array<{ id: string; name: string; colorSlotIndex: number; quantityPerUnit: number }>;
};

type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  stripeCustomerId: string | null;
  source: "superprint" | "stripe";
  orderCount: number;
};

type FulfillmentMethod = "PICKUP" | "SHIP";

type ShippingQuote = {
  method: FulfillmentMethod;
  shippingAmountCents: number;
  shippingRateCents: number;
  rateId: string | null;
  shippoShipmentId: string | null;
  provider: string | null;
  service: string | null;
  estimatedDays: number | null;
};

type AppearanceMode = "system" | "light" | "dark";
type ActiveAppearance = "light" | "dark";

type AdminJob = {
  id: string;
  status: string;
  queuePosition?: number | null;
  etaMinutes?: number | null;
  order?: { orderNumber: string; customer?: { email: string } | null; product?: { name: string } | null } | null;
  printer?: { publicName?: string | null } | null;
  filament?: { material: string; color: string } | null;
};

type PartPlannerRow = {
  key: string;
  partId: string;
  productName: string;
  partName: string;
  color: string;
  requiredQuantity: number;
  quantityOnHand: number;
  quantityToPrint: number;
  suggestedPlateCount: number;
  suggestedPlateQuantity: number;
  orders: Array<{ orderNumber: string; quantity: number; customerEmail: string }>;
};

type PartInventoryRow = {
  id: string;
  name: string;
  role: string;
  colorSlotIndex: number;
  quantityPerUnit: number;
  product: { name: string };
  inventory: Array<{ id: string; color: string; quantityOnHand: number; location: string; notes?: string | null }>;
};

LogBox.ignoreAllLogs(true);

type ThemePalette = {
  ink: string;
  slate: string;
  muted: string;
  line: string;
  paper: string;
  card: string;
  field: string;
  cyan: string;
  cyanDark: string;
  mint: string;
  warn: string;
  danger: string;
  secondaryBg: string;
  secondaryBorder: string;
  badgeBg: string;
  actionBg: string;
  markBg: string;
};

const lightPalette: ThemePalette = {
  ink: "#0f172a",
  slate: "#475569",
  muted: "#64748b",
  line: "#dbe2ea",
  paper: "#f8fafc",
  card: "#ffffff",
  field: "#ffffff",
  cyan: "#06b6d4",
  cyanDark: "#0891b2",
  mint: "#2dd4bf",
  warn: "#f59e0b",
  danger: "#ef4444",
  secondaryBg: "#e0f2fe",
  secondaryBorder: "#bae6fd",
  badgeBg: "#e0f2fe",
  actionBg: "#0f172a",
  markBg: "#0f172a"
};

const darkPalette: ThemePalette = {
  ink: "#f8fafc",
  slate: "#cbd5e1",
  muted: "#94a3b8",
  line: "#253244",
  paper: "#070b12",
  card: "#0f172a",
  field: "#111827",
  cyan: "#06b6d4",
  cyanDark: "#67e8f9",
  mint: "#2dd4bf",
  warn: "#f59e0b",
  danger: "#f87171",
  secondaryBg: "#082f49",
  secondaryBorder: "#155e75",
  badgeBg: "#083344",
  actionBg: "#0891b2",
  markBg: "#0f172a"
};

let palette = lightPalette;

const navItems: Array<{ key: ScreenKey; title: string; detail: string }> = [
  { key: "pos", title: "Take Order", detail: "Cash, Stripe, deposits" },
  { key: "orders", title: "Orders", detail: "Past and live orders" },
  { key: "queue", title: "Queue", detail: "Build plate work" },
  { key: "parts", title: "Action Items", detail: "Print, build, deliver" },
  { key: "products", title: "Products", detail: "Catalog and slots" },
  { key: "customers", title: "Customers", detail: "Names, email, Stripe" },
  { key: "reports", title: "Reports", detail: "Cash and deposits" },
  { key: "settings", title: "Settings", detail: "API and device" }
];

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>("dashboard");
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<AdminSettings>({
    apiBaseUrl: "https://print.superk.studio",
    adminCookie: "",
    adminEmail: "",
    adminPassword: "",
    publishableKey: "",
    terminalLocationId: "",
    appearance: "system"
  });
  const activeAppearance: ActiveAppearance = settings.appearance === "system" ? (systemScheme === "dark" ? "dark" : "light") : settings.appearance;
  const theme = useMemo(() => {
    const nextPalette = activeAppearance === "dark" ? darkPalette : lightPalette;
    return { palette: nextPalette, styles: createStyles(nextPalette) };
  }, [activeAppearance]);
  palette = theme.palette;
  styles = theme.styles;

  const client = useMemo(() => new SuperPrintClient(settings), [settings]);
  const tokenProvider = useMemo(() => async () => {
    const response = await client.post<{ secret: string }>("/api/admin/pos/terminal/connection-token", {});
    return response.secret;
  }, [client]);

  return (
    <StripeProvider publishableKey={settings.publishableKey}>
      <StripeTerminalProvider tokenProvider={tokenProvider}>
        <AppShell screen={screen} setScreen={setScreen} settings={settings} setSettings={setSettings} client={client} activeAppearance={activeAppearance} />
      </StripeTerminalProvider>
    </StripeProvider>
  );
}

function AppShell({
  screen,
  setScreen,
  settings,
  setSettings,
  client,
  activeAppearance
}: {
  screen: ScreenKey;
  setScreen: (screen: ScreenKey) => void;
  settings: AdminSettings;
  setSettings: (settings: AdminSettings) => void;
  client: SuperPrintClient;
  activeAppearance: ActiveAppearance;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={activeAppearance === "dark" ? "light" : "dark"} />
      <View style={styles.topBar}>
        <Pressable onPress={() => setScreen("dashboard")} style={styles.brandLogoButton}>
          <Image source={activeAppearance === "dark" ? brandLockupDark : brandLockupLight} style={styles.brandLogo} resizeMode="contain" />
        </Pressable>
        <View style={styles.brandText}>
          <Text style={styles.brandSub}>Owner Admin</Text>
        </View>
        <Pressable onPress={() => setScreen("settings")} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Settings</Text>
        </Pressable>
      </View>

      {screen !== "dashboard" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.navScroller} contentContainerStyle={styles.navRail}>
          {navItems.map((item) => (
            <Pressable key={item.key} onPress={() => setScreen(item.key)} style={[styles.navPill, screen === item.key && styles.navPillActive]}>
              <Text style={[styles.navPillText, screen === item.key && styles.navPillTextActive]}>{item.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
        {screen === "dashboard" && <DashboardScreen onOpen={setScreen} />}
        {screen === "pos" && <POSScreen client={client} settings={settings} setSettings={setSettings} />}
        {screen === "orders" && <OrdersScreen client={client} />}
        {screen === "settings" && <SettingsScreen settings={settings} setSettings={setSettings} />}
        {screen === "queue" && <QueueScreen client={client} />}
        {screen === "parts" && <PartsScreen client={client} />}
        {screen === "products" && <ProductsScreen client={client} />}
        {screen === "customers" && <CustomersScreen client={client} />}
        {screen === "reports" && <ReportsScreen client={client} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DashboardScreen({ onOpen }: { onOpen: (screen: ScreenKey) => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <Text style={styles.kicker}>SuperPrint Admin</Text>
      <Text style={styles.h1}>Owner Console</Text>
      <Text style={styles.copy}>A native SuperPrint admin app for the counter, the shop floor, and the end-of-day money check.</Text>

      <View style={styles.grid}>
        {navItems.map((item) => (
          <Pressable key={item.key} onPress={() => onOpen(item.key)} style={styles.gridCard}>
            <View style={styles.gridIconBadge}>
              <Image source={brandMark} style={styles.gridIcon} resizeMode="contain" />
            </View>
            <Text style={styles.gridTitle}>{item.title}</Text>
            <Text style={styles.gridDetail}>{item.detail}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function POSScreen({ client, settings, setSettings }: { client: SuperPrintClient; settings: AdminSettings; setSettings: (settings: AdminSettings) => void }) {
  const stripe = useStripe();
  const terminal = useStripeTerminal({
    onDidAcceptTermsOfService: () => setMessage("Tap to Pay terms accepted."),
    onDidChangeConnectionStatus: (status) => setMessage(`Reader ${status}.`),
    onDidRequestReaderInput: (input) => setMessage(`Reader input: ${input.join(", ")}`),
    onDidRequestReaderDisplayMessage: (display) => setMessage(`Reader: ${display}`)
  });
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0.00");
  const [colors, setColors] = useState<string[]>(["PLA"]);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>("PICKUP");
  const [estimatedPickupAt, setEstimatedPickupAt] = useState("");
  const [address, setAddress] = useState({ street1: "", street2: "", city: "", state: "CO", zip: "", phone: "" });
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paidNow, setPaidNow] = useState("0.00");
  const [queueNow, setQueueNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedProduct = products.find((product) => product.id === productId);
  const slotCount = Math.max(1, selectedProduct?.colorSlotCount ?? 1);
  const itemTotalCents = cents(unitPrice) * Math.max(1, Number.parseInt(quantity, 10) || 1);
  const totalCents = itemTotalCents + (shippingQuote?.shippingAmountCents ?? 0);

  useEffect(() => {
    setProductLoading(true);
    client.get<{ products: ProductOption[] }>("/api/products")
      .then((response) => {
        setProducts(response.products);
        const first = response.products[0];
        if (first) {
          setProductId(first.id);
          setUnitPrice((first.priceCents / 100).toFixed(2));
          setColors(Array.from({ length: Math.max(1, first.colorSlotCount ?? 1) }, () => first.defaultMaterial ?? "PLA"));
        }
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load products."))
      .finally(() => setProductLoading(false));
  }, [client]);

  useEffect(() => {
    const query = customerQuery.trim();
    if (query.length < 2) {
      setCustomers([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      client.get<{ customers: AdminCustomer[] }>(`/api/admin/customers?q=${encodeURIComponent(query)}`)
        .then((response) => {
          if (!cancelled) setCustomers(response.customers);
        })
        .catch(() => {
          if (!cancelled) setCustomers([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, customerQuery]);

  function selectCustomer(customer: AdminCustomer) {
    setCustomerName(customer.name);
    setCustomerEmail(customer.email);
    setCustomerQuery(`${customer.name} ${customer.email}`);
    setCustomers([]);
  }

  async function refreshTerminalConfig() {
    const config = await client.get<{ publishableKey: string | null; terminalLocationId: string | null }>("/api/admin/pos/terminal/config");
    setSettings({ ...settings, publishableKey: config.publishableKey ?? "", terminalLocationId: config.terminalLocationId ?? "" });
    return config;
  }

  async function quoteShipping() {
    if (!selectedProduct) return;
    setSaving(true);
    setMessage("Estimating fulfillment...");
    try {
      const quote = await client.post<ShippingQuote>("/api/admin/pos/shipping/quote", {
        productId,
        quantity: Math.max(1, Number.parseInt(quantity, 10) || 1),
        productPriceCents: itemTotalCents,
        customerEmail,
        fulfillment: {
          method: fulfillmentMethod,
          address: fulfillmentAddress()
        }
      });
      setShippingQuote(quote);
      setMessage(quote.method === "SHIP" ? `Shipping ${money(quote.shippingAmountCents)}${quote.provider ? ` via ${quote.provider}` : ""}.` : "Pickup selected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not estimate fulfillment.");
    } finally {
      setSaving(false);
    }
  }

  async function saveOrder() {
    if (!customerName.trim() || !customerEmail.trim() || !productId) {
      setMessage("Customer, email, and product are required.");
      return;
    }
    setSaving(true);
    setMessage("Saving order...");
    try {
      const paidCents = cents(paidNow);
      const response = await client.post<{ order: { orderNumber: string } }>("/api/admin/pos", {
        ...buildOrderPayload(),
        paymentMethod,
        amountPaidCents: paidCents,
        depositCents: paidCents
      });
      setMessage(`Saved ${response.order.orderNumber}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Order save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function chargeManualCard() {
    setSaving(true);
    setMessage("Creating Stripe manual card payment...");
    try {
      const started = await client.post<{ order: { id: string; orderNumber: string; stripePaymentIntentId?: string | null }; clientSecret: string; publishableKey: string | null }>("/api/admin/pos/manual/payment-intent", buildOrderPayload());
      if (started.publishableKey && started.publishableKey !== settings.publishableKey) {
        setSettings({ ...settings, publishableKey: started.publishableKey });
      }
      const init = await stripe.initPaymentSheet({
        merchantDisplayName: "SuperPrint",
        paymentIntentClientSecret: started.clientSecret,
        returnURL: "superprint-admin://stripe-redirect"
      });
      if (init.error) throw new Error(init.error.message);
      const presented = await stripe.presentPaymentSheet();
      if (presented.error) throw new Error(presented.error.message);
      const paymentIntentId = started.order.stripePaymentIntentId;
      if (!paymentIntentId) throw new Error("Stripe did not return the payment intent id.");
      const completed = await client.post<{ order: { orderNumber: string } }>("/api/admin/pos/manual/complete", {
        orderId: started.order.id,
        paymentIntentId,
        queueNow
      });
      setMessage(`Paid ${completed.order.orderNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Manual card payment failed.");
    } finally {
      setSaving(false);
    }
  }

  async function chargeTapToPay() {
    setSaving(true);
    setMessage("Connecting Tap to Pay...");
    try {
      const config = await refreshTerminalConfig();
      const locationId = config.terminalLocationId ?? settings.terminalLocationId;
      if (!locationId) throw new Error("Add a Stripe Terminal location ID in SuperPrint admin settings.");
      if (!terminal.getIsInitialized()) {
        const initialized = await terminal.initialize();
        if (initialized.error) throw new Error(initialized.error.message);
      }
      const support = await terminal.supportsReadersOfType({
        deviceType: "tapToPay",
        discoveryMethod: "tapToPay"
      });
      if (support.error || !support.readerSupportResult) throw new Error(support.error?.message ?? "This device is not ready for Tap to Pay.");
      const connected = terminal.connectedReader ?? (await terminal.easyConnect({
        discoveryMethod: "tapToPay",
        locationId,
        merchantDisplayName: "SuperPrint",
        tosAcceptancePermitted: true,
        autoReconnectOnUnexpectedDisconnect: true
      })).reader;
      if (!connected) throw new Error("Could not connect this iPhone as the Tap to Pay reader.");
      const started = await client.post<{ order: { id: string; orderNumber: string }; clientSecret: string }>("/api/admin/pos/terminal/payment-intent", buildOrderPayload());
      const retrieved = await terminal.retrievePaymentIntent(started.clientSecret);
      if (retrieved.error || !retrieved.paymentIntent) throw new Error(retrieved.error?.message ?? "Could not retrieve Stripe Terminal payment.");
      const collected = await terminal.collectPaymentMethod({
        paymentIntent: retrieved.paymentIntent,
        customerCancellation: "enableIfAvailable"
      });
      if (collected.error || !collected.paymentIntent) throw new Error(collected.error?.message ?? "Card collection failed.");
      const confirmed = await terminal.confirmPaymentIntent({ paymentIntent: collected.paymentIntent as TerminalPaymentIntent.Type });
      if (confirmed.error || !confirmed.paymentIntent) throw new Error(confirmed.error?.message ?? "Stripe Terminal confirmation failed.");
      const completed = await client.post<{ order: { orderNumber: string } }>("/api/admin/pos/terminal/complete", {
        orderId: started.order.id,
        paymentIntentId: confirmed.paymentIntent.id,
        queueNow
      });
      setMessage(`Paid ${completed.order.orderNumber}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tap to Pay failed.");
    } finally {
      setSaving(false);
    }
  }

  function fulfillmentAddress() {
    return {
      name: customerName,
      email: customerEmail,
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: "US",
      phone: address.phone
    };
  }

  function buildOrderPayload() {
    return {
      customerName,
      customerEmail,
      internalNotes: "Created in SuperPrint Admin iOS",
      source: "IN_PERSON",
      queueNow,
      estimatedPickupAt: estimatedPickupAt || null,
      fulfillment: {
        method: fulfillmentMethod,
        address: fulfillmentAddress()
      },
      shippingAmountCents: shippingQuote?.shippingAmountCents ?? 0,
      shippingRateCents: shippingQuote?.shippingRateCents ?? 0,
      shippoRateId: shippingQuote?.rateId ?? null,
      shippoShipmentId: shippingQuote?.shippoShipmentId ?? null,
      lines: [
        {
          productId,
          quantity: Math.max(1, Number.parseInt(quantity, 10) || 1),
          unitPriceCents: cents(unitPrice),
          selectedFilamentMaterialIds: [],
          selectedColors: colors.slice(0, slotCount).map((color) => color.trim()).filter(Boolean)
        }
      ]
    };
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Take Order" detail="Counter order entry for new and past SuperPrint orders." />
      <Card>
        <Field label="Find Stripe customer" value={customerQuery} onChangeText={setCustomerQuery} autoCapitalize="none" />
        {customers.length ? (
          <View style={styles.choiceList}>
            {customers.map((customer) => (
              <Pressable key={`${customer.source}-${customer.id}`} onPress={() => selectCustomer(customer)} style={styles.choiceRow}>
                <Text style={styles.rowTitle}>{customer.name}</Text>
                <Text style={styles.cardCopy}>{customer.email} · {customer.source}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Field label="Customer name" value={customerName} onChangeText={setCustomerName} />
        <Field label="Email" value={customerEmail} onChangeText={setCustomerEmail} keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.label}>Product</Text>
        {productLoading ? <ActivityIndicator color={palette.cyanDark} /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRail}>
          {products.map((product) => (
            <Pressable
              key={product.id}
              onPress={() => {
                setProductId(product.id);
                setUnitPrice((product.priceCents / 100).toFixed(2));
                setColors(Array.from({ length: Math.max(1, product.colorSlotCount ?? 1) }, (_, index) => colors[index] ?? product.defaultMaterial ?? "PLA"));
                setShippingQuote(null);
              }}
              style={[styles.productChip, productId === product.id && styles.productChipActive]}
            >
              <Text style={[styles.productChipTitle, productId === product.id && styles.productChipTitleActive]}>{product.name}</Text>
              <Text style={[styles.productChipMeta, productId === product.id && styles.productChipMetaActive]}>{money(product.priceCents)} · {Math.max(1, product.colorSlotCount ?? 1)} color</Text>
            </Pressable>
          ))}
        </ScrollView>
        {!products.length && !productLoading ? <Field label="Product ID" value={productId} onChangeText={setProductId} autoCapitalize="none" /> : null}
        <View style={styles.inline}>
          <Field label="Qty" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" grow />
          <Field label="Unit price" value={unitPrice} onChangeText={setUnitPrice} keyboardType="decimal-pad" grow />
        </View>
        {Array.from({ length: slotCount }, (_, index) => (
          <Field
            key={index}
            label={slotCount === 1 ? "Color / material" : `Color ${index + 1}`}
            value={colors[index] ?? ""}
            onChangeText={(value) => setColors((current) => {
              const next = [...current];
              next[index] = value;
              return next;
            })}
          />
        ))}
        <View style={styles.segment}>
          {(["PICKUP", "SHIP"] as const).map((method) => (
            <Pressable key={method} onPress={() => { setFulfillmentMethod(method); setShippingQuote(null); }} style={[styles.segmentItem, fulfillmentMethod === method && styles.segmentItemActive]}>
              <Text style={[styles.segmentText, fulfillmentMethod === method && styles.segmentTextActive]}>{method}</Text>
            </Pressable>
          ))}
        </View>
        {fulfillmentMethod === "PICKUP" ? (
          <Field label="Estimated pickup time" value={estimatedPickupAt} onChangeText={setEstimatedPickupAt} />
        ) : (
          <View style={styles.field}>
            <Field label="Street" value={address.street1} onChangeText={(street1) => setAddress({ ...address, street1 })} />
            <Field label="Apt / suite" value={address.street2} onChangeText={(street2) => setAddress({ ...address, street2 })} />
            <View style={styles.inline}>
              <Field label="City" value={address.city} onChangeText={(city) => setAddress({ ...address, city })} grow />
              <Field label="State" value={address.state} onChangeText={(state) => setAddress({ ...address, state })} grow />
              <Field label="ZIP" value={address.zip} onChangeText={(zip) => setAddress({ ...address, zip })} grow />
            </View>
          </View>
        )}
        <Pressable onPress={quoteShipping} disabled={saving} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Estimate {fulfillmentMethod === "SHIP" ? "Shipping" : "Pickup"}</Text>
        </Pressable>
        <Text style={styles.cardCopy}>Total {money(totalCents)}{shippingQuote ? ` · fulfillment ${money(shippingQuote.shippingAmountCents)}` : ""}</Text>
        <View style={styles.segment}>
          {["CASH", "STRIPE_TERMINAL", "STRIPE_MANUAL"].map((method) => (
            <Pressable key={method} onPress={() => setPaymentMethod(method)} style={[styles.segmentItem, paymentMethod === method && styles.segmentItemActive]}>
              <Text style={[styles.segmentText, paymentMethod === method && styles.segmentTextActive]}>{method.replace("STRIPE_", "")}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Paid now" value={paidNow} onChangeText={setPaidNow} keyboardType="decimal-pad" />
        <View style={styles.switchRow}>
          <Text style={styles.label}>Queue paid items now</Text>
          <Switch value={queueNow} onValueChange={setQueueNow} />
        </View>
        <Pressable onPress={saveOrder} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{paymentMethod === "CASH" ? "Save Cash Order" : "Save Without Charging"}</Text>}
        </Pressable>
        {paymentMethod === "STRIPE_TERMINAL" ? (
          <Pressable onPress={chargeTapToPay} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
            <Text style={styles.primaryButtonText}>Tap to Pay on iPhone</Text>
          </Pressable>
        ) : null}
        {paymentMethod === "STRIPE_MANUAL" ? (
          <Pressable onPress={chargeManualCard} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
            <Text style={styles.primaryButtonText}>Enter Card Securely</Text>
          </Pressable>
        ) : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>
    </ScrollView>
  );
}

function OrdersScreen({ client }: { client: SuperPrintClient }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Add your admin cookie in Settings, then refresh.");

  async function load() {
    setLoading(true);
    try {
      const response = await client.get<{ orders: AdminOrder[] }>("/api/admin/orders");
      setOrders(response.orders);
      setMessage(response.orders.length ? "" : "No orders returned.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Orders" detail="Paid, partial, imported, cash, and Stripe work." />
      <Pressable onPress={load} style={styles.primaryButton}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Refresh Orders</Text>}
      </Pressable>
      {orders.length ? orders.map((order) => (
        <Card key={order.id}>
          <View style={styles.orderTop}>
            <View>
              <Text style={styles.cardTitle}>{order.orderNumber}</Text>
              <Text style={styles.cardCopy}>{order.customer?.email ?? "No customer email"}</Text>
            </View>
            <Text style={styles.money}>{money(order.totalCents)}</Text>
          </View>
          <View style={styles.badgeRow}>
            <Badge label={order.status} />
            <Badge label={order.paymentStatus} />
            <Badge label={order.paymentMethod ?? "UNPAID"} />
          </View>
        </Card>
      )) : (
        <Card><Text style={styles.cardCopy}>{message}</Text></Card>
      )}
    </ScrollView>
  );
}

function QueueScreen({ client }: { client: SuperPrintClient }) {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Sign in in Settings, then refresh the production queue.");

  async function load() {
    setLoading(true);
    try {
      const response = await client.get<{ jobs: AdminJob[] }>("/api/admin/queue");
      setJobs(response.jobs);
      setMessage(response.jobs.length ? "" : "No print jobs in the queue yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load queue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Queue" detail="Live jobs by status, plate order, material, and customer." />
      <LoadButton title="Refresh Queue" loading={loading} onPress={load} />
      {jobs.length ? jobs.map((job) => (
        <Card key={job.id}>
          <View style={styles.orderTop}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>{job.order?.orderNumber ?? "Print job"}</Text>
              <Text style={styles.cardCopy}>{job.order?.product?.name ?? job.order?.customer?.email ?? "Unassigned job"}</Text>
            </View>
            <Text style={styles.money}>{job.queuePosition ? `#${job.queuePosition}` : job.status}</Text>
          </View>
          <View style={styles.badgeRow}>
            <Badge label={job.status} />
            {job.filament ? <Badge label={`${job.filament.color} ${job.filament.material}`} /> : null}
            {job.printer?.publicName ? <Badge label={job.printer.publicName} /> : null}
            {job.etaMinutes ? <Badge label={`${job.etaMinutes}m`} /> : null}
          </View>
        </Card>
      )) : <Card><Text style={styles.cardCopy}>{message}</Text></Card>}
    </ScrollView>
  );
}

function PartsScreen({ client }: { client: SuperPrintClient }) {
  const [planner, setPlanner] = useState<PartPlannerRow[]>([]);
  const [parts, setParts] = useState<PartInventoryRow[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [mode, setMode] = useState<"print" | "build" | "deliver">("print");
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("Sign in in Settings, then refresh action items.");

  async function load() {
    setLoading(true);
    try {
      const [response, orderResponse] = await Promise.all([
        client.get<{ planner: PartPlannerRow[]; parts: PartInventoryRow[] }>("/api/admin/parts"),
        client.get<{ orders: AdminOrder[] }>("/api/admin/orders")
      ]);
      setPlanner(response.planner);
      setParts(response.parts);
      setOrders(orderResponse.orders);
      setMessage(response.planner.length || response.parts.length || orderResponse.orders.length ? "" : "No action items found yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load action items.");
    } finally {
      setLoading(false);
    }
  }

  async function logPrinted(row: PartPlannerRow, amount: number) {
    const quantity = Math.max(1, amount);
    setSavingKey(`${row.key}:${quantity}`);
    setMessage(`Logging ${quantity} ${row.color} ${row.partName}...`);
    try {
      await client.post("/api/admin/parts", {
        productPartId: row.partId,
        color: row.color,
        quantityDelta: quantity,
        location: "Fresh prints",
        notes: `Logged from SuperPrint Admin action items for ${row.productName}`
      });
      setMessage(`Logged ${quantity} printed ${row.partName}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not log printed parts.");
    } finally {
      setSavingKey("");
    }
  }

  async function updateOrder(order: AdminOrder, action: "markPacking" | "markShipped" | "markDelivered") {
    setSavingKey(`${order.id}:${action}`);
    setMessage(`Updating ${order.orderNumber}...`);
    try {
      await client.post("/api/admin/orders", { orderId: order.id, action });
      setMessage(`${order.orderNumber} updated.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update order.");
    } finally {
      setSavingKey("");
    }
  }

  const printRows = planner.filter((row) => row.quantityToPrint > 0).sort(sortPlannerRows);
  const colorGroups = groupPlannerByColor(printRows);
  const readyOrderNumbers = new Set(planner.filter((row) => row.quantityToPrint === 0).flatMap((row) => row.orders.map((order) => order.orderNumber)));
  const readyToBuild = orders.filter((order) => readyOrderNumbers.has(order.orderNumber) || order.status === "COMPLETED").filter((order) => !["PACKING", "SHIPPED", "DELIVERED"].includes(order.shippingStatus ?? ""));
  const deliveryOrders = orders.filter((order) => ["PACKING", "LABEL_READY", "LABEL_PRINTED", "SHIPPED", "PICKUP"].includes(order.shippingStatus ?? "") && order.shippingStatus !== "DELIVERED");
  const toPrint = printRows.reduce((total, row) => total + row.quantityToPrint, 0);
  const plates = printRows.reduce((total, row) => total + row.suggestedPlateCount, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Action Items" detail="Walk through what to print, build, and deliver without doing the math in your head." />
      <LoadButton title="Refresh Action Items" loading={loading} onPress={load} />
      <View style={styles.metricRow}>
        <Metric label="Print" value={String(toPrint)} />
        <Metric label="Plates" value={String(plates)} />
        <Metric label="Build" value={String(readyToBuild.length)} />
        <Metric label="Deliver" value={String(deliveryOrders.length)} />
      </View>
      <View style={styles.segment}>
        {([
          ["print", "Print"],
          ["build", "Build"],
          ["deliver", "Deliver"]
        ] as const).map(([key, label]) => (
          <Pressable key={key} onPress={() => setMode(key)} style={[styles.segmentItem, mode === key && styles.segmentItemActive]}>
            <Text style={[styles.segmentText, mode === key && styles.segmentTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === "print" ? (
        colorGroups.length ? colorGroups.map((group) => (
          <Card key={group.color}>
            <View style={styles.orderTop}>
              <View>
                <Text style={styles.cardTitle}>{group.color}</Text>
                <Text style={styles.cardCopy}>Print highest quantity first, then log parts as they come off the plate.</Text>
              </View>
              <Badge label={`${group.quantityToPrint} parts`} />
            </View>
            {group.rows.map((row) => (
              <View key={row.key} style={styles.actionItem}>
                <View style={styles.grow}>
                  <Text style={styles.rowTitle}>{row.productName} · {row.partName}</Text>
                  <Text style={styles.cardCopy}>Need {row.requiredQuantity}, stored {row.quantityOnHand}, print {row.quantityToPrint} · {row.suggestedPlateCount} plate{row.suggestedPlateCount === 1 ? "" : "s"}</Text>
                  <Text style={styles.cardCopy}>{row.orders.map((order) => `${order.orderNumber} x${order.quantity}`).join(", ")}</Text>
                </View>
                <View style={styles.actionButtons}>
                  <Pressable disabled={Boolean(savingKey)} onPress={() => logPrinted(row, 1)} style={styles.compactButton}>
                    <Text style={styles.compactButtonText}>+1</Text>
                  </Pressable>
                  <Pressable disabled={Boolean(savingKey)} onPress={() => logPrinted(row, row.quantityToPrint)} style={styles.compactButton}>
                    <Text style={styles.compactButtonText}>Printed</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </Card>
        )) : <Card><Text style={styles.cardCopy}>{message || "Nothing needs printing. Move to Build."}</Text></Card>
      ) : null}

      {mode === "build" ? (
        readyToBuild.length ? readyToBuild.map((order) => (
          <Card key={order.id}>
            <View style={styles.orderTop}>
              <View style={styles.grow}>
                <Text style={styles.cardTitle}>{order.orderNumber}</Text>
                <Text style={styles.cardCopy}>{order.customer?.email ?? "No customer email"} · {order.product?.name ?? "Order"}</Text>
              </View>
              <Badge label={order.fulfillmentMethod ?? "FULFILL"} />
            </View>
            <View style={styles.stepList}>
              <Text style={styles.stepText}>1. Pull printed parts by color.</Text>
              <Text style={styles.stepText}>2. Assemble and quality check.</Text>
              <Text style={styles.stepText}>3. Mark ready for pickup or packing.</Text>
            </View>
            <Pressable disabled={Boolean(savingKey)} onPress={() => updateOrder(order, "markPacking")} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{order.fulfillmentMethod === "PICKUP" ? "Ready for Pickup" : "Built / Pack It"}</Text>
            </Pressable>
          </Card>
        )) : <Card><Text style={styles.cardCopy}>{message || "No orders are ready to build yet."}</Text></Card>
      ) : null}

      {mode === "deliver" ? (
        deliveryOrders.length ? deliveryOrders.map((order) => (
          <Card key={order.id}>
            <View style={styles.orderTop}>
              <View style={styles.grow}>
                <Text style={styles.cardTitle}>{order.orderNumber}</Text>
                <Text style={styles.cardCopy}>{order.customer?.email ?? "No customer email"} · {order.shippingStatus ?? "Ready"}</Text>
              </View>
              <Badge label={order.fulfillmentMethod ?? "FULFILL"} />
            </View>
            <View style={styles.inline}>
              {order.fulfillmentMethod === "SHIP" && order.shippingStatus !== "SHIPPED" ? (
                <Pressable disabled={Boolean(savingKey)} onPress={() => updateOrder(order, "markShipped")} style={[styles.secondaryButton, styles.grow]}>
                  <Text style={styles.secondaryButtonText}>Shipped</Text>
                </Pressable>
              ) : null}
              <Pressable disabled={Boolean(savingKey)} onPress={() => updateOrder(order, "markDelivered")} style={[styles.primaryButton, styles.grow]}>
                <Text style={styles.primaryButtonText}>Delivered</Text>
              </Pressable>
            </View>
          </Card>
        )) : <Card><Text style={styles.cardCopy}>{message || "No deliveries are waiting."}</Text></Card>
      ) : null}

      {mode === "print" && parts.length ? parts.slice(0, 6).map((part) => (
        <Card key={part.id}>
          <Text style={styles.cardTitle}>{part.product.name} · {part.name}</Text>
          <Text style={styles.cardCopy}>{part.role} · slot {part.colorSlotIndex + 1} · {part.quantityPerUnit} per item</Text>
          <View style={styles.badgeRow}>
            {part.inventory.length ? part.inventory.map((item) => (
              <Badge key={item.id} label={`${item.color}: ${item.quantityOnHand} @ ${item.location}`} />
            )) : <Badge label="No stock logged" />}
          </View>
        </Card>
      )) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

function ProductsScreen({ client }: { client: SuperPrintClient }) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Refresh to pull the live catalog from Docker.");

  async function load() {
    setLoading(true);
    try {
      const response = await client.get<{ products: ProductOption[] }>("/api/products");
      setProducts(response.products);
      setMessage(response.products.length ? "" : "No active products.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load products.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Products" detail="Catalog prices, color slots, batches, and default material." />
      <LoadButton title="Refresh Products" loading={loading} onPress={load} />
      {products.length ? products.map((product) => (
        <Card key={product.id}>
          <View style={styles.orderTop}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>{product.name}</Text>
              <Text style={styles.cardCopy}>{product.defaultMaterial ?? "Material"} · {Math.max(1, product.colorSlotCount ?? 1)} color slot{(product.colorSlotCount ?? 1) === 1 ? "" : "s"}</Text>
            </View>
            <Text style={styles.money}>{money(product.priceCents)}</Text>
          </View>
          <View style={styles.badgeRow}>
            <Badge label={product.status ?? "ACTIVE"} />
            <Badge label={`Batch ${product.maxBatchQuantity ?? 1}`} />
          </View>
        </Card>
      )) : <Card><Text style={styles.cardCopy}>{message}</Text></Card>}
    </ScrollView>
  );
}

function CustomersScreen({ client }: { client: SuperPrintClient }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Sign in in Settings, then refresh customers from order history.");

  async function load() {
    setLoading(true);
    try {
      const response = await client.get<{ orders: AdminOrder[] }>("/api/admin/orders");
      setOrders(response.orders);
      setMessage(response.orders.length ? "" : "No customer orders yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }

  const customers = uniqueCustomers(orders);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Customers" detail="Customer list generated from POS, Stripe, cash, and imported orders." />
      <LoadButton title="Refresh Customers" loading={loading} onPress={load} />
      {customers.length ? customers.map((customer) => (
        <Card key={customer.email}>
          <View style={styles.orderTop}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>{customer.name || customer.email}</Text>
              <Text style={styles.cardCopy}>{customer.email}</Text>
            </View>
            <Text style={styles.money}>{money(customer.totalCents)}</Text>
          </View>
          <View style={styles.badgeRow}>
            <Badge label={`${customer.orderCount} order${customer.orderCount === 1 ? "" : "s"}`} />
            <Badge label={`${customer.paidCount} paid`} />
          </View>
        </Card>
      )) : <Card><Text style={styles.cardCopy}>{message}</Text></Card>}
    </ScrollView>
  );
}

function ReportsScreen({ client }: { client: SuperPrintClient }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Sign in in Settings, then refresh owner totals.");

  async function load() {
    setLoading(true);
    try {
      const response = await client.get<{ orders: AdminOrder[] }>("/api/admin/orders");
      setOrders(response.orders);
      setMessage(response.orders.length ? "" : "No orders to report yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }

  const totals = reportTotals(orders);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Reports" detail="Owner money view for cash, Stripe, deposits, balances, and counts." />
      <LoadButton title="Refresh Reports" loading={loading} onPress={load} />
      <View style={styles.metricRow}>
        <Metric label="Paid" value={money(totals.paid)} />
        <Metric label="Balance" value={money(totals.balance)} />
        <Metric label="Cash" value={money(totals.cash)} />
        <Metric label="Stripe" value={money(totals.stripe)} />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Payment Mix</Text>
        <View style={styles.badgeRow}>
          <Badge label={`${totals.orders} orders`} />
          <Badge label={`${totals.partial} partial`} />
          <Badge label={`${totals.unpaid} unpaid`} />
        </View>
        {message && !orders.length ? <Text style={styles.cardCopy}>{message}</Text> : null}
      </Card>
    </ScrollView>
  );
}

function SettingsScreen({ settings, setSettings }: { settings: AdminSettings; setSettings: (settings: AdminSettings) => void }) {
  const client = useMemo(() => new SuperPrintClient(settings), [settings]);
  const [testing, setTesting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [status, setStatus] = useState("");

  async function checkConnection() {
    setTesting(true);
    setStatus("Checking backend...");
    try {
      await client.health();
      const products = await client.get<{ products: ProductOption[] }>("/api/products");
      setStatus(`Connected. Found ${products.products.length} active product${products.products.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection failed.");
    } finally {
      setTesting(false);
    }
  }

  async function signIn() {
    setSigningIn(true);
    setStatus("Signing in...");
    try {
      const cookie = await client.signIn(settings.adminEmail, settings.adminPassword);
      setSettings({ ...settings, adminCookie: cookie });
      setStatus("Signed in. Admin cookie captured for local API calls.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setSigningIn(false);
    }
  }

  async function signInApple() {
    setSigningIn(true);
    setStatus("Opening Apple sign in...");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      });
      if (!credential.identityToken) throw new Error("Apple did not return an identity token.");
      const cookie = await client.signInWithApple(credential.identityToken);
      setSettings({ ...settings, adminCookie: cookie });
      setStatus("Signed in with Apple.");
    } catch (error) {
      if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") {
        setStatus("Apple sign in canceled.");
      } else {
        setStatus(error instanceof Error ? error.message : "Apple sign in failed.");
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function loadPaymentConfig() {
    setTesting(true);
    setStatus("Loading payment settings...");
    try {
      const config = await client.get<{ publishableKey: string | null; terminalLocationId: string | null; configured: boolean; mode: string }>("/api/admin/pos/terminal/config");
      setSettings({ ...settings, publishableKey: config.publishableKey ?? "", terminalLocationId: config.terminalLocationId ?? "" });
      setStatus(config.configured ? `Stripe ${config.mode} configured.` : "Stripe is not configured yet in the web admin.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load payment settings.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Settings" detail="Owner setup for auth, payments, backend, and device." />
      <View style={styles.grid}>
        {[
          ["Backend", settings.apiBaseUrl],
          ["Auth", settings.adminCookie ? "Signed in" : "Not signed in"],
          ["Payments", settings.publishableKey ? "Stripe loaded" : "Needs config"],
          ["Terminal", settings.terminalLocationId || "No location"]
        ].map(([title, detail]) => (
          <View key={title} style={styles.gridCard}>
            <View style={styles.gridIconBadge}>
              <Image source={brandMark} style={styles.gridIcon} resizeMode="contain" />
            </View>
            <Text style={styles.gridTitle}>{title}</Text>
            <Text style={styles.gridDetail}>{detail}</Text>
          </View>
        ))}
      </View>
      <Card>
        <Text style={styles.cardTitle}>Appearance</Text>
        <View style={styles.segment}>
          {(["system", "light", "dark"] as AppearanceMode[]).map((mode) => (
            <Pressable key={mode} onPress={() => setSettings({ ...settings, appearance: mode })} style={[styles.segmentItem, settings.appearance === mode && styles.segmentItemActive]}>
              <Text style={[styles.segmentText, settings.appearance === mode && styles.segmentTextActive]}>{mode.slice(0, 1).toUpperCase() + mode.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card>
        <Field label="API base URL" value={settings.apiBaseUrl} onChangeText={(apiBaseUrl) => setSettings({ ...settings, apiBaseUrl })} autoCapitalize="none" />
        <View style={styles.inline}>
          <Pressable onPress={() => setSettings({ ...settings, apiBaseUrl: "https://print.superk.studio" })} style={[styles.secondaryButton, styles.grow]}>
            <Text style={styles.secondaryButtonText}>Use Production</Text>
          </Pressable>
          <Pressable onPress={() => setSettings({ ...settings, apiBaseUrl: "http://localhost:3000" })} style={[styles.secondaryButton, styles.grow]}>
            <Text style={styles.secondaryButtonText}>Use Localhost</Text>
          </Pressable>
        </View>
        <Pressable onPress={signInApple} style={styles.primaryButton}>
          {signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign in with Apple</Text>}
        </Pressable>
        <Field label="Admin email" value={settings.adminEmail} onChangeText={(adminEmail) => setSettings({ ...settings, adminEmail })} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Admin password" value={settings.adminPassword} onChangeText={(adminPassword) => setSettings({ ...settings, adminPassword })} secureTextEntry />
        <Pressable onPress={signIn} style={styles.primaryButton}>
          {signingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sign In to Backend</Text>}
        </Pressable>
        <Field label="Admin session cookie" value={settings.adminCookie} onChangeText={(adminCookie) => setSettings({ ...settings, adminCookie })} autoCapitalize="none" multiline />
        <Field label="Stripe publishable key" value={settings.publishableKey} onChangeText={(publishableKey) => setSettings({ ...settings, publishableKey })} autoCapitalize="none" />
        <Field label="Terminal location" value={settings.terminalLocationId} onChangeText={(terminalLocationId) => setSettings({ ...settings, terminalLocationId })} autoCapitalize="none" />
        <View style={styles.inline}>
          <Pressable onPress={loadPaymentConfig} style={[styles.secondaryButton, styles.grow]}>
            <Text style={styles.secondaryButtonText}>Load Payments</Text>
          </Pressable>
          <Pressable onPress={checkConnection} style={[styles.primaryButton, styles.grow]}>
            {testing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Test</Text>}
          </Pressable>
        </View>
        {status ? <Text style={styles.message}>{status}</Text> : null}
        <Text style={styles.cardCopy}>Production points to print.superk.studio. Localhost works in Simulator; a physical iPhone needs production or your Mac LAN URL with trusted auth origins.</Text>
      </Card>
    </ScrollView>
  );
}

function WorkflowScreen({ title, detail, action }: { title: string; detail: string; action: string }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title={title} detail={detail} />
      <Card>
        <Text style={styles.cardTitle}>Native workflow ready</Text>
        <Text style={styles.cardCopy}>{action}</Text>
      </Card>
    </ScrollView>
  );
}

function ScreenHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <View>
      <Text style={styles.h1}>{title}</Text>
      <Text style={styles.copy}>{detail}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "email-address" | "number-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  grow?: boolean;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={[styles.field, props.grow && styles.grow]}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        multiline={props.multiline}
        secureTextEntry={props.secureTextEntry}
        style={[styles.input, props.multiline && styles.multilineInput]}
      />
    </View>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function LoadButton({ title, loading, onPress }: { title: string; loading: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.primaryButton}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{title}</Text>}
    </Pressable>
  );
}

class SuperPrintClient {
  constructor(private settings: AdminSettings) {}

  async health(): Promise<void> {
    await this.request<{ ok: boolean }>("/api/health", { method: "GET" }, false);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  async signIn(email: string, password: string): Promise<string> {
    const base = this.settings.apiBaseUrl.replace(/\/$/, "");
    const response = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, callbackURL: "/admin" })
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(body?.message ?? body?.error ?? `Sign in failed (${response.status})`);
    }
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("Signed in, but the backend did not return a session cookie to the app.");
    return normalizeSetCookie(cookie);
  }

  async signInWithApple(identityToken: string): Promise<string> {
    const base = this.settings.apiBaseUrl.replace(/\/$/, "");
    const response = await fetch(`${base}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "apple",
        idToken: { token: identityToken },
        callbackURL: "/admin"
      })
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(body?.message ?? body?.error ?? `Apple sign in failed (${response.status})`);
    }
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("Apple sign in succeeded, but no session cookie was returned.");
    return normalizeSetCookie(cookie);
  }

  private async request<T>(path: string, init: RequestInit, includeCookie = true): Promise<T> {
    const base = this.settings.apiBaseUrl.replace(/\/$/, "");
    const url = `${base}${path}`;
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(includeCookie && this.settings.adminCookie ? { Cookie: this.settings.adminCookie } : {})
      }
    });
    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const body = parseResponseBody(text, contentType, response.status, url);
    if (!response.ok) {
      throw new Error(body?.error ?? `Request failed (${response.status})`);
    }
    return body as T;
  }
}

function cents(value: string) {
  return Math.max(0, Math.round((Number(value) || 0) * 100));
}

function uniqueCustomers(orders: AdminOrder[]) {
  const map = new Map<string, { email: string; name: string; orderCount: number; paidCount: number; totalCents: number }>();
  for (const order of orders) {
    const email = order.customer?.email ?? "unknown";
    const existing = map.get(email) ?? {
      email,
      name: order.customer?.name ?? "",
      orderCount: 0,
      paidCount: 0,
      totalCents: 0
    };
    existing.name = existing.name || order.customer?.name || "";
    existing.orderCount += 1;
    existing.totalCents += order.totalCents;
    if (order.paymentStatus === "PAID") existing.paidCount += 1;
    map.set(email, existing);
  }
  return [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
}

function reportTotals(orders: AdminOrder[]) {
  return orders.reduce(
    (totals, order) => {
      const paid = order.amountPaidCents ?? 0;
      totals.orders += 1;
      totals.paid += paid;
      totals.balance += order.balanceDueCents ?? Math.max(0, order.totalCents - paid);
      if (order.paymentMethod === "CASH") totals.cash += paid;
      if (order.paymentMethod?.startsWith("STRIPE")) totals.stripe += paid;
      if (order.paymentStatus === "PARTIAL") totals.partial += 1;
      if (order.paymentStatus === "UNPAID") totals.unpaid += 1;
      return totals;
    },
    { orders: 0, paid: 0, balance: 0, cash: 0, stripe: 0, partial: 0, unpaid: 0 }
  );
}

function parseResponseBody(text: string, contentType: string, status: number, url: string) {
  if (!text) return null;
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Backend returned invalid JSON from ${url} (${status}).`);
    }
  }
  const preview = text.replace(/\s+/g, " ").trim().slice(0, 140);
  if (text.trim().startsWith("<")) {
    throw new Error(`Backend returned an HTML page from ${url} (${status}). Check Settings: sign in again, verify the API URL, and redeploy Docker if this is production.`);
  }
  throw new Error(`Backend returned non-JSON from ${url} (${status}): ${preview || "empty response"}`);
}

function sortPlannerRows(a: PartPlannerRow, b: PartPlannerRow) {
  return b.quantityToPrint - a.quantityToPrint || a.color.localeCompare(b.color) || a.productName.localeCompare(b.productName) || a.partName.localeCompare(b.partName);
}

function groupPlannerByColor(rows: PartPlannerRow[]) {
  const groups = new Map<string, { color: string; quantityToPrint: number; rows: PartPlannerRow[] }>();
  for (const row of rows) {
    const existing = groups.get(row.color) ?? { color: row.color, quantityToPrint: 0, rows: [] };
    existing.quantityToPrint += row.quantityToPrint;
    existing.rows.push(row);
    groups.set(row.color, existing);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, rows: group.rows.sort(sortPlannerRows) }))
    .sort((a, b) => b.quantityToPrint - a.quantityToPrint || a.color.localeCompare(b.color));
}

function money(centsValue: number) {
  return (centsValue / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function normalizeSetCookie(value: string) {
  return value
    .split(/,(?=[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

let styles = createStyles(palette);

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.paper },
  topBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: palette.card, borderBottomWidth: 1, borderBottomColor: palette.line },
  brandLogoButton: { width: 132, height: 44, justifyContent: "center" },
  brandLogo: { width: 132, height: 38 },
  brandText: { flex: 1 },
  brandSub: { color: palette.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  smallButton: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { color: palette.ink, fontWeight: "800" },
  navScroller: { flexGrow: 0, maxHeight: 58, backgroundColor: palette.card, borderBottomWidth: 1, borderBottomColor: palette.line },
  navRail: { gap: 8, paddingHorizontal: 16, paddingVertical: 9, alignItems: "center" },
  navPill: { height: 38, justifyContent: "center", borderWidth: 1, borderColor: palette.line, borderRadius: 8, paddingHorizontal: 12 },
  navPillActive: { backgroundColor: palette.actionBg, borderColor: palette.actionBg },
  navPillText: { color: palette.slate, fontWeight: "800", fontSize: 12 },
  navPillTextActive: { color: "#fff" },
  content: { flex: 1 },
  screen: { flex: 1 },
  screenBody: { padding: 18, paddingBottom: 56, gap: 16 },
  kicker: { color: palette.cyanDark, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  h1: { color: palette.ink, fontSize: 34, fontWeight: "900" },
  copy: { color: palette.slate, fontSize: 15, lineHeight: 22 },
  metricRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "47.8%", backgroundColor: palette.card, borderColor: palette.line, borderWidth: 1, borderRadius: 8, padding: 14 },
  metricValue: { color: palette.ink, fontSize: 18, fontWeight: "900" },
  metricLabel: { color: palette.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridCard: { width: "47.8%", minHeight: 126, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 14, overflow: "hidden" },
  gridIconBadge: { width: 38, height: 38, borderRadius: 8, backgroundColor: palette.markBg, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  gridIcon: { width: 30, height: 30 },
  gridTitle: { color: palette.ink, fontSize: 17, fontWeight: "900" },
  gridDetail: { color: palette.slate, fontSize: 12, lineHeight: 17, marginTop: 8 },
  card: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 16, gap: 12 },
  cardTitle: { color: palette.ink, fontSize: 18, fontWeight: "900" },
  cardCopy: { color: palette.slate, fontSize: 13, lineHeight: 19 },
  field: { gap: 6 },
  grow: { flex: 1 },
  label: { color: palette.ink, fontSize: 12, fontWeight: "800" },
  input: { minHeight: 44, borderWidth: 1, borderColor: palette.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: palette.ink, backgroundColor: palette.field },
  multilineInput: { minHeight: 90, textAlignVertical: "top" },
  inline: { flexDirection: "row", gap: 10 },
  productRail: { gap: 8, paddingVertical: 2 },
  productChip: { width: 168, minHeight: 76, borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 12, justifyContent: "space-between", backgroundColor: palette.field },
  productChipActive: { backgroundColor: palette.actionBg, borderColor: palette.actionBg },
  productChipTitle: { color: palette.ink, fontSize: 14, fontWeight: "900" },
  productChipTitleActive: { color: "#fff" },
  productChipMeta: { color: palette.muted, fontSize: 11, fontWeight: "800" },
  productChipMetaActive: { color: "#cffafe" },
  segment: { flexDirection: "row", borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 4, gap: 4 },
  segmentItem: { flex: 1, alignItems: "center", borderRadius: 6, paddingVertical: 10 },
  segmentItemActive: { backgroundColor: palette.cyan },
  segmentText: { color: palette.slate, fontSize: 12, fontWeight: "900" },
  segmentTextActive: { color: "#fff" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  primaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: palette.actionBg, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  secondaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: palette.secondaryBg, borderWidth: 1, borderColor: palette.secondaryBorder, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  secondaryButtonText: { color: palette.cyanDark, fontWeight: "900", fontSize: 13 },
  disabled: { opacity: 0.7 },
  message: { color: palette.slate, fontSize: 13 },
  orderTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  money: { color: palette.ink, fontSize: 18, fontWeight: "900" },
  rowLine: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 10 },
  rowTitle: { color: palette.ink, fontSize: 14, fontWeight: "900" },
  actionItem: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12, gap: 10 },
  actionButtons: { flexDirection: "row", gap: 8 },
  compactButton: { minHeight: 38, borderRadius: 8, backgroundColor: palette.actionBg, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  compactButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  stepList: { gap: 6, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 },
  stepText: { color: palette.slate, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  choiceList: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, overflow: "hidden" },
  choiceRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: palette.line, backgroundColor: palette.field },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { borderRadius: 6, backgroundColor: palette.badgeBg, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { color: palette.cyanDark, fontSize: 11, fontWeight: "900" }
  });
}
