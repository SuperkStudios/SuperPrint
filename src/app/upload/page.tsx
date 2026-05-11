import { UploadForm } from "@/components/upload-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UploadPage() {
  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[0.8fr_1.2fr] lg:px-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Upload an STL</h1>
        <p className="mt-3 text-muted-foreground">
          Custom models enter an approval queue. Once approved, SuperPrint creates a checkout-ready order with price,
          ETA, material, and queue placement.
        </p>
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
