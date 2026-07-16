import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "jsonc-parser";
import { codexAddArgs, installCodex, installOpenCode, mergeOpenCodeConfig } from "../src/install.js";

const config = {
  apiBase: "https://www.hivellm.com/api/human",
  apiKey: "hive_install_key",
};

test("builds a Codex MCP command that only adds hiveLLM", () => {
  const args = codexAddArgs(config, { nodePath: "/node", serverEntry: "/hivellm/server.js" });
  assert.deepEqual(args, [
    "mcp", "add",
    "--env", "HIVELLM_API_KEY=hive_install_key",
    "--env", "HIVELLM_API_BASE=https://www.hivellm.com/api/human",
    "--env", "HIVELLM_CLIENT_NAME=Codex",
    "hivellm", "--", "/node", "/hivellm/server.js",
  ]);
});

test("Codex install replaces only the existing hiveLLM server", () => {
  const calls = [];
  const result = installCodex(config, {
    nodePath: "/node",
    serverEntry: "/hivellm/server.js",
    spawnSync(command, args) {
      calls.push({ command, args });
      return { status: 0, stdout: "", stderr: "" };
    },
  });

  assert.deepEqual(calls[0].args, ["mcp", "remove", "hivellm"]);
  assert.equal(calls[1].args.includes("HIVELLM_API_KEY=hive_install_key"), true);
  assert.equal(result.client, "Codex");
});

test("OpenCode install preserves models, providers, comments, and other MCPs", () => {
  const source = `{
  // keep the user's selected model
  "model": "openai/gpt-5.6",
  "provider": { "openai": { "options": {} } },
  "mcp": {
    "github": { "type": "remote", "url": "https://example.com/mcp" },
    "castellar-human": {
      "type": "local",
      "command": ["node", "/old/castellar.js", "human-mcp"]
    }
  },
}
`;
  const next = mergeOpenCodeConfig(source, config, { nodePath: "/node", serverEntry: "/hivellm/server.js" });
  const parsed = parse(next);

  assert.match(next, /keep the user's selected model/);
  assert.equal(parsed.model, "openai/gpt-5.6");
  assert.equal(parsed.mcp.github.url, "https://example.com/mcp");
  assert.equal(parsed.mcp["castellar-human"], undefined);
  assert.deepEqual(parsed.mcp.hivellm.command, ["/node", "/hivellm/server.js"]);
  assert.equal(parsed.mcp.hivellm.environment.HIVELLM_API_KEY, "hive_install_key");
});

test("OpenCode install does not remove an unrelated server that reuses the legacy key", () => {
  const source = JSON.stringify({
    mcp: {
      "castellar-human": {
        type: "remote",
        url: "https://example.com/custom-mcp",
      },
    },
  });
  const parsed = parse(mergeOpenCodeConfig(source, config, {
    nodePath: "/node",
    serverEntry: "/hivellm/server.js",
  }));

  assert.equal(parsed.mcp["castellar-human"].url, "https://example.com/custom-mcp");
  assert.equal(parsed.mcp.hivellm.enabled, true);
});

test("writes a valid global OpenCode config without changing unrelated settings", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "hivellm-opencode-"));
  const configPath = path.join(homeDir, ".config", "opencode", "opencode.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ model: "anthropic/claude", mcp: { existing: { enabled: true } } }));

  const result = installOpenCode(config, {
    homeDir,
    nodePath: "/node",
    serverEntry: "/hivellm/server.js",
  });
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));

  assert.equal(result.configPath, configPath);
  assert.equal(parsed.model, "anthropic/claude");
  assert.equal(parsed.mcp.existing.enabled, true);
  assert.equal(parsed.mcp.hivellm.enabled, true);
});
