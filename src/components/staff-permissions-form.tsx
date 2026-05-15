"use client";

import { useState } from "react";
import { adminNavigation, staffPermissions, type StaffPermission } from "@/domain/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StaffPermissionsForm({ staff }: { staff: Array<{ id: string; name: string; email: string; role: string; staffPermissions: unknown }> }) {
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setMessage("");
    const response = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        role: String(formData.get("role") ?? "STAFF"),
        permissions: formData.getAll("permissions").map(String)
      })
    });
    const body = await response.json().catch(() => null);
    setMessage(response.ok ? body?.temporaryPassword ? `Staff invited. Temporary password: ${body.temporaryPassword}` : "Staff updated." : body?.error ?? "Staff update failed.");
    if (response.ok && !body?.temporaryPassword) window.location.reload();
  }

  return (
    <div className="grid gap-6">
      <form action={submit} className="grid gap-4 rounded border bg-card p-4 text-card-foreground shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <Field name="name" label="Name" placeholder="Operator name" />
          <Field name="email" label="Email" type="email" placeholder="operator@example.com" />
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <select id="role" name="role" className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
        <PermissionGrid defaultPermissions={["dashboard", "queue", "orders", "filament"]} />
        <Button type="submit" className="w-fit">Invite or update staff</Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </form>

      <div className="overflow-x-auto rounded border bg-card text-card-foreground shadow-sm">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1fr_120px_1.4fr] gap-4 bg-muted px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
            <span>Staff</span>
            <span>Role</span>
            <span>Permissions</span>
          </div>
          {staff.map((member) => (
            <div key={member.id} className="grid grid-cols-[1fr_120px_1.4fr] gap-4 border-t px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-muted-foreground">{member.email}</p>
              </div>
              <span>{member.role}</span>
              <span className="text-muted-foreground">{formatPermissions(member.staffPermissions)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PermissionGrid({ defaultPermissions }: { defaultPermissions: StaffPermission[] }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Allowed admin work</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {staffPermissions.map((permission) => {
          const label = adminNavigation.find((item) => item.permission === permission)?.label ?? permission;
          return (
            <label key={permission} className="flex items-center gap-2 rounded border bg-background p-3 text-sm">
              <input type="checkbox" name="permissions" value={permission} defaultChecked={defaultPermissions.includes(permission)} />
              {label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Field({ name, label, type = "text", placeholder }: { name: string; label: string; type?: string; placeholder?: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required />
    </div>
  );
}

function formatPermissions(value: unknown) {
  const permissions = Array.isArray(value) ? value.map(String) : [];
  if (!permissions.length) return "No restricted permissions";
  return permissions.map((permission) => adminNavigation.find((item) => item.permission === permission)?.label ?? permission).join(", ");
}
