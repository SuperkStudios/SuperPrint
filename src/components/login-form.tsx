"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [mode, setMode] = useState<"signin" | "signup">(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [message, setMessage] = useState("");
  const [canResendVerification, setCanResendVerification] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setCanResendVerification(false);
    if (mode === "signup" && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    if (mode === "signup" && username.trim().length < 3) {
      setMessage("Choose a username with at least 3 characters.");
      return;
    }
    if (mode === "signup" && !acceptedLegal) {
      setMessage("Accept the Terms and Privacy Policy before creating an account.");
      return;
    }
    const endpoint = mode === "signin" ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        name: name || username || email.split("@")[0],
        username,
        callbackURL: nextPath
      })
    });
    if (response.ok) {
      if (mode === "signup") {
        setMessage("Account created. Check your email to verify before signing in.");
        setCanResendVerification(true);
        return;
      }
      window.location.href = nextPath;
      return;
    }
    const body = await response.json().catch(() => null);
    if (body?.code === "EMAIL_NOT_VERIFIED" || body?.error === "EMAIL_NOT_VERIFIED") {
      setMessage("Verify your email before signing in. We sent a fresh verification link.");
      setCanResendVerification(true);
      return;
    }
    setMessage(body?.message ?? body?.error ?? "Authentication failed.");
  }

  async function resendVerification() {
    if (!email) {
      setMessage("Enter your email, then resend verification.");
      return;
    }
    setMessage("Sending verification email...");
    const response = await fetch("/api/account/verification/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, callbackURL: nextPath })
    });
    setMessage(response.ok ? "Verification email sent. Check your inbox." : "Could not send verification email.");
    setCanResendVerification(response.ok);
  }

  async function social(provider: "google" | "apple") {
    const response = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, callbackURL: nextPath })
    });
    const body = await response.json().catch(() => null);
    if (body?.url) {
      window.location.href = body.url;
      return;
    }
    setMessage(body?.message ?? `${provider} sign-in is not configured yet.`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={() => social("google")}>Continue with Google</Button>
        <Button type="button" variant="outline" onClick={() => social("apple")}>Continue with Apple</Button>
      </div>
      <div className="flex rounded border p-1 text-sm">
        <button type="button" onClick={() => setMode("signin")} className={`flex-1 rounded px-3 py-2 ${mode === "signin" ? "bg-primary text-primary-foreground" : ""}`}>Sign in</button>
        <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded px-3 py-2 ${mode === "signup" ? "bg-primary text-primary-foreground" : ""}`}>Create account</button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
          </>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
        ) : null}
        {mode === "signup" ? (
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="mt-1" checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} />
            <span>
              I agree to the <a href="/legal#terms" className="font-medium text-primary hover:underline">Terms of Service</a> and <a href="/legal#privacy" className="font-medium text-primary hover:underline">Privacy Policy</a>.
            </span>
          </label>
        ) : null}
        <Button type="submit" className="w-full">{mode === "signin" ? "Sign in" : "Create account"}</Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {canResendVerification ? (
          <Button type="button" variant="outline" className="w-full" onClick={resendVerification}>
            Resend verification email
          </Button>
        ) : null}
      </form>
    </div>
  );
}

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}
