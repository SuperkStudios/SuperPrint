import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptSensitiveField } from "@/lib/secure-fields";
import { requireMerchantUser } from "@/lib/merchant-app";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  businessName: z.string().trim().min(2),
  legalBusinessName: z.string().trim().optional(),
  businessType: z.enum(["SOLE_PROPRIETORSHIP", "LLC", "CORPORATION", "PARTNERSHIP", "NONPROFIT", "OTHER"]),
  siteUrl: z.string().trim().url(),
  ownerName: z.string().trim().min(2),
  ownerEmail: z.string().trim().email(),
  phone: z.string().trim().min(7),
  street1: z.string().trim().min(3),
  street2: z.string().trim().optional(),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  zip: z.string().trim().min(5),
  country: z.string().trim().default("US"),
  taxIdType: z.enum(["EIN", "SSN"]),
  taxId: z.string().trim().regex(/^[0-9-]{4,16}$/),
  acceptedLegal: z.boolean().optional(),
  submit: z.boolean().optional()
});

export async function GET() {
  const { application, response } = await requireMerchantUser();
  if (response) return response;
  return NextResponse.json({ application: application ? publicApplication(application) : null });
}

export async function POST(request: Request) {
  const { session, application, response } = await requireMerchantUser();
  if (response) return response;

  try {
    const body = schema.parse(await request.json());
    if (body.submit && !body.acceptedLegal) {
      return NextResponse.json({ error: "You must accept the merchant and platform terms before submitting." }, { status: 400 });
    }
    const taxDigits = body.taxId.replace(/\D/g, "");
    const status = body.submit ? "SUBMITTED" : application?.status ?? "DRAFT";
    const saved = await prisma.merchantApplication.upsert({
      where: { id: application?.id ?? "__new__" },
      create: {
        userId: session.user.id,
        businessName: body.businessName,
        legalBusinessName: body.legalBusinessName || null,
        businessType: body.businessType,
        siteUrl: body.siteUrl,
        ownerName: body.ownerName,
        ownerEmail: body.ownerEmail,
        phone: body.phone,
        street1: body.street1,
        street2: body.street2 || null,
        city: body.city,
        state: body.state,
        zip: body.zip,
        country: body.country,
        taxIdType: body.taxIdType,
        taxIdLast4: taxDigits.slice(-4),
        encryptedTaxId: encryptSensitiveField(taxDigits),
        status,
        submittedAt: body.submit ? new Date() : null
      },
      update: {
        businessName: body.businessName,
        legalBusinessName: body.legalBusinessName || null,
        businessType: body.businessType,
        siteUrl: body.siteUrl,
        ownerName: body.ownerName,
        ownerEmail: body.ownerEmail,
        phone: body.phone,
        street1: body.street1,
        street2: body.street2 || null,
        city: body.city,
        state: body.state,
        zip: body.zip,
        country: body.country,
        taxIdType: body.taxIdType,
        taxIdLast4: taxDigits.slice(-4),
        encryptedTaxId: encryptSensitiveField(taxDigits),
        status,
        submittedAt: body.submit ? new Date() : application?.submittedAt
      },
      include: { documents: { orderBy: { uploadedAt: "desc" } } }
    });
    return NextResponse.json({ application: publicApplication(saved) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save merchant application." }, { status: 400 });
  }
}

function publicApplication(application: {
  id: string;
  status: string;
  businessName: string;
  legalBusinessName: string | null;
  businessType: string;
  siteUrl: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  taxIdType: string;
  taxIdLast4: string;
  stripeConnectStatus: string;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  stripeRequirementsDue: unknown;
  submittedAt: Date | null;
  documents?: Array<{ id: string; type: string; fileName: string; uploadedAt: Date }>;
}) {
  return {
    ...application,
    taxId: "",
    submittedAt: application.submittedAt?.toISOString() ?? null,
    documents: application.documents?.map((document) => ({
      id: document.id,
      type: document.type,
      fileName: document.fileName,
      uploadedAt: document.uploadedAt.toISOString()
    })) ?? []
  };
}
