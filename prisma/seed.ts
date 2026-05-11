import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: "system.seedMode" },
    update: { value: "bootstrap-safe" },
    create: { key: "system.seedMode", value: "bootstrap-safe" }
  });

  console.log("Bootstrap-safe seed complete. No users, products, printers, jobs, orders, media, or events were created.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
