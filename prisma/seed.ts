import { hash } from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { resolveLocalStoragePath } from "../src/lib/storage";

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
      where: { slug: "articulated-dragon" },
      update: {},
      create: {
        slug: "articulated-dragon",
        name: "Articulated Dragon",
        description: "A showpiece flexible dragon print used for live factory demos.",
        imageUrl: "/products/dragon.svg",
        priceCents: 5400,
        estimatedPrintMinutes: 186,
        defaultMaterial: "PLA"
      }
    }),
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

  const [blackPla, clearPetg, silkGreenPla] = await Promise.all([
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
    }),
    prisma.filamentSpool.create({
      data: {
        material: "PLA",
        color: "Silk Emerald",
        brand: "Bambu",
        remainingGrams: 812,
        thresholdGrams: 160,
        location: "Rack A4"
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
        currentFilamentId: silkGreenPla.id
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
      fileName: "camera-rig-handle-v7.stl",
      storageKey: "uploads/demo/camera-rig-handle-v7.stl",
      fileSizeBytes: 1840128,
      contentType: "model/stl",
      notes: "Needs PETG, hand-held camera rig grip. Please check wall thickness around the screw bosses.",
      status: "PENDING"
    }
  });

  const activeOrder = await prisma.order.create({
    data: {
      orderNumber: "SP-2401",
      customerId: customer.id,
      productId: products[0].id,
      status: "PRINTING",
      totalCents: products[0].priceCents,
      paymentStatus: "PAID",
      shippingStatus: "LABEL_PENDING",
      printJobs: {
        create: {
          printerId: forgeOne.id,
          filamentId: silkGreenPla.id,
          status: "PRINTING",
          queuePosition: 0,
          etaMinutes: 74,
          startedAt: new Date(Date.now() - 52 * 60 * 1000),
          streamUrl: process.env.PUBLIC_FACTORY_STREAM_URL ?? "https://demo.superprint.local/live/factory"
        }
      }
    }
  });

  const completedOrder = await prisma.order.create({
    data: {
      orderNumber: "SP-2399",
      customerId: customer.id,
      productId: products[2].id,
      status: "COMPLETED",
      totalCents: products[2].priceCents,
      paymentStatus: "PAID",
      shippingStatus: "READY_TO_SHIP",
      printJobs: {
        create: {
          printerId: forgeTwo.id,
          filamentId: blackPla.id,
          status: "COMPLETED",
          queuePosition: null,
          etaMinutes: 0,
          startedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
        }
      }
    }
  });

  await Promise.all([
    prisma.order.create({
      data: {
        orderNumber: "SP-2402",
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
        orderNumber: "SP-2403",
        customerId: customer.id,
        productId: products[2].id,
        status: "QUEUED",
        totalCents: products[2].priceCents,
        paymentStatus: "PAID",
        printJobs: {
          create: {
            printerId: forgeOne.id,
            filamentId: blackPla.id,
            status: "QUEUED",
            queuePosition: 2,
            etaMinutes: 34
          }
        }
      }
    }),
    prisma.order.create({
      data: {
        orderNumber: "SP-2404",
        customerId: customer.id,
        productId: products[3].id,
        status: "QUEUED",
        totalCents: products[3].priceCents,
        paymentStatus: "PAID",
        printJobs: {
          create: {
            printerId: forgeTwo.id,
            filamentId: clearPetg.id,
            status: "QUEUED",
            queuePosition: 3,
            etaMinutes: 72
          }
        }
      }
    }),
    prisma.order.create({
      data: {
        orderNumber: "SP-2405",
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
        title: "Replace PETG spool before long queue run",
        description: "Clear PETG is below threshold. Swap after current dragon print or before SP-2402 starts.",
        dueAt: new Date(Date.now() + 90 * 60 * 1000),
        status: "OPEN"
      }
    }),
    prisma.orderVideo.create({
      data: {
        orderId: completedOrder.id,
        title: "SP-2399 finished print media",
        storageKey: "videos/demo/SP-2399.mp4",
        timelapseStorageKey: "timelapses/demo/SP-2399.mp4",
        thumbnailStorageKey: "thumbnails/demo/SP-2399.svg",
        playbackUrl: "/api/media/local",
        durationSec: 328
      }
    }),
    prisma.platformEvent.createMany({
      data: [
        {
          type: "ORDER_CREATED",
          actorId: customer.id,
          payload: { orderNumber: "SP-2401", customerEmail: customer.email }
        },
        {
          type: "MODEL_UPLOADED",
          actorId: customer.id,
          payload: { fileName: "camera-rig-handle-v7.stl", uploadId: upload.id }
        },
        {
          type: "PRINT_STARTED",
          actorId: admin.id,
          payload: {
            orderNumber: activeOrder.orderNumber,
            printerName: "Forge One",
            printerInternalIp: "10.10.0.21",
            status: "PRINTING",
            etaMinutes: 74
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
            orderNumber: completedOrder.orderNumber,
            playbackUrl: "/api/media/local",
            localVolumeKey: "videos/demo/SP-2399.mp4"
          }
        }
      ]
    })
  ]);

  await Promise.all([
    writeDemoMedia("videos/demo/SP-2399.mp4", "SuperPrint demo video placeholder for SP-2399\n"),
    writeDemoMedia("timelapses/demo/SP-2399.mp4", "SuperPrint demo timelapse placeholder for SP-2399\n"),
    writeDemoMedia(
      "thumbnails/demo/SP-2399.svg",
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" fill="#082f49"/><text x="48" y="190" fill="#22c55e" font-family="Arial" font-size="42">SP-2399 complete</text></svg>`
    )
  ]);
}

async function writeDemoMedia(storageKey: string, contents: string) {
  try {
    const localPath = resolveLocalStoragePath(storageKey);
    await mkdir(localPath.slice(0, localPath.lastIndexOf("/")), { recursive: true });
    await writeFile(localPath, contents);
  } catch (error) {
    console.warn(`Skipped demo media write for ${storageKey}:`, error);
  }
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
