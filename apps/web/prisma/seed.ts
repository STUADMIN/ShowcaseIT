import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  /** Matches `DEV_USER` in `src/lib/auth/config.ts` for local demo sessions */
  const demo = await prisma.user.upsert({
    where: { id: 'dev-user-1' },
    update: { email: 'demo@showcaseit.app', name: 'Demo User' },
    create: {
      id: 'dev-user-1',
      email: 'demo@showcaseit.app',
      name: 'Demo User',
    },
  });

  const existingWs = await prisma.workspaceMember.findFirst({
    where: { userId: demo.id },
    include: { workspace: true },
  });

  if (existingWs) {
    console.log('Seed skipped (workspace already linked):', { user: demo.id, workspace: existingWs.workspaceId });
    return;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: 'My Workspace',
      plan: 'pro',
      members: {
        create: {
          userId: demo.id,
          role: 'owner',
        },
      },
    },
  });

  const brandKit = await prisma.brandKit.create({
    data: {
      workspaceId: workspace.id,
      name: 'Default Brand',
      colorPrimary: '#2563EB',
      colorSecondary: '#7C3AED',
      colorAccent: '#F59E0B',
    },
  });

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: 'Getting Started',
      description: 'Your first ShowcaseIt project',
      brandKitId: brandKit.id,
    },
  });

  console.log('Seed data created:', {
    user: demo.id,
    workspace: workspace.id,
    brandKit: brandKit.id,
    project: project.id,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
