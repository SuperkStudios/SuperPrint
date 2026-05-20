"use client";

import { useState } from "react";
import type React from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/utils";

type AdminFactoryData = Awaited<ReturnType<typeof import("@/services/factory-evolution").getAdminFactoryEvolution>>;

export function AdminFactoryEvolutionManager({ data }: { data: AdminFactoryData }) {
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setSaving(String(formData.get("resource")));
    setMessage("");
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch("/api/admin/factory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coercePayload(payload))
    });
    const body = await response.json().catch(() => ({}));
    setSaving("");
    setMessage(response.ok ? "Factory settings saved." : body.error ?? "Could not save factory settings.");
    if (response.ok) window.location.reload();
  }

  return (
    <div className="grid gap-6">
      {message ? <div className="rounded border bg-card p-3 text-sm">{message}</div> : null}

      <Editor title="Upgrade goal" resource="goal" saving={saving} onSubmit={submit}>
        <Field name="title" label="Title" placeholder="4-Color Printing System" />
        <Field name="slug" label="Slug" placeholder="4-color-printing-system" />
        <Textarea name="description" label="Description" placeholder="What this unlocks for the production line." />
        <Select name="category" label="Category" options={["printer", "material", "camera", "automation", "facility", "livestream", "quality", "experimental"]} />
        <Select name="status" label="Status" options={["active", "funded", "installing", "completed", "cancelled"]} defaultValue="active" />
        <Select name="visibility" label="Visibility" options={["public", "private"]} defaultValue="public" />
        <Field name="targetAmountCents" label="Target cents" type="number" defaultValue="140000" />
        <Field name="currentAmountCents" label="Current cents" type="number" defaultValue="0" />
        <Field name="contributionCount" label="Contribution count" type="number" defaultValue="0" />
        <Textarea name="unlockBenefitsText" label="Unlock benefits, one per line" />
        <Field name="imageUrl" label="Image URL" />
        <Field name="displayOrder" label="Display order" type="number" defaultValue="0" />
        <Checkbox name="featured" label="Featured goal" />
      </Editor>

      <Card>
        <CardHeader><CardTitle>Current Goals and Manual Progress</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {data.goals.map((goal) => (
            <GoalProgressEditor key={goal.id} goal={goal} saving={saving} onSubmit={submit} />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Live factory stats</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.stats.map((stat) => (
              <div key={stat.id} className="rounded border p-3 text-sm">
                <p className="text-muted-foreground">{stat.label}</p>
                <p className="mt-2 text-xl font-semibold">{stat.value}{stat.unit ?? ""}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Editor title="Milestone" resource="milestone" saving={saving} onSubmit={submit}>
          <Field name="title" label="Title" placeholder="100 Completed Prints" />
          <Field name="slug" label="Slug" />
          <Textarea name="description" label="Description" />
          <Select name="metric" label="Metric" options={["completed_prints", "filament_grams", "queue_watch_hours", "printer_uptime_hours", "contribution_cents", "livestream_engagement", "custom"]} />
          <Field name="targetValue" label="Target value" type="number" defaultValue="100" />
          <Field name="currentValue" label="Current value" type="number" defaultValue="0" />
          <Field name="unitLabel" label="Unit label" />
          <Field name="displayOrder" label="Display order" type="number" defaultValue="0" />
          <Select name="visibility" label="Visibility" options={["public", "private"]} />
          <Checkbox name="completed" label="Completed" />
        </Editor>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Editor title="Supporter tier" resource="tier" saving={saving} onSubmit={submit}>
          <Field name="title" label="Title" placeholder="Builder" />
          <Field name="slug" label="Slug" />
          <Textarea name="description" label="Description" />
          <Field name="monthlyPriceCents" label="Monthly cents" type="number" />
          <Field name="oneTimePriceCents" label="One-time cents" type="number" />
          <Textarea name="perksText" label="Perks, one per line" />
          <Field name="badgeIcon" label="Badge icon" defaultValue="Builder" />
          <Field name="badgeColor" label="Badge color" defaultValue="#22d3ee" />
          <Field name="priorityWeight" label="Priority weight" type="number" step="0.01" defaultValue="1.03" />
          <Field name="displayOrder" label="Display order" type="number" defaultValue="0" />
          <Checkbox name="active" label="Active" defaultChecked />
        </Editor>

        <Editor title="Unlocked upgrade" resource="unlockedUpgrade" saving={saving} onSubmit={submit}>
          <Field name="title" label="Title" placeholder="New filament color unlocked" />
          <Textarea name="description" label="Description" />
          <Select name="category" label="Category" options={["printer", "material", "camera", "automation", "facility", "livestream", "quality", "experimental"]} />
          <Select name="goalId" label="Related goal" options={["", ...data.goals.map((goal) => goal.id)]} labels={["No related goal", ...data.goals.map((goal) => goal.title)]} />
          <Field name="imageUrl" label="Image URL" />
          <Field name="displayOrder" label="Display order" type="number" defaultValue="0" />
          <Checkbox name="public" label="Public" defaultChecked />
        </Editor>
      </div>

      <Card>
        <CardHeader><CardTitle>Configured Items</CardTitle></CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <List title="Milestones" items={data.milestones.map((item) => ({ id: item.id, title: item.title, meta: `${item.currentValue}/${item.targetValue}` }))} resource="milestone" onSubmit={submit} />
          <List title="Tiers" items={data.tiers.map((item) => ({ id: item.id, title: item.title, meta: item.active ? "active" : "inactive" }))} resource="tier" onSubmit={submit} />
        </CardContent>
      </Card>
    </div>
  );
}

function Editor({ title, resource, saving, children, onSubmit }: { title: string; resource: string; saving: string; children: React.ReactNode; onSubmit: (formData: FormData) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }} className="grid gap-4">
          <input type="hidden" name="resource" value={resource} />
          <input type="hidden" name="action" value="upsert" />
          <div className="grid gap-4 md:grid-cols-2">{children}</div>
          <Button className="w-fit" disabled={saving === resource}>{saving === resource ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <label className="grid gap-2 text-sm"><Label>{label}</Label><Input {...props} /></label>;
}

function Textarea({ label, name, placeholder, defaultValue }: { label: string; name: string; placeholder?: string; defaultValue?: string }) {
  return <label className="grid gap-2 text-sm md:col-span-2"><Label>{label}</Label><textarea name={name} placeholder={placeholder} defaultValue={defaultValue} className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm" /></label>;
}

function Select({ label, name, options, labels, defaultValue }: { label: string; name: string; options: string[]; labels?: string[]; defaultValue?: string }) {
  return (
    <label className="grid gap-2 text-sm">
      <Label>{label}</Label>
      <select name={name} defaultValue={defaultValue} className="h-10 rounded-md border bg-background px-3 text-sm">
        {options.map((option, index) => <option key={option || "none"} value={option}>{labels?.[index] ?? option}</option>)}
      </select>
    </label>
  );
}

function Checkbox({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} /> {label}</label>;
}

function Existing({ resource, id, title, meta, onSubmit }: { resource: string; id: string; title: string; meta: string; onSubmit: (formData: FormData) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border p-3 text-sm">
      <div><p className="font-medium">{title}</p><p className="text-muted-foreground">{meta}</p></div>
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }}>
        <input type="hidden" name="resource" value={resource} />
        <input type="hidden" name="action" value="delete" />
        <input type="hidden" name="id" value={id} />
        <Button variant="outline" size="sm"><Trash2 className="size-4" /> Delete</Button>
      </form>
    </div>
  );
}

function GoalProgressEditor({ goal, saving, onSubmit }: { goal: AdminFactoryData["goals"][number]; saving: string; onSubmit: (formData: FormData) => void }) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }} className="grid gap-4 rounded border p-3 text-sm">
      <input type="hidden" name="resource" value="goal" />
      <input type="hidden" name="action" value="upsert" />
      <input type="hidden" name="id" value={goal.id} />
      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <p className="font-medium">{goal.title}</p>
          <p className="text-muted-foreground">{money(goal.currentAmountCents)} / {money(goal.targetAmountCents)}</p>
        </div>
        <Field name="title" label="Title" defaultValue={goal.title} />
        <Field name="slug" label="Slug" defaultValue={goal.slug} />
        <Field name="currentAmountCents" label="Current cents" type="number" defaultValue={String(goal.currentAmountCents)} />
        <Field name="targetAmountCents" label="Target cents" type="number" defaultValue={String(goal.targetAmountCents)} />
        <Field name="contributionCount" label="Contribution count" type="number" defaultValue={String(goal.contributionCount)} />
        <Field name="displayOrder" label="Display order" type="number" defaultValue={String(goal.displayOrder)} />
        <Select name="category" label="Category" options={["printer", "material", "camera", "automation", "facility", "livestream", "quality", "experimental"]} defaultValue={goal.category} />
        <Select name="status" label="Status" options={["active", "funded", "installing", "completed", "cancelled"]} defaultValue={goal.status} />
        <Select name="visibility" label="Visibility" options={["public", "private"]} defaultValue={goal.visibility} />
        <Field name="imageUrl" label="Image URL" defaultValue={goal.imageUrl ?? ""} />
        <Checkbox name="featured" label="Featured" defaultChecked={goal.featured} />
      </div>
      <Textarea name="description" label="Description" defaultValue={goal.description} />
      <Textarea name="unlockBenefitsText" label="Unlock benefits, one per line" defaultValue={goal.unlockBenefits.join("\n")} />
      <div className="flex gap-2">
        <Button size="sm" disabled={saving === "goal"}>{saving === "goal" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Update</Button>
        <Button type="button" variant="outline" size="sm" onClick={(event) => {
          const form = event.currentTarget.closest("form");
          if (!form) return;
          const formData = new FormData(form);
          formData.set("action", "delete");
          onSubmit(formData);
        }}><Trash2 className="size-4" /> Delete</Button>
      </div>
    </form>
  );
}

function List({ title, items, resource, onSubmit }: { title: string; items: Array<{ id: string; title: string; meta: string }>; resource: string; onSubmit: (formData: FormData) => void }) {
  return <div className="grid gap-2"><p className="font-medium">{title}</p>{items.map((item) => <Existing key={item.id} resource={resource} id={item.id} title={item.title} meta={item.meta} onSubmit={onSubmit} />)}</div>;
}

function coercePayload(payload: Record<string, FormDataEntryValue>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const stringValue = String(value);
    if (["targetAmountCents", "currentAmountCents", "contributionCount", "displayOrder", "monthlyPriceCents", "oneTimePriceCents", "targetValue", "currentValue"].includes(key)) {
      result[key] = stringValue === "" ? null : Number(stringValue);
    } else if (["priorityWeight"].includes(key)) {
      result[key] = stringValue === "" ? 1 : Number(stringValue);
    } else {
      result[key] = stringValue;
    }
  }
  for (const key of ["featured", "completed", "active", "public"]) {
    result[key] = payload[key] === "on";
  }
  return result;
}
