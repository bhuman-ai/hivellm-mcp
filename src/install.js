import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyEdits, modify, parse } from "jsonc-parser";
import { callHiveApi } from "./api.js";
import { requireApiKey } from "./config.js";

const serverEntry = fileURLToPath(new URL("../bin/hivellm-mcp.js", import.meta.url));

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function commandError(result, fallback) {
  return asText(result?.stderr || result?.stdout, fallback);
}

export async function validateAccount(config, options = {}) {
  requireApiKey(config);
  return callHiveApi(config, "GET", "/human/account", null, { fetchImpl: options.fetchImpl });
}

export function codexAddArgs(config, options = {}) {
  const apiKey = requireApiKey(config);
  return [
    "mcp",
    "add",
    "--env",
    `HIVELLM_API_KEY=${apiKey}`,
    "--env",
    `HIVELLM_API_BASE=${config.apiBase}`,
    "--env",
    "HIVELLM_CLIENT_NAME=Codex",
    "hivellm",
    "--",
    options.nodePath || process.execPath,
    options.serverEntry || serverEntry,
  ];
}

export function installCodex(config, options = {}) {
  const run = options.spawnSync || spawnSync;
  const command = options.codexCommand || "codex";
  run(command, ["mcp", "remove", "hivellm"], { encoding: "utf8" });

  const args = codexAddArgs(config, options);
  const result = run(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(commandError(result, "Codex could not add the hiveLLM MCP server."));
  }

  return { client: "Codex", server: "hivellm", command, args };
}

export function defaultOpenCodeConfigPath(homeDir = os.homedir()) {
  const root = process.platform === "win32"
    ? process.env.APPDATA || path.join(homeDir, "AppData", "Roaming")
    : path.join(homeDir, ".config");
  const jsonPath = path.join(root, "opencode", "opencode.json");
  const jsoncPath = path.join(root, "opencode", "opencode.jsonc");
  if (fs.existsSync(jsonPath)) return jsonPath;
  if (fs.existsSync(jsoncPath)) return jsoncPath;
  return jsonPath;
}

export function mergeOpenCodeConfig(source, config, options = {}) {
  requireApiKey(config);
  const initial = source.trim() ? source : "{}\n";
  const errors = [];
  const current = parse(initial, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length || !current || typeof current !== "object" || Array.isArray(current)) {
    throw new Error("OpenCode config is not valid JSON or JSONC. Fix it before installing hiveLLM.");
  }

  const value = {
    type: "local",
    command: [options.nodePath || process.execPath, options.serverEntry || serverEntry],
    enabled: true,
    timeout: 130000,
    environment: {
      HIVELLM_API_KEY: config.apiKey,
      HIVELLM_API_BASE: config.apiBase,
      HIVELLM_CLIENT_NAME: "OpenCode",
    },
  };
  const edits = modify(initial, ["mcp", "hivellm"], value, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" },
    isArrayInsertion: false,
  });
  return applyEdits(initial, edits);
}

export function installOpenCode(config, options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const configPath = options.configPath || defaultOpenCodeConfigPath(homeDir);
  const source = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "{}\n";
  const next = mergeOpenCodeConfig(source, config, options);

  fs.mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(configPath, next.endsWith("\n") ? next : `${next}\n`, { mode: 0o600 });
  return { client: "OpenCode", server: "hivellm", configPath };
}

export async function installClient(target, config, options = {}) {
  const account = await validateAccount(config, options);
  if (target === "codex") {
    return { account, ...installCodex(config, options) };
  }
  if (target === "opencode") {
    return { account, ...installOpenCode(config, options) };
  }
  throw new Error("Choose codex or opencode.");
}

export function installedServerEntry() {
  return serverEntry;
}
