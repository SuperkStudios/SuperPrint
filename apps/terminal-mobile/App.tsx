import { SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { StripeTerminalProvider } from "@stripe/stripe-terminal-react-native";
import { TerminalScreen } from "./src/TerminalScreen";

const backendUrl = process.env.EXPO_PUBLIC_SUPERPRINT_URL ?? "http://localhost:3000";
const adminSessionCookie = process.env.EXPO_PUBLIC_SUPERPRINT_SESSION_COOKIE ?? "";

async function fetchConnectionToken() {
  const response = await fetch(`${backendUrl}/api/admin/pos/terminal/connection-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(adminSessionCookie ? { Cookie: adminSessionCookie } : {})
    }
  });
  const body = await response.json();
  if (!response.ok || !body.secret) throw new Error(body.error ?? "Could not fetch Terminal token.");
  return body.secret;
}

export default function App() {
  return (
    <StripeTerminalProvider logLevel="verbose" tokenProvider={fetchConnectionToken}>
      <SafeAreaView style={styles.shell}>
        <View style={styles.header}>
          <Text style={styles.kicker}>SuperPrint</Text>
          <Text style={styles.title}>Phone Terminal</Text>
          <Text style={styles.copy}>Native Tap to Pay app shell for Stripe Terminal.</Text>
          <TextInput value={backendUrl} editable={false} style={styles.input} />
        </View>
        <TerminalScreen backendUrl={backendUrl} adminSessionCookie={adminSessionCookie} />
      </SafeAreaView>
    </StripeTerminalProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#f8fafc" },
  header: { padding: 20, gap: 6, backgroundColor: "#ffffff", borderBottomColor: "#dbe2ea", borderBottomWidth: 1 },
  kicker: { color: "#0891b2", fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "800" },
  copy: { color: "#475569", fontSize: 14 },
  input: { marginTop: 8, borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 8, padding: 10, color: "#334155" }
});
