import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { command } from "./test-environment.mjs";
import { repositoryRoot, fromRoot } from "./paths.mjs";

process.chdir(repositoryRoot);

// Atalho exclusivamente local: PostgreSQL privado ao projeto, sem instalar serviço do Windows.
await mkdir(".local", { recursive: true });
const settingsPath = resolve(".local/development.json");
let settings;
try {
  settings = JSON.parse(await readFile(settingsPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  settings = {
    dbPassword: randomBytes(24).toString("hex"),
    appPassword: randomBytes(24).toString("hex"),
    jwtKey: randomBytes(48).toString("base64"),
    adminEmail: "admin@educatech.local",
    adminPassword: `PimIV!${randomBytes(18).toString("hex")}`,
  };
  await writeFile(settingsPath, JSON.stringify(settings, null, 2), {
    mode: 0o600,
  });
}
const port = Number(process.env.DEV_DB_PORT || 55433);
const apiPort = Number(process.env.DEV_API_PORT || 5080);
const directory = resolve(".local/development-db");
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  port,
  user: "postgres",
  password: settings.dbPassword,
  persistent: true,
  authMethod: "scram-sha-256",
  onLog: () => {},
  onError: (message) => {
    if (String(message).includes("FATAL")) console.error(message);
  },
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
});
let client,
  server,
  stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (server && !server.killed) {
    server.kill();
    await Promise.race([
      once(server, "exit"),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  }
  if (client) await client.end();
  await pg.stop();
}
try {
  try {
    await access(resolve(directory, "PG_VERSION"));
  } catch {
    await pg.initialise();
  }
  await pg.start();
  client = pg.getPgClient();
  await client.connect();
  if (
    !(await client.query("SELECT 1 FROM pg_database WHERE datname='educatech'"))
      .rowCount
  )
    await pg.createDatabase("educatech");
  await client.end();
  client = pg.getPgClient("educatech");
  await client.connect();
  await command("dotnet", ["build", "EducaTech.sln"], {
    cwd: fromRoot("backend"),
  });
  const dll = resolve(
    "backend/EducaTech.Api/bin/Debug/net8.0/EducaTech.Api.dll",
  );
  const cwd = resolve("backend/EducaTech.Api");
  const env = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: "Development",
    ASPNETCORE_URLS: `http://localhost:${apiPort}`,
    ConnectionStrings__Database: `Host=127.0.0.1;Port=${port};Database=educatech;Username=postgres;Password=${settings.dbPassword}`,
    Bootstrap__Email: settings.adminEmail,
    Bootstrap__Password: settings.adminPassword,
    Jwt__Key: settings.jwtKey,
  };
  await command("dotnet", [dll, "--migrate", "--bootstrap"], { cwd, env });
  const role = await client.query(
    "SELECT format('ALTER ROLE educatech_app LOGIN PASSWORD %L',$1::text) AS sql",
    [settings.appPassword],
  );
  await client.query(role.rows[0].sql);
  env.ConnectionStrings__Database = `Host=127.0.0.1;Port=${port};Database=educatech;Username=educatech_app;Password=${settings.appPassword}`;
  delete env.Bootstrap__Password;
  delete env.Bootstrap__Email;
  server = spawn("dotnet", [dll], {
    cwd,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  process.on("SIGINT", () => {
    stop().catch(console.error);
  });
  process.on("SIGTERM", () => {
    stop().catch(console.error);
  });
  console.log(
    `\nEducaTech: http://localhost:${apiPort}\nSwagger: http://localhost:${apiPort}/swagger\nConta administrativa local: veja ${settingsPath}\nDados persistidos em .local/development-db. Encerre com Ctrl+C.\n`,
  );
  const serverExit = once(server, "exit");
  if (process.argv.includes("--check")) {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null)
        throw new Error("A API encerrou durante a inicialização.");
      try {
        const response = await fetch(
          `http://localhost:${apiPort}/health/ready`,
        );
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Aguarda o servidor abrir a porta local. */
      }
      await new Promise((done) => setTimeout(done, 250));
    }
    if (!ready)
      throw new Error("A API não ficou disponível no prazo esperado.");
    console.log(
      "Inicialização local validada; banco e configurações existentes preservados.",
    );
    await stop();
  } else {
    const [code] = await serverExit;
    if (code && !stopping) process.exitCode = code;
  }
} finally {
  await stop();
}
