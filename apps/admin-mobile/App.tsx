import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";
import { StripeTerminalProvider, useStripeTerminal } from "@stripe/stripe-terminal-react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  BadgeCheck,
  Banknote,
  Boxes,
  ChartColumn,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Factory,
  History,
  IdCard,
  Layers,
  Package,
  PackageCheck,
  Plus,
  Printer,
  ReceiptText,
  ScanFace,
  ShoppingCart,
  SmartphoneNfc,
  Settings,
  Store,
  Users,
  type LucideIcon
} from "lucide-react-native";
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
const defaultApiBaseUrl = process.env.EXPO_PUBLIC_SUPERPRINT_URL ?? "https://print.superk.studio";
const secureSessionKey = "superprint.admin.sessionCookie";
const secureEmailKey = "superprint.admin.email";
const secureSessionMetaKey = "superprint.admin.sessionMeta";

type ScreenKey = "dashboard" | "pos" | "orders" | "queue" | "parts" | "filament" | "merchants" | "products" | "customers" | "reports" | "settings";

type AdminSettings = {
  apiBaseUrl: string;
  adminCookie: string;
  adminEmail: string;
  adminPassword: string;
  primaryColor: string;
  publishableKey: string;
  terminalLocationId: string;
  stripeMode: string;
  stripeConfigured: boolean;
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
  orderSource?: "IN_PERSON" | "BACKLOG_IMPORT" | "PAST_IMPORT" | string | null;
  items?: Array<{ quantity: number; printedQuantity?: number | null }>;
  customer?: { name?: string | null; email: string } | null;
  product?: { name: string } | null;
};

type ProductOption = {
  id: string;
  name: string;
  priceCents: number;
  estimatedPrintMinutes?: number;
  estimatedGrams?: number;
  colorSlotCount?: number;
  defaultMaterial?: string;
  allowedFilaments?: Array<{
    filamentMaterialId: string;
    estimatedGramsOverride?: number | null;
    estimatedPrintMinutesOverride?: number | null;
    filamentMaterial: { color: string; material: string };
  }>;
  status?: string;
  maxBatchQuantity?: number;
  parts?: Array<{ id: string; name: string; colorSlotIndex: number; colorSlotPattern?: number[]; quantityPerUnit: number }>;
};

type LineDraft = {
  productId: string;
  quantity: string;
  printedQuantity: string;
  unitPrice: string;
  selectedFilamentMaterialIds: string[];
  selectedColors: string[];
};

type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  stripeCustomerId: string | null;
  source: "superprint" | "stripe";
  orderCount: number;
};

type MobileSessionInfo = {
  signedIn: boolean;
  user?: {
    email: string;
    name: string;
    role?: string | null;
    emailVerified: boolean;
    adminAllowed: boolean;
  };
};

type StoredSessionMeta = {
  email: string;
  savedAt: string;
  lastValidatedAt: string;
};

type LocalAuthState = {
  unlocked: boolean;
  supported: boolean;
  enrolled: boolean;
  label: string;
  message: string;
};

type PlatformTheme = {
  brandName: string;
  primaryColor: string;
};

type FulfillmentMethod = "PICKUP" | "SHIP";
type PosPaymentMethod = "UNPAID" | "CASH" | "STRIPE_TERMINAL" | "STRIPE_MANUAL";
type ExpectedPaymentType = "CARD" | "CASH";

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

type StripePaymentChoice = {
  id: string;
  amountCents: number;
  status: string;
  created: string;
  receiptEmail?: string | null;
  description?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
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

type FilamentSpool = {
  id: string;
  material: FilamentMaterial;
  type?: FilamentMaterial;
  color: string;
  brand: string;
  startingGrams: number;
  spoolWeightGrams?: number;
  remainingGrams: number;
  thresholdGrams: number;
  rollCostCents: number;
  location: string;
  active: boolean;
  requiresAdminApproval?: boolean;
  assignedPrinterHistory?: AssignedPrinterHistoryItem[];
  notes?: string | null;
};

type AssignedPrinterHistoryItem = {
  id: string;
  name: string;
  gramsUsed?: number;
  completedAt?: string;
  status?: string;
  gramsSource?: string;
  printedLayers?: number;
  totalLayers?: number;
  material?: string;
};

type FilamentMaterial = "PLA" | "PLA_PLUS" | "PETG" | "ABS" | "TPU" | "NYLON" | "RESIN";

type MerchantApplication = {
  id: string;
  user: { email: string; name: string | null };
  status: string;
  businessName: string;
  legalBusinessName: string | null;
  businessType: string;
  siteUrl: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  taxIdType: string;
  taxIdLast4: string;
  stripeConnectStatus: string;
  stripeAccountId: string | null;
  stripeTerminalLocationId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  stripeRequirementsDue: string[];
  reviewNotes: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  updatedAt: string;
};

const filamentMaterials: FilamentMaterial[] = ["PLA", "PLA_PLUS", "PETG", "ABS", "TPU", "NYLON", "RESIN"];
const defaultPrimaryColor = "#00e5ff";

type PrinterHistoryItem = {
  id: string;
  name: string;
  status: string;
  gramsUsed?: number;
  completedAt?: string;
  gramsSource?: string;
  printedLayers?: number;
  totalLayers?: number;
  printTimeSeconds?: number;
  material?: string;
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
  orange: string;
  mint: string;
  warn: string;
  danger: string;
  secondaryBg: string;
  secondaryBorder: string;
  badgeBg: string;
  actionBg: string;
  actionText: string;
  markBg: string;
};

const lightPalette: ThemePalette = {
  ink: "#0b0f14",
  slate: "#5d6879",
  muted: "#5d6879",
  line: "#c3ccd5",
  paper: "#f6f7f8",
  card: "#ffffff",
  field: "#ffffff",
  cyan: "#00e5ff",
  cyanDark: "#008ea3",
  orange: "#ff6a00",
  mint: "#22c55e",
  warn: "#ff6a00",
  danger: "#dc2626",
  secondaryBg: "#e6fbff",
  secondaryBorder: "#9eefff",
  badgeBg: "#e6fbff",
  actionBg: "#00e5ff",
  actionText: "#0b0f14",
  markBg: "#0b0f14"
};

const darkPalette: ThemePalette = {
  ink: "#f8fafc",
  slate: "#cbd5e1",
  muted: "#8995a6",
  line: "#242e38",
  paper: "#0b0f14",
  card: "#0e131b",
  field: "#111821",
  cyan: "#00e5ff",
  cyanDark: "#67e8f9",
  orange: "#ff6a00",
  mint: "#22c55e",
  warn: "#ff8a2a",
  danger: "#ef4444",
  secondaryBg: "#19212a",
  secondaryBorder: "#242e38",
  badgeBg: "#083344",
  actionBg: "#00e5ff",
  actionText: "#0b0f14",
  markBg: "#0b0f14"
};

let palette = lightPalette;

function buildMobilePalette(primaryColor: string, appearance: ActiveAppearance): ThemePalette {
  const base = appearance === "dark" ? darkPalette : lightPalette;
  const primary = normalizePrimaryColor(primaryColor);
  const actionText = readableForeground(primary);
  return {
    ...base,
    cyan: primary,
    cyanDark: primary,
    actionBg: primary,
    actionText,
    secondaryBg: appearance === "dark" ? mixHex(primary, "#0b0f14", 0.82) : mixHex(primary, "#ffffff", 0.84),
    secondaryBorder: appearance === "dark" ? mixHex(primary, "#0b0f14", 0.56) : mixHex(primary, "#ffffff", 0.56),
    badgeBg: appearance === "dark" ? mixHex(primary, "#0b0f14", 0.76) : mixHex(primary, "#ffffff", 0.84)
  };
}

function normalizePrimaryColor(value?: unknown) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : defaultPrimaryColor;
}

