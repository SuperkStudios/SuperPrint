import { SupportTicketStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEmailSettings, sendSupportTicketReplyEmail, sendSupportTicketStartedEmail } from "@/services/email";

const publicTicketInclude = {
  customer: { select: { id: true, email: true, name: true } },
  messages: { include: { author: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: "asc" as const } }
};

export async function createSupportTicket(input: { userId: string; subject: string; message: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId }, select: { id: true, email: true, name: true } });
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: {
        ticketNumber: await nextTicketNumber(tx),
        customerId: user.id,
        subject: input.subject,
        status: SupportTicketStatus.AWAITING_ADMIN,
        messages: {
          create: {
            authorId: user.id,
            authorType: "CUSTOMER",
            body: input.message,
            channel: "UI"
          }
        }
      },
      include: publicTicketInclude
    });
    return created;
  });
  void sendSupportTicketStartedEmail({
    customerEmail: user.email,
    customerName: user.name,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    message: input.message
  }).catch((error) => console.error("Could not send support ticket start emails", error));
  return ticket;
}

export async function listCustomerTickets(userId: string) {
  return prisma.supportTicket.findMany({
    where: { customerId: userId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getCustomerTicket(userId: string, ticketId: string) {
  return prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId: userId },
    include: publicTicketInclude
  });
}

export async function listAdminTickets(status?: SupportTicketStatus | "ALL") {
  return prisma.supportTicket.findMany({
    where: status && status !== "ALL" ? { status } : undefined,
    include: {
      customer: { select: { email: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }]
  });
}

export async function getAdminTicket(ticketId: string) {
  return prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: publicTicketInclude
  });
}

export async function addCustomerTicketReply(input: { userId: string; ticketId: string; message: string; channel?: string; emailFrom?: string | null }) {
  const ticket = await prisma.supportTicket.findFirstOrThrow({
    where: { id: input.ticketId, customerId: input.userId },
    include: { customer: true }
  });
  const updated = await addTicketMessage({
    ticketId: ticket.id,
    authorId: input.userId,
    authorType: "CUSTOMER",
    body: input.message,
    channel: input.channel ?? "UI",
    emailFrom: input.emailFrom,
    status: SupportTicketStatus.AWAITING_ADMIN
  });
  const settings = await getEmailSettings();
  void sendSupportTicketReplyEmail({
    to: settings.supportFrom,
    customerEmail: ticket.customer.email,
    customerName: ticket.customer.name,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    message: input.message,
    status: updated.status,
    replyAuthor: ticket.customer.name || ticket.customer.email,
    admin: true
  }).catch((error) => console.error("Could not send support customer reply email", error));
  return updated;
}

export async function addAdminTicketReply(input: { adminId: string | null; ticketId: string; message: string; channel?: string; emailFrom?: string | null }) {
  const ticket = await prisma.supportTicket.findUniqueOrThrow({ where: { id: input.ticketId }, include: { customer: true } });
  const updated = await addTicketMessage({
    ticketId: ticket.id,
    authorId: input.adminId,
    authorType: "ADMIN",
    body: input.message,
    channel: input.channel ?? "UI",
    emailFrom: input.emailFrom,
    status: SupportTicketStatus.AWAITING_CUSTOMER
  });
  void sendSupportTicketReplyEmail({
    to: ticket.customer.email,
    customerEmail: ticket.customer.email,
    customerName: ticket.customer.name,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    message: input.message,
    status: updated.status,
    replyAuthor: "SuperPrint Support"
  }).catch((error) => console.error("Could not send support admin reply email", error));
  return updated;
}

export async function updateSupportTicketStatus(input: { ticketId: string; status: SupportTicketStatus; actorId?: string | null; note?: string | null }) {
  const ticket = await prisma.supportTicket.update({
    where: { id: input.ticketId },
    data: {
      status: input.status,
      closedAt: input.status === SupportTicketStatus.CLOSED ? new Date() : null,
      ...(input.note ? {
        lastMessageAt: new Date(),
        messages: {
          create: {
            authorId: input.actorId ?? undefined,
            authorType: "SYSTEM",
            body: input.note,
            channel: "UI"
          }
        }
      } : {})
    },
    include: publicTicketInclude
  });
  if (input.note) {
    const notifyCustomer = input.status === SupportTicketStatus.CLOSED || input.status === SupportTicketStatus.AWAITING_CUSTOMER;
    const settings = await getEmailSettings();
    void sendSupportTicketReplyEmail({
      to: notifyCustomer ? ticket.customer.email : settings.supportFrom,
      customerEmail: ticket.customer.email,
      customerName: ticket.customer.name,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      message: input.note,
      status: ticket.status,
      replyAuthor: "SuperPrint Support"
    }).catch((error) => console.error("Could not send support status email", error));
  }
  return ticket;
}

export async function ingestSupportEmail(input: { from: string; to?: string | null; subject?: string | null; text: string }) {
  const ticketNumber = parseTicketNumber(`${input.to ?? ""} ${input.subject ?? ""}`);
  if (!ticketNumber) throw new Error("No support ticket token found.");
  const ticket = await prisma.supportTicket.findUniqueOrThrow({ where: { ticketNumber }, include: { customer: true } });
  const from = input.from.toLowerCase();
  if (from === ticket.customer.email.toLowerCase()) {
    return addCustomerTicketReply({ userId: ticket.customerId, ticketId: ticket.id, message: input.text, channel: "EMAIL", emailFrom: input.from });
  }
  return addAdminTicketReply({ adminId: null, ticketId: ticket.id, message: input.text, channel: "EMAIL", emailFrom: input.from });
}

function addTicketMessage(input: {
  ticketId: string;
  authorId?: string | null;
  authorType: string;
  body: string;
  channel: string;
  emailFrom?: string | null;
  status: SupportTicketStatus;
}) {
  return prisma.supportTicket.update({
    where: { id: input.ticketId },
    data: {
      status: input.status,
      closedAt: null,
      lastMessageAt: new Date(),
      messages: {
        create: {
          authorId: input.authorId ?? undefined,
          authorType: input.authorType,
          body: input.body,
          channel: input.channel,
          emailFrom: input.emailFrom
        }
      }
    },
    include: publicTicketInclude
  });
}

async function nextTicketNumber(tx: Prisma.TransactionClient) {
  const latest = await tx.supportTicket.findFirst({ orderBy: { createdAt: "desc" }, select: { ticketNumber: true } });
  const next = Number(latest?.ticketNumber.replace(/\D/g, "") ?? "0") + 1;
  return `SUP-${String(next).padStart(6, "0")}`;
}

function parseTicketNumber(value: string) {
  return value.match(/SUP-\d{6}/i)?.[0].toUpperCase() ?? null;
}
