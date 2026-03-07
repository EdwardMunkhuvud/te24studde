import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { writeFile } from "node:fs/promises";

import { INITIAL_DATA } from "../data/initial-data";
import { ROLES, Role } from "../lib/constants";

const prisma = new PrismaClient();

async function main() {
  const existingUserCount = await prisma.user.count();

  if (existingUserCount > 0) {
    console.log("Databasen har redan data. Seed hoppas over.");
    return;
  }

  const credentials: Array<{ name: string; username: string; password: string; role: Role }> = [];

  for (const entry of INITIAL_DATA) {
    const user = await prisma.user.create({
      data: {
        name: entry.name,
        username: entry.username,
        passwordHash: await hash(entry.password, 10),
        role: entry.role,
        targetAmount: entry.targetAmount,
      },
    });

    credentials.push({
      name: entry.name,
      username: entry.username,
      password: entry.password,
      role: entry.role,
    });

    for (const contribution of entry.contributions) {
      await prisma.contribution.create({
        data: {
          userId: user.id,
          title: contribution.title,
          periodLabel: contribution.periodLabel,
          amount: contribution.amount,
          kind: contribution.kind,
          note: contribution.note,
          sortOrder: contribution.sortOrder,
        },
      });
    }
  }

  const lines = [
    "# Loginuppgifter till Studde",
    "",
    "Dessa uppgifter genererades automatiskt från seed-datan i projektet.",
    "",
    "| Namn | Användarnamn | Lösenord | Roll |",
    "| --- | --- | --- | --- |",
    ...credentials.map(
      (credential) =>
        `| ${credential.name} | \`${credential.username}\` | \`${credential.password}\` | ${credential.role === ROLES.ADMIN ? "Admin" : "Elev"} |`,
    ),
    "",
    "Byt lösenord manuellt via adminpanelen om du vill dela ut nya uppgifter.",
  ];

  await writeFile("generated-login-uppgifter.md", `${lines.join("\n")}\n`, "utf8");

  console.log(`Importerade ${credentials.length} konton från projektets seed-data.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
