import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { repositoryRoot, fromRoot } from "./paths.mjs";

// Verifica arquivos candidatos ao Git, sem imprimir valores de credenciais.
const paths = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        windowsHide: true,
      },
    )
      .split("\0")
      .filter(Boolean),
  ),
];
let secrets = [];
try {
  const local = JSON.parse(
    await readFile(fromRoot(".local/development.json"), "utf8"),
  );
  secrets = [
    local.dbPassword,
    local.appPassword,
    local.jwtKey,
    local.adminPassword,
  ].filter((value) => typeof value === "string" && value.length >= 12);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const problems = [];
let checked = 0;
for (const path of paths) {
  let info;
  try {
    info = await stat(fromRoot(path));
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  if (!info.isFile()) continue;
  checked++;
  const normalized = path.replaceAll("\\", "/");
  if (
    /(^|\/)(\.local|node_modules|bin|obj|dist|\.expo|\.gradle|test-results)(\/|$)/.test(
      normalized,
    ) ||
    /(^|\/)\.env($|\.(?!example$))/.test(normalized) ||
    /\.(apk|aab|ipa|keystore|jks)$/i.test(normalized) ||
    /(^|\/)appsettings\.Local\.json$/i.test(normalized)
  ) {
    problems.push(
      `${path}: arquivo gerado, configuração local ou credencial não deve ser versionado.`,
    );
    continue;
  }
  if (
    secrets.length &&
    /\.(cs|csproj|props|json|md|js|mjs|ts|tsx|yaml|yml|sql|ps1|sh|html|css)$/.test(
      path,
    )
  ) {
    const content = await readFile(fromRoot(path), "utf8");
    if (secrets.some((secret) => content.includes(secret)))
      problems.push(`${path}: contém uma credencial do ambiente local.`);
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Repositório: ${checked} arquivos conferidos; dados locais, dependências e credenciais fora do conjunto de publicação.`,
  );
