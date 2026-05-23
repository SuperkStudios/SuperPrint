export type EmailTemplateId =
  | "password-reset"
  | "account-created"
  | "order-confirmation"
  | "order-processing"
  | "order-ready-pickup"
  | "order-shipped"
  | "support-thread-started"
  | "support-thread-notification"
  | "support-ticket-reply";

export type EmailTemplate = {
  id: EmailTemplateId;
  label: string;
  description: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailThemeSettings = {
  cloudflareAccountId: string;
  apiKey: string;
  noreplyFrom: string;
  supportFrom: string;
  brandName: string;
  headerImageUrl: string;
  footerNote: string;
  headerHtml: string;
  footerHtml: string;
};

const transactionalEmailDomain = "print.superk.studio";

export const defaultEmailThemeSettings: EmailThemeSettings = {
  cloudflareAccountId: "",
  apiKey: "",
  noreplyFrom: `noreply@${transactionalEmailDomain}`,
  supportFrom: `support@${transactionalEmailDomain}`,
  brandName: "SuperPrint",
  headerImageUrl: "{{appUrl}}/brand/email-factory-banner.png",
  footerNote: "Live manufacturing. Transparent by design.",
  headerHtml: `
<div style="background:#071015;color:#ffffff;border-bottom:3px solid #00e5ff">
  <img src="{{headerImageUrl}}" alt="" width="680" style="display:block;width:100%;max-width:680px;height:auto;border:0" />
  <div style="padding:20px 28px">
    <div style="font-size:24px;font-weight:800;letter-spacing:.02em">{{brandName}}</div>
    <div style="margin-top:4px;color:#9fb0bd;font-size:13px">{{footerNote}}</div>
  </div>
</div>`.trim(),
  footerHtml: `
<div style="padding:20px 28px;background:#081016;color:#9fb0bd;font-size:13px;line-height:1.6">
  <div>Need help? Reply here or email <a href="mailto:{{supportEmail}}" style="color:#00e5ff">{{supportEmail}}</a>.</div>
  <div style="margin-top:8px">{{footerNote}}</div>
  <div style="margin-top:8px">{{brandName}} &middot; print.superk.studio</div>
</div>`.trim()
};

export const defaultEmailTemplates: EmailTemplate[] = [
  {
    id: "password-reset",
    label: "Password reset",
    description: "Sent when a customer requests a password reset.",
    subject: "Reset your {{brandName}} password",
    text: "Hi {{customerName}},\n\nUse this link to reset your password:\n{{resetUrl}}\n\nIf you did not request this, you can ignore this email.",
    html: `
<h1>Reset your password</h1>
<p>Hi {{customerName}},</p>
<p>Use the button below to reset your {{brandName}} password.</p>
<p><a href="{{resetUrl}}" style="{{buttonStyle}}">Reset password</a></p>
<p style="{{mutedStyle}}">If you did not request this, you can ignore this email.</p>`.trim()
  },
  {
    id: "account-created",
    label: "New account",
    description: "Sent when a new account is created.",
    subject: "Welcome to {{brandName}}",
    text: "Hi {{customerName}},\n\nYour {{brandName}} account is ready. Verify your email here:\n{{verificationUrl}}\n\nDashboard: {{dashboardUrl}}",
    html: `
<h1>Your account is ready</h1>
<p>Hi {{customerName}},</p>
<p>Welcome to {{brandName}}. Verify your email, then you can track orders, rewards, live prints, and completed media.</p>
<p><a href="{{verificationUrl}}" style="{{buttonStyle}}">Verify email</a></p>
<p><a href="{{dashboardUrl}}">Open your dashboard</a></p>`.trim()
  },
  {
    id: "order-confirmation",
    label: "Order confirmation",
    description: "Sent after checkout is created.",
    subject: "Order {{orderNumber}} received",
    text: "Thanks {{customerName}}. We received order {{orderNumber}} for {{orderSummary}}.\n\nOrder: {{orderUrl}}\nInvoice: {{invoiceUrl}}\nLive view: {{liveUrl}}",
    html: `
<h1>Order received</h1>
<p>Thanks {{customerName}}. We received <strong>{{orderNumber}}</strong>.</p>
<p>{{orderSummary}}</p>
<p>Total: <strong>{{orderTotal}}</strong></p>
<p><a href="{{orderUrl}}" style="{{buttonStyle}}">View order</a></p>
<p><a href="{{invoiceUrl}}">View invoice</a> &middot; <a href="{{liveUrl}}">Live production view</a></p>`.trim()
  },
  {
    id: "order-processing",
    label: "Order processing",
    description: "Sent when an order is paid and admitted to production.",
    subject: "Order {{orderNumber}} is in production",
    text: "Order {{orderNumber}} is now processing.\n\nLive view: {{liveUrl}}\nOrder: {{orderUrl}}",
    html: `
<h1>Your print is processing</h1>
<p>Order <strong>{{orderNumber}}</strong> is paid and moving into the production queue.</p>
<p><a href="{{liveUrl}}" style="{{buttonStyle}}">Watch live view</a></p>
<p><a href="{{orderUrl}}">View order details</a></p>`.trim()
  },
  {
    id: "order-ready-pickup",
    label: "Ready for pickup",
    description: "Sent when a completed pickup order is ready.",
    subject: "Order {{orderNumber}} is ready for pickup",
    text: "Good news, {{customerName}}. Order {{orderNumber}} is ready for pickup.\n\nOrder: {{orderUrl}}",
    html: `
<h1>Ready for pickup</h1>
<p>Good news, {{customerName}}. Order <strong>{{orderNumber}}</strong> is ready for pickup.</p>
<p><a href="{{orderUrl}}" style="{{buttonStyle}}">View pickup details</a></p>`.trim()
  },
  {
    id: "order-shipped",
    label: "Order shipped",
    description: "Sent when an order is marked shipped.",
    subject: "Order {{orderNumber}} shipped",
    text: "Order {{orderNumber}} has shipped.\n\nTracking: {{trackingUrl}}\nOrder: {{orderUrl}}",
    html: `
<h1>Your order shipped</h1>
<p>Order <strong>{{orderNumber}}</strong> is on the way.</p>
<p><a href="{{trackingUrl}}" style="{{buttonStyle}}">Track shipment</a></p>
<p><a href="{{orderUrl}}">View order</a></p>`.trim()
  },
  {
    id: "support-thread-started",
    label: "Support confirmation",
    description: "Sent to the customer when they start a support thread.",
    subject: "We received your support request",
    text: "Hi {{customerName}},\n\nWe received your support request about {{supportSubject}}. Reply to this email to continue the thread.",
    html: `
<h1>Support request received</h1>
<p>Hi {{customerName}},</p>
<p>We received ticket <strong>{{ticketNumber}}</strong> about <strong>{{supportSubject}}</strong>. Reply to this email or open the ticket in your dashboard to continue.</p>
<p><a href="{{ticketUrl}}" style="{{buttonStyle}}">View ticket</a></p>`.trim()
  },
  {
    id: "support-thread-notification",
    label: "Support team notification",
    description: "Sent to support when a customer starts a support thread.",
    subject: "New support request: {{supportSubject}}",
    text: "{{customerName}} <{{customerEmail}}> started a support request.\n\n{{supportMessage}}",
    html: `
<h1>New support request</h1>
<p><strong>{{customerName}}</strong> &lt;{{customerEmail}}&gt;</p>
<p><strong>Ticket:</strong> {{ticketNumber}}</p>
<p><strong>Subject:</strong> {{supportSubject}}</p>
<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;background:#f4f7fa;padding:14px;border-radius:8px">{{supportMessage}}</pre>
<p><a href="{{adminTicketUrl}}" style="{{buttonStyle}}">Open ticket</a></p>`.trim()
  },
  {
    id: "support-ticket-reply",
    label: "Support ticket reply",
    description: "Sent when a support ticket receives a new reply or status update.",
    subject: "[{{ticketNumber}}] {{supportSubject}}",
    text: "{{replyAuthor}} replied on {{ticketNumber}}.\n\nStatus: {{ticketStatus}}\n\n{{supportMessage}}\n\nTicket: {{ticketUrl}}",
    html: `
<h1>{{replyAuthor}} replied</h1>
<p><strong>Ticket:</strong> {{ticketNumber}}</p>
<p><strong>Status:</strong> {{ticketStatus}}</p>
<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;background:#f4f7fa;padding:14px;border-radius:8px">{{supportMessage}}</pre>
<p><a href="{{ticketUrl}}" style="{{buttonStyle}}">Open ticket</a></p>`.trim()
  }
];

export function emailSettingKeys() {
  return [
    "email.cloudflareAccountId",
    "email.apiUrl",
    "email.apiKey",
    "email.noreplyFrom",
    "email.supportFrom",
    "email.brandName",
    "email.headerImageUrl",
    "email.footerNote",
    "email.headerHtml",
    "email.footerHtml",
    ...defaultEmailTemplates.flatMap((template) => [
      `email.template.${template.id}.subject`,
      `email.template.${template.id}.text`,
      `email.template.${template.id}.html`
    ])
  ];
}

export function resolveEmailSettings(values: Record<string, unknown> = {}) {
  return {
    cloudflareAccountId: stringSetting(values["email.cloudflareAccountId"], process.env.CLOUDFLARE_EMAIL_ACCOUNT_ID ?? legacyAccountId(values["email.apiUrl"]) ?? defaultEmailThemeSettings.cloudflareAccountId),
    apiKey: stringSetting(values["email.apiKey"], process.env.CLOUDFLARE_EMAIL_API_TOKEN ?? process.env.SUPERMAIL_API_KEY ?? defaultEmailThemeSettings.apiKey),
    noreplyFrom: senderSetting(values["email.noreplyFrom"], process.env.CLOUDFLARE_EMAIL_NOREPLY_FROM ?? process.env.SUPERMAIL_NOREPLY_FROM ?? defaultEmailThemeSettings.noreplyFrom),
    supportFrom: senderSetting(values["email.supportFrom"], process.env.CLOUDFLARE_EMAIL_SUPPORT_FROM ?? process.env.SUPERMAIL_SUPPORT_FROM ?? defaultEmailThemeSettings.supportFrom),
    brandName: stringSetting(values["email.brandName"], defaultEmailThemeSettings.brandName),
    headerImageUrl: stringSetting(values["email.headerImageUrl"], defaultEmailThemeSettings.headerImageUrl),
    footerNote: stringSetting(values["email.footerNote"], defaultEmailThemeSettings.footerNote),
    headerHtml: stringSetting(values["email.headerHtml"], defaultEmailThemeSettings.headerHtml),
    footerHtml: stringSetting(values["email.footerHtml"], defaultEmailThemeSettings.footerHtml),
    templates: defaultEmailTemplates.map((template) => ({
      ...template,
      subject: stringSetting(values[`email.template.${template.id}.subject`], template.subject),
      text: stringSetting(values[`email.template.${template.id}.text`], template.text),
      html: stringSetting(values[`email.template.${template.id}.html`], template.html)
    }))
  };
}

export function buildEmailSettingsUpdate(input: {
  cloudflareAccountId?: string;
  apiUrl?: string;
  apiKey?: string;
  noreplyFrom?: string;
  supportFrom?: string;
  brandName?: string;
  headerImageUrl?: string;
  footerNote?: string;
  headerHtml?: string;
  footerHtml?: string;
  templates?: Array<Partial<EmailTemplate> & { id: EmailTemplateId }>;
}, existing: Record<string, unknown> = {}) {
  const updates: Record<string, string> = {};
  add(updates, "email.cloudflareAccountId", input.cloudflareAccountId ?? input.apiUrl);
  if (input.apiKey && !isMaskedSecret(input.apiKey)) add(updates, "email.apiKey", input.apiKey);
  if (input.apiKey && isMaskedSecret(input.apiKey) && typeof existing["email.apiKey"] === "string") updates["email.apiKey"] = existing["email.apiKey"];
  addSender(updates, "email.noreplyFrom", input.noreplyFrom);
  addSender(updates, "email.supportFrom", input.supportFrom);
  add(updates, "email.brandName", input.brandName);
  add(updates, "email.headerImageUrl", input.headerImageUrl);
  add(updates, "email.footerNote", input.footerNote);
  add(updates, "email.headerHtml", input.headerHtml);
  add(updates, "email.footerHtml", input.footerHtml);
  for (const template of input.templates ?? []) {
    if (!defaultEmailTemplates.some((candidate) => candidate.id === template.id)) continue;
    add(updates, `email.template.${template.id}.subject`, template.subject);
    add(updates, `email.template.${template.id}.text`, template.text);
    add(updates, `email.template.${template.id}.html`, template.html);
  }
  return updates;
}

export function publicEmailSettings(values: Record<string, unknown> = {}) {
  const settings = resolveEmailSettings(values);
  return {
    ...settings,
    apiKey: maskSecret(settings.apiKey)
  };
}

function add(updates: Record<string, string>, key: string, value?: string) {
  if (typeof value === "string") updates[key] = value.trim();
}

function addSender(updates: Record<string, string>, key: string, value?: string) {
  if (typeof value === "string") updates[key] = normalizeSenderAddress(value);
}

function stringSetting(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function senderSetting(value: unknown, fallback: string) {
  return normalizeSenderAddress(stringSetting(value, fallback));
}

function normalizeSenderAddress(value: string) {
  const trimmed = value.trim();
  const displayNameMatch = trimmed.match(/<([^>]+)>/);
  const address = (displayNameMatch?.[1] ?? trimmed).trim().toLowerCase();
  if (!address) return `noreply@${transactionalEmailDomain}`;
  if (!address.includes("@")) return `${address}@${transactionalEmailDomain}`;
  return address;
}

function maskSecret(value: string) {
  if (!value) return "";
  if (value.includes("...")) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function isMaskedSecret(value: string) {
  return value.includes("...");
}

function legacyAccountId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}
