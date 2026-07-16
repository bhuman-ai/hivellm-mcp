import process from "node:process";
import { callHiveApi } from "./api.js";
import { loadConfig } from "./config.js";
import { installClient, installedServerEntry, validateAccount } from "./install.js";
import { runStdioServer } from "./server.js";
import { VERSION } from "./version.js";

function usage() {
  return `hiveLLM MCP

Usage:
  hivellm-mcp                    Start the MCP stdio server
  hivellm-mcp install codex     Add hiveLLM to Codex
  hivellm-mcp install opencode  Add hiveLLM to OpenCode
  hivellm-mcp doctor            Check the account and production API

Environment:
  HIVELLM_API_KEY               Required account key from hivellm.com/install
  HIVELLM_API_BASE              Optional API override
`;
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const [command, target] = argv;
  const config = options.config || loadConfig(options.env || process.env);
  const stdout = options.stdout || process.stdout;

  if (command === "help" || command === "--help" || command === "-h") {
    stdout.write(usage());
    return;
  }
  if (command === "--version" || command === "version") {
    stdout.write(`${VERSION}\n`);
    return;
  }
  if (command === "install") {
    const result = await installClient(String(target || "").toLowerCase(), config, options);
    stdout.write(`hiveLLM connected to ${result.client} for ${result.account.email}.\n`);
    stdout.write(result.client === "Codex" ? "Restart Codex, then ask it to check hiveLLM expert availability.\n" : "Restart OpenCode, then ask it to check hiveLLM expert availability.\n");
    return result;
  }
  if (command === "doctor") {
    const account = await validateAccount(config, options);
    const offer = await callHiveApi(config, "GET", "/human/offer", null, {
      allowAnonymous: true,
      fetchImpl: options.fetchImpl,
    });
    stdout.write(`[ok] Account: ${account.email}\n`);
    stdout.write(`[ok] API: ${config.apiBase}\n`);
    stdout.write(`[ok] MCP server: ${installedServerEntry()}\n`);
    stdout.write(`[ok] Expert matching: ${offer.line}\n`);
    return { account, offer };
  }
  if (command) {
    throw new Error(`Unknown command: ${command}\n\n${usage()}`);
  }

  return (options.runServer || runStdioServer)(config);
}
