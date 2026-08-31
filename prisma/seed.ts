import { PrismaClient } from "@prisma/client";
import fixtures from "../fixtures/island-media-fixtures.json";
import { seedFixtures } from "./seed-fixtures";

const prisma = new PrismaClient();

async function main() {
  console.log(`Seeding from fixtureClock=${fixtures.fixtureClock}, currency=${fixtures.currency}`);
  await seedFixtures(prisma);
  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
