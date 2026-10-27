import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
export const fromRoot = (...parts) => resolve(repositoryRoot, ...parts);
