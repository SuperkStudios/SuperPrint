"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({ user }: { user: { name: string; image?: string | null; username?: string | null; bio?: string | null } }) {
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setMessage("");
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        image: String(formData.get("image") ?? ""),
        username: String(formData.get("username") ?? ""),
        bio: String(formData.get("bio") ?? "")
      })
    });
    setMessage(response.ok ? "Profile updated." : (await response.json().catch(() => null))?.error ?? "Profile update failed.");
  }

  return (
    <form action={submit} className="space-y-4 rounded border bg-white p-5">
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
        <textarea id="bio" name="bio" defaultValue={user.bio ?? ""} className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <Button type="submit">Save profile</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
