import { Prisma } from "@prisma/client";
import { defaultEmailTemplates, emailSettingKeys, resolveEmailSettings, type EmailTemplateId } from "@/domain/email-templates";
import { prisma } from "@/lib/prisma";

type EmailVariables = Record<string, string | number | null | undefined>;

type SendTemplateEmailInput = {
  templateId: EmailTemplateId;
  to: string | string[];
  variables?: EmailVariables;
  from?: "noreply" | "support";
  replyTo?: string | null;
};

type EmailOrder = Prisma.OrderGetPayload<{
  include: { customer: true; product: true; upload: true; items: { include: { product: true } } };
}>;

export async function getEmailSettings() {
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: emailSettingKeys() } } });
  return resolveEmailSettings(Object.fromEntries(settings.map((setting) => [setting.key, setting.value])));
}

export async function sendTemplateEmail(input: SendTemplateEmailInput) {
  const settings = await getEmailSettings();
  if (!settings.apiUrl || !settings.apiKey) return { skipped: true, reason: "SuperMail API is not configured." };
  const template = settings.templates.find((item) => item.id === input.templateId) ?? defaultEmailTemplates.find((item) => item.id === input.templateId);
  if (!template) return { skipped: true, reason: "Unknown email template." };

  const variables = normalizeVariables({
    brandName: settings.brandName,
    supportEmail: settings.supportFrom,
    appUrl: appUrl(),
    headerImageUrl: absoluteUrl(settings.headerImageUrl),
    footerNote: settings.footerNote,
    dashboardUrl: `${appUrl()}/dashboard`,
    liveUrl: `${appUrl()}/queue`,
    buttonStyle: "display:inline-block;background:#00e5ff;color:#071015;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:8px",
    mutedStyle: "color:#64748b;font-size:14px",
    ...input.variables
  });
  const subject = renderTemplate(template.subject, variables);
  const text = renderTemplate(template.text, variables);
  const bodyHtml = renderTemplate(template.html, variables);
  const html = wrapEmailHtml({
    headerHtml: renderTemplate(settings.headerHtml, variables),
    footerHtml: renderTemplate(settings.footerHtml, variables),
    bodyHtml
  });
  const response = await fetch(`${settings.apiUrl.replace(/\/$/, "")}/api/send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${settings.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: input.from === "support" ? settings.supportFrom : settings.noreplyFrom,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject,
      text,
      html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {})
    }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`SuperMail send failed (${response.status}): ${body || response.statusText}`);
  }
  return response.json();
}

export async function sendPasswordResetEmail(input: { email: string; name?: string | null; resetUrl: string }) {
  return sendTemplateEmail({
    templateId: "password-reset",
    to: input.email,
    variables: {
      customerName: input.name || input.email,
      resetUrl: input.resetUrl
    },
    from: "noreply",
    replyTo: defaultSupportEmail()
  });
}

export async function sendAccountCreatedEmail(input: { email: string; name?: string | null; verificationUrl: string }) {
  return sendTemplateEmail({
    templateId: "account-created",
    to: input.email,
    variables: {
      customerName: input.name || input.email,
      verificationUrl: input.verificationUrl
    },
    from: "noreply",
    replyTo: defaultSupportEmail()
  });
}

export async function sendOrderEmail(templateId: Extract<EmailTemplateId, "order-confirmation" | "order-processing" | "order-ready-pickup" | "order-shipped">, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, product: true, upload: true, items: { include: { product: true } } }
  });
  if (!order?.customer.email) return { skipped: true, reason: "Order or customer email not found." };
  return sendTemplateEmail({
    templateId,
    to: order.customer.email,
    variables: orderVariables(order),
    from: "noreply",
    replyTo: defaultSupportEmail()
  });
}

export async function sendSupportThreadEmails(input: { userId: string; subject: string; message: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId }, select: { email: true, name: true } });
  const settings = await getEmailSettings();
  const variables = {
    customerName: user.name || user.email,
    customerEmail: user.email,
    supportSubject: input.subject,
    supportMessage: input.message
  };
  await sendTemplateEmail({
    templateId: "support-thread-notification",
    to: settings.supportFrom,
    variables,
    from: "support",
    replyTo: user.email
  });
  return sendTemplateEmail({
    templateId: "support-thread-started",
    to: user.email,
    variables,
    from: "support",
    replyTo: settings.supportFrom
  });
}

export async function sendSupportTicketStartedEmail(input: {
  customerEmail: string;
  customerName?: string | null;
  ticketId: string;
  ticketNumber: string;
  subject: string;
  message: string;
}) {
  const settings = await getEmailSettings();
  const variables = supportTicketVariables(input);
  await sendTemplateEmail({
    templateId: "support-thread-notification",
    to: settings.supportFrom,
    variables,
    from: "support",
    replyTo: supportReplyAddress(settings.supportFrom, input.ticketNumber)
  });
  return sendTemplateEmail({
    templateId: "support-thread-started",
    to: input.customerEmail,
    variables,
    from: "support",
    replyTo: supportReplyAddress(settings.supportFrom, input.ticketNumber)
  });
}

export async function sendSupportTicketReplyEmail(input: {
  to: string;
  customerEmail: string;
  customerName?: string | null;
  ticketId: string;
  ticketNumber: string;
  subject: string;
  message: string;
  status: string;
  replyAuthor: string;
  admin?: boolean;
}) {
  const settings = await getEmailSettings();
  return sendTemplateEmail({
    templateId: "support-ticket-reply",
    to: input.to,
    variables: supportTicketVariables(input),
    from: "support",
    replyTo: supportReplyAddress(settings.supportFrom, input.ticketNumber)
  });
}

export function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key: string) => variables[key] ?? "");
}

function wrapEmailHtml(input: { headerHtml: string; bodyHtml: string; footerHtml: string }) {
  return `
<!doctype html>
<html>
  <body style="margin:0;background:#eef4f7;font-family:Inter,Arial,sans-serif;color:#0f172a">
    <div style="max-width:680px;margin:0 auto;background:#ffffff">
      ${input.headerHtml}
      <main style="padding:28px;line-height:1.6;font-size:16px">${input.bodyHtml}</main>
      ${input.footerHtml}
    </div>
  </body>
</html>`.trim();
}

function normalizeVariables(input: EmailVariables) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, escapeHtml(String(value ?? ""))]));
}

function orderVariables(order: EmailOrder) {
  const orderUrl = `${appUrl()}/orders`;
  const invoiceUrl = `${appUrl()}/orders/${order.id}/invoice`;
  const orderSummary = order.items.length
    ? order.items.map((item) => `${item.quantity} x ${item.product.name}`).join(", ")
    : order.product?.name ?? order.upload?.fileName ?? "Custom print order";
  return {
    customerName: order.customer.name || order.customer.email,
    customerEmail: order.customer.email,
    orderNumber: order.orderNumber,
    orderSummary,
    orderTotal: formatMoney(order.totalCents),
    orderUrl,
    invoiceUrl,
    liveUrl: `${appUrl()}/queue`,
    trackingUrl: order.trackingUrl || orderUrl,
    trackingNumber: order.trackingNumber || ""
  };
}

function supportTicketVariables(input: {
  customerEmail: string;
  customerName?: string | null;
  ticketId: string;
  ticketNumber: string;
  subject: string;
  message: string;
  status?: string;
  replyAuthor?: string;
}) {
  return {
    customerName: input.customerName || input.customerEmail,
    customerEmail: input.customerEmail,
    replyAuthor: input.replyAuthor ?? "SuperPrint Support",
    supportSubject: input.subject,
    supportMessage: input.message,
    ticketNumber: input.ticketNumber,
    ticketStatus: formatTicketStatus(input.status ?? "OPEN"),
    ticketUrl: `${appUrl()}/support/${input.ticketId}`,
    adminTicketUrl: `${appUrl()}/admin/support/${input.ticketId}`
  };
}

function supportReplyAddress(baseAddress: string, ticketNumber: string) {
  const [local, domain] = baseAddress.split("@");
  if (!local || !domain) return baseAddress;
  return `${local}+${ticketNumber.toLowerCase()}@${domain}`;
}

function formatTicketStatus(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^\w|\s\w/g, (match) => match.toUpperCase());
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

function absoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("{{")) return value;
  return `${appUrl()}${value.startsWith("/") ? value : `/${value}`}`;
}

function defaultSupportEmail() {
  return "support@print.superk.studio";
}

function formatMoney(cents: number) {
  return `$${(Math.round(cents) / 100).toFixed(2)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
