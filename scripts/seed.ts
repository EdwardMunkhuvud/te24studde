import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { writeFile } from "node:fs/promises";

import { CONTRIBUTION_TYPES, POLL_TYPES, ROLES, Role, SEED_VERSION } from "../lib/constants";

const prisma = new PrismaClient();
const SEED_VERSION_KEY = "seed-version";
const WELCOME_ANNOUNCEMENT_KEY = "welcome-announcement-created";
const WELCOME_POLL_KEY = "welcome-poll-created";

const INITIAL_USERS = [
  { name: "Adan Lindell Åkesson", username: "adan.lindell.akesson", password: "adan", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Armin Colic", username: "armin.colic", password: "armin", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Benjamin Brkic", username: "benjamin.brkic", password: "benjamin", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 350, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Edvin Moberg", username: "edvin.moberg", password: "edvin", role: ROLES.ADMIN, targetAmount: 1050, contributions: [] },
  { name: "Elis Blüml Karadza", username: "elis.bluml.karadza", password: "elis", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Erik Hellström", username: "erik.hellstrom", password: "erik", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Folke Farebo", username: "folke.farebo", password: "folke", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 210, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Frankie Dang", username: "frankie.dang", password: "frankie", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 350, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Ghazal Abo Nabout", username: "ghazal.abo.nabout", password: "ghazal", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 280, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Harry Almert", username: "harry.almert", password: "harry", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Helle van Asseldonk", username: "helle.van.asseldonk", password: "helle", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 420, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Hugo Lindberg", username: "hugo.lindberg", password: "hugo", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Isabella Dinh", username: "isabella.dinh", password: "isabella", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 770, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Jennifer Tran", username: "jennifer.tran", password: "jennifer", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 1120, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Justina Jonasson", username: "justina.jonasson", password: "justina", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 630, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Karim Almasri", username: "karim.almasri", password: "karim", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 70, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Keon Gashi", username: "keon.gashi", password: "keon", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Lucas Ericsson", username: "lucas.ericsson", password: "lucas", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 350, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Lucas Jonsson", username: "lucas.jonsson", password: "lucas", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 630, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Maja Granlund", username: "maja.granlund", password: "maja", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 560, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Majd Arab", username: "majd.arab", password: "majd", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 350, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Melwin Dahlberg", username: "melwin.dahlberg", password: "melwin", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Nikolaj Andersen", username: "nikolaj.andersen", password: "nikolaj", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 420, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Oliver Krantz", username: "oliver.krantz", password: "oliver", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Simon Elgemar Jonsson", username: "simon.elgemar.jonsson", password: "simon", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 490, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Stefan Noel", username: "stefan.noel", password: "stefan", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Svante Brodin", username: "svante.brodin", password: "svante", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 210, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Vendela Lindh", username: "vendela.lindh", password: "vendela", role: ROLES.STUDENT, targetAmount: 1050, contributions: [] },
  { name: "Viggo Haglind", username: "viggo.haglind", password: "viggo", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 350, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Vilgot Tyrberg", username: "vilgot.tyrberg", password: "vilgot", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 1680, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
  { name: "Vilma Hagman Dalfjärd", username: "vilma.hagman.dalfjard", password: "vilma", role: ROLES.STUDENT, targetAmount: 1050, contributions: [{ title: "Runda 1", amount: 840, kind: CONTRIBUTION_TYPES.SALE, periodLabel: "Runda 1", note: null, sortOrder: 0 }] },
] as const;

const DEFAULT_ANNOUNCEMENT = {
  title: "Studde ar live",
  body: "Har ser ni klasskassan, nya announcements och omrostningar direkt i mobilen.",
};

async function syncSeedUsers() {
  const currentVersion = await prisma.setting.findUnique({
    where: {
      key: SEED_VERSION_KEY,
    },
  });
  const shouldRefreshPasswords = currentVersion?.value !== SEED_VERSION;
  const credentials: Array<{ name: string; username: string; password: string; role: Role }> = [];

  for (const entry of INITIAL_USERS) {
    const existingUser = await prisma.user.findUnique({
      where: {
        username: entry.username,
      },
      include: {
        contributions: true,
      },
    });

    const passwordHash = shouldRefreshPasswords || !existingUser ? await hash(entry.password, 10) : undefined;

    if (!existingUser) {
      const createdUser = await prisma.user.create({
        data: {
          name: entry.name,
          username: entry.username,
          passwordHash: passwordHash ?? (await hash(entry.password, 10)),
          role: entry.role,
          targetAmount: entry.targetAmount,
        },
      });

      for (const contribution of entry.contributions) {
        await prisma.contribution.create({
          data: {
            userId: createdUser.id,
            title: contribution.title,
            periodLabel: contribution.periodLabel,
            amount: contribution.amount,
            kind: contribution.kind,
            note: contribution.note,
            sortOrder: contribution.sortOrder,
          },
        });
      }
    } else {
      await prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          name: entry.name,
          role: entry.role,
          targetAmount: entry.targetAmount,
          ...(passwordHash ? { passwordHash } : {}),
        },
      });

      if (existingUser.contributions.length === 0 && entry.contributions.length > 0) {
        for (const contribution of entry.contributions) {
          await prisma.contribution.create({
            data: {
              userId: existingUser.id,
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
    }

    credentials.push({
      name: entry.name,
      username: entry.username,
      password: entry.password,
      role: entry.role,
    });
  }

  await prisma.setting.upsert({
    where: {
      key: SEED_VERSION_KEY,
    },
    update: {
      value: SEED_VERSION,
    },
    create: {
      key: SEED_VERSION_KEY,
      value: SEED_VERSION,
    },
  });

  return credentials;
}

async function ensureWelcomeAnnouncement() {
  const existingFlag = await prisma.setting.findUnique({
    where: {
      key: WELCOME_ANNOUNCEMENT_KEY,
    },
  });

  if (existingFlag) {
    return;
  }

  const announcementCount = await prisma.announcement.count();

  if (announcementCount > 0) {
    await prisma.setting.create({
      data: {
        key: WELCOME_ANNOUNCEMENT_KEY,
        value: "true",
      },
    });
    return;
  }

  const admin = await prisma.user.findFirst({
    where: {
      role: ROLES.ADMIN,
    },
  });

  if (!admin) {
    return;
  }

  await prisma.announcement.create({
    data: {
      title: DEFAULT_ANNOUNCEMENT.title,
      body: DEFAULT_ANNOUNCEMENT.body,
      authorId: admin.id,
    },
  });

  await prisma.setting.create({
    data: {
      key: WELCOME_ANNOUNCEMENT_KEY,
      value: "true",
    },
  });
}

async function ensureWelcomePoll() {
  const existingFlag = await prisma.setting.findUnique({
    where: {
      key: WELCOME_POLL_KEY,
    },
  });

  if (existingFlag) {
    return;
  }

  const pollCount = await prisma.poll.count();

  if (pollCount > 0) {
    await prisma.setting.create({
      data: {
        key: WELCOME_POLL_KEY,
        value: "true",
      },
    });
    return;
  }

  const admin = await prisma.user.findFirst({
    where: {
      role: ROLES.ADMIN,
    },
  });

  if (!admin) {
    return;
  }

  const poll = await prisma.poll.create({
    data: {
      title: "Vilken studentaktivitet vill ni prioritera?",
      description: "Detta ar ett exempel pa en omrostning. Du kan ta bort eller ersatta den i adminpanelen.",
      type: POLL_TYPES.OPTION,
      authorId: admin.id,
    },
  });

  await prisma.pollOption.createMany({
    data: [
      { pollId: poll.id, label: "Flak", sortOrder: 0 },
      { pollId: poll.id, label: "Skiva", sortOrder: 1 },
      { pollId: poll.id, label: "Mer merch", sortOrder: 2 },
    ],
  });

  await prisma.setting.create({
    data: {
      key: WELCOME_POLL_KEY,
      value: "true",
    },
  });
}

async function writeCredentialsFile(credentials: Array<{ name: string; username: string; password: string; role: Role }>) {
  const lines = [
    "# Loginuppgifter till Studde",
    "",
    "Dessa uppgifter genererades automatiskt fran seed-datan i projektet.",
    "",
    "| Namn | Anvandarnamn | Losenord | Roll |",
    "| --- | --- | --- | --- |",
    ...credentials.map(
      (credential) =>
        `| ${credential.name} | \`${credential.username}\` | \`${credential.password}\` | ${credential.role === ROLES.ADMIN ? "Admin" : "Elev"} |`,
    ),
    "",
    "Byt losenord manuellt via adminpanelen om du vill dela ut nya uppgifter.",
  ];

  await writeFile("generated-login-uppgifter.md", `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const credentials = await syncSeedUsers();
  await ensureWelcomeAnnouncement();
  await ensureWelcomePoll();
  await writeCredentialsFile(credentials);

  console.log(`Synkade ${credentials.length} konton och seedade community-innehall.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
