/**
 * Setup functions that create prerequisite data in the HR platform database
 * before specific tours run. This ensures multi-actor flows (like ticket
 * escalation) have realistic, connected data to capture.
 *
 * Each function is idempotent — it checks for existing data before inserting.
 */

import type { SetupContext } from './hr-manifest';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function findCategory(
  ctx: SetupContext,
  name: string,
): Promise<string | null> {
  const rows = await ctx.prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "TicketCategory" WHERE "organizationId" = $1 AND name = $2 LIMIT 1`,
    ctx.orgId,
    name,
  );
  return rows[0]?.id ?? null;
}

async function ticketExists(
  ctx: SetupContext,
  subject: string,
): Promise<boolean> {
  const rows = await ctx.prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Ticket" WHERE "organizationId" = $1 AND subject = $2 LIMIT 1`,
    ctx.orgId,
    subject,
  );
  return rows.length > 0;
}

async function nextTicketNumber(ctx: SetupContext): Promise<number> {
  const rows = await ctx.prisma.$queryRawUnsafe<{ next: bigint }[]>(
    `SELECT COALESCE(MAX("ticketNumber"), 0) + 1 AS next FROM "Ticket" WHERE "organizationId" = $1`,
    ctx.orgId,
  );
  return Number(rows[0]?.next ?? 2001);
}

/* ------------------------------------------------------------------ */
/*  Shared: SSO escalation ticket                                      */
/*  Used by both org-admin and partner-admin tours.                    */
/* ------------------------------------------------------------------ */

const SSO_SUBJECT = '[Demo] SSO configuration for new client portal';

async function ensureSSOEscalationTicket(ctx: SetupContext): Promise<void> {
  const { prisma, orgId, userMap } = ctx;
  const benId = userMap.get('Ben Taylor');
  const helenId = userMap.get('Helen Richardson');
  if (!benId || !helenId) {
    console.warn('  [setup] Ben Taylor or Helen Richardson not found — skipping SSO ticket');
    return;
  }

  if (await ticketExists(ctx, SSO_SUBJECT)) {
    console.log('  [setup] SSO escalation ticket already exists — skipping');
    return;
  }

  const catId = await findCategory(ctx, 'IT Support');
  const num = await nextTicketNumber(ctx);
  const now = new Date();
  const created = new Date(now.getTime() - 4 * 86_400_000);
  const escalated = new Date(now.getTime() - 2 * 86_400_000);
  const ticketId = `setup-sso-${now.getTime()}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Ticket"
       (id, "ticketNumber", "organizationId", subject, status, priority,
        "escalationLevel", "categoryId", "createdById", "assigneeId",
        "escalatedAt", "escalatedById", "escalatedByName",
        "createdAt", "updatedAt")
     VALUES
       ($1, $2, $3, $4,
        'IN_PROGRESS'::"TicketStatus", 'HIGH'::"TicketPriority", 'PARTNER'::"TicketEscalationLevel",
        $5, $6, $7, $8, $9, $10, $11, $11)`,
    ticketId, num, orgId, SSO_SUBJECT,
    catId, benId, helenId,
    escalated, helenId, 'Helen Richardson',
    created,
  );

  const messages: {
    sender: string | null;
    body: string;
    isSystem: boolean;
    offsetHours: number;
  }[] = [
    {
      sender: benId,
      body: 'We need SSO set up for the new client portal launching next month. The client requires SAML 2.0 integration with their Azure AD tenant. This is blocking the go-live timeline — can we get this prioritised?',
      isSystem: false,
      offsetHours: 0,
    },
    {
      sender: helenId,
      body: "Thanks Ben, I've reviewed the requirements with IT. SAML 2.0 configuration needs to be done at the platform level — our team doesn't have the access for this. I'm escalating to our partner admin team who manage identity integrations. I'll keep you in the loop.",
      isSystem: false,
      offsetHours: 4,
    },
    {
      sender: null,
      body: 'Ticket escalated to Partner Admin by Helen Richardson',
      isSystem: true,
      offsetHours: 4,
    },
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TicketMessage"
         (id, "ticketId", "senderId", body, "isInternal", "isSystemMessage", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      `${ticketId}-msg-${i}`,
      ticketId,
      msg.sender,
      msg.body,
      msg.isSystem,
      msg.isSystem,
      new Date(created.getTime() + msg.offsetHours * 3_600_000),
    );
  }

  // Participants
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TicketParticipant" (id, "ticketId", "userId", role, "createdAt")
     VALUES ($1, $2, $3, 'creator', $4)`,
    `${ticketId}-part-ben`, ticketId, benId, created,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TicketParticipant" (id, "ticketId", "userId", role, "createdAt")
     VALUES ($1, $2, $3, 'assignee', $4)`,
    `${ticketId}-part-helen`, ticketId, helenId, created,
  );

  console.log(`  [setup] Created SSO escalation ticket #${num} (PARTNER level, 3 messages)`);
}