function readableForeground(hex: string) {
  const color = normalizePrimaryColor(hex);
  const red = parseInt(color.slice(1, 3), 16);
  const green = parseInt(color.slice(3, 5), 16);
  const blue = parseInt(color.slice(5, 7), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 150 ? "#0b0f14" : "#ffffff";
}

function mixHex(color: string, base: string, weight: number) {
  const a = normalizePrimaryColor(color);
  const b = normalizePrimaryColor(base);
  const channels = [1, 3, 5].map((index) => {
    const value = Math.round(parseInt(a.slice(index, index + 2), 16) * (1 - weight) + parseInt(b.slice(index, index + 2), 16) * weight);
    return value.toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

const navItems: Array<{ key: ScreenKey; title: string; detail: string }> = [
  { key: "pos", title: "Take Order", detail: "Cash, Stripe, deposits" },
  { key: "orders", title: "Orders", detail: "Past and live orders" },
  { key: "queue", title: "Queue", detail: "Build plate work" },
  { key: "parts", title: "Action Items", detail: "Print, build, deliver" },
  { key: "filament", title: "Filament", detail: "Add rolls and stock" },
  { key: "merchants", title: "Merchants", detail: "Review and approve" },
  { key: "products", title: "Products", detail: "Catalog and slots" },
  { key: "customers", title: "Customers", detail: "Names, email, Stripe" },
  { key: "reports", title: "Reports", detail: "Cash and deposits" },
  { key: "settings", title: "Settings", detail: "API and device" }
];

const navIcons: Record<ScreenKey, LucideIcon> = {
  dashboard: Factory,
  pos: ShoppingCart,
  orders: ClipboardList,
  queue: Printer,
  parts: PackageCheck,
  filament: Layers,
  merchants: Store,
  products: Package,
  customers: Users,
  reports: ChartColumn,
  settings: Settings
};

type PosFlowStep = "customer" | "items" | "fulfillment" | "payment" | "review";
const posFlowSteps: Array<{ key: PosFlowStep; label: string; icon: LucideIcon }> = [
  { key: "customer", label: "Customer", icon: IdCard },
  { key: "items", label: "Items", icon: Boxes },
  { key: "fulfillment", label: "Fulfill", icon: PackageCheck },
  { key: "payment", label: "Payment", icon: CircleDollarSign },
  { key: "review", label: "Review", icon: ClipboardCheck }
];

const paymentOptions: Array<{ key: PosPaymentMethod; label: string; icon: LucideIcon }> = [
  { key: "UNPAID", label: "On Delivery", icon: ReceiptText },
  { key: "CASH", label: "Cash", icon: Banknote },
  { key: "STRIPE_TERMINAL", label: "Tap", icon: SmartphoneNfc },
  { key: "STRIPE_MANUAL", label: "Manual", icon: CreditCard }
];

const expectedPaymentOptions: Array<{ key: ExpectedPaymentType; label: string; icon: LucideIcon }> = [
  { key: "CARD", label: "Card", icon: CreditCard },
  { key: "CASH", label: "Cash", icon: Banknote }
];

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>("dashboard");
  const systemScheme = useColorScheme();
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [sessionInfo, setSessionInfo] = useState<MobileSessionInfo | null>(null);
  const [sessionMeta, setSessionMeta] = useState<StoredSessionMeta | null>(null);
  const [localAuth, setLocalAuth] = useState<LocalAuthState>({
    unlocked: false,
    supported: false,
    enrolled: false,
    label: "Face ID",
    message: ""
  });
  const [settings, setSettings] = useState<AdminSettings>({
    apiBaseUrl: defaultApiBaseUrl,
    adminCookie: "",
    adminEmail: "",
    adminPassword: "",
    primaryColor: defaultPrimaryColor,
    publishableKey: "",
    terminalLocationId: "",
    stripeMode: "",
    stripeConfigured: false,
    appearance: "system"
  });
  const activeAppearance: ActiveAppearance = settings.appearance === "system" ? (systemScheme === "dark" ? "dark" : "light") : settings.appearance;
  const theme = useMemo(() => {
    const nextPalette = buildMobilePalette(settings.primaryColor, activeAppearance);
    return { palette: nextPalette, styles: createStyles(nextPalette) };
  }, [activeAppearance, settings.primaryColor]);
  palette = theme.palette;
  styles = theme.styles;

  const client = useMemo(() => new SuperPrintClient(settings), [settings]);
  const tokenProvider = useMemo(() => async () => {
    const response = await client.post<{ secret: string }>("/api/admin/pos/terminal/connection-token", {});
    return response.secret;
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    async function restoreSavedSession() {
      try {
        const [cookie, email] = await Promise.all([
          SecureStore.getItemAsync(secureSessionKey),
          SecureStore.getItemAsync(secureEmailKey)
        ]);
        if (email && !cancelled) {
          setSettings((current) => ({ ...current, adminEmail: email }));
        }
        if (!cookie) {
          if (!cancelled) setSessionInfo({ signedIn: false });
          return;
        }
        const nextSettings = {
          ...settings,
          adminCookie: cookie,
          adminEmail: email ?? settings.adminEmail
        };
        const session = await new SuperPrintClient(nextSettings).get<MobileSessionInfo>("/api/admin/mobile-session");
        if (!session.signedIn || !session.user?.adminAllowed) {
          await clearStoredSession();
          if (!cancelled) {
            setSessionInfo({ signedIn: false });
            setAuthMessage("Saved login expired. Sign in again.");
          }
          return;
        }
        if (!cancelled) {
          setSettings((current) => ({
            ...current,
            adminCookie: cookie,
            adminEmail: email ?? session.user?.email ?? current.adminEmail
          }));
          const meta = await saveSessionMeta(session.user?.email ?? email ?? nextSettings.adminEmail);
          setSessionMeta(meta);
          setSessionInfo(session);
        }
      } catch {
        await clearStoredSession();
        if (!cancelled) {
          setSessionInfo({ signedIn: false });
          setAuthMessage("Saved login could not be restored. Sign in again.");
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }
    restoreSavedSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    new SuperPrintClient(settings)
      .getPublic<PlatformTheme>("/api/platform/theme")
      .then((platformTheme) => {
        if (cancelled) return;
        setSettings((current) => ({
          ...current,
          primaryColor: normalizePrimaryColor(platformTheme.primaryColor)
        }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [settings.apiBaseUrl]);

  async function finishSignIn(cookie: string, emailFallback?: string) {
    const nextSettings = { ...settings, adminCookie: cookie, adminEmail: emailFallback ?? settings.adminEmail };
    const session = await new SuperPrintClient(nextSettings).get<MobileSessionInfo>("/api/admin/mobile-session");
    if (!session.signedIn || !session.user?.adminAllowed) throw new Error("Signed in, but this account is not allowed to use SuperPrint admin.");
    await SecureStore.setItemAsync(secureSessionKey, cookie, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    await SecureStore.setItemAsync(secureEmailKey, session.user.email, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    const meta = await saveSessionMeta(session.user.email);
    setSessionMeta(meta);
    setSettings((current) => ({
      ...current,
      adminCookie: cookie,
      adminEmail: session.user?.email ?? emailFallback ?? current.adminEmail,
      adminPassword: ""
    }));
    setSessionInfo(session);
    setLocalAuth((current) => ({ ...current, unlocked: true, message: "" }));
    setAuthMessage("");
    setScreen("dashboard");
    return session;
  }

  async function signOut() {
    await clearStoredSession();
    setSettings((current) => ({ ...current, adminCookie: "", adminPassword: "" }));
    setSessionInfo({ signedIn: false });
    setSessionMeta(null);
    setLocalAuth((current) => ({ ...current, unlocked: false, message: "" }));
    setScreen("settings");
  }

  const signedIn = Boolean(sessionInfo?.signedIn && sessionInfo.user?.adminAllowed && settings.adminCookie);
  const locked = signedIn && !localAuth.unlocked;

  async function unlockAdmin() {
    const result = await runLocalAdminUnlock();
    setLocalAuth((current) => ({
      ...current,
      supported: result.supported,
      enrolled: result.enrolled,
      label: result.label,
      unlocked: result.success,
      message: result.message
    }));
  }

  if (authLoading) {
    return <LoadingShell activeAppearance={activeAppearance} message="Loading secure session..." />;
  }

  return (
    <StripeProvider publishableKey={settings.publishableKey}>
      <StripeTerminalProvider tokenProvider={tokenProvider}>
        {locked ? (
          <BiometricLockScreen
            activeAppearance={activeAppearance}
            sessionInfo={sessionInfo}
            sessionMeta={sessionMeta}
            localAuth={localAuth}
            onUnlock={unlockAdmin}
            onSignOut={signOut}
          />
        ) : signedIn ? (
          <AppShell screen={screen} setScreen={setScreen} settings={settings} setSettings={setSettings} client={client} activeAppearance={activeAppearance} sessionInfo={sessionInfo} sessionMeta={sessionMeta} onSignOut={signOut} />
        ) : (
          <AuthScreen settings={settings} setSettings={setSettings} activeAppearance={activeAppearance} authMessage={authMessage} finishSignIn={finishSignIn} />
        )}
      </StripeTerminalProvider>
    </StripeProvider>
  );
}

async function clearStoredSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(secureSessionKey),
    SecureStore.deleteItemAsync(secureEmailKey),
    SecureStore.deleteItemAsync(secureSessionMetaKey)
  ]);
}

async function saveSessionMeta(email: string): Promise<StoredSessionMeta> {
  const existing = await readStoredSessionMeta();
  const now = new Date().toISOString();
  const meta = {
    email,
    savedAt: existing?.savedAt ?? now,
    lastValidatedAt: now
  };
  await SecureStore.setItemAsync(secureSessionMetaKey, JSON.stringify(meta), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return meta;
}

async function readStoredSessionMeta(): Promise<StoredSessionMeta | null> {
  const raw = await SecureStore.getItemAsync(secureSessionMetaKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSessionMeta>;
    if (!parsed.email || !parsed.savedAt || !parsed.lastValidatedAt) return null;
    return {
      email: parsed.email,
      savedAt: parsed.savedAt,
      lastValidatedAt: parsed.lastValidatedAt
    };
  } catch {
    return null;
  }
}

async function runLocalAdminUnlock() {
  const [supported, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => [])
  ]);
  const label = localAuthLabel(types);
  if (!supported) {
    return { success: true, supported, enrolled, label, message: "No biometric hardware was found, so the saved admin session was unlocked on this device." };
  }
  if (!enrolled) {
    return { success: false, supported, enrolled, label, message: "Set up Face ID or a device passcode before opening the saved admin session." };
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock SuperPrint Admin",
    fallbackLabel: "Use Passcode",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
    biometricsSecurityLevel: "strong"
  });
  if (result.success) {
    return { success: true, supported, enrolled, label, message: "" };
  }
  return {
    success: false,
    supported,
    enrolled,
    label,
    message: authErrorMessage(result.error)
  };
}

function localAuthLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID";
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "Touch ID";
  return "Device passcode";
}

function authErrorMessage(error?: string) {
  if (error === "user_cancel" || error === "system_cancel" || error === "app_cancel") return "Admin unlock was canceled.";
  if (error === "lockout") return "Too many attempts. Use your device passcode or try again in a moment.";
  if (error === "not_enrolled") return "Set up Face ID or a device passcode before opening the saved admin session.";
  if (error === "passcode_not_set") return "Set a device passcode before opening the saved admin session.";
  return "Could not unlock the admin session.";
}

function LoadingShell({ activeAppearance, message }: { activeAppearance: ActiveAppearance; message: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={activeAppearance === "dark" ? "light" : "dark"} />
      <View style={[styles.screenBody, styles.centerPane]}>
        <Image source={activeAppearance === "dark" ? brandLockupDark : brandLockupLight} style={styles.loginLogo} resizeMode="contain" />
        <ActivityIndicator color={palette.cyan} />
        <Text style={styles.cardCopy}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

function BiometricLockScreen({
  activeAppearance,
  sessionInfo,
  sessionMeta,
  localAuth,
  onUnlock,
  onSignOut
}: {
  activeAppearance: ActiveAppearance;
  sessionInfo: MobileSessionInfo | null;
  sessionMeta: StoredSessionMeta | null;
  localAuth: LocalAuthState;
  onUnlock: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    void unlock();
  }, []);

  async function unlock() {
    setUnlocking(true);
    try {
      await onUnlock();
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={activeAppearance === "dark" ? "light" : "dark"} />
      <View style={[styles.screenBody, styles.centerPane]}>
        <Image source={activeAppearance === "dark" ? brandLockupDark : brandLockupLight} style={styles.loginLogo} resizeMode="contain" />
        <View style={styles.lockBadge}>
          <ScanFace size={34} color={palette.cyan} strokeWidth={2.5} />
        </View>
        <Text style={styles.kicker}>Secure Session</Text>
        <Text style={styles.h1}>Unlock Admin</Text>
        <Text style={styles.copy}>
          {sessionInfo?.user?.email ?? sessionMeta?.email ?? "Your saved admin session"} is saved securely. Use {localAuth.label} or device passcode to continue.
        </Text>
        <View style={styles.readOnlyPanel}>
          <InfoRow label="Saved session" value={sessionMeta?.email ?? sessionInfo?.user?.email ?? "Admin"} />
          <InfoRow label="Last checked" value={sessionMeta?.lastValidatedAt ? new Date(sessionMeta.lastValidatedAt).toLocaleString() : "Just now"} />
          <InfoRow label="Device security" value={localAuth.supported ? (localAuth.enrolled ? localAuth.label : "Not enrolled") : "No biometric hardware"} />
        </View>
        <Pressable onPress={unlock} disabled={unlocking} style={[styles.primaryButton, unlocking && styles.disabled]}>
          {unlocking ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>Unlock with {localAuth.label}</Text>}
        </Pressable>
        <Pressable onPress={onSignOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Use Different Account</Text>
        </Pressable>
        {localAuth.message ? <Text style={styles.message}>{localAuth.message}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

function AuthScreen({
  settings,
  setSettings,
  activeAppearance,
  authMessage,
  finishSignIn
}: {
  settings: AdminSettings;
  setSettings: (settings: AdminSettings) => void;
  activeAppearance: ActiveAppearance;
  authMessage: string;
  finishSignIn: (cookie: string, emailFallback?: string) => Promise<MobileSessionInfo>;
}) {
  const client = useMemo(() => new SuperPrintClient(settings), [settings]);
  const [signingIn, setSigningIn] = useState(false);
  const [status, setStatus] = useState(authMessage);

  useEffect(() => {
    setStatus(authMessage);
  }, [authMessage]);

  async function signIn() {
    if (!settings.adminEmail.trim() || !settings.adminPassword.trim()) {
      setStatus("Email and password are required.");
      return;
    }
    setSigningIn(true);
    setStatus("Signing in...");
    try {
      const cookie = await client.signIn(settings.adminEmail, settings.adminPassword);
      const session = await finishSignIn(cookie, settings.adminEmail);
      setStatus(sessionStatusForSettings(session, { ...settings, adminEmail: session.user?.email ?? settings.adminEmail }));
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
      const session = await finishSignIn(cookie, credential.email ?? settings.adminEmail);
      setStatus(sessionStatus(session));
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={activeAppearance === "dark" ? "light" : "dark"} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
        <ScrollView style={styles.screen} contentContainerStyle={[styles.screenBody, styles.loginBody]}>
          <Image source={activeAppearance === "dark" ? brandLockupDark : brandLockupLight} style={styles.loginLogo} resizeMode="contain" />
          <Text style={styles.kicker}>Owner Admin</Text>
          <Text style={styles.h1}>Sign In</Text>
          <Text style={styles.copy}>Use your SuperPrint admin account. The session is saved in iOS secure storage so you do not have to sign in every time.</Text>
          <Card>
            <Field label="API base URL" value={settings.apiBaseUrl} onChangeText={(apiBaseUrl) => setSettings({ ...settings, apiBaseUrl })} autoCapitalize="none" />
            <View style={styles.inline}>
              <Pressable onPress={() => setSettings({ ...settings, apiBaseUrl: "https://print.superk.studio" })} style={[styles.secondaryButton, styles.grow]}>
                <Text style={styles.secondaryButtonText}>Use Production</Text>
              </Pressable>
              <Pressable onPress={() => setSettings({ ...settings, apiBaseUrl: "http://192.168.10.104:3000" })} style={[styles.secondaryButton, styles.grow]}>
                <Text style={styles.secondaryButtonText}>Use Localhost</Text>
              </Pressable>
            </View>
            <Pressable onPress={signInApple} style={styles.primaryButton}>
              {signingIn ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>Sign in with Apple</Text>}
            </Pressable>
            <Field label="Admin email" value={settings.adminEmail} onChangeText={(adminEmail) => setSettings({ ...settings, adminEmail })} autoCapitalize="none" keyboardType="email-address" />
            <Field label="Admin password" value={settings.adminPassword} onChangeText={(adminPassword) => setSettings({ ...settings, adminPassword })} secureTextEntry />
            <Pressable onPress={signIn} style={styles.primaryButton}>
              {signingIn ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>Sign In</Text>}
            </Pressable>
            {status ? <Text style={styles.message}>{status}</Text> : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AppShell({
  screen,
  setScreen,
  settings,
  setSettings,
  client,
  activeAppearance,
  sessionInfo,
  sessionMeta,
  onSignOut
}: {
  screen: ScreenKey;
  setScreen: (screen: ScreenKey) => void;
  settings: AdminSettings;
  setSettings: (settings: AdminSettings) => void;
  client: SuperPrintClient;
  activeAppearance: ActiveAppearance;
  sessionInfo: MobileSessionInfo | null;
  sessionMeta: StoredSessionMeta | null;
  onSignOut: () => Promise<void>;
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
        {screen === "settings" && <SettingsScreen settings={settings} setSettings={setSettings} sessionInfo={sessionInfo} sessionMeta={sessionMeta} onSignOut={onSignOut} />}
        {screen === "queue" && <QueueScreen client={client} />}
        {screen === "parts" && <PartsScreen client={client} />}
        {screen === "filament" && <FilamentScreen client={client} />}
        {screen === "merchants" && <MerchantsScreen client={client} />}
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
        {navItems.map((item) => {
          const Icon = navIcons[item.key];
          return (
            <Pressable key={item.key} onPress={() => onOpen(item.key)} style={styles.gridCard}>
              <DashboardIconBadge Icon={Icon} />
              <Text style={styles.gridTitle}>{item.title}</Text>
              <Text style={styles.gridDetail}>{item.detail}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function POSScreen({ client, settings, setSettings }: { client: SuperPrintClient; settings: AdminSettings; setSettings: (settings: AdminSettings) => void }) {
  const stripe = useStripe();
  const {
    initialize,
    easyConnect,
    retrievePaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
    setReaderDisplay,
    connectedReader,
    supportsReadersOfType
  } = useStripeTerminal({
    onDidAcceptTermsOfService: () => setMessage("Tap to Pay terms accepted."),
    onDidChangeConnectionStatus: (status) => setMessage(`Reader ${status}.`),
    onDidRequestReaderInput: (input) => setMessage(`Reader input: ${input.join(", ")}`),
    onDidRequestReaderDisplayMessage: (display) => setMessage(`Reader: ${display}`)
  });
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [stripePayments, setStripePayments] = useState<StripePaymentChoice[]>([]);
  const [stripePaymentLoading, setStripePaymentLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [flowStep, setFlowStep] = useState<PosFlowStep>("customer");
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>("PICKUP");
  const [estimatedPickupAt, setEstimatedPickupAt] = useState<Date | null>(null);
  const [address, setAddress] = useState({ street1: "", street2: "", city: "", state: "CO", zip: "", phone: "" });
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("UNPAID");
  const [paidNow, setPaidNow] = useState("0.00");
  const [expectedPaymentSelected, setExpectedPaymentSelected] = useState(false);
  const [expectedPaymentType, setExpectedPaymentType] = useState<ExpectedPaymentType>("CARD");
  const [paymentReference, setPaymentReference] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [manualTransactionId, setManualTransactionId] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [source, setSource] = useState<"IN_PERSON" | "PAST_IMPORT">("IN_PERSON");
  const [queueNow, setQueueNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const totalCents = lines.reduce((total, line) => total + cents(line.unitPrice) * positiveInt(line.quantity, 1), 0) + (shippingQuote?.shippingAmountCents ?? 0);
  const paidNowCents = cents(paidNow);
  const recordsPastStripePayment = source === "PAST_IMPORT" && paymentMethod === "STRIPE_MANUAL";
  const displayPaidCents = paymentMethod === "CASH" || recordsPastStripePayment ? totalCents : paidNowCents;
  const displayBalanceCents = Math.max(0, totalCents - displayPaidCents);
  const activeStepIndex = posFlowSteps.findIndex((step) => step.key === flowStep);

  useEffect(() => {
    initialize().catch(() => undefined);
  }, [initialize]);

  useEffect(() => {
    if (settings.publishableKey) return;
    client.get<{ publishableKey: string | null; terminalLocationId: string | null; configured: boolean; mode: string }>("/api/admin/pos/terminal/config")
      .then((config) => {
        if (!config.publishableKey && !config.terminalLocationId) return;
        setSettings({
          ...settings,
          publishableKey: config.publishableKey ?? settings.publishableKey,
          terminalLocationId: config.terminalLocationId ?? settings.terminalLocationId,
          stripeConfigured: config.configured,
          stripeMode: config.mode
        });
      })
      .catch(() => undefined);
  }, [client, settings.publishableKey, setSettings]);

  useEffect(() => {
    setProductLoading(true);
    client.get<{ products: ProductOption[] }>("/api/admin/products")
      .then((response) => {
        setProducts(response.products);
        const first = response.products[0];
        if (first) setLines([newOrderLine(first)]);
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

  function selectOrderSource(nextSource: "IN_PERSON" | "PAST_IMPORT") {
    setSource(nextSource);
    setQueueNow(false);
    setStripePayments([]);
    if (nextSource === "PAST_IMPORT") {
      setFulfillmentMethod("PICKUP");
      selectPaymentMethod("STRIPE_MANUAL");
      setPaidNow((totalCents / 100).toFixed(2));
      setPaymentReference("");
      setManualTransactionId("");
    } else {
      selectPaymentMethod("UNPAID");
    }
  }

  function selectPaymentMethod(method: PosPaymentMethod) {
    setPaymentMethod(method);
    setMessage("");
    if (method === "UNPAID") {
      setPaidNow("0.00");
      setCardBrand("");
      setCardLast4("");
      setPaymentReference(expectedPaymentSelected ? `Expected ${expectedPaymentType.toLowerCase()} ${money(totalCents)}` : "");
      return;
    }
    if (method === "CASH") {
      setPaidNow((totalCents / 100).toFixed(2));
      setExpectedPaymentSelected(false);
      setCardBrand("");
      setCardLast4("");
      setPaymentReference("Cash");
      return;
    }
    if (method === "STRIPE_TERMINAL") {
      setPaidNow("0.00");
      setExpectedPaymentSelected(false);
      setPaymentReference("");
      setCardBrand("");
      setCardLast4("");
      return;
    }
    setPaidNow(source === "PAST_IMPORT" ? (totalCents / 100).toFixed(2) : "0.00");
    setExpectedPaymentSelected(false);
    setPaymentReference(manualTransactionId.trim());
  }

  function markExpectedPayment() {
    setExpectedPaymentSelected(true);
    setPaidNow("0.00");
    setPaymentReference(`Expected ${expectedPaymentType.toLowerCase()} ${money(totalCents)}`);
  }

  function selectExpectedPaymentType(type: ExpectedPaymentType) {
    setExpectedPaymentType(type);
    if (expectedPaymentSelected) {
      setPaymentReference(`Expected ${type.toLowerCase()} ${money(totalCents)}`);
    }
  }

  function markManualTransactionComplete() {
    const transactionId = manualTransactionId.trim();
    if (!transactionId) {
      setMessage("Enter the Stripe transaction id first.");
      return;
    }
    setPaymentReference(transactionId);
    setPaidNow((totalCents / 100).toFixed(2));
    setMessage(`Manual transaction ${transactionId} is ready to confirm.`);
  }

  async function loadStripePayments() {
    const email = customerEmail.trim();
    if (!email) {
      setMessage("Enter the customer email first.");
      return;
    }
    setStripePaymentLoading(true);
    setMessage("Loading paid Stripe payments...");
    try {
      const response = await client.get<{ payments: StripePaymentChoice[] }>(`/api/admin/pos/stripe-payments?email=${encodeURIComponent(email)}`);
      setStripePayments(response.payments);
      setMessage(response.payments.length ? "Select the Stripe payment to attach." : "No paid Stripe payments found for this customer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load Stripe payments.");
    } finally {
      setStripePaymentLoading(false);
    }
  }

  function selectStripePayment(payment: StripePaymentChoice) {
    setManualTransactionId(payment.id);
    setPaymentReference(payment.id);
    setPaidNow((totalCents / 100).toFixed(2));
    setCardBrand(payment.cardBrand ?? "");
    setCardLast4(payment.cardLast4 ?? "");
    setMessage(`Stripe payment ${payment.id} selected.`);
  }

  function goToStep(step: PosFlowStep) {
    setFlowStep(step);
  }

  function goNext() {
    setFlowStep(posFlowSteps[Math.min(posFlowSteps.length - 1, activeStepIndex + 1)]?.key ?? "review");
  }

  function goBack() {
    setFlowStep(posFlowSteps[Math.max(0, activeStepIndex - 1)]?.key ?? "customer");
  }

  async function quoteShipping() {
    const firstLine = lines[0];
    if (!firstLine) return;
    setSaving(true);
    setMessage("Estimating fulfillment...");
    try {
      const quote = await client.post<ShippingQuote>("/api/admin/pos/shipping/quote", {
        productId: firstLine.productId,
        quantity: positiveInt(firstLine.quantity, 1),
        productPriceCents: Math.max(0, totalCents - (shippingQuote?.shippingAmountCents ?? 0)),
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
    if (!lines.length) {
      setMessage("Add at least one product.");
      return;
    }
    if (recordsPastStripePayment && !paymentReference.trim()) {
      setMessage("Select a Stripe payment or enter the payment intent reference.");
      setFlowStep("payment");
      return;
    }
    setSaving(true);
    setMessage("Saving order...");
    try {
      const paidCents = paymentMethod === "CASH" || recordsPastStripePayment ? totalCents : cents(paidNow);
      const response = await client.post<{ order: { orderNumber: string } }>("/api/admin/pos", {
        ...buildOrderPayload(),
        paymentMethod,
        amountPaidCents: paidCents,
        depositCents: paidCents,
        paymentReference: paymentReference.trim() || null,
        cardBrand: cardBrand.trim() || null,
        cardLast4: cardLast4.replace(/\D/g, "").slice(0, 4) || null
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
    setMessage("Loading Stripe card payment...");
    try {
      if (!settings.publishableKey) {
        const config = await client.get<{ publishableKey: string | null; terminalLocationId: string | null; configured: boolean; mode: string }>("/api/admin/pos/terminal/config");
        if (!config.publishableKey || !config.configured) throw new Error("Stripe card payments are not configured yet.");
        setSettings({
          ...settings,
          publishableKey: config.publishableKey,
          terminalLocationId: config.terminalLocationId ?? settings.terminalLocationId,
          stripeConfigured: config.configured,
          stripeMode: config.mode
        });
        setMessage("Stripe card payments are loaded. Tap Charge Card again.");
        return;
      }
      setMessage("Creating Stripe manual card payment...");
      const started = await client.post<{ order: { id: string; orderNumber: string; stripePaymentIntentId?: string | null }; clientSecret: string; publishableKey: string | null }>("/api/admin/pos/manual/payment-intent", buildOrderPayload());
      if (started.publishableKey && started.publishableKey !== settings.publishableKey) {
        setSettings({ ...settings, publishableKey: started.publishableKey, stripeConfigured: true });
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

  async function ensureTapToPayReady() {
    let terminalLocationId = settings.terminalLocationId;
    if (!terminalLocationId) {
      setMessage("Loading payment configuration...");
      const config = await client.get<{ publishableKey: string | null; terminalLocationId: string | null; configured: boolean; mode: string }>("/api/admin/pos/terminal/config");
      terminalLocationId = config.terminalLocationId ?? "";
      setSettings({
        ...settings,
        publishableKey: config.publishableKey ?? settings.publishableKey,
        terminalLocationId,
        stripeConfigured: config.configured,
        stripeMode: config.mode
      });
    }
    if (!terminalLocationId) throw new Error("Add a Stripe Terminal location ID in Settings before using Tap to Pay on iPhone.");

    const support = await supportsReadersOfType({ discoveryMethod: "tapToPay", deviceType: "tapToPay" });
    if (!support.readerSupportResult) {
      throw new Error("Tap to Pay on iPhone requires a compatible iPhone running a supported iOS version.");
    }
    if (connectedReader) return terminalLocationId;

    setMessage("Initializing Tap to Pay on iPhone...");
    const connected = await easyConnect({
      discoveryMethod: "tapToPay",
      locationId: terminalLocationId,
      merchantDisplayName: "SuperPrint",
      tosAcceptancePermitted: true,
      autoReconnectOnUnexpectedDisconnect: true
    });
    if (connected.error) throw new Error(connected.error.message);
    return terminalLocationId;
  }

  async function chargeTapToPay() {
    if (!customerName.trim() || !customerEmail.trim() || !lines.length) {
      setMessage("Customer, email, and product are required.");
      return;
    }
    setSaving(true);
    let started: { order: { id: string; orderNumber: string; stripePaymentIntentId?: string | null }; clientSecret: string } | null = null;
    try {
      await ensureTapToPayReady();
      setMessage("Creating order and preparing Tap to Pay on iPhone...");
      started = await client.post<{ order: { id: string; orderNumber: string; stripePaymentIntentId?: string | null }; clientSecret: string }>("/api/admin/pos/terminal/payment-intent", {
        ...buildOrderPayload(),
        savePaymentMethod: true
      });
      const display = await setReaderDisplay({
        currency: "usd",
        tax: 0,
        total: totalCents,
        lineItems: lines.map((line) => {
          const product = productFor(line, products);
          const quantity = positiveInt(line.quantity, 1);
          return {
            displayName: product?.name ?? "SuperPrint item",
            quantity,
            amount: cents(line.unitPrice) * quantity
          };
        })
      });
      if (display.error) setMessage(display.error.message);

      const retrieved = await retrievePaymentIntent(started.clientSecret);
      if (retrieved.error || !retrieved.paymentIntent) throw new Error(retrieved.error?.message ?? "Could not retrieve payment.");
      setMessage("Waiting for customer to present a contactless card or wallet...");
      const collected = await collectPaymentMethod({
        paymentIntent: retrieved.paymentIntent,
        customerCancellation: "enableIfAvailable",
        allowRedisplay: "limited"
      });
      if (collected.error || !collected.paymentIntent) throw new Error(collected.error?.message ?? "Could not collect payment method.");
      setMessage("Processing payment...");
      const confirmed = await confirmPaymentIntent({ paymentIntent: collected.paymentIntent });
      if (confirmed.error || !confirmed.paymentIntent) throw new Error(confirmed.error?.message ?? "Could not confirm payment.");
      const paymentIntentId = confirmed.paymentIntent.id ?? started.order.stripePaymentIntentId;
      if (!paymentIntentId) throw new Error("Stripe did not return the payment intent id.");
      const completed = await client.post<{ order: { orderNumber: string } }>("/api/admin/pos/terminal/complete", {
        orderId: started.order.id,
        paymentIntentId,
        queueNow
      });
      setMessage(`Approved ${completed.order.orderNumber}. Digital receipt is sent to ${customerEmail}.`);
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Tap to Pay payment failed.";
      const paymentIntentId = started?.order.stripePaymentIntentId;
      if (started?.order.id && paymentIntentId) {
        await client.post<{ order: { orderNumber: string } }>("/api/admin/pos/terminal/cancel", {
          orderId: started.order.id,
          paymentIntentId,
          reason: failure
        }).catch(() => undefined);
      }
      setMessage(paymentIntentId ? `${failure} The unpaid checkout was canceled.` : failure);
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
    const paymentNotes = [
      expectedPaymentSelected && paymentMethod === "UNPAID" ? `Expected ${expectedPaymentType.toLowerCase()} payment: ${money(totalCents)}` : null,
      manualTransactionId.trim() && paymentMethod === "STRIPE_MANUAL" ? `Manual transaction id: ${manualTransactionId.trim()}` : null
    ].filter(Boolean);
    return {
      customerName,
      customerEmail,
      internalNotes: [internalNotes.trim(), ...paymentNotes, "Created in SuperPrint Admin iOS"].filter(Boolean).join("\n"),
      orderDate: orderDate || null,
      source,
      queueNow,
      estimatedPickupAt: estimatedPickupAt ? estimatedPickupAt.toISOString() : null,
      fulfillment: {
        method: fulfillmentMethod,
        address: fulfillmentAddress()
      },
      shippingAmountCents: shippingQuote?.shippingAmountCents ?? 0,
      shippingRateCents: shippingQuote?.shippingRateCents ?? 0,
      shippoRateId: shippingQuote?.rateId ?? null,
      shippoShipmentId: shippingQuote?.shippoShipmentId ?? null,
      lines: lines.map((line) => {
        const product = productFor(line, products);
        const slotCount = Math.max(1, product?.colorSlotCount ?? 1);
        const selectedIds = line.selectedFilamentMaterialIds.slice(0, slotCount);
        const selectedColors = Array.from({ length: slotCount }, (_, index) => {
          const selectedId = selectedIds[index] ?? selectedIds[0] ?? "";
          const allowed = product?.allowedFilaments?.find((item) => item.filamentMaterialId === selectedId);
          return line.selectedColors[index]?.trim() || allowed?.filamentMaterial.color || "";
        }).filter(Boolean);
        return {
          productId: line.productId,
          quantity: positiveInt(line.quantity, 1),
          printedQuantity: source === "PAST_IMPORT" ? 0 : Math.min(positiveInt(line.quantity, 1), nonNegativeInt(line.printedQuantity, 0)),
          unitPriceCents: cents(line.unitPrice),
          selectedFilamentMaterialIds: selectedIds.filter(Boolean),
          selectedColors
        };
      })
    };
  }

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const next = { ...line, ...patch };
      if (patch.productId) {
        const product = products.find((item) => item.id === patch.productId);
        if (product) return newOrderLine(product, next.quantity);
      }
      return next;
    }));
    setShippingQuote(null);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Take Order" detail="" />

      <View style={styles.flowHero}>
        <View style={styles.modeGrid}>
          <Pressable onPress={() => selectOrderSource("IN_PERSON")} style={[styles.modeCard, source === "IN_PERSON" && styles.modeCardActive]}>
            <AppIconBadge Icon={Plus} small />
            <Text style={[styles.modeTitle, source === "IN_PERSON" && styles.modeTitleActive]}>New order</Text>
          </Pressable>
          <Pressable onPress={() => selectOrderSource("PAST_IMPORT")} style={[styles.modeCard, source === "PAST_IMPORT" && styles.modeCardActive]}>
            <AppIconBadge Icon={History} small />
            <Text style={[styles.modeTitle, source === "PAST_IMPORT" && styles.modeTitleActive]}>Past print</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepRail}>
        {posFlowSteps.map((step, index) => {
          const StepIcon = step.icon;
          return (
            <Pressable key={step.key} onPress={() => goToStep(step.key)} style={[styles.stepPill, flowStep === step.key && styles.stepPillActive]}>
              <StepIcon size={16} color={flowStep === step.key ? palette.actionText : palette.cyanDark} strokeWidth={2.5} />
              <Text style={[styles.stepLabel, flowStep === step.key && styles.stepLabelActive]}>{index + 1}. {step.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {flowStep === "customer" ? (
        <Card>
          <View style={styles.orderTop}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>Customer</Text>
            </View>
            <AppIconBadge Icon={IdCard} small />
          </View>
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
        <Field label="Customer name (optional)" value={customerName} onChangeText={setCustomerName} />
        <Field label="Email (optional)" value={customerEmail} onChangeText={setCustomerEmail} keyboardType="email-address" autoCapitalize="none" />
          <FlowNav onBack={goBack} onNext={goNext} backDisabled={activeStepIndex === 0} nextLabel="Choose Items" />
        </Card>
      ) : null}

      {flowStep === "items" ? (
        <Card>
          <View style={styles.orderTop}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>Items + colors</Text>
            </View>
            <AppIconBadge Icon={Boxes} small />
          </View>
        {productLoading ? <ActivityIndicator color={palette.cyanDark} /> : null}
        {lines.map((line, index) => {
          const product = productFor(line, products);
          const slotCount = Math.max(1, product?.colorSlotCount ?? 1);
          return (
            <View key={index} style={styles.actionItem}>
              <Text style={styles.cardTitle}>Item {index + 1}</Text>
              <Text style={styles.label}>Product</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRail}>
                {products.map((item) => (
                  <Pressable key={item.id} onPress={() => updateLine(index, { productId: item.id })} style={[styles.productChip, line.productId === item.id && styles.productChipActive]}>
                    <Text style={[styles.productChipTitle, line.productId === item.id && styles.productChipTitleActive]}>{item.name}</Text>
                    <Text style={[styles.productChipMeta, line.productId === item.id && styles.productChipMetaActive]}>{money(item.priceCents)} · {Math.max(1, item.colorSlotCount ?? 1)} color</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {!products.length && !productLoading ? <Field label="Product ID" value={line.productId} onChangeText={(productId) => updateLine(index, { productId })} autoCapitalize="none" /> : null}
              <View style={styles.inline}>
                <Field label="Qty" value={line.quantity} onChangeText={(quantity) => updateLine(index, { quantity })} keyboardType="number-pad" grow />
                <Field label="Unit price" value={line.unitPrice} onChangeText={(unitPrice) => updateLine(index, { unitPrice })} keyboardType="decimal-pad" grow />
              </View>
              {source !== "PAST_IMPORT" ? (
                <Field
                  label="Already printed"
                  value={line.printedQuantity}
                  onChangeText={(printedQuantity) => updateLine(index, { printedQuantity })}
                  keyboardType="number-pad"
                />
              ) : null}
              <ProductionEstimatePanel line={line} product={product} />
              {Array.from({ length: slotCount }, (_, slotIndex) => {
                const allowed = product?.allowedFilaments ?? [];
                return (
                  <View key={slotIndex} style={styles.field}>
                    <Text style={styles.label}>{slotCount === 1 ? "Filament / color" : `Filament ${slotIndex + 1}`}</Text>
                    {allowed.length ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
                        {allowed.map((item) => {
                          const active = (line.selectedFilamentMaterialIds[slotIndex] ?? line.selectedFilamentMaterialIds[0]) === item.filamentMaterialId;
                          return (
                            <Pressable key={item.filamentMaterialId} onPress={() => {
                              const selectedFilamentMaterialIds = [...line.selectedFilamentMaterialIds];
                              const selectedColors = [...line.selectedColors];
                              selectedFilamentMaterialIds[slotIndex] = item.filamentMaterialId;
                              selectedColors[slotIndex] = item.filamentMaterial.color;
                              updateLine(index, { selectedFilamentMaterialIds, selectedColors });
                            }} style={[styles.choiceChip, active && styles.choiceChipActive]}>
                              <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{item.filamentMaterial.color} {item.filamentMaterial.material.replace("_PLUS", "+")}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    ) : (
                      <Field label="Color / material" value={line.selectedColors[slotIndex] ?? ""} onChangeText={(value) => {
                        const selectedColors = [...line.selectedColors];
                        selectedColors[slotIndex] = value;
                        updateLine(index, { selectedColors });
                      }} />
                    )}
                  </View>
                );
              })}
              {lines.length > 1 ? (
                <Pressable disabled={saving} onPress={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} style={styles.dangerButton}>
                  <Text style={styles.dangerButtonText}>Remove Item</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {products[0] ? (
          <Pressable disabled={saving} onPress={() => setLines((current) => [...current, newOrderLine(products[0])])} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Add Item</Text>
          </Pressable>
        ) : null}
          <FlowNav onBack={goBack} onNext={goNext} backDisabled={false} nextLabel="Fulfillment" />
        </Card>
      ) : null}

      {flowStep === "fulfillment" ? (
        <Card>
          <View style={styles.orderTop}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>Fulfillment</Text>
            </View>
            <AppIconBadge Icon={PackageCheck} small />
          </View>
        <View style={styles.segment}>
          {(["PICKUP", "SHIP"] as const).map((method) => (
            <Pressable key={method} onPress={() => { setFulfillmentMethod(method); setShippingQuote(null); }} style={[styles.segmentItem, fulfillmentMethod === method && styles.segmentItemActive]}>
              <Text style={[styles.segmentText, fulfillmentMethod === method && styles.segmentTextActive]}>{method}</Text>
            </Pressable>
          ))}
        </View>
        {fulfillmentMethod === "PICKUP" ? (
          <PickupTimeSelector
            value={estimatedPickupAt}
            onChange={setEstimatedPickupAt}
          />
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
          <FlowNav onBack={goBack} onNext={goNext} backDisabled={false} nextLabel="Payment Plan" />
        </Card>
      ) : null}

      {flowStep === "payment" ? (
        <Card>
          <View style={styles.orderTop}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>Payment</Text>
            </View>
            <AppIconBadge Icon={CircleDollarSign} small />
          </View>

          <View style={styles.paymentGrid}>
            {paymentOptions.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => selectPaymentMethod(option.key)}
                style={[styles.paymentTile, paymentMethod === option.key && styles.paymentTileActive]}
              >
                <PaymentIconBadge Icon={option.icon} active={paymentMethod === option.key} small />
                <Text style={[styles.paymentTileTitle, paymentMethod === option.key && styles.paymentTileTitleActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.paymentPanel}>
            {paymentMethod === "UNPAID" ? (
              <>
                <View style={styles.orderTop}>
                  <View style={styles.grow}>
                    <Text style={styles.cardTitle}>Pay on delivery</Text>
                  </View>
                  <Text style={styles.money}>{money(totalCents)}</Text>
                </View>
                <View style={styles.iconChoiceRow}>
                  {expectedPaymentOptions.map((option) => (
                    <Pressable
                      key={option.key}
                      onPress={() => selectExpectedPaymentType(option.key)}
                      style={[styles.iconChoice, expectedPaymentType === option.key && styles.iconChoiceActive]}
                    >
                      <PaymentIconBadge Icon={option.icon} active={expectedPaymentType === option.key} small />
                      <Text style={[styles.iconChoiceText, expectedPaymentType === option.key && styles.iconChoiceTextActive]}>{option.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={markExpectedPayment} style={[styles.secondaryButton, expectedPaymentSelected && styles.primaryButton]}>
                  <Text style={expectedPaymentSelected ? styles.primaryButtonText : styles.secondaryButtonText}>{expectedPaymentSelected ? `${formatExpectedPaymentType(expectedPaymentType)} On Delivery` : `Set ${formatExpectedPaymentType(expectedPaymentType)} On Delivery`}</Text>
                </Pressable>
              </>
            ) : null}

            {paymentMethod === "CASH" ? (
              <>
                <View style={styles.orderTop}>
                  <View style={styles.grow}>
                    <Text style={styles.cardTitle}>Cash sale</Text>
                  </View>
                  <Text style={styles.money}>{money(totalCents)}</Text>
                </View>
              </>
            ) : null}

            {paymentMethod === "STRIPE_TERMINAL" ? (
              <>
                <View style={styles.orderTop}>
                  <View style={styles.grow}>
                    <Text style={styles.cardTitle}>Tap to Pay</Text>
                  </View>
                  <Text style={styles.money}>{money(totalCents)}</Text>
                </View>
                <Pressable onPress={chargeTapToPay} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
                  {saving ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>Tap to Pay {money(totalCents)}</Text>}
                </Pressable>
              </>
            ) : null}

            {paymentMethod === "STRIPE_MANUAL" ? (
              <>
                <View style={styles.orderTop}>
                  <View style={styles.grow}>
                    <Text style={styles.cardTitle}>{source === "PAST_IMPORT" ? "Recorded Stripe payment" : "Manual card"}</Text>
                  </View>
                  <Text style={styles.money}>{money(totalCents)}</Text>
                </View>
                {source === "PAST_IMPORT" ? (
                  <>
                    <Pressable onPress={loadStripePayments} disabled={stripePaymentLoading || saving} style={[styles.secondaryButton, (stripePaymentLoading || saving) && styles.disabled]}>
                      {stripePaymentLoading ? <ActivityIndicator color={palette.cyanDark} /> : <Text style={styles.secondaryButtonText}>Load Paid Stripe Payments</Text>}
                    </Pressable>
                    {stripePayments.length ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRail}>
                        {stripePayments.map((payment) => {
                          const active = paymentReference === payment.id;
                          return (
                            <Pressable key={payment.id} onPress={() => selectStripePayment(payment)} style={[styles.historyCard, active && styles.historyCardActive]}>
                              <Text style={[styles.historyTitle, active && styles.historyTitleActive]} numberOfLines={2}>{payment.id}</Text>
                              <Text style={[styles.historyMeta, active && styles.historyMetaActive]}>{money(payment.amountCents)} · {payment.status}</Text>
                              <Text style={[styles.historyMeta, active && styles.historyMetaActive]}>{new Date(payment.created).toLocaleDateString()}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    ) : null}
                    <Text style={styles.cardCopy}>Past orders are recorded as already paid. No card will be charged.</Text>
                  </>
                ) : (
                  <Pressable onPress={chargeManualCard} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
                    {saving ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>Charge Card Securely</Text>}
                  </Pressable>
                )}
                <Field label={source === "PAST_IMPORT" ? "Payment intent / reference" : "Transaction id"} value={manualTransactionId} onChangeText={(value) => { setManualTransactionId(value); setPaymentReference(value); }} autoCapitalize="none" />
                <View style={styles.inline}>
                  <Field label="Card brand" value={cardBrand} onChangeText={setCardBrand} grow />
                  <Field label="Last 4" value={cardLast4} onChangeText={(value) => setCardLast4(value.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" grow />
                </View>
                <Pressable onPress={markManualTransactionComplete} disabled={saving} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>{source === "PAST_IMPORT" ? "Use Reference As Paid" : "Complete With Transaction ID"}</Text>
                </Pressable>
              </>
            ) : null}
          </View>

          <View style={styles.paymentSummary}>
            <InfoRow label="Total" value={money(totalCents)} />
            <InfoRow label="Paid on confirm" value={money(displayPaidCents)} />
            <InfoRow label="Balance after confirm" value={money(displayBalanceCents)} />
          </View>
          <View style={styles.inline}>
            {paymentMethod === "UNPAID" || (source === "PAST_IMPORT" && paymentMethod !== "STRIPE_MANUAL") ? (
              <Field label="Reference" value={paymentReference} onChangeText={setPaymentReference} grow />
            ) : null}
            <Field label="Order date" value={orderDate} onChangeText={setOrderDate} grow />
          </View>
          {paymentMethod === "UNPAID" ? null : (
            <View style={styles.switchRow}>
              <Text style={styles.label}>Queue paid items now</Text>
              <Switch value={queueNow} onValueChange={setQueueNow} />
            </View>
          )}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <FlowNav onBack={goBack} onNext={goNext} backDisabled={false} nextLabel="Review" />
        </Card>
      ) : null}

      {flowStep === "review" ? (
        <Card>
          <View style={styles.orderTop}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>Review + create</Text>
            </View>
            <AppIconBadge Icon={BadgeCheck} small />
          </View>
        <View style={styles.readOnlyPanel}>
          <InfoRow label="Mode" value={source === "PAST_IMPORT" ? "Past print import" : "New counter order"} />
          <InfoRow label="Customer" value={customerName || "Missing"} />
          <InfoRow label="Email" value={customerEmail || "Missing"} />
          <InfoRow label="Items" value={`${lines.length} line(s)`} />
          <InfoRow label="Fulfillment" value={fulfillmentMethod} />
          <InfoRow label="Payment" value={paymentMethod === "STRIPE_TERMINAL" ? "Tap to Pay" : paymentMethod.replace("STRIPE_", "")} />
          <InfoRow label="Total" value={money(totalCents)} />
          <InfoRow label="Paid" value={money(displayPaidCents)} />
          <InfoRow label="Balance" value={money(displayBalanceCents)} />
        </View>
        <Field label="Notes" value={internalNotes} onChangeText={setInternalNotes} multiline />
        <Pressable onPress={saveOrder} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
          {saving ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>{paymentMethod === "UNPAID" ? "Create Pay-on-Delivery Order" : "Confirm Order"}</Text>}
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
          <FlowNav onBack={goBack} onNext={goNext} backDisabled={false} nextDisabled nextLabel="Done" />
        </Card>
      ) : null}
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
        {loading ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>Refresh Orders</Text>}
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
  const [deliveryPaymentRefs, setDeliveryPaymentRefs] = useState<Record<string, string>>({});
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

  async function updateOrder(
    order: AdminOrder,
    action: "markPacking" | "markShipped" | "markDelivered" | "markPaidCashDelivered" | "markPaidReferenceDelivered",
    paymentReference?: string
  ) {
    setSavingKey(`${order.id}:${action}`);
    setMessage(`Updating ${order.orderNumber}...`);
    try {
      await client.post("/api/admin/orders", { orderId: order.id, action, paymentReference });
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
  const activeOrders = orders.filter((order) => order.orderSource !== "PAST_IMPORT");
  const readyToBuild = activeOrders.filter((order) => readyOrderNumbers.has(order.orderNumber) || orderItemsArePrinted(order)).filter((order) => !["PACKING", "SHIPPED", "DELIVERED"].includes(order.shippingStatus ?? ""));
  const deliveryOrders = activeOrders.filter((order) => ["PACKING", "LABEL_READY", "LABEL_PRINTED", "SHIPPED"].includes(order.shippingStatus ?? "") && order.shippingStatus !== "DELIVERED");
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
        deliveryOrders.length ? deliveryOrders.map((order) => {
          const balanceDue = order.balanceDueCents ?? Math.max(0, order.totalCents - (order.amountPaidCents ?? 0));
          const needsPayment = order.paymentStatus !== "PAID" || balanceDue > 0;
          const paymentRef = deliveryPaymentRefs[order.id] ?? "";
          return (
            <Card key={order.id}>
              <View style={styles.orderTop}>
                <View style={styles.grow}>
                  <Text style={styles.cardTitle}>{order.orderNumber}</Text>
                  <Text style={styles.cardCopy}>{order.customer?.email ?? "No customer email"} · {order.shippingStatus ?? "Ready"}</Text>
                </View>
                <Badge label={order.fulfillmentMethod ?? "FULFILL"} />
              </View>
              <View style={styles.badgeRow}>
                <Badge label={order.paymentStatus} />
                <Badge label={needsPayment ? `Due ${money(balanceDue || order.totalCents)}` : "Paid"} />
              </View>
              {needsPayment ? (
                <>
                  <Field
                    label="Stripe / card reference"
                    value={paymentRef}
                    onChangeText={(value) => setDeliveryPaymentRefs((current) => ({ ...current, [order.id]: value }))}
                    autoCapitalize="none"
                  />
                  <View style={styles.inline}>
                    <Pressable
                      disabled={Boolean(savingKey)}
                      onPress={() => updateOrder(order, "markPaidCashDelivered", "Cash on delivery")}
                      style={[styles.secondaryButton, styles.grow]}
                    >
                      <Text style={styles.secondaryButtonText}>Cash + Delivered</Text>
                    </Pressable>
                    <Pressable
                      disabled={Boolean(savingKey) || !paymentRef.trim()}
                      onPress={() => updateOrder(order, "markPaidReferenceDelivered", paymentRef.trim())}
                      style={[styles.primaryButton, styles.grow, !paymentRef.trim() && styles.disabled]}
                    >
                      <Text style={styles.primaryButtonText}>Ref + Delivered</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
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
              )}
            </Card>
          );
        }) : <Card><Text style={styles.cardCopy}>{message || "No deliveries are waiting."}</Text></Card>
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

function FilamentScreen({ client }: { client: SuperPrintClient }) {
  const emptyForm = {
    id: "",
    material: "PLA" as FilamentMaterial,
    color: "",
    brand: "",
    startingGrams: "1000",
    remainingGrams: "1000",
    thresholdGrams: "150",
    rollCostDollars: "20.00",
    location: "Stock",
    notes: ""
  };
  const [spools, setSpools] = useState<FilamentSpool[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showInactive, setShowInactive] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading filament inventory...");
  const [history, setHistory] = useState<PrinterHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistorySpoolId, setSelectedHistorySpoolId] = useState("");
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [historyPage, setHistoryPage] = useState(0);
  const historyPageSize = 20;
  const historyPageCount = Math.max(1, Math.ceil(history.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, historyPageCount - 1);
  const visibleHistory = history.slice(currentHistoryPage * historyPageSize, currentHistoryPage * historyPageSize + historyPageSize);

  useEffect(() => {
    void load();
  }, [client]);

  async function load() {
    setLoading(true);
    try {
      const response = await client.get<{ spools: FilamentSpool[] }>("/api/admin/filament");
      setSpools(response.spools);
      setMessage(response.spools.length ? "" : "No filament rolls in the system yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load filament.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!form.color.trim() || !form.brand.trim()) {
      setMessage("Color and brand are required.");
      return;
    }
    setSaving(true);
    setMessage(form.id ? "Updating filament roll..." : "Adding filament roll...");
    try {
      await client.post<{ spool: FilamentSpool }>("/api/admin/filament", {
        id: form.id || undefined,
        material: form.material,
        color: form.color.trim(),
        brand: form.brand.trim(),
        startingGrams: positiveInt(form.startingGrams, 1000),
        remainingGrams: nonNegativeInt(form.remainingGrams, 1000),
        thresholdGrams: nonNegativeInt(form.thresholdGrams, 150),
        rollCostCents: cents(form.rollCostDollars),
        location: form.location.trim() || "Stock",
        active: true,
        requiresAdminApproval: requiresApproval,
        notes: form.notes.trim() || null
      });
      setForm(emptyForm);
      setRequiresApproval(false);
      setMessage(form.id ? "Filament updated." : "Filament added.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save filament.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(spool: FilamentSpool) {
    setSaving(true);
    setMessage(`Removing ${spool.color} ${spool.material}...`);
    try {
      const response = await client.delete<{ removed: boolean; deactivated: boolean }>("/api/admin/filament", { id: spool.id });
      setMessage(response.removed ? "Filament removed." : "Filament is referenced by existing records, so it was deactivated.");
      if (form.id === spool.id) {
        setForm(emptyForm);
        setRequiresApproval(false);
      }
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove filament.");
    } finally {
      setSaving(false);
    }
  }

  async function pullHistory() {
    setHistoryLoading(true);
    setMessage("Pulling printer history...");
    try {
      const response = await client.post<{ completedPrints: PrinterHistoryItem[]; message: string }>("/api/admin/printer-history", {});
      setHistory(response.completedPrints);
      setHistoryPage(0);
      setMessage(response.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not pull printer history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function updateHistory(action: "assign" | "ignore" | "importCompleted", print: PrinterHistoryItem) {
    if (action !== "ignore" && !selectedHistorySpoolId) {
      setMessage("Choose a filament roll for this history action.");
      return;
    }
    setSaving(true);
    setMessage(action === "ignore" ? "Ignoring history row..." : "Updating filament from history...");
    try {
      const response = await client.patch<{ message: string }>("/api/admin/printer-history", {
        action,
        print,
        spoolId: action === "ignore" ? undefined : selectedHistorySpoolId
      });
      setMessage(response.message);
      setHistory((current) => current.filter((item) => item.id !== print.id));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update printer history.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignedHistory(spool: FilamentSpool, item: AssignedPrinterHistoryItem) {
    setSaving(true);
    setMessage(`Removing ${item.name} from ${spool.color}...`);
    try {
      const response = await client.patch<{ message: string }>("/api/admin/filament", {
        action: "removeHistory",
        spoolId: spool.id,
        historyId: item.id
      });
      setMessage(response.message);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove assigned history.");
    } finally {
      setSaving(false);
    }
  }

  async function moveAssignedHistory(spool: FilamentSpool, item: AssignedPrinterHistoryItem) {
    const targetSpoolId = moveTargets[item.id];
    if (!targetSpoolId) {
      setMessage("Choose the filament roll to move this history row to.");
      return;
    }
    setSaving(true);
    setMessage(`Moving ${item.name}...`);
    try {
      const response = await client.patch<{ message: string }>("/api/admin/filament", {
        action: "moveHistory",
        spoolId: spool.id,
        targetSpoolId,
        historyId: item.id
      });
      setMoveTargets((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setMessage(response.message);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not move assigned history.");
    } finally {
      setSaving(false);
    }
  }

  function edit(spool: FilamentSpool) {
    setForm({
      id: spool.id,
      material: spool.material,
      color: spool.color,
      brand: spool.brand,
      startingGrams: String(spool.startingGrams),
      remainingGrams: String(spool.remainingGrams),
      thresholdGrams: String(spool.thresholdGrams),
      rollCostDollars: (spool.rollCostCents / 100).toFixed(2),
      location: spool.location,
      notes: spool.notes ?? ""
    });
    setRequiresApproval(Boolean(spool.requiresAdminApproval));
    setMessage(`Editing ${spool.color} ${spool.material}.`);
  }

  const visibleSpools = spools.filter((spool) => showInactive || spool.active);
  const totalGrams = visibleSpools.reduce((total, spool) => total + spool.remainingGrams, 0);
  const lowCount = visibleSpools.filter((spool) => spool.remainingGrams <= spool.thresholdGrams).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Filament" detail="Add 1kg rolls, update existing stock, and pull printer history." />
      <LoadButton title="Refresh Filament" loading={loading} onPress={load} />
      <View style={styles.metricRow}>
        <Metric label="Active rolls" value={String(spools.filter((spool) => spool.active).length)} />
        <Metric label="In stock" value={`${(totalGrams / 1000).toFixed(1)}kg`} />
        <Metric label="Low rolls" value={String(lowCount)} />
        <Metric label="Materials" value={String(new Set(visibleSpools.map((spool) => spool.material)).size)} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>{form.id ? "Edit filament" : "Add 1kg filament roll"}</Text>
        <Text style={styles.cardCopy}>
          {form.id ? "Update the stock details for this roll." : "New rolls start at 1000g in Stock, matching the main admin app."}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
          {filamentMaterials.map((material) => (
            <Pressable key={material} onPress={() => setForm({ ...form, material })} style={[styles.choiceChip, form.material === material && styles.choiceChipActive]}>
              <Text style={[styles.choiceChipText, form.material === material && styles.choiceChipTextActive]}>{material.replace("_PLUS", "+")}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.inline}>
          <Field label="Color" value={form.color} onChangeText={(color) => setForm({ ...form, color })} grow />
          <Field label="Brand" value={form.brand} onChangeText={(brand) => setForm({ ...form, brand })} grow />
        </View>
        <View style={styles.inline}>
          <Field label="1kg roll cost" value={form.rollCostDollars} onChangeText={(rollCostDollars) => setForm({ ...form, rollCostDollars })} keyboardType="decimal-pad" grow />
          <Field label="Low alert grams" value={form.thresholdGrams} onChangeText={(thresholdGrams) => setForm({ ...form, thresholdGrams })} keyboardType="number-pad" grow />
        </View>
        {form.id ? (
          <>
            <View style={styles.inline}>
              <Field label="Start g" value={form.startingGrams} onChangeText={(startingGrams) => setForm({ ...form, startingGrams })} keyboardType="number-pad" grow />
              <Field label="Left g" value={form.remainingGrams} onChangeText={(remainingGrams) => setForm({ ...form, remainingGrams })} keyboardType="number-pad" grow />
              <Field label="Location" value={form.location} onChangeText={(location) => setForm({ ...form, location })} grow />
            </View>
            <Field label="Notes" value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} multiline />
            <View style={styles.switchRow}>
              <View style={styles.grow}>
                <Text style={styles.rowTitle}>Requires approval</Text>
                <Text style={styles.cardCopy}>Use for specialty filament customers should not freely select.</Text>
              </View>
              <Switch value={requiresApproval} onValueChange={setRequiresApproval} />
            </View>
          </>
        ) : (
          <View style={styles.summaryBand}>
            <Text style={styles.summaryText}>Starting grams: 1000</Text>
            <Text style={styles.summaryText}>Remaining grams: 1000</Text>
            <Text style={styles.summaryText}>Location: Stock</Text>
          </View>
        )}
        <View style={styles.inline}>
          {form.id ? (
            <Pressable onPress={() => { setForm(emptyForm); setRequiresApproval(false); }} style={[styles.secondaryButton, styles.grow]}>
              <Text style={styles.secondaryButtonText}>Cancel Edit</Text>
            </Pressable>
          ) : null}
          <Pressable disabled={saving} onPress={save} style={[styles.primaryButton, styles.grow, saving && styles.disabled]}>
            {saving ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>{form.id ? "Update Roll" : "Add 1kg Roll"}</Text>}
          </Pressable>
        </View>
      </Card>

      <Card>
        <View style={styles.orderTop}>
          <View style={styles.grow}>
            <Text style={styles.cardTitle}>Printer History</Text>
            <Text style={styles.cardCopy}>Pull completed, stopped, and failed prints, then assign grams to a roll or import old prints.</Text>
          </View>
          <Badge label={`${history.length} rows`} />
        </View>
        <Pressable disabled={historyLoading || saving} onPress={pullHistory} style={styles.secondaryButton}>
          {historyLoading ? <ActivityIndicator color={palette.cyanDark} /> : <Text style={styles.secondaryButtonText}>Pull Printer History</Text>}
        </Pressable>
        <Text style={styles.label}>Filament roll for history</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
          {spools.filter((spool) => spool.active).map((spool) => (
            <Pressable key={spool.id} onPress={() => setSelectedHistorySpoolId(spool.id)} style={[styles.choiceChip, selectedHistorySpoolId === spool.id && styles.choiceChipActive]}>
              <Text style={[styles.choiceChipText, selectedHistorySpoolId === spool.id && styles.choiceChipTextActive]}>{spool.color} {spool.material.replace("_PLUS", "+")}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {history.length > historyPageSize ? (
          <View style={styles.inline}>
            <Pressable disabled={currentHistoryPage === 0} onPress={() => setHistoryPage((page) => Math.max(0, page - 1))} style={[styles.secondaryButton, styles.grow, currentHistoryPage === 0 && styles.disabled]}>
              <Text style={styles.secondaryButtonText}>Previous</Text>
            </Pressable>
            <View style={[styles.summaryBand, styles.grow]}>
              <Text style={styles.summaryText}>Page {currentHistoryPage + 1} of {historyPageCount}</Text>
              <Text style={styles.summaryText}>{currentHistoryPage * historyPageSize + 1}-{Math.min(history.length, (currentHistoryPage + 1) * historyPageSize)} of {history.length}</Text>
            </View>
            <Pressable disabled={currentHistoryPage >= historyPageCount - 1} onPress={() => setHistoryPage((page) => Math.min(historyPageCount - 1, page + 1))} style={[styles.secondaryButton, styles.grow, currentHistoryPage >= historyPageCount - 1 && styles.disabled]}>
              <Text style={styles.secondaryButtonText}>Next</Text>
            </Pressable>
          </View>
        ) : null}
        {visibleHistory.length ? visibleHistory.map((print) => (
          <View key={print.id} style={styles.spoolRow}>
            <View style={styles.orderTop}>
              <View style={styles.grow}>
                <Text style={styles.rowTitle}>{print.name}</Text>
                <Text style={styles.cardCopy}>{print.status} · {typeof print.gramsUsed === "number" ? `${Math.round(print.gramsUsed)}g` : "no grams"}{print.completedAt ? ` · ${new Date(print.completedAt).toLocaleDateString()}` : ""}</Text>
              </View>
              <Badge label={print.gramsSource ?? print.material ?? "history"} />
            </View>
            <View style={styles.inline}>
              <Pressable disabled={saving || typeof print.gramsUsed !== "number"} onPress={() => updateHistory("assign", print)} style={[styles.secondaryButton, styles.grow]}>
                <Text style={styles.secondaryButtonText}>Assign</Text>
              </Pressable>
              <Pressable disabled={saving || typeof print.gramsUsed !== "number"} onPress={() => updateHistory("importCompleted", print)} style={[styles.primaryButton, styles.grow]}>
                <Text style={styles.primaryButtonText}>Import</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={() => updateHistory("ignore", print)} style={[styles.dangerButton, styles.grow]}>
                <Text style={styles.dangerButtonText}>Ignore</Text>
              </Pressable>
            </View>
          </View>
        )) : <Text style={styles.cardCopy}>No pulled printer history yet.</Text>}
      </Card>

      <Card>
        <View style={styles.switchRow}>
          <Text style={styles.cardTitle}>Inventory</Text>
          <View style={styles.inlineCenter}>
            <Text style={styles.cardCopy}>Inactive</Text>
            <Switch value={showInactive} onValueChange={setShowInactive} />
          </View>
        </View>
        {visibleSpools.length ? visibleSpools.map((spool) => {
          const percent = Math.min(100, Math.max(0, Math.round((spool.remainingGrams / Math.max(1, spool.startingGrams)) * 100)));
          const assignedHistory = Array.isArray(spool.assignedPrinterHistory) ? spool.assignedPrinterHistory : [];
          const assignedGrams = assignedHistory.reduce((total, item) => total + Math.max(0, Math.round(item.gramsUsed ?? 0)), 0);
          return (
            <View key={spool.id} style={styles.spoolRow}>
              <View style={styles.orderTop}>
                <View style={styles.grow}>
                  <Text style={styles.cardTitle}>{spool.color} {spool.material.replace("_PLUS", "+")}</Text>
                  <Text style={styles.cardCopy}>{spool.brand} · {spool.location} · {money(spool.rollCostCents)}</Text>
                </View>
                <Badge label={spool.active ? (spool.remainingGrams <= spool.thresholdGrams ? "LOW" : "ACTIVE") : "INACTIVE"} />
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(3, percent)}%` }]} />
              </View>
              <Text style={styles.cardCopy}>{spool.remainingGrams}g left of {spool.startingGrams}g · low at {spool.thresholdGrams}g</Text>
              <View style={styles.summaryBand}>
                <Text style={styles.summaryText}>Assigned history: {assignedHistory.length} print{assignedHistory.length === 1 ? "" : "s"}</Text>
                <Text style={styles.summaryText}>Assigned grams: {assignedGrams}g</Text>
              </View>
              {assignedHistory.length ? assignedHistory.map((item) => (
                <View key={item.id} style={styles.actionItem}>
                  <View style={styles.orderTop}>
                    <View style={styles.grow}>
                      <Text style={styles.rowTitle}>{item.name}</Text>
                      <Text style={styles.cardCopy}>{item.status ?? "history"} · {typeof item.gramsUsed === "number" ? `${Math.round(item.gramsUsed)}g` : "no grams"}{item.completedAt ? ` · ${new Date(item.completedAt).toLocaleDateString()}` : ""}</Text>
                    </View>
                    <Badge label={item.gramsSource ?? item.material ?? "assigned"} />
                  </View>
                  <Text style={styles.label}>Move to filament</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
                    {spools.filter((target) => target.id !== spool.id && target.active).map((target) => {
                      const active = moveTargets[item.id] === target.id;
                      return (
                        <Pressable key={target.id} onPress={() => setMoveTargets((current) => ({ ...current, [item.id]: target.id }))} style={[styles.choiceChip, active && styles.choiceChipActive]}>
                          <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{target.color} {target.material.replace("_PLUS", "+")}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.inline}>
                    <Pressable disabled={saving || !moveTargets[item.id]} onPress={() => moveAssignedHistory(spool, item)} style={[styles.secondaryButton, styles.grow, (!moveTargets[item.id] || saving) && styles.disabled]}>
                      <Text style={styles.secondaryButtonText}>Move</Text>
                    </Pressable>
                    <Pressable disabled={saving} onPress={() => removeAssignedHistory(spool, item)} style={[styles.dangerButton, styles.grow, saving && styles.disabled]}>
                      <Text style={styles.dangerButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              )) : null}
              <View style={styles.inline}>
                <Pressable disabled={saving} onPress={() => edit(spool)} style={[styles.secondaryButton, styles.grow]}>
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>
                <Pressable disabled={saving} onPress={() => remove(spool)} style={[styles.dangerButton, styles.grow]}>
                  <Text style={styles.dangerButtonText}>{spool.active ? "Remove" : "Delete"}</Text>
                </Pressable>
              </View>
            </View>
          );
        }) : <Text style={styles.cardCopy}>{message || "No filament rolls to show."}</Text>}
      </Card>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

function MerchantsScreen({ client }: { client: SuperPrintClient }) {
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Refresh merchant applications from the local Docker backend.");

  async function load() {
    setLoading(true);
    try {
      const response = await client.get<{ applications: MerchantApplication[] }>("/api/admin/merchants");
      setApplications(response.applications);
      setNotesById(Object.fromEntries(response.applications.map((application) => [application.id, application.reviewNotes ?? ""])));
      setMessage(response.applications.length ? "" : "No merchant applications yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load merchant applications.");
    } finally {
      setLoading(false);
    }
  }

  async function review(application: MerchantApplication, action: "approve" | "reject" | "needs_review") {
    setSavingId(application.id);
    setMessage(action === "approve" ? "Approving merchant..." : action === "reject" ? "Rejecting merchant..." : "Marking merchant for review...");
    try {
      await client.post<{ application: MerchantApplication }>(`/api/admin/merchants/${application.id}`, {
        action,
        reviewNotes: notesById[application.id] ?? ""
      });
      await load();
      setMessage(action === "approve" ? "Merchant approved." : action === "reject" ? "Merchant rejected." : "Merchant marked needs review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update merchant application.");
    } finally {
      setSavingId("");
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, [client]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenBody}>
      <ScreenHeader title="Merchants" detail="View application data, Stripe Connect state, KYC requirements, and approve Tap to Pay access." />
      <LoadButton title="Refresh Merchants" loading={loading} onPress={load} />
      {applications.length ? applications.map((application) => {
        const stripeReady = application.stripeConnectStatus === "ENABLED" && application.stripeChargesEnabled && application.stripePayoutsEnabled && application.stripeDetailsSubmitted;
        const saved = savingId === application.id;
        const approved = application.status === "APPROVED";
        return (
          <Card key={application.id}>
            <View style={styles.orderTop}>
              <View style={styles.grow}>
                <Text style={styles.cardTitle}>{application.businessName}</Text>
                <Text style={styles.cardCopy}>{application.legalBusinessName || application.businessName}</Text>
              </View>
              <Badge label={application.status.replace(/_/g, " ")} />
            </View>
            <View style={styles.badgeRow}>
              <Badge label={`Connect ${application.stripeConnectStatus.replace(/_/g, " ")}`} />
              <Badge label={application.stripeDetailsSubmitted ? "KYC submitted" : "KYC due"} />
              <Badge label={application.stripeChargesEnabled ? "Charges on" : "Charges off"} />
              <Badge label={application.stripePayoutsEnabled ? "Payouts on" : "Payouts off"} />
            </View>
            <View style={styles.readOnlyPanel}>
              <InfoRow label="Owner" value={`${application.ownerName} · ${application.ownerEmail}`} />
              <InfoRow label="Login" value={`${application.user.name ?? "Merchant"} · ${application.user.email}`} />
              <InfoRow label="Phone" value={application.phone || "Not provided"} />
              <InfoRow label="Address" value={merchantAddress(application)} />
              <InfoRow label="Business type" value={application.businessType.replace(/_/g, " ")} />
              <InfoRow label="Website" value={application.siteUrl || "Not provided"} />
              <InfoRow label="Tax" value={`${application.taxIdType} ending ${application.taxIdLast4 || "----"}`} />
              <InfoRow label="Stripe acct" value={application.stripeAccountId ?? "Not started"} />
              <InfoRow label="Terminal" value={application.stripeTerminalLocationId ?? "Not created"} />
              <InfoRow label="Submitted" value={merchantDate(application.submittedAt)} />
              <InfoRow label="Updated" value={merchantDate(application.updatedAt)} />
            </View>
            <View style={styles.summaryBand}>
              <Text style={styles.summaryText}>Stripe requirements</Text>
              <Text style={styles.cardCopy}>
                {application.stripeRequirementsDue.length
                  ? application.stripeRequirementsDue.map(formatStripeRequirement).join(", ")
                  : "No outstanding Stripe requirements."}
              </Text>
            </View>
            <Field label="Review notes" value={notesById[application.id] ?? ""} onChangeText={(reviewNotes) => setNotesById((current) => ({ ...current, [application.id]: reviewNotes }))} multiline />
            {!stripeReady ? <Text style={styles.message}>Approve unlocks after Stripe Connect is enabled with KYC details submitted, charges enabled, and payouts enabled.</Text> : null}
            {application.approvedAt ? <Text style={styles.cardCopy}>Approved {merchantDate(application.approvedAt)}</Text> : null}
            {application.rejectedAt ? <Text style={styles.cardCopy}>Rejected {merchantDate(application.rejectedAt)}</Text> : null}
            <View style={styles.inline}>
              <Pressable disabled={saved || !stripeReady || approved} onPress={() => review(application, "approve")} style={[styles.primaryButton, styles.grow, (saved || !stripeReady || approved) && styles.disabled]}>
                {saved ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>{approved ? "Approved" : "Approve"}</Text>}
              </Pressable>
              <Pressable disabled={saved} onPress={() => review(application, "needs_review")} style={[styles.secondaryButton, styles.grow, saved && styles.disabled]}>
                <Text style={styles.secondaryButtonText}>Needs Review</Text>
              </Pressable>
            </View>
            <Pressable disabled={saved} onPress={() => review(application, "reject")} style={[styles.dangerButton, saved && styles.disabled]}>
              <Text style={styles.dangerButtonText}>Reject</Text>
            </Pressable>
          </Card>
        );
      }) : <Card><Text style={styles.cardCopy}>{message}</Text></Card>}
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

function SettingsScreen({
  settings,
  setSettings,
  sessionInfo,
  sessionMeta,
  onSignOut
}: {
  settings: AdminSettings;
  setSettings: (settings: AdminSettings) => void;
  sessionInfo: MobileSessionInfo | null;
  sessionMeta: StoredSessionMeta | null;
  onSignOut: () => Promise<void>;
}) {
  const client = useMemo(() => new SuperPrintClient(settings), [settings]);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState("");

  async function loadPaymentConfig() {
    setTesting(true);
    setStatus("Loading Stripe payment settings...");
    try {
      const config = await client.get<{ publishableKey: string | null; terminalLocationId: string | null; configured: boolean; mode: string }>("/api/admin/pos/terminal/config");
      setSettings({
        ...settings,
        publishableKey: config.publishableKey ?? "",
        terminalLocationId: config.terminalLocationId ?? "",
        stripeMode: config.mode,
        stripeConfigured: config.configured
      });
      setStatus(config.configured ? `Loaded Stripe ${config.mode} payments.` : "Stripe secret key is not configured yet in SuperPrint settings.");
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
          ["Auth", sessionInfo?.user?.email ?? "Signed in"],
          ["Payments", settings.stripeConfigured ? `Stripe ${settings.stripeMode || "ready"}` : "Needs platform config"],
          ["Terminal", settings.terminalLocationId || "No location"]
        ].map(([title, detail]) => {
          const Icon = title === "Backend" ? Factory : title === "Auth" ? ScanFace : title === "Payments" ? CreditCard : SmartphoneNfc;
          return (
            <View key={title} style={styles.gridCard}>
              <DashboardIconBadge Icon={Icon} />
              <Text style={styles.gridTitle}>{title}</Text>
              <Text style={styles.gridDetail}>{detail}</Text>
            </View>
          );
        })}
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
        <Text style={styles.cardTitle}>Account</Text>
        <View style={styles.readOnlyPanel}>
          <InfoRow label="Signed in as" value={(sessionInfo?.user?.email ?? settings.adminEmail) || "Admin"} />
          <InfoRow label="Role" value={sessionInfo?.user?.role ?? "Admin"} />
          <InfoRow label="Session storage" value="SecureStore, this device only" />
          <InfoRow label="App unlock" value="Face ID / device passcode" />
          <InfoRow label="Session checked" value={sessionMeta?.lastValidatedAt ? new Date(sessionMeta.lastValidatedAt).toLocaleString() : "Current launch"} />
          <InfoRow label="Backend" value={settings.apiBaseUrl} />
        </View>
        <Pressable onPress={onSignOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sign Out</Text>
        </Pressable>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Payments</Text>
        <View style={styles.readOnlyPanel}>
          <InfoRow label="Stripe source" value="SuperPrint platform settings" />
          <InfoRow label="Mode" value={settings.stripeMode || "Not loaded"} />
          <InfoRow label="Terminal location" value={settings.terminalLocationId || "Not loaded"} />
          <InfoRow label="Publishable key" value={settings.publishableKey ? "Loaded from platform" : "Not loaded"} />
        </View>
        <Pressable onPress={loadPaymentConfig} style={styles.primaryButton}>
          {testing ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>Load Payments</Text>}
        </Pressable>
        {status ? <Text style={styles.message}>{status}</Text> : null}
        <Text style={styles.cardCopy}>Stripe keys are managed by the deployed SuperPrint platform. This app only loads the publishable payment config needed for Stripe SDKs.</Text>
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
      {detail ? <Text style={styles.copy}>{detail}</Text> : null}
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

function AppIconBadge({ Icon, small = false }: { Icon: LucideIcon; small?: boolean }) {
  return (
    <View style={[styles.iconBadge, small && styles.iconBadgeSmall]}>
      <Icon size={small ? 20 : 28} color={palette.cyan} strokeWidth={2.5} />
    </View>
  );
}

function DashboardIconBadge({ Icon }: { Icon: LucideIcon }) {
  return (
    <View style={styles.gridIconBadge}>
      <Icon size={24} color={palette.cyan} strokeWidth={2.5} />
    </View>
  );
}

function PaymentIconBadge({ Icon, active = false, small = false }: { Icon: LucideIcon; active?: boolean; small?: boolean }) {
  return (
    <View style={[styles.iconBadge, small && styles.iconBadgeSmall, active && styles.iconBadgeActive]}>
      <Icon size={small ? 20 : 26} color={active ? palette.actionText : palette.cyan} strokeWidth={2.5} />
    </View>
  );
}

function FlowNav({
  onBack,
  onNext,
  backDisabled,
  nextDisabled,
  nextLabel
}: {
  onBack: () => void;
  onNext: () => void;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  nextLabel: string;
}) {
  return (
    <View style={styles.inline}>
      <Pressable disabled={backDisabled} onPress={onBack} style={[styles.secondaryButton, styles.grow, backDisabled && styles.disabled]}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
      <Pressable disabled={nextDisabled} onPress={onNext} style={[styles.primaryButton, styles.grow, nextDisabled && styles.disabled]}>
        <Text style={styles.primaryButtonText}>{nextLabel}</Text>
      </Pressable>
    </View>
  );
}

function ProductionEstimatePanel({ line, product }: { line: LineDraft; product?: ProductOption }) {
  if (!product) return null;
  const estimate = estimateLineProduction(line, product);
  return (
    <View style={styles.summaryBand}>
      <Text style={styles.summaryText}>Catalog print time: {formatMinutes(estimate.totalMinutes)}</Text>
      <Text style={styles.summaryText}>Platform plates: {estimate.totalPlates} · {estimate.quantity} unit{estimate.quantity === 1 ? "" : "s"}</Text>
      {estimate.plates.map((plate) => (
        <Text key={plate.key} style={styles.summaryText}>
          {plate.label}: {plate.quantity} part{plate.quantity === 1 ? "" : "s"} · {plate.plates} plate{plate.plates === 1 ? "" : "s"} · max {plate.maxPerPlate}/plate
        </Text>
      ))}
    </View>
  );
}

function PickupTimeSelector({ value, onChange }: { value: Date | null; onChange: (value: Date | null) => void }) {
  const pickerValue = value ?? nextPickupDefault();

  function handleDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === "dismissed") return;
    if (selected) onChange(copyDateToPickup(pickerValue, selected));
  }

  function handleTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === "dismissed") return;
    if (selected) onChange(copyTimeToPickup(pickerValue, selected));
  }

  return (
    <View style={styles.field}>
      <View style={styles.switchRow}>
        <View>
          <Text style={styles.label}>Estimated pickup</Text>
          <Text style={styles.cardCopy}>{value ? formatPickupDateTime(value) : "No pickup date selected"}</Text>
        </View>
        {value ? (
          <Pressable onPress={() => onChange(null)} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.pickerRow}>
        <View style={styles.datePickerShell}>
          <Text style={styles.label}>Date</Text>
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display={Platform.OS === "ios" ? "compact" : "default"}
            onChange={handleDateChange}
          />
        </View>
        <View style={styles.datePickerShell}>
          <Text style={styles.label}>Time</Text>
          <DateTimePicker
            value={pickerValue}
            mode="time"
            display={Platform.OS === "ios" ? "compact" : "default"}
            minuteInterval={5}
            onChange={handleTimeChange}
          />
        </View>
      </View>
    </View>
  );
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
      {loading ? <ActivityIndicator color={palette.actionText} /> : <Text style={styles.primaryButtonText}>{title}</Text>}
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

  async getPublic<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" }, false);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  async delete<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "DELETE", body: JSON.stringify(body) });
  }

  async signIn(email: string, password: string): Promise<string> {
    const base = this.settings.apiBaseUrl.replace(/\/$/, "");
    const response = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: base,
        Referer: `${base}/admin`
      },
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
      headers: {
        "Content-Type": "application/json",
        Origin: base,
        Referer: `${base}/admin`
      },
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
        ...(includeCookie && this.settings.adminCookie ? {
          Cookie: this.settings.adminCookie,
          Authorization: `Bearer ${sessionTokenFromCookie(this.settings.adminCookie)}`,
          "X-SuperPrint-Session-Token": sessionTokenFromCookie(this.settings.adminCookie)
        } : {})
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

function positiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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

function sessionStatus(session: MobileSessionInfo) {
  if (!session.signedIn || !session.user) return "Not signed in.";
  const allowed = session.user.adminAllowed ? "admin allowed" : "not admin";
  return `Signed in as ${session.user.email} · ${session.user.role ?? "NO_ROLE"} · ${allowed}`;
}

function sessionStatusForSettings(session: MobileSessionInfo, settings: AdminSettings) {
  const status = sessionStatus(session);
  if (!session.user?.email || !settings.adminEmail.trim()) return status;
  return session.user.email.toLowerCase() === settings.adminEmail.trim().toLowerCase()
    ? status
    : `${status}. Email field is ${settings.adminEmail.trim()}.`;
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

function orderItemsArePrinted(order: AdminOrder) {
  if (!order.items?.length) return false;
  return order.items.every((item) => (item.printedQuantity ?? 0) >= item.quantity);
}

function productFor(line: LineDraft, products: ProductOption[]) {
  return products.find((product) => product.id === line.productId) ?? products[0];
}

function newOrderLine(product: ProductOption, quantity = "1"): LineDraft {
  const slotCount = Math.max(1, product.colorSlotCount ?? 1);
  const selectedFilamentMaterialIds = Array.from({ length: slotCount }, (_, index) => product.allowedFilaments?.[index]?.filamentMaterialId ?? product.allowedFilaments?.[0]?.filamentMaterialId ?? "");
  const selectedColors = Array.from({ length: slotCount }, (_, index) => product.allowedFilaments?.[index]?.filamentMaterial.color ?? product.allowedFilaments?.[0]?.filamentMaterial.color ?? product.defaultMaterial ?? "");
  return {
    productId: product.id,
    quantity,
    printedQuantity: "0",
    unitPrice: (product.priceCents / 100).toFixed(2),
    selectedFilamentMaterialIds,
    selectedColors
  };
}

function estimateLineProduction(line: LineDraft, product: ProductOption) {
  const quantity = positiveInt(line.quantity, 1);
  const remainingQuantity = Math.max(0, quantity - nonNegativeInt(line.printedQuantity, 0));
  const selectedId = line.selectedFilamentMaterialIds[0] ?? "";
  const filament = product.allowedFilaments?.find((item) => item.filamentMaterialId === selectedId);
  const minutesPerUnit = Math.max(1, Math.ceil(filament?.estimatedPrintMinutesOverride ?? product.estimatedPrintMinutes ?? 0));
  const plates = estimatePlatformPlates(line, product, remainingQuantity);
  return {
    quantity: remainingQuantity,
    plates,
    totalMinutes: minutesPerUnit * remainingQuantity,
    totalPlates: plates.reduce((total, plate) => total + plate.plates, 0)
  };
}

function estimatePlatformPlates(line: LineDraft, product: ProductOption, quantity: number) {
  const parts = product.parts?.length
    ? product.parts
    : [{ id: product.id, name: product.name, colorSlotIndex: 0, colorSlotPattern: [], quantityPerUnit: 1 }];
  const rows = new Map<string, { key: string; label: string; quantity: number; maxPerPlate: number; plates: number }>();
  for (const part of parts) {
    const pattern = part.colorSlotPattern?.length ? part.colorSlotPattern : Array.from({ length: Math.max(1, part.quantityPerUnit) }, () => part.colorSlotIndex);
    for (const slotIndex of pattern) {
      const color = line.selectedColors[slotIndex]?.trim() || line.selectedColors[0]?.trim() || `Color ${slotIndex + 1}`;
      const key = `${part.id}:${color.toLowerCase()}`;
      const maxPerPlate = Math.max(1, (product.maxBatchQuantity ?? 1) * Math.max(1, part.quantityPerUnit));
      const existing = rows.get(key) ?? {
        key,
        label: `${part.name} ${color}`,
        quantity: 0,
        maxPerPlate,
        plates: 0
      };
      existing.quantity += quantity;
      existing.plates = Math.ceil(existing.quantity / existing.maxPerPlate);
      rows.set(key, existing);
    }
  }
  return [...rows.values()];
}

function formatMinutes(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function merchantAddress(application: MerchantApplication) {
  const cityStateZip = [application.city, [application.state, application.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [
    [application.street1, application.street2].filter(Boolean).join(" "),
    cityStateZip,
    application.country
  ].filter(Boolean).join(", ");
}

function merchantDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

function formatStripeRequirement(value: string) {
  return value.replace(/[._]/g, " ").replace(/\s+/g, " ").trim();
}

function money(centsValue: number) {
  return (centsValue / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatExpectedPaymentType(type: ExpectedPaymentType) {
  return type === "CARD" ? "Card" : "Cash";
}

function nextPickupDefault() {
  const next = new Date();
  next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5, 0, 0);
  return next;
}

function copyDateToPickup(current: Date, selectedDate: Date) {
  const next = new Date(current);
  next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  return next;
}

function copyTimeToPickup(current: Date, selectedTime: Date) {
  const next = new Date(current);
  next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
  return next;
}

function formatPickupDateTime(value: Date) {
  return value.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function normalizeSetCookie(value: string) {
  return value
    .split(/,(?=[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function sessionTokenFromCookie(cookieHeader: string) {
  const sessionCookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("better-auth.session_token=") || item.startsWith("__Secure-better-auth.session_token="));
  const rawValue = sessionCookie?.split("=").slice(1).join("=") || cookieHeader;
  try {
    return decodeURIComponent(rawValue).split(".")[0] || rawValue;
  } catch {
    return rawValue.split(".")[0] || rawValue;
  }
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
  navPillTextActive: { color: palette.actionText },
  content: { flex: 1 },
  screen: { flex: 1 },
  screenBody: { padding: 18, paddingBottom: 56, gap: 16 },
  flowHero: { borderRadius: 8, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, padding: 16, gap: 14 },
  modeGrid: { flexDirection: "row", gap: 10 },
  modeCard: { flex: 1, minHeight: 118, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.field, padding: 12, gap: 8 },
  modeCardActive: { backgroundColor: palette.actionBg, borderColor: palette.actionBg },
  modeTitle: { color: palette.ink, fontSize: 15, fontWeight: "900" },
  modeTitleActive: { color: palette.actionText },
  modeCopy: { color: palette.slate, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  modeCopyActive: { color: palette.actionText },
  stepRail: { gap: 8, paddingVertical: 2 },
  stepPill: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, paddingHorizontal: 10 },
  stepPillActive: { backgroundColor: palette.actionBg, borderColor: palette.actionBg },
  stepLabel: { color: palette.slate, fontSize: 12, fontWeight: "900" },
  stepLabelActive: { color: palette.actionText },
  centerPane: { flex: 1, alignItems: "center", justifyContent: "center" },
  loginBody: { justifyContent: "center", minHeight: "100%" },
  loginLogo: { width: 176, height: 56 },
  lockBadge: { width: 72, height: 72, borderRadius: 8, backgroundColor: palette.markBg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.line },
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
  iconBadge: { width: 54, height: 54, borderRadius: 8, backgroundColor: palette.markBg, alignItems: "center", justifyContent: "center" },
  iconBadgeSmall: { width: 36, height: 36 },
  iconBadgeActive: { backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" },
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
  pickerRow: { flexDirection: "row", gap: 10 },
  datePickerShell: { flex: 1, minHeight: 64, borderWidth: 1, borderColor: palette.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, alignItems: "flex-start", justifyContent: "center", backgroundColor: palette.field, gap: 4 },
  readOnlyPanel: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, backgroundColor: palette.field, overflow: "hidden" },
  infoRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.line },
  infoLabel: { color: palette.muted, fontSize: 12, fontWeight: "800" },
  infoValue: { flex: 1, color: palette.ink, fontSize: 13, fontWeight: "900", textAlign: "right" },
  inline: { flexDirection: "row", gap: 10 },
  inlineCenter: { flexDirection: "row", gap: 8, alignItems: "center" },
  productRail: { gap: 8, paddingVertical: 2 },
  productChip: { width: 168, minHeight: 76, borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 12, justifyContent: "space-between", backgroundColor: palette.field },
  productChipActive: { backgroundColor: palette.actionBg, borderColor: palette.actionBg },
  productChipTitle: { color: palette.ink, fontSize: 14, fontWeight: "900" },
  productChipTitleActive: { color: palette.actionText },
  productChipMeta: { color: palette.muted, fontSize: 11, fontWeight: "800" },
  productChipMetaActive: { color: palette.actionText },
  historyRail: { gap: 8, paddingVertical: 2 },
  historyCard: { width: 210, minHeight: 96, borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 12, justifyContent: "space-between", backgroundColor: palette.field },
  historyCardActive: { backgroundColor: palette.actionBg, borderColor: palette.actionBg },
  historyTitle: { color: palette.ink, fontSize: 13, fontWeight: "900" },
  historyTitleActive: { color: palette.actionText },
  historyMeta: { color: palette.muted, fontSize: 11, fontWeight: "800" },
  historyMetaActive: { color: palette.actionText },
  chipRail: { gap: 8, paddingVertical: 2 },
  choiceChip: { minHeight: 38, minWidth: 72, borderWidth: 1, borderColor: palette.line, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, backgroundColor: palette.field },
  choiceChipActive: { backgroundColor: palette.actionBg, borderColor: palette.actionBg },
  choiceChipText: { color: palette.slate, fontSize: 12, fontWeight: "900" },
  choiceChipTextActive: { color: palette.actionText },
  segment: { flexDirection: "row", borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 4, gap: 4 },
  segmentItem: { flex: 1, alignItems: "center", borderRadius: 6, paddingVertical: 10 },
  segmentItemActive: { backgroundColor: palette.cyan },
  segmentText: { color: palette.slate, fontSize: 12, fontWeight: "900" },
  segmentTextActive: { color: palette.actionText },
  paymentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  paymentTile: { width: "47.8%", minHeight: 82, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.field, padding: 12, gap: 8, alignItems: "center", justifyContent: "center" },
  paymentTileActive: { backgroundColor: palette.actionBg, borderColor: palette.actionBg },
  paymentTileTitle: { color: palette.ink, fontSize: 14, fontWeight: "900" },
  paymentTileTitleActive: { color: palette.actionText },
  paymentTileCopy: { color: palette.slate, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  paymentTileCopyActive: { color: palette.actionText },
  paymentPanel: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, backgroundColor: palette.field, padding: 12, gap: 12 },
  paymentSummary: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, backgroundColor: palette.card, overflow: "hidden" },
  iconChoiceRow: { flexDirection: "row", gap: 10 },
  iconChoice: { flex: 1, minHeight: 72, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, padding: 10, alignItems: "center", justifyContent: "center", gap: 8 },
  iconChoiceActive: { backgroundColor: palette.actionBg, borderColor: palette.actionBg },
  iconChoiceText: { color: palette.ink, fontSize: 13, fontWeight: "900" },
  iconChoiceTextActive: { color: palette.actionText },
  successBand: { borderRadius: 8, borderWidth: 1, borderColor: palette.secondaryBorder, backgroundColor: palette.secondaryBg, padding: 12 },
  successText: { color: palette.cyanDark, fontSize: 13, fontWeight: "900" },
  summaryBand: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, backgroundColor: palette.secondaryBg, padding: 12, gap: 6 },
  summaryText: { color: palette.slate, fontSize: 12, fontWeight: "800" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  primaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: palette.actionBg, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: palette.actionText, fontWeight: "900", fontSize: 15 },
  secondaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: palette.secondaryBg, borderWidth: 1, borderColor: palette.secondaryBorder, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  secondaryButtonText: { color: palette.cyanDark, fontWeight: "900", fontSize: 13 },
  dangerButton: { minHeight: 48, borderRadius: 8, backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  dangerButtonText: { color: "#b91c1c", fontWeight: "900", fontSize: 13 },
  disabled: { opacity: 0.7 },
  message: { color: palette.slate, fontSize: 13 },
  orderTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  money: { color: palette.ink, fontSize: 18, fontWeight: "900" },
  rowLine: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 10 },
  rowTitle: { color: palette.ink, fontSize: 14, fontWeight: "900" },
  actionItem: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12, gap: 10 },
  spoolRow: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12, gap: 10 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: palette.secondaryBg, overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: palette.cyan },
  actionButtons: { flexDirection: "row", gap: 8 },
  compactButton: { minHeight: 38, borderRadius: 8, backgroundColor: palette.actionBg, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  compactButtonText: { color: palette.actionText, fontSize: 12, fontWeight: "900" },
  stepList: { gap: 6, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 },
  stepText: { color: palette.slate, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  choiceList: { borderWidth: 1, borderColor: palette.line, borderRadius: 8, overflow: "hidden" },
  choiceRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: palette.line, backgroundColor: palette.field },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { borderRadius: 6, backgroundColor: palette.badgeBg, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { color: palette.cyanDark, fontSize: 11, fontWeight: "900" }
  });
}
