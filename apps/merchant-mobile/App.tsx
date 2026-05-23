import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View
} from "react-native";
import { StripeTerminalProvider, useStripeTerminal } from "@stripe/stripe-terminal-react-native";

type ScreenKey = "home" | "onboarding" | "enable" | "checkout" | "store" | "orders" | "settings";
type AuthMode = "signIn" | "signUp";
type MerchantStatus = "DRAFT" | "SUBMITTED" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED";
type BusinessType = "SOLE_PROPRIETORSHIP" | "LLC" | "CORPORATION" | "PARTNERSHIP" | "NONPROFIT" | "OTHER";
type TaxIdType = "EIN" | "SSN";
type DocumentType = "BUSINESS_LICENSE" | "TAX_DOCUMENT" | "IDENTITY_DOCUMENT" | "ADDRESS_VERIFICATION" | "OTHER";
type ActiveAppearance = "light" | "dark";

type SuperPrintLocalAuthenticationModule = {
  authenticate(reason: string): Promise<boolean>;
};

type PlatformTheme = {
  brandName: string;
  primaryColor: string;
};

type ThemePalette = {
  ink: string;
  slate: string;
  muted: string;
  line: string;
  paper: string;
  card: string;
  field: string;
  primary: string;
  primaryText: string;
  secondaryBg: string;
  secondaryBorder: string;
  danger: string;
};

type UserSession = {
  token: string;
  user: { id: string; email: string; name: string; emailVerified: boolean };
};

type MerchantApplication = {
  id?: string;
  status: MerchantStatus;
  businessName: string;
  legalBusinessName: string;
  businessType: BusinessType;
  siteUrl: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  taxIdType: TaxIdType;
  taxId: string;
  taxIdLast4: string;
  stripeConnectStatus: string;
  stripeAccountId?: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  stripeRequirementsDue: string[];
  documents: Array<{ id: string; type: DocumentType; fileName: string; uploadedAt: string }>;
};

type Product = {
  id?: string;
  name: string;
  priceCents: number;
  active: boolean;
};

type Order = {
  id: string;
  customerEmail: string;
  itemSummary: string;
  amountCents: number;
  status: string;
  receiptUrl?: string | null;
};

const sessionKey = "superprint.merchant.session";
const backendKey = "superprint.merchant.backendUrl";
const awarenessKey = "superprint.merchant.tapToPayAwareness.v1";
const defaultBackendUrl = process.env.EXPO_PUBLIC_SUPERPRINT_URL ?? "https://print.superk.studio";
const defaultPrimaryColor = "#00e5ff";

const emptyApplication: MerchantApplication = {
  status: "DRAFT",
  businessName: "",
  legalBusinessName: "",
  businessType: "LLC",
  siteUrl: "https://",
  ownerName: "",
  ownerEmail: "",
  phone: "",
  street1: "",
  street2: "",
  city: "",
  state: "CO",
  zip: "",
  country: "US",
  taxIdType: "EIN",
  taxId: "",
  taxIdLast4: "",
  stripeConnectStatus: "NOT_STARTED",
  stripeAccountId: null,
  stripeChargesEnabled: false,
  stripePayoutsEnabled: false,
  stripeDetailsSubmitted: false,
  stripeRequirementsDue: [],
  documents: []
};

const starterProducts: Product[] = [
  { name: "Custom 3D print", priceCents: 2400, active: true },
  { name: "Replacement part", priceCents: 1200, active: true }
];

const lightPalette: ThemePalette = {
  ink: "#0b0f14",
  slate: "#5d6879",
  muted: "#5d6879",
  line: "#c3ccd5",
  paper: "#f6f7f8",
  card: "#ffffff",
  field: "#ffffff",
  primary: defaultPrimaryColor,
  primaryText: "#0b0f14",
  secondaryBg: "#e6fbff",
  secondaryBorder: "#9eefff",
  danger: "#dc2626"
};

const darkPalette: ThemePalette = {
  ink: "#f8fafc",
  slate: "#cbd5e1",
  muted: "#8995a6",
  line: "#242e38",
  paper: "#0b0f14",
  card: "#0e131b",
  field: "#111821",
  primary: defaultPrimaryColor,
  primaryText: "#0b0f14",
  secondaryBg: "#19212a",
  secondaryBorder: "#242e38",
  danger: "#ef4444"
};

let palette = lightPalette;
let styles = createStyles(palette);

