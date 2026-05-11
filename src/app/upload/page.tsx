import { getServerSession } from "next-auth";
import { UploadForm } from "@/components/upload-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthRequired } from "@/components/auth-required";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return (
      <AuthRequired
        title="Sign in to upload an STL"
        copy="Uploads become private customer jobs, so SuperPrint needs an account before accepting model files."
      />
    );
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[0.8fr_1.2fr] lg:px-8">
      <div>
        <p className="text-sm font-medium text-primary">Custom print request</p>
        <h1 className="text-3xl font-semibold tracking-tight">Upload an STL</h1>
        <p className="mt-3 text-muted-foreground">
          Custom models enter an approval queue. Once approved, SuperPrint creates a checkout-ready order with price,
          ETA, material, and queue placement.
        </p>
        <div className="mt-6 space-y-3 text-sm text-muted-foreground">
          <p className="rounded border bg-white p-3">Accepted files: `.stl` up to 150MB.</p>
          <p className="rounded border bg-white p-3">Review includes material fit, printability, risk, ETA, and price.</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Model approval request</CardTitle>
          <CardDescription>Demo mode stores metadata and resolves a Docker volume upload target.</CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>
    </main>
  );
}
