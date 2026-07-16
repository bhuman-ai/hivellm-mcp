import test from "node:test";
import assert from "node:assert/strict";
import { apiUrl, callHiveApi, normalizeApiBase } from "../src/api.js";

const config = {
  apiBase: "https://hivellm.com/api/human/",
  apiKey: "hive_test_key",
};

test("normalizes the production host and human API path", () => {
  assert.equal(normalizeApiBase(config.apiBase), "https://www.hivellm.com/api/human");
  assert.equal(
    apiUrl(config.apiBase, "/human/rooms/42"),
    "https://www.hivellm.com/api/human?path=%2Fhuman%2Frooms%2F42"
  );
});

test("sends the hiveLLM account key without exposing other AI credentials", async () => {
  let captured;
  const payload = await callHiveApi(config, "POST", "/human/rooms", { task: "Review this UI" }, {
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ id: "42" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(captured.init.headers.Authorization, "Bearer hive_test_key");
  assert.equal(JSON.parse(captured.init.body).task, "Review this UI");
  assert.deepEqual(payload, { id: "42" });
});

test("returns a useful backend error", async () => {
  await assert.rejects(
    callHiveApi(config, "GET", "/human/account", null, {
      fetchImpl: async () => new Response(JSON.stringify({ error: "Invalid hiveLLM API key" }), { status: 401 }),
    }),
    /Invalid hiveLLM API key/
  );
});
