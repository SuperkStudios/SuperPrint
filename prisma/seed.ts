import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.$transaction([
    prisma.platformEvent.deleteMany(),
    prisma.orderVideo.deleteMany(),
    prisma.maintenanceTask.deleteMany(),
    prisma.printJob.deleteMany(),
    prisma.order.deleteMany(),
    prisma.modelUpload.deleteMany(),
    prisma.printer.deleteMany(),
    prisma.filamentSpool.deleteMany(),
    prisma.product.deleteMany(),
    prisma.user.deleteMany()
  ]);

  const passwordHash = await hash("superprint-demo", 10);

  const [admin, customer] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@superprint.test" },
      update: {},
      create: {
        email: "admin@superprint.test",
        name: "Avery Admin",
        passwordHash,
        role: "ADMIN"
      }
    }),
    prisma.user.upsert({
      where: { email: "customer@superprint.test" },
      update: {},
      create: {
        email: "customer@superprint.test",
        name: "Casey Customer",
        passwordHash,
        role: "CUSTOMER"
      }
    })
  ]);

  const products = await Promise.all([
    prisma.product.upsert({
      where: { slug: "desk-cable-loom" },
      update: {},
      create: {
        slug: "desk-cable-loom",
        name: "Desk Cable Loom",
        description: "A low-profile cable guide printed in matte PLA for tidy workstations.",
        imageUrl: "/products/cable-loom.svg",
        priceCents: 1800,
        estimatedPrintMinutes: 72,
        defaultMaterial: "PLA"
      }
    }),
    prisma.product.upsert({
      where: { slug: "modular-drawer-bin" },
      update: {},
      create: {
        slug: "modular-drawer-bin",
        name: "Modular Drawer Bin",
        description: "Snap-fit storage tray with transparent production tracking.",
        imageUrl: "/products/drawer-bin.svg",
        priceCents: 2600,
        estimatedPrintMinutes: 118,
        defaultMaterial: "PETG"
      }
    }),
    prisma.product.upsert({
      where: { slug: "camera-cold-shoe-cap" },
      update: {},
      create: {
        slug: "camera-cold-shoe-cap",
        name: "Camera Cold Shoe Cap",
        description: "Small durable accessory printed fast and filmed end-to-end.",
        imageUrl: "/products/cold-shoe-cap.svg",
        priceCents: 900,
        estimatedPrintMinutes: 34,
        defaultMaterial: "PLA"
      }
    })
  ]);

  const [blackPla, clearPetg] = await Promise.all([
    prisma.filamentSpool.create({
      data: {
        material: "PLA",
        color: "Matte Black",
        brand: "PolyMaker",
        remainingGrams: 640,
        thresholdGrams: 180,
        location: "Rack A2"
      }
    }),
    prisma.filamentSpool.create({
      data: {
        material: "PETG",
        color: "Clear",
        brand: "Prusament",
        remainingGrams: 125,
        thresholdGrams: 200,
        location: "Rack B1"
      }
    })
  ]);

  const [forgeOne, forgeTwo] = await Promise.all([
    prisma.printer.create({
      data: {
        name: "printer-forge-one",
        publicName: "Forge One",
        status: "HEALTHY",
        healthDescription: "Nominal: bed level stable, nozzle clean",
        internalIp: "10.10.0.21",
        controlApiUrl: "http://10.10.0.21/api",
        currentFilamentId: blackPla.id
      }
    }),
    prisma.printer.create({
      data: {
        name: "printer-forge-two",
        publicName: "Forge Two",
        status: "WARNING",
        healthDescription: "Filament below threshold; next swap queued",
        internalIp: "10.10.0.22",
        controlApiUrl: "http://10.10.0.22/api",
        currentFilamentId: clearPetg.id
      }
    })
  ]);

  const upload = await prisma.modelUpload.create({
    data: {
      customerId: customer.id,
      fileName: "bracket-v3.stl",
      storageKey: "uploads/demo/bracket-v3.stl",
      notes: "Needs PETG, load-bearing bracket for workshop wall.",
      status: "PENDING"
    }
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: "SP-1001",
      customerId: customer.id,
      productId: products[0].id,
      status: "PRINTING",
      totalCents: products[0].priceCents,
      paymentStatus: "PAID",
      shippingStatus: "LABEL_PENDING",
      printJobs: {
        create: {
          printerId: forgeOne.id,
          filamentId: blackPla.id,
          status: "PRINTING",
          queuePosition: 0,
          etaMinutes: 38,
          startedAt: new Date("2026-05-11T19:00:00.000Z"),
          streamUrl: process.env.PUBLIC_FACTORY_STREAM_URL ?? "https://demo.superprint.local/live/factory"
        }
      }
    }
  });

  await Promise.all([
    prisma.order.create({
      data: {
        orderNumber: "SP-1002",
        customerId: customer.id,
        productId: products[1].id,
        status: "QUEUED",
        totalCents: products[1].priceCents,
        paymentStatus: "PAID",
        printJobs: {
          create: {
            printerId: forgeTwo.id,
            filamentId: clearPetg.id,
            status: "QUEUED",
            queuePosition: 1,
            etaMinutes: 118
          }
        }
      }
    }),
    prisma.order.create({
      data: {
        orderNumber: "SP-1003",
        customerId: customer.id,
        uploadId: upload.id,
        status: "CHECKOUT_READY",
        totalCents: 4200,
        paymentStatus: "PENDING"
      }
    }),
    prisma.maintenanceTask.create({
      data: {
        printerId: forgeTwo.id,
        title: "Replace PETG spool",
        description: "Swap clear PETG after current job or before SP-1002 starts.",
        dueAt: new Date("2026-05-11T23:00:00.000Z"),
        status: "OPEN"
      }
    }),
    prisma.orderVideo.create({
      data: {
        orderId: order.id,
        title: "SP-1001 live print capture",
        storageKey: "videos/demo/SP-1001.mp4",
        playbackUrl: "https://demo.superprint.local/videos/SP-1001.mp4",
        durationSec: 328
      }
    }),
    prisma.platformEvent.createMany({
      data: [
        {
          type: "ORDER_CREATED",
          actorId: customer.id,
          payload: { orderNumber: "SP-1001", customerEmail: customer.email }
        },
        {
          type: "MODEL_UPLOADED",
          actorId: customer.id,
          payload: { fileName: "bracket-v3.stl", uploadId: upload.id }
        },
        {
          type: "PRINT_STARTED",
          actorId: admin.id,
          payload: {
            orderNumber: "SP-1001",
            printerName: "Forge One",
            printerInternalIp: "10.10.0.21",
            status: "PRINTING",
            etaMinutes: 38
          }
        },
        {
          type: "FILAMENT_LOW",
          payload: {
            printerName: "Forge Two",
            material: "PETG",
            color: "Clear",
            remainingGrams: 125,
            adminNotes: "Pull replacement from Rack B4"
          }
        },
        {
          type: "VIDEO_READY",
          payload: {
            orderNumber: "SP-1001",
            playbackUrl: "https://demo.superprint.local/videos/SP-1001.mp4",
            s3Key: "videos/demo/SP-1001.mp4"
          }
        }
      ]
    })
  ]);
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