/* ------------------------------------------------------------------ */
/*  setupEmployeeTickets                                               */
/* ------------------------------------------------------------------ */

const LAPTOP_SUBJECT = '[Demo] Laptop extremely slow after Windows update';

/**
 * Ensures Ben Taylor has a ticket with a back-and-forth conversation so the
 * employee ticket tour can click into a conversation with real content.
 */
export async function setupEmployeeTickets(ctx: SetupContext): Promise<void> {
  const { prisma, orgId, userMap } = ctx;
  const benId = userMap.get('Ben Taylor');
  const helenId = userMap.get('Helen Richardson');
  if (!benId || !helenId) {
    console.warn('  [setup] Ben Taylor or Helen Richardson not found — skipping employee ticket setup');
    return;
  }

  if (await ticketExists(ctx, LAPTOP_SUBJECT)) {
    console.log('  [setup] Employee demo ticket already exists — skipping');
    return;
  }

  const catId = await findCategory(ctx, 'IT Support');
  const num = await nextTicketNumber(ctx);
  const now = new Date();
  const created = new Date(now.getTime() - 3 * 86_400_000);
  const ticketId = `setup-emp-laptop-${now.getTime()}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Ticket"
       (id, "ticketNumber", "organizationId", subject, status, priority,
        "escalationLevel", "categoryId", "createdById", "assigneeId",
        "createdAt", "updatedAt")
     VALUES
       ($1, $2, $3, $4,
        'IN_PROGRESS'::"TicketStatus", 'MEDIUM'::"TicketPriority", 'ORG'::"TicketEscalationLevel",
        $5, $6, $7, $8, $8)`,
    ticketId, num, orgId, LAPTOP_SUBJECT,
    catId, benId, helenId,
    created,
  );

  const messages: { sender: string; body: string; offsetHours: number }[] = [
    {
      sender: benId,
      body: "My laptop has been incredibly slow since the Windows update on Monday. Applications take 2-3 minutes to open and Teams keeps freezing mid-call. It's affecting my client work — I had to reschedule two meetings yesterday.",
      offsetHours: 0,
    },
    {
      sender: helenId,
      body: "Thanks Ben, this sounds like the KB5034441 update that's caused issues across the org. Can you check your free disk space (Settings > Storage)? Also try clearing your Teams cache — delete everything in %appdata%\\Microsoft\\Teams\\Cache. I'll remote in this afternoon if those don't help.",
      offsetHours: 4,
    },
    {
      sender: benId,
      body: "Just checked — I have 12GB free on C: drive which seems low. Cleared the Teams cache and it's slightly better but still sluggish opening Outlook and the CRM. Happy for you to remote in whenever suits.",
      offsetHours: 8,
    },
    {
      sender: helenId,
      body: "I've remoted in and found the issue — Windows Update downloaded 8GB of rollback files plus the old update is stuck in a retry loop. I've cleaned up the rollback cache, disabled the problematic update via WSUS, and freed up 23GB of space. Give it a restart and let me know how it goes tomorrow.",
      offsetHours: 28,
    },
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TicketMessage"
         (id, "ticketId", "senderId", body, "isInternal", "isSystemMessage", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, false, false, $5, $5)`,
      `${ticketId}-msg-${i}`,
      ticketId,
      msg.sender,
      msg.body,
      new Date(created.getTime() + msg.offsetHours * 3_600_000),
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "TicketParticipant" (id, "ticketId", "userId", role, "createdAt")
     VALUES ($1, $2, $3, 'creator', $4)`,
    `${ticketId}-part-ben`, ticketId, benId, created,
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TicketParticipant" (id, "ticketId", "userId", role, "createdAt")
     VALUES ($1, $2, $3, 'assignee', $4)`,
    `${ticketId}-part-helen`, ticketId, helenId, created,
  );

  console.log(`  [setup] Created employee demo ticket #${num} (4 messages)`);
}

/* ------------------------------------------------------------------ */
/*  setupOrgAdminTickets                                               */
/* ------------------------------------------------------------------ */

/**
 * Ensures Helen Richardson's inbox has a ticket escalated to PARTNER level
 * so the "Escalated to Partner Admin" banner is visible during the tour.
 */
export async function setupOrgAdminTickets(ctx: SetupContext): Promise<void> {
  await ensureSSOEscalationTicket(ctx);
}

/* ------------------------------------------------------------------ */
/*  setupPartnerAdminTickets                                           */
/* ------------------------------------------------------------------ */

/**
 * Ensures the partner admin's Escalated Inbox has a ticket with the full
 * conversation history: employee request → org admin response → escalation.
 */
export async function setupPartnerAdminTickets(ctx: SetupContext): Promise<void> {
  await ensureSSOEscalationTicket(ctx);
}
