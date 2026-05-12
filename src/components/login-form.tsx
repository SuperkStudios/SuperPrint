"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (mode === "signup" && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    if (mode === "signup" && username.trim().length < 3) {
      setMessage("Choose a username with at least 3 characters.");
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
        callbackURL: "/dashboard"
      })
    });
    if (response.ok) {
      window.location.href = "/dashboard";
      return;
    }
    const body = await response.json().catch(() => null);
    setMessage(body?.message ?? body?.error ?? "Authentication failed.");
  }

  async function social(provider: "google" | "apple") {
    const response = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, callbackURL: "/dashboard" })
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
        <Button type="submit" className="w-full">{mode === "signin" ? "Sign in" : "Create account"}</Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </form>
    </div>
  );
}
