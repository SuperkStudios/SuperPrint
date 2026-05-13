import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { PageShell } from "@/components/cyber-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AuthRequired({ title, copy }: { title: string; copy: string }) {
  return (
    <PageShell className="flex items-start justify-center">
      <Card className="mt-8 w-full max-w-2xl">
        <CardContent className="p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded bg-primary/10 text-primary">
            <LockKeyhole className="size-5" />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-muted-foreground">{copy}</p>
          <Button asChild className="mt-6">
            <Link href="/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