function buildMobilePalette(primaryColor: string, appearance: ActiveAppearance): ThemePalette {
  const base = appearance === "dark" ? darkPalette : lightPalette;
  const primary = normalizePrimaryColor(primaryColor);
  return {
    ...base,
    primary,
    primaryText: readableForeground(primary),
    secondaryBg: appearance === "dark" ? mixHex(primary, "#0b0f14", 0.82) : mixHex(primary, "#ffffff", 0.84),
    secondaryBorder: appearance === "dark" ? mixHex(primary, "#0b0f14", 0.56) : mixHex(primary, "#ffffff", 0.56)
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

export default function App() {
  const systemScheme = useColorScheme();
  const [backendUrl, setBackendUrl] = useState(defaultBackendUrl);
  const [platformTheme, setPlatformTheme] = useState<PlatformTheme>({ brandName: "SuperPrint", primaryColor: defaultPrimaryColor });
  const [session, setSession] = useState<UserSession | null>(null);
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [loading, setLoading] = useState(true);
  const [pendingSession, setPendingSession] = useState<UserSession | null>(null);
  const [application, setApplication] = useState<MerchantApplication>(emptyApplication);
  const [products, setProducts] = useState<Product[]>(starterProducts);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showTapToPayAwareness, setShowTapToPayAwareness] = useState(false);
  const [biometricMessage, setBiometricMessage] = useState("");

  const client = useMemo(() => new MerchantClient(backendUrl, session?.token ?? ""), [backendUrl, session?.token]);
  const activeAppearance: ActiveAppearance = systemScheme === "dark" ? "dark" : "light";
  const theme = useMemo(() => {
    const nextPalette = buildMobilePalette(platformTheme.primaryColor, activeAppearance);
    return { palette: nextPalette, styles: createStyles(nextPalette) };
  }, [activeAppearance, platformTheme.primaryColor]);
  palette = theme.palette;
  styles = theme.styles;
  const tokenProvider = useMemo(() => async () => {
    const response = await client.post<{ secret: string }>("/api/merchant/terminal/connection-token", {});
    return response.secret;
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const [savedSession, savedBackendUrl] = await Promise.all([
        SecureStore.getItemAsync(sessionKey),
        SecureStore.getItemAsync(backendKey)
      ]);
      if (cancelled) return;
      if (savedBackendUrl) setBackendUrl(savedBackendUrl);
      if (savedSession) {
        setPendingSession(JSON.parse(savedSession) as UserSession);
      }
      setLoading(false);
    }
    restore().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) SecureStore.setItemAsync(backendKey, backendUrl).catch(() => undefined);
  }, [backendUrl, loading]);

  useEffect(() => {
    let cancelled = false;
    new MerchantClient(backendUrl, "")
      .get<PlatformTheme>("/api/platform/theme")
      .then((nextTheme) => {
        if (!cancelled) setPlatformTheme({ brandName: nextTheme.brandName || "SuperPrint", primaryColor: normalizePrimaryColor(nextTheme.primaryColor) });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [backendUrl]);

  useEffect(() => {
    if (!loading && session) SecureStore.setItemAsync(sessionKey, JSON.stringify(session)).catch(() => undefined);
  }, [loading, session]);

  useEffect(() => {
    if (!session?.token || loading) return;
    refreshPlatformData().catch(() => undefined);
  }, [session?.token, loading]);

  useEffect(() => {
    if (!session?.token || loading) return;
    let cancelled = false;
    SecureStore.getItemAsync(awarenessKey)
      .then((value) => {
        if (!cancelled && value !== "seen") setShowTapToPayAwareness(true);
      })
      .catch(() => {
        if (!cancelled) setShowTapToPayAwareness(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token, loading]);

  async function refreshPlatformData() {
    setRefreshing(true);
    try {
      const [applicationResult, productResult, orderResult] = await Promise.all([
        client.get<{ application: MerchantApplication | null }>("/api/merchant/application"),
        client.get<{ products: Product[] }>("/api/merchant/products"),
        client.get<{ orders: Order[] }>("/api/merchant/orders")
      ]);
      setApplication(applicationResult.application ? { ...emptyApplication, ...applicationResult.application, taxId: "" } : emptyApplication);
      setProducts(productResult.products.length ? productResult.products : starterProducts);
      setOrders(orderResult.orders);
    } finally {
      setRefreshing(false);
    }
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(sessionKey);
    setSession(null);
    setPendingSession(null);
    setApplication(emptyApplication);
    setProducts(starterProducts);
    setOrders([]);
  }

  async function dismissTapToPayAwareness(nextScreen?: ScreenKey) {
    setShowTapToPayAwareness(false);
    await SecureStore.setItemAsync(awarenessKey, "seen").catch(() => undefined);
    if (nextScreen) setScreen(nextScreen);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={activeAppearance === "dark" ? "light" : "dark"} />
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.muted}>Loading merchant store...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    if (pendingSession) {
      return (
        <BiometricUnlockScreen
          email={pendingSession.user.email}
          onUnlock={async () => {
            const authenticated = await unlockSavedSession();
            if (authenticated) {
              setSession(pendingSession);
              setPendingSession(null);
              setBiometricMessage("");
            } else {
              await SecureStore.deleteItemAsync(sessionKey);
              setPendingSession(null);
              setBiometricMessage("Biometric unlock was canceled. Sign in again to continue.");
            }
          }}
          onSignInInstead={async () => {
            await SecureStore.deleteItemAsync(sessionKey);
            setPendingSession(null);
            setBiometricMessage("Sign in again to continue.");
          }}
        />
      );
    }
    return <AuthScreen backendUrl={backendUrl} setBackendUrl={setBackendUrl} client={client} onSession={setSession} initialMessage={biometricMessage} />;
  }

  return (
    <StripeTerminalProvider tokenProvider={tokenProvider}>
      <SafeAreaView style={styles.safe}>
        <TerminalWarmup enabled={Boolean(session?.token)} />
        <StatusBar style={activeAppearance === "dark" ? "light" : "dark"} />
        <View style={styles.topBar}>
          <Pressable onPress={() => setScreen("home")} style={styles.brandButton}>
            <Text style={styles.brand}>{platformTheme.brandName} Merchant</Text>
            <Text style={styles.brandSub}>{application.businessName || session.user.email}</Text>
          </Pressable>
          <Pressable onPress={() => setScreen("settings")} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>Settings</Text>
          </Pressable>
        </View>
        <ScrollView horizontal style={styles.nav} contentContainerStyle={styles.navInner} showsHorizontalScrollIndicator={false}>
          {[
            ["home", "Home"],
            ["onboarding", "Apply"],
            ["enable", "Tap to Pay"],
            ["checkout", "Checkout"],
            ["store", "Store"],
            ["orders", "Orders"]
          ].map(([key, label]) => (
            <Pressable key={key} onPress={() => setScreen(key as ScreenKey)} style={[styles.navPill, screen === key && styles.navPillActive]}>
              <Text style={[styles.navText, screen === key && styles.navTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
          {screen === "home" && <HomeScreen application={application} products={products} orders={orders} refreshing={refreshing} onOpen={setScreen} onRefresh={refreshPlatformData} />}
          {screen === "onboarding" && <OnboardingScreen application={application} setApplication={setApplication} client={client} onRefresh={refreshPlatformData} />}
          {screen === "enable" && <EnableScreen application={application} client={client} onCheckout={() => setScreen("checkout")} />}
          {screen === "checkout" && <CheckoutScreen application={application} products={products} client={client} onOrder={(order) => setOrders((current) => [order, ...current])} />}
          {screen === "store" && <StoreScreen products={products} setProducts={setProducts} client={client} />}
          {screen === "orders" && <OrdersScreen orders={orders} onRefresh={refreshPlatformData} />}
          {screen === "settings" && <SettingsScreen backendUrl={backendUrl} setBackendUrl={setBackendUrl} userEmail={session.user.email} onSignOut={signOut} />}
        </KeyboardAvoidingView>
        <TapToPayAwarenessModal
          visible={showTapToPayAwareness}
          application={application}
          onEnable={() => dismissTapToPayAwareness("enable")}
          onDismiss={() => dismissTapToPayAwareness()}
        />
      </SafeAreaView>
    </StripeTerminalProvider>
  );
}

async function unlockSavedSession() {
  const localAuth = NativeModules.SuperPrintLocalAuthentication as SuperPrintLocalAuthenticationModule | undefined;
  if (!localAuth) return true;
  return localAuth.authenticate("Unlock your saved SuperPrint Merchant session.");
}

function TerminalWarmup({ enabled }: { enabled: boolean }) {
  const { initialize } = useStripeTerminal({});

  useEffect(() => {
    if (!enabled) return;
    initialize().catch(() => undefined);
  }, [enabled, initialize]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") initialize().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [enabled, initialize]);

  return null;
}

function TapToPayAwarenessModal({
  visible,
  application,
  onEnable,
  onDismiss
}: {
  visible: boolean;
  application: MerchantApplication;
  onEnable: () => void;
  onDismiss: () => void;
}) {
  const approved = application.status === "APPROVED" && application.stripeConnectStatus === "ENABLED";
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onDismiss}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <Text style={styles.kicker}>Now available</Text>
          <Text style={styles.modalTitle}>Tap to Pay on iPhone</Text>
          <Text style={styles.copy}>Accept in-person contactless cards, Apple Pay, and other digital wallets from your merchant checkout. No extra card reader is required on a compatible iPhone.</Text>
          <View style={styles.stepList}>
            <Text style={styles.stepText}>1. Complete merchant approval and Stripe Connect onboarding.</Text>
            <Text style={styles.stepText}>2. Accept Tap to Pay on iPhone terms as the business owner or authorized admin.</Text>
            <Text style={styles.stepText}>3. Review merchant education, then take a checkout payment.</Text>
          </View>
          <Pressable onPress={onEnable} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{approved ? "Enable Tap to Pay on iPhone" : "View Setup Steps"}</Text>
          </Pressable>
          <Pressable onPress={onDismiss} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Not Now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function BiometricUnlockScreen({
  email,
  onUnlock,
  onSignInInstead
}: {
  email: string;
  onUnlock: () => Promise<void>;
  onSignInInstead: () => Promise<void>;
}) {
  const [unlocking, setUnlocking] = useState(false);
  const [status, setStatus] = useState("Use Face ID, Touch ID, or your device passcode to unlock your saved merchant session.");

  async function unlock() {
    setUnlocking(true);
    setStatus("Waiting for device authentication...");
    try {
      await onUnlock();
    } finally {
      setUnlocking(false);
    }
  }

  useEffect(() => {
    unlock().catch(() => setStatus("Unlock failed. Try again or sign in instead."));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={palette.paper === darkPalette.paper ? "light" : "dark"} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
        <SectionHeader title="Unlock SuperPrint Merchant" detail={email} />
        <Card>
          <Text style={styles.cardTitle}>Session protected</Text>
          <Text style={styles.copy}>{status}</Text>
          <Pressable disabled={unlocking} onPress={unlock} style={[styles.primaryButton, unlocking && styles.disabled]}>
            {unlocking ? <ActivityIndicator color={palette.primaryText} /> : <Text style={styles.primaryButtonText}>Unlock with Face ID</Text>}
          </Pressable>
          <Pressable disabled={unlocking} onPress={onSignInInstead} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign In Instead</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function AuthScreen({
  backendUrl,
  setBackendUrl,
  client,
  onSession,
  initialMessage
}: {
  backendUrl: string;
  setBackendUrl: (value: string) => void;
  client: MerchantClient;
  onSession: (session: UserSession) => void;
  initialMessage?: string;
}) {
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [status, setStatus] = useState(initialMessage ?? "");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setStatus("");
    if (mode === "signUp" && !acceptedLegal) {
      setStatus("Accept the Terms and Privacy Policy before creating an account.");
      setLoading(false);
      return;
    }
    try {
      const result = await client.post<UserSession>("/api/merchant/mobile/session", { mode, email, password, name });
      onSession(result);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={palette.paper === darkPalette.paper ? "light" : "dark"} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
        <SectionHeader title="SuperPrint Merchant" detail="Sign in with your main print.superk.studio account to apply and manage your store." />
        <Card>
          <View style={styles.segment}>
            <Pressable onPress={() => setMode("signIn")} style={[styles.segmentItem, mode === "signIn" && styles.segmentItemActive]}>
              <Text style={mode === "signIn" ? styles.segmentTextActive : styles.segmentText}>Sign in</Text>
            </Pressable>
            <Pressable onPress={() => setMode("signUp")} style={[styles.segmentItem, mode === "signUp" && styles.segmentItemActive]}>
              <Text style={mode === "signUp" ? styles.segmentTextActive : styles.segmentText}>Create</Text>
            </Pressable>
          </View>
          {mode === "signUp" ? <Field label="Name" value={name} onChangeText={setName} /> : null}
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <Field label="Platform URL" value={backendUrl} onChangeText={setBackendUrl} autoCapitalize="none" />
          {mode === "signUp" ? (
            <>
              <Pressable onPress={() => Linking.openURL(`${backendUrl}/legal`)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>View Terms and Privacy</Text>
              </Pressable>
              <View style={styles.switchRow}>
                <Text style={styles.label}>I agree to SuperPrint Terms and Privacy Policy</Text>
                <Switch value={acceptedLegal} onValueChange={setAcceptedLegal} />
              </View>
            </>
          ) : null}
          <Pressable disabled={loading || (mode === "signUp" && !acceptedLegal)} onPress={submit} style={[styles.primaryButton, (loading || (mode === "signUp" && !acceptedLegal)) && styles.disabled]}>
            {loading ? <ActivityIndicator color={palette.primaryText} /> : <Text style={styles.primaryButtonText}>{mode === "signIn" ? "Sign In" : "Create Account"}</Text>}
          </Pressable>
          {status ? <Text style={styles.message}>{status}</Text> : null}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeScreen({
  application,
  products,
  orders,
  refreshing,
  onOpen,
  onRefresh
}: {
  application: MerchantApplication;
  products: Product[];
  orders: Order[];
  refreshing: boolean;
  onOpen: (screen: ScreenKey) => void;
  onRefresh: () => void;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text style={styles.kicker}>Merchant Console</Text>
      <Text style={styles.h1}>Take payments and run your store from iPhone.</Text>
      <View style={styles.metrics}>
        <Metric label="Application" value={application.status === "APPROVED" ? "Approved" : application.status === "SUBMITTED" ? "Submitted" : "Open"} />
        <Metric label="Connect" value={application.stripeConnectStatus.replace(/_/g, " ")} />
        <Metric label="Products" value={String(products.filter((item) => item.active).length)} />
        <Metric label="Paid" value={money(orders.reduce((total, order) => total + order.amountCents, 0))} />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Platform connection</Text>
        <Text style={styles.copy}>Your merchant profile, documents, Stripe Connect onboarding, products, orders, and Tap to Pay setup sync with print.superk.studio.</Text>
        <Pressable onPress={() => onOpen("onboarding")} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Open Merchant Application</Text>
        </Pressable>
        <Pressable onPress={() => onOpen(application.status === "APPROVED" ? "checkout" : "enable")} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{application.status === "APPROVED" ? "Open Checkout" : "View Tap to Pay Status"}</Text>
        </Pressable>
        <Pressable disabled={refreshing} onPress={onRefresh} style={[styles.secondaryButton, refreshing && styles.disabled]}>
          <Text style={styles.secondaryButtonText}>{refreshing ? "Refreshing..." : "Refresh Platform Data"}</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

function OnboardingScreen({
  application,
  setApplication,
  client,
  onRefresh
}: {
  application: MerchantApplication;
  setApplication: (application: MerchantApplication) => void;
  client: MerchantClient;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  function patch(update: Partial<MerchantApplication>) {
    setApplication({ ...application, ...update });
  }

  async function save(submit: boolean) {
    setSubmitting(true);
    setStatus("");
    try {
      const result = await client.post<{ application: MerchantApplication }>("/api/merchant/application", { ...application, acceptedLegal, submit });
      setApplication({ ...emptyApplication, ...result.application, taxId: "" });
      setStatus(submit ? "Application submitted for SuperPrint merchant review." : "Application saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save application.");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadDocument(type: DocumentType) {
    setStatus("");
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? "application/octet-stream"
    } as unknown as Blob);
    try {
      const result = await client.upload<{ document: MerchantApplication["documents"][number] }>("/api/merchant/application/documents", formData);
      patch({ documents: [result.document, ...application.documents] });
      setStatus(`${asset.name} uploaded securely.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not upload document.");
    }
  }

  async function startStripeConnect() {
    setSubmitting(true);
    setStatus("");
    try {
      const result = await client.post<{ url: string; accountId: string }>("/api/merchant/connect/onboarding", {});
      patch({ stripeAccountId: result.accountId, stripeConnectStatus: "ONBOARDING_STARTED" });
      await Linking.openURL(result.url);
      setStatus("Stripe Connect onboarding opened. Return here and refresh status after completing it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start Stripe Connect onboarding.");
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshStripeConnect() {
    setSubmitting(true);
    setStatus("");
    try {
      const result = await client.get<{
        status: string;
        chargesEnabled?: boolean;
        payoutsEnabled?: boolean;
        detailsSubmitted?: boolean;
        requirementsDue?: string[];
      }>("/api/merchant/connect/status");
      patch({
        stripeConnectStatus: result.status,
        stripeChargesEnabled: Boolean(result.chargesEnabled),
        stripePayoutsEnabled: Boolean(result.payoutsEnabled),
        stripeDetailsSubmitted: Boolean(result.detailsSubmitted),
        stripeRequirementsDue: result.requirementsDue ?? []
      });
      setStatus(`Stripe Connect status: ${result.status.replace(/_/g, " ")}.`);
      onRefresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not refresh Stripe Connect status.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <SectionHeader title="Merchant Application" detail="Apply with your business, ownership, tax, documents, and Stripe Connect onboarding." />
      <Card>
        <Field label="Business name" value={application.businessName} onChangeText={(businessName) => patch({ businessName })} />
        <Field label="Legal business name" value={application.legalBusinessName} onChangeText={(legalBusinessName) => patch({ legalBusinessName })} />
        <Choice label="Business type" value={application.businessType} options={["SOLE_PROPRIETORSHIP", "LLC", "CORPORATION", "PARTNERSHIP", "NONPROFIT", "OTHER"]} onChange={(businessType) => patch({ businessType: businessType as BusinessType })} />
        <Field label="Site URL" value={application.siteUrl} onChangeText={(siteUrl) => patch({ siteUrl })} autoCapitalize="none" />
        <Field label="Owner name" value={application.ownerName} onChangeText={(ownerName) => patch({ ownerName })} />
        <Field label="Owner email" value={application.ownerEmail} onChangeText={(ownerEmail) => patch({ ownerEmail })} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Phone" value={application.phone} onChangeText={(phone) => patch({ phone })} keyboardType="number-pad" />
        <Field label="Street" value={application.street1} onChangeText={(street1) => patch({ street1 })} />
        <Field label="Suite / unit" value={application.street2} onChangeText={(street2) => patch({ street2 })} />
        <View style={styles.inline}>
          <Field label="City" value={application.city} onChangeText={(city) => patch({ city })} grow />
          <Field label="State" value={application.state} onChangeText={(state) => patch({ state })} grow />
          <Field label="ZIP" value={application.zip} onChangeText={(zip) => patch({ zip })} keyboardType="number-pad" grow />
        </View>
        <Choice label="Tax identifier" value={application.taxIdType} options={["EIN", "SSN"]} onChange={(taxIdType) => patch({ taxIdType: taxIdType as TaxIdType })} />
        <Field label="Full EIN or SSN" value={application.taxId} onChangeText={(taxId) => patch({ taxId })} keyboardType="number-pad" secureTextEntry />
        {application.taxIdLast4 ? <Text style={styles.copy}>Tax ID on file ending in {application.taxIdLast4}</Text> : null}
        <View style={styles.badgeRow}>
          <Badge label={application.status} />
          <Badge label={`Connect ${application.stripeConnectStatus.replace(/_/g, " ")}`} />
          <Badge label={`${application.documents.length} docs`} />
        </View>
        <Pressable disabled={submitting} onPress={() => save(false)} style={[styles.secondaryButton, submitting && styles.disabled]}>
          <Text style={styles.secondaryButtonText}>Save Application</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`${client.baseUrl}/legal#merchant-terms`)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>View Merchant Terms</Text>
        </Pressable>
        <View style={styles.switchRow}>
          <Text style={styles.label}>I accept SuperPrint merchant terms, platform terms, and Stripe Connect disclosures</Text>
          <Switch value={acceptedLegal} onValueChange={setAcceptedLegal} />
        </View>
        <Pressable disabled={submitting || !acceptedLegal} onPress={() => save(true)} style={[styles.primaryButton, (submitting || !acceptedLegal) && styles.disabled]}>
          {submitting ? <ActivityIndicator color={palette.primaryText} /> : <Text style={styles.primaryButtonText}>Submit Application</Text>}
        </Pressable>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Secure documents</Text>
        <Text style={styles.copy}>Upload business license, tax document, identity document, or address verification. Files are stored privately on the platform.</Text>
        {(["BUSINESS_LICENSE", "TAX_DOCUMENT", "IDENTITY_DOCUMENT", "ADDRESS_VERIFICATION"] as DocumentType[]).map((type) => (
          <Pressable key={type} onPress={() => uploadDocument(type)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Upload {type.replace(/_/g, " ")}</Text>
          </Pressable>
        ))}
        {application.documents.map((document) => (
          <Text key={document.id} style={styles.copy}>{document.type.replace(/_/g, " ")}: {document.fileName}</Text>
        ))}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Stripe Connect onboarding</Text>
        <Text style={styles.copy}>Open Stripe-hosted onboarding to complete identity, business, bank account, and KYC requirements for payments and payouts.</Text>
        <Pressable disabled={submitting || !application.id} onPress={startStripeConnect} style={[styles.primaryButton, (!application.id || submitting) && styles.disabled]}>
          <Text style={styles.primaryButtonText}>Start Stripe Connect</Text>
        </Pressable>
        <Pressable disabled={submitting || !application.stripeAccountId} onPress={refreshStripeConnect} style={[styles.secondaryButton, (!application.stripeAccountId || submitting) && styles.disabled]}>
          <Text style={styles.secondaryButtonText}>Refresh Stripe Status</Text>
        </Pressable>
        {application.stripeRequirementsDue.length ? <Text style={styles.copy}>Requirements due: {application.stripeRequirementsDue.join(", ")}</Text> : null}
        {status ? <Text style={styles.message}>{status}</Text> : null}
      </Card>
    </ScrollView>
  );
}

function EnableScreen({ application, client, onCheckout }: { application: MerchantApplication; client: MerchantClient; onCheckout: () => void }) {
  const { initialize, easyConnect, connectedReader, supportsReadersOfType } = useStripeTerminal({
    onDidAcceptTermsOfService: () => setStatus("Terms accepted. Continue through merchant education."),
    onDidChangeConnectionStatus: (connectionStatus) => setStatus(`Reader ${connectionStatus}.`)
  });
  const [educationComplete, setEducationComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setupProgress, setSetupProgress] = useState(connectedReader ? 100 : 0);
  const [status, setStatus] = useState("Eligible approved merchants can enable Tap to Pay on iPhone here or from checkout.");

  useEffect(() => {
    initialize().catch(() => undefined);
  }, [initialize]);

  async function enable() {
    setLoading(true);
    setSetupProgress(10);
    try {
      if (application.status !== "APPROVED" || application.stripeConnectStatus !== "ENABLED") {
        throw new Error("SuperPrint approval and completed Stripe Connect onboarding are required before Tap to Pay is enabled.");
      }
      setSetupProgress(25);
      const config = await client.get<{ terminalLocationId: string | null }>("/api/merchant/terminal/config");
      if (!config.terminalLocationId) throw new Error("Stripe Terminal location is not configured.");
      setSetupProgress(45);
      const support = await supportsReadersOfType({ discoveryMethod: "tapToPay", deviceType: "tapToPay" });
      if (!support.readerSupportResult) throw new Error("Tap to Pay on iPhone requires iPhone XS or later with supported iOS.");
      setStatus("Initializing Tap to Pay on iPhone. Keep this app open while setup completes.");
      setSetupProgress(70);
      const result = await easyConnect({
        discoveryMethod: "tapToPay",
        locationId: config.terminalLocationId,
        merchantDisplayName: application.businessName || "SuperPrint Merchant",
        tosAcceptancePermitted: true,
        autoReconnectOnUnexpectedDisconnect: true
      });
      if (result.error) throw new Error(result.error.message);
      setSetupProgress(100);
      setStatus("Tap to Pay on iPhone enabled.");
    } catch (error) {
      setSetupProgress(0);
      setStatus(error instanceof Error ? error.message : "Could not enable Tap to Pay on iPhone.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <SectionHeader title="Tap to Pay on iPhone" detail="Enable payment acceptance, accept terms, and review merchant education." />
      <Card>
        <Text style={styles.cardTitle}>Enablement</Text>
        <View style={styles.badgeRow}>
          <Badge label={application.status === "APPROVED" ? "Approved merchant" : application.status} />
          <Badge label={`Connect ${application.stripeConnectStatus.replace(/_/g, " ")}`} />
          <Badge label={connectedReader ? "Enabled" : "Not enabled"} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${setupProgress}%` }]} />
        </View>
        <Text style={styles.copy}>{connectedReader || setupProgress === 100 ? "Tap to Pay on iPhone is ready for checkout." : "Setup progress appears here while the reader is preparing."}</Text>
        <Pressable disabled={loading || application.status !== "APPROVED" || application.stripeConnectStatus !== "ENABLED"} onPress={enable} style={[styles.primaryButton, (loading || application.status !== "APPROVED" || application.stripeConnectStatus !== "ENABLED") && styles.disabled]}>
          {loading ? <ActivityIndicator color={palette.primaryText} /> : <Text style={styles.primaryButtonText}>Enable Tap to Pay on iPhone</Text>}
        </Pressable>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Merchant education</Text>
        <View style={styles.stepList}>
          <Text style={styles.stepText}>1. Ask the customer to hold a contactless card near the top of the iPhone.</Text>
          <Text style={styles.stepText}>2. Customers can also pay with Apple Pay or another digital wallet.</Text>
          <Text style={styles.stepText}>3. If a PIN screen appears, hand the iPhone to the customer so they can enter it privately.</Text>
          <Text style={styles.stepText}>4. If a card cannot complete contactless PIN, ask for another contactless card or digital wallet.</Text>
          <Text style={styles.stepText}>5. Send a confidential digital receipt to the customer by email.</Text>
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Merchant education complete</Text>
          <Switch value={educationComplete} onValueChange={setEducationComplete} />
        </View>
        <Pressable disabled={!educationComplete || application.status !== "APPROVED" || application.stripeConnectStatus !== "ENABLED"} onPress={onCheckout} style={[styles.primaryButton, (!educationComplete || application.status !== "APPROVED" || application.stripeConnectStatus !== "ENABLED") && styles.disabled]}>
          <Text style={styles.primaryButtonText}>Try Checkout</Text>
        </Pressable>
        {status ? <Text style={styles.message}>{status}</Text> : null}
      </Card>
    </ScrollView>
  );
}

function CheckoutScreen({ application, products, client, onOrder }: { application: MerchantApplication; products: Product[]; client: MerchantClient; onOrder: (order: Order) => void }) {
  const { initialize, easyConnect, retrievePaymentIntent, collectPaymentMethod, confirmPaymentIntent, setReaderDisplay, connectedReader, supportsReadersOfType } = useStripeTerminal({
    onDidAcceptTermsOfService: () => setStatus("Terms accepted."),
    onDidChangeConnectionStatus: (connectionStatus) => setStatus(`Reader ${connectionStatus}.`),
    onDidRequestReaderDisplayMessage: (message) => setStatus(`Reader: ${message}`),
    onDidRequestReaderInput: (input) => setStatus(`Reader input: ${input.join(", ")}`)
  });
  const activeProducts = products.filter((item) => item.active);
  const [selectedProductId, setSelectedProductId] = useState(activeProducts[0]?.id ?? "");
  const selectedProduct = activeProducts.find((item) => item.id === selectedProductId) ?? activeProducts[0];
  const [amount, setAmount] = useState(selectedProduct ? dollars(selectedProduct.priceCents) : "0.00");
  const [customerEmail, setCustomerEmail] = useState("");
  const [status, setStatus] = useState("Add an item, choose Tap to Pay, then present a contactless card or wallet.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initialize().catch(() => undefined);
  }, [initialize]);

  useEffect(() => {
    if (selectedProduct) setAmount(dollars(selectedProduct.priceCents));
  }, [selectedProduct?.id]);

  async function ensureReady() {
    if (application.status !== "APPROVED" || application.stripeConnectStatus !== "ENABLED") {
      throw new Error("Complete SuperPrint approval and Stripe Connect onboarding before checkout.");
    }
    setStatus("Initializing Tap to Pay on iPhone...");
    const config = await client.get<{ terminalLocationId: string | null }>("/api/merchant/terminal/config");
    if (!config.terminalLocationId) throw new Error("Stripe Terminal location is not configured.");
    const support = await supportsReadersOfType({ discoveryMethod: "tapToPay", deviceType: "tapToPay" });
    if (!support.readerSupportResult) throw new Error("Tap to Pay on iPhone requires a compatible iPhone and supported iOS.");
    if (connectedReader) return;
    setStatus("Configuring Tap to Pay on iPhone. This may take a moment the first time.");
    const connection = await easyConnect({
      discoveryMethod: "tapToPay",
      locationId: config.terminalLocationId,
      merchantDisplayName: application.businessName || "SuperPrint Merchant",
      tosAcceptancePermitted: true,
      autoReconnectOnUnexpectedDisconnect: true
    });
    if (connection.error) throw new Error(connection.error.message);
  }

  async function charge() {
    setLoading(true);
    try {
      await ensureReady();
      const amountCents = cents(amount);
      if (amountCents <= 0) throw new Error("Enter an amount greater than zero.");
      if (!customerEmail.trim()) throw new Error("Customer email is required for the digital receipt.");
      const itemName = selectedProduct?.name ?? "Counter sale";
      setStatus("Creating payment and opening Tap to Pay on iPhone...");
      const started = await client.post<{ clientSecret: string; paymentIntentId: string }>("/api/merchant/terminal/payment-intent", {
        amountCents,
        customerEmail,
        businessName: application.businessName,
        items: [{ name: itemName, amountCents, quantity: 1 }]
      });
      await setReaderDisplay({ currency: "usd", tax: 0, total: amountCents, lineItems: [{ displayName: itemName, quantity: 1, amount: amountCents }] });
      const retrieved = await retrievePaymentIntent(started.clientSecret);
      if (retrieved.error || !retrieved.paymentIntent) throw new Error(retrieved.error?.message ?? "Could not retrieve payment.");
      const collected = await collectPaymentMethod({ paymentIntent: retrieved.paymentIntent, customerCancellation: "enableIfAvailable", allowRedisplay: "limited" });
      if (collected.error || !collected.paymentIntent) throw new Error(collected.error?.message ?? "Could not collect payment.");
      const confirmed = await confirmPaymentIntent({ paymentIntent: collected.paymentIntent });
      if (confirmed.error || !confirmed.paymentIntent) throw new Error(confirmed.error?.message ?? "Could not confirm payment.");
      const completed = await client.post<{ status: string; receiptEmail: string; receiptUrl?: string | null }>("/api/merchant/terminal/complete", {
        paymentIntentId: confirmed.paymentIntent.id ?? started.paymentIntentId
      });
      onOrder({ id: started.paymentIntentId, customerEmail, itemSummary: itemName, amountCents, status: completed.status, receiptUrl: completed.receiptUrl });
      setStatus(`Approved. Digital receipt sent to ${completed.receiptEmail}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Tap to Pay checkout failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <SectionHeader title="Checkout" detail="Enter an amount or sell a store item and accept Tap to Pay on iPhone." />
      <Card>
        <Text style={styles.cardTitle}>Cart</Text>
        <Pressable disabled={loading || application.status !== "APPROVED" || application.stripeConnectStatus !== "ENABLED"} onPress={charge} style={[styles.primaryButton, (loading || application.status !== "APPROVED" || application.stripeConnectStatus !== "ENABLED") && styles.disabled]}>
          {loading ? <ActivityIndicator color={palette.primaryText} /> : <Text style={styles.primaryButtonText}>Tap to Pay on iPhone</Text>}
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
          {activeProducts.map((product) => (
            <Pressable key={product.id ?? product.name} onPress={() => setSelectedProductId(product.id ?? product.name)} style={[styles.chip, selectedProduct === product && styles.chipActive]}>
              <Text style={[styles.chipText, selectedProduct === product && styles.chipTextActive]}>{product.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field label="Customer receipt email" value={customerEmail} onChangeText={setCustomerEmail} autoCapitalize="none" keyboardType="email-address" />
        {status ? <Text style={styles.message}>{status}</Text> : null}
      </Card>
    </ScrollView>
  );
}

function StoreScreen({ products, setProducts, client }: { products: Product[]; setProducts: (products: Product[]) => void; client: MerchantClient }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("10.00");
  const [status, setStatus] = useState("");

  async function saveProduct(product: Product) {
    const saved = await client.post<{ product: Product }>("/api/merchant/products", product);
    setProducts(product.id ? products.map((item) => item.id === product.id ? saved.product : item) : [saved.product, ...products]);
  }

  async function addProduct() {
    if (!name.trim()) return;
    try {
      await saveProduct({ name: name.trim(), priceCents: cents(price), active: true });
      setName("");
      setPrice("10.00");
      setStatus("Product saved to platform.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save product.");
    }
  }

  async function toggle(product: Product) {
    const updated = { ...product, active: !product.active };
    setProducts(products.map((item) => item.id === product.id ? updated : item));
    await saveProduct(updated).catch((error) => setStatus(error instanceof Error ? error.message : "Could not update product."));
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <SectionHeader title="Store" detail="Manage the products shown at checkout." />
      <Card>
        <Field label="Product name" value={name} onChangeText={setName} />
        <Field label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        <Pressable onPress={addProduct} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Add Product</Text>
        </Pressable>
        {status ? <Text style={styles.message}>{status}</Text> : null}
      </Card>
      {products.map((product) => (
        <Card key={product.id ?? product.name}>
          <View style={styles.rowBetween}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>{product.name}</Text>
              <Text style={styles.copy}>{money(product.priceCents)}</Text>
            </View>
            <Switch value={product.active} onValueChange={() => toggle(product)} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

function OrdersScreen({ orders, onRefresh }: { orders: Order[]; onRefresh: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <SectionHeader title="Orders" detail="Recent in-person payments and receipt status." />
      <Pressable onPress={onRefresh} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Refresh Orders</Text>
      </Pressable>
      {orders.length ? orders.map((order) => (
        <Card key={order.id}>
          <View style={styles.rowBetween}>
            <View style={styles.grow}>
              <Text style={styles.cardTitle}>{order.itemSummary}</Text>
              <Text style={styles.copy}>{order.customerEmail}</Text>
            </View>
            <Text style={styles.money}>{money(order.amountCents)}</Text>
          </View>
          <View style={styles.badgeRow}>
            <Badge label={order.status} />
            <Badge label={order.receiptUrl ? "Receipt ready" : "Receipt pending"} />
          </View>
        </Card>
      )) : (
        <Card><Text style={styles.copy}>No orders yet.</Text></Card>
      )}
    </ScrollView>
  );
}

function SettingsScreen({ backendUrl, setBackendUrl, userEmail, onSignOut }: { backendUrl: string; setBackendUrl: (value: string) => void; userEmail: string; onSignOut: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <SectionHeader title="Settings" detail="Merchant app connection settings for production." />
      <Card>
        <Field label="SuperPrint URL" value={backendUrl} onChangeText={setBackendUrl} autoCapitalize="none" />
        <Text style={styles.copy}>Signed in as {userEmail}</Text>
        <Pressable onPress={onSignOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sign Out</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

function SectionHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.kicker}>SuperPrint Merchant</Text>
      <Text style={styles.h1}>{title}</Text>
      <Text style={styles.muted}>{detail}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Field({
  label,
  value,
  onChangeText,
  grow,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  grow?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "number-pad" | "decimal-pad";
  secureTextEntry?: boolean;
}) {
  return (
    <View style={[styles.field, grow && styles.grow]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} style={styles.input} placeholderTextColor={palette.muted} {...props} />
    </View>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
        {options.map((option) => (
          <Pressable key={option} onPress={() => onChange(option)} style={[styles.chip, value === option && styles.chipActive]}>
            <Text style={[styles.chipText, value === option && styles.chipTextActive]}>{option.replace(/_/g, " ")}</Text>
          </Pressable>
        ))}
      </ScrollView>
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

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

class MerchantClient {
  constructor(public baseUrl: string, private token: string) {}

  async get<T>(path: string) {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" }
    });
  }

  async upload<T>(path: string, body: FormData) {
    return this.request<T>(path, { method: "POST", body });
  }

  private async request<T>(path: string, init: RequestInit) {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
    };
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Merchant request failed.");
    return data as T;
  }
}

function cents(value: string) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

function dollars(value: number) {
  return (value / 100).toFixed(2);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
}

function createStyles(palette: ThemePalette) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: palette.card, borderBottomColor: palette.line, borderBottomWidth: 1 },
  brandButton: { flex: 1 },
  brand: { color: palette.ink, fontSize: 18, fontWeight: "900" },
  brandSub: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  iconButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, backgroundColor: palette.secondaryBg, borderWidth: 1, borderColor: palette.secondaryBorder },
  iconButtonText: { color: palette.primary, fontWeight: "900", fontSize: 12 },
  nav: { flexGrow: 0, backgroundColor: palette.card, borderBottomColor: palette.line, borderBottomWidth: 1 },
  navInner: { padding: 10, gap: 8 },
  navPill: { minHeight: 36, justifyContent: "center", paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.field },
  navPillActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  navText: { color: palette.slate, fontSize: 12, fontWeight: "900" },
  navTextActive: { color: palette.primaryText },
  content: { flex: 1 },
  screen: { flex: 1 },
  body: { padding: 18, gap: 14, paddingBottom: 36 },
  sectionHeader: { gap: 5 },
  kicker: { color: palette.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  h1: { color: palette.ink, fontSize: 28, fontWeight: "900", lineHeight: 32 },
  muted: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  copy: { color: palette.slate, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: palette.card, borderColor: palette.line, borderWidth: 1, borderRadius: 8, padding: 16, gap: 12 },
  cardTitle: { color: palette.ink, fontSize: 18, fontWeight: "900" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "47.8%", backgroundColor: palette.card, borderColor: palette.line, borderWidth: 1, borderRadius: 8, padding: 14 },
  metricValue: { color: palette.ink, fontSize: 19, fontWeight: "900", textTransform: "capitalize" },
  metricLabel: { color: palette.muted, fontSize: 12, fontWeight: "800" },
  primaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  primaryButtonText: { color: palette.primaryText, fontWeight: "900", fontSize: 15 },
  secondaryButton: { minHeight: 44, borderRadius: 8, backgroundColor: palette.secondaryBg, borderWidth: 1, borderColor: palette.secondaryBorder, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  secondaryButtonText: { color: palette.primary, fontWeight: "900", fontSize: 14 },
  disabled: { opacity: 0.5 },
  field: { gap: 6 },
  label: { color: palette.ink, fontSize: 12, fontWeight: "900" },
  input: { minHeight: 46, color: palette.ink, backgroundColor: palette.field, borderColor: palette.line, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 15 },
  inline: { flexDirection: "row", gap: 10 },
  grow: { flex: 1 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { borderRadius: 999, backgroundColor: palette.secondaryBg, borderWidth: 1, borderColor: palette.secondaryBorder, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: palette.primary, fontSize: 11, fontWeight: "900", textTransform: "capitalize" },
  message: { color: palette.primary, backgroundColor: palette.secondaryBg, borderColor: palette.secondaryBorder, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: palette.card, borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: 20, gap: 14, borderTopColor: palette.line, borderTopWidth: 1 },
  modalTitle: { color: palette.ink, fontSize: 30, lineHeight: 34, fontWeight: "900" },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: palette.secondaryBg, borderColor: palette.secondaryBorder, borderWidth: 1, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: palette.primary },
  stepList: { gap: 8 },
  stepText: { color: palette.slate, fontSize: 13, lineHeight: 19 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  chipRail: { gap: 8 },
  chip: { minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.field },
  chipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  chipText: { color: palette.slate, fontWeight: "900", fontSize: 12 },
  chipTextActive: { color: palette.primaryText },
  segment: { flexDirection: "row", borderWidth: 1, borderColor: palette.line, borderRadius: 8, padding: 4, gap: 4 },
  segmentItem: { flex: 1, alignItems: "center", borderRadius: 6, paddingVertical: 10 },
  segmentItemActive: { backgroundColor: palette.primary },
  segmentText: { color: palette.muted, fontSize: 12, fontWeight: "900" },
  segmentTextActive: { color: palette.primaryText, fontSize: 12, fontWeight: "900" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  money: { color: palette.primary, fontWeight: "900", fontSize: 18 }
  });
}
