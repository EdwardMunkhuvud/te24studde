import { readFile } from "fs/promises";
import path from "path";

import { listR2MediaObjects } from "../lib/r2";
import { ensureR2Thumbnail } from "../lib/r2-thumbnails";

const imageExtensions = new Set([".gif", ".jpeg", ".jpg", ".png", ".webp"]);

async function main() {
  await loadLocalEnv();

  const objects = (await listR2MediaObjects()).filter((object) => (
    object.Key && imageExtensions.has(path.extname(object.Key).toLowerCase())
  ));
  let created = 0;
  let existing = 0;
  let cursor = 0;

  console.log(`Skapar miniatyrer för ${objects.length} bilder...`);

  async function worker() {
    while (cursor < objects.length) {
      const index = cursor++;
      const key = objects[index].Key as string;
      const result = await ensureR2Thumbnail(key);

      if (result === "created") {
        created += 1;
      } else if (result === "existing") {
        existing += 1;
      }

      if ((index + 1) % 20 === 0 || index + 1 === objects.length) {
        console.log(`${index + 1}/${objects.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, () => worker()));
  console.log(`Klart: ${created} skapade, ${existing} fanns redan.`);
}

async function loadLocalEnv() {
  for (const fileName of [".env.local", ".env"]) {
    const content = await readFile(path.join(process.cwd(), fileName), "utf8").catch(() => "");

    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
