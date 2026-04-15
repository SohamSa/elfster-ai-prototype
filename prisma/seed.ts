import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.gift.deleteMany();

  await prisma.gift.createMany({
    data: [
      {
        title: "Insulated travel mug",
        description: "Leak-resistant mug for desk and commute.",
        priceCents: 2200,
        tags: ["office", "drinkware", "practical"],
        audience: "coworker",
        occasion: "office",
      },
      {
        title: "Desk plant kit",
        description: "Low-light friendly starter plant with pot.",
        priceCents: 2800,
        tags: ["office", "wellness", "decor"],
        audience: "coworker",
        occasion: "birthday",
      },
      {
        title: "Artisan chocolate box",
        description: "Shareable sweets; check dietary notes.",
        priceCents: 1800,
        tags: ["food", "shareable", "holiday"],
        audience: "friend",
        occasion: "holiday",
      },
      {
        title: "Streaming gift card",
        description: "Let them pick shows; digital delivery.",
        priceCents: 2500,
        tags: ["digital", "entertainment", "flexible"],
        audience: "friend",
        occasion: "any",
      },
      {
        title: "Nice pen + small notebook set",
        description: "Professional desk set; neutral for most offices.",
        priceCents: 1600,
        tags: ["office", "stationery", "practical"],
        audience: "coworker",
        occasion: "office",
      },
      {
        title: "Snack variety pack",
        description: "Shareable mix for a team kitchen or desk drawer.",
        priceCents: 1400,
        tags: ["food", "shareable", "office"],
        audience: "coworker",
        occasion: "any",
      },
      {
        title: "Phone stand + cable organizer",
        description: "Keeps video calls tidy; compact for a cubicle.",
        priceCents: 1900,
        tags: ["office", "tech", "practical"],
        audience: "coworker",
        occasion: "office",
      },
    ],
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
