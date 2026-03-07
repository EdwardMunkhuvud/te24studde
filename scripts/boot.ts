import { spawn, spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function runOrFail(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runOrFail(npmCommand, ["run", "db:push"]);
runOrFail(npmCommand, ["run", "db:seed"]);

const port = process.env.PORT ?? "3000";
const nextProcess = spawn(npxCommand, ["next", "start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  env: process.env,
});

nextProcess.on("exit", (code) => {
  process.exit(code ?? 0);
});
