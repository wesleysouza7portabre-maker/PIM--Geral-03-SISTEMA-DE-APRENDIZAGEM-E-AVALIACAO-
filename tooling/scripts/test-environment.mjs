import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import { repositoryRoot } from "./paths.mjs";

process.chdir(repositoryRoot);

export async function command(file, args, options = {}) {
  const child = spawn(file, args, {
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  child.on("error", (error) => console.error(error.message));
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`${file} encerrou com código ${code}`);
}
export async function startEnvironment() {
  // SQL e arquivos Web são copiados pelo build: nunca testar uma cópia antiga.
  await command("dotnet", ["build", "backend/EducaTech.sln", "--no-restore"]);
  const runId = randomBytes(5).toString("hex");
  const port = Number(process.env.TEST_DB_PORT || 55432);
  const apiPort = Number(process.env.TEST_API_PORT || 5087);
  await mkdir(".local", { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: resolve(`.local/pg-${runId}`),
    port,
    user: "postgres",
    password: randomBytes(24).toString("hex"),
    persistent: true,
    authMethod: "scram-sha-256",
    onLog: () => {},
    onError: (message) => {
      if (String(message).includes("FATAL")) console.error(message);
    },
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });
  let client, server;
  const cleanup = async () => {
    if (server && !server.killed) {
      server.kill();
      await Promise.race([
        once(server, "exit"),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
    }
    if (client) await client.end();
    await pg.stop();
  };
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("educatech_tests");
    client = pg.getPgClient("educatech_tests");
    await client.connect();
    const adminEmail = "admin@educatech.test";
    const adminPassword = `PimIV!${randomBytes(18).toString("hex")}`;
    const env = {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: "Development",
      ASPNETCORE_URLS: `http://127.0.0.1:${apiPort}`,
      Jwt__Key: randomBytes(48).toString("base64"),
      Bootstrap__Email: adminEmail,
      Bootstrap__Password: adminPassword,
    };
    // A biblioteca não expõe options publicamente em todas as versões; usa a configuração do cliente.
    env.ConnectionStrings__Database = `Host=127.0.0.1;Port=${port};Database=educatech_tests;Username=postgres;Password=${client.connectionParameters.password}`;
    const dll = resolve(
      "backend/EducaTech.Api/bin/Debug/net8.0/EducaTech.Api.dll",
    );
    const cwd = resolve("backend/EducaTech.Api");
    await command("dotnet", [dll, "--migrate", "--bootstrap"], { cwd, env });
    await command("dotnet", [dll, "--migrate"], { cwd, env }); // Migração idempotente.
    const appPassword = randomBytes(24).toString("hex");
    const roleSql = await client.query(
      "SELECT format('ALTER ROLE educatech_app LOGIN PASSWORD %L',$1::text) AS sql",
      [appPassword],
    );
    await client.query(roleSql.rows[0].sql);
    env.ConnectionStrings__Database = `Host=127.0.0.1;Port=${port};Database=educatech_tests;Username=educatech_app;Password=${appPassword}`;
    let log = "";
    function launch() {
      server = spawn("dotnet", [dll], {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      server.stdout.on("data", (chunk) => {
        log += chunk;
      });
      server.stderr.on("data", (chunk) => {
        log += chunk;
      });
    }
    const base = `http://127.0.0.1:${apiPort}`;
    async function waitReady() {
      let ready = false;
      for (let i = 0; i < 60; i++) {
        if (server.exitCode !== null) throw new Error(`API encerrou: ${log}`);
        try {
          const response = await fetch(`${base}/health/ready`);
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!ready) throw new Error(`API indisponível: ${log}`);
    }
    launch();
    await waitReady();
    return {
      base,
      client,
      adminEmail,
      adminPassword,
      cleanup,
      restartApi: async () => {
        const ended = once(server, "exit");
        server.kill();
        await ended;
        launch();
        await waitReady();
      },
      logs: () => log,
    };
  } catch (error) {
    await cleanup().catch(() => {});
    throw error;
  }
}
