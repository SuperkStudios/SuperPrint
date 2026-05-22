import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useStripeTerminal } from "@stripe/stripe-terminal-react-native";

type Props = {
  backendUrl: string;
  adminSessionCookie: string;
};

export function TerminalScreen({ backendUrl, adminSessionCookie }: Props) {
  const [status, setStatus] = useState("Starting Terminal SDK...");
  const [terminalLocationId, setTerminalLocationId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [amount, setAmount] = useState("0.00");

  const {
    initialize,
    discoverReaders,
    connectReader,
    retrievePaymentIntent,
    collectPaymentMethod,
    confirmPaymentIntent,
    discoveredReaders,
    connectedReader
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: () => setStatus("Phone reader discovered."),
    onDidChangeConnectionStatus: (connectionStatus) => setStatus(`Connection: ${connectionStatus}`)
  });

  useEffect(() => {
    initialize();
    fetch(`${backendUrl}/api/admin/pos/terminal/config`, {
      headers: adminSessionCookie ? { Cookie: adminSessionCookie } : undefined
    })
      .then((response) => response.json())
      .then((body) => setTerminalLocationId(body.terminalLocationId ?? ""))
      .catch(() => setStatus("Could not load Terminal config."));
  }, [adminSessionCookie, backendUrl, initialize]);

  async function connectPhoneReader() {
    setStatus("Checking Tap to Pay support...");
    const discovery = await discoverReaders({ discoveryMethod: "tapToPay" });
    if (discovery.error) {
      setStatus(discovery.error.message);
      return;
    }
    const reader = discoveredReaders[0];
    if (!reader) {
      setStatus("No Tap to Pay reader found on this device.");
      return;
    }
    const connection = await connectReader({
      discoveryMethod: "tapToPay",
      reader,
      locationId: terminalLocationId
    });
    setStatus(connection.error ? connection.error.message : "This phone is connected as the reader.");
  }

  async function chargeSampleOrder() {
    setStatus("Creating SuperPrint order...");
    const cents = Math.max(0, Math.round(Number(amount || 0) * 100));
    const response = await fetch(`${backendUrl}/api/admin/pos/terminal/payment-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminSessionCookie ? { Cookie: adminSessionCookie } : {})
      },
      body: JSON.stringify({
        customerName,
        customerEmail,
        savePaymentMethod: true,
        lines: [{
          productId: "replace-with-product-id",
          quantity: 1,
          unitPriceCents: cents,
          selectedFilamentMaterialIds: [],
          selectedColors: []
        }]
      })
    });
    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error ?? "Could not create order.");
      return;
    }
    const retrieved = await retrievePaymentIntent(body.clientSecret);
    if (retrieved.error || !retrieved.paymentIntent) {
      setStatus(retrieved.error?.message ?? "Could not retrieve PaymentIntent.");
      return;
    }
    const collected = await collectPaymentMethod({
      paymentIntent: retrieved.paymentIntent,
      enableCustomerCancellation: true
    });
    if (collected.error || !collected.paymentIntent) {
      setStatus(collected.error?.message ?? "Could not collect card.");
      return;
    }
    const confirmed = await confirmPaymentIntent({ paymentIntent: collected.paymentIntent });
    if (confirmed.error || !confirmed.paymentIntent) {
      setStatus(confirmed.error?.message ?? "Could not confirm payment.");
      return;
    }
    await fetch(`${backendUrl}/api/admin/pos/terminal/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(adminSessionCookie ? { Cookie: adminSessionCookie } : {})
      },
      body: JSON.stringify({ orderId: body.order.id, paymentIntentId: confirmed.paymentIntent.stripeId, queueNow: true })
    });
    setStatus("Payment complete.");
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.label}>Status</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.label}>Terminal location</Text>
      <TextInput value={terminalLocationId} onChangeText={setTerminalLocationId} placeholder="tml_..." style={styles.input} />
      <Text style={styles.label}>Customer</Text>
      <TextInput value={customerName} onChangeText={setCustomerName} placeholder="Name" style={styles.input} />
      <TextInput value={customerEmail} onChangeText={setCustomerEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <Text style={styles.label}>Amount</Text>
      <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.input} />
      <Pressable style={styles.button} onPress={connectPhoneReader}>
        <Text style={styles.buttonText}>{connectedReader ? "Reconnect phone reader" : "Use this phone as reader"}</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.secondary]} onPress={chargeSampleOrder}>
        <Text style={styles.buttonText}>Charge sample order</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 12 },
  label: { color: "#0f172a", fontWeight: "700", fontSize: 13 },
  status: { color: "#475569", backgroundColor: "#e0f2fe", borderRadius: 8, padding: 12 },
  input: { backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 8, padding: 12 },
  button: { alignItems: "center", backgroundColor: "#06b6d4", borderRadius: 8, padding: 14 },
  secondary: { backgroundColor: "#0f172a" },
  buttonText: { color: "#ffffff", fontWeight: "800" }
});
