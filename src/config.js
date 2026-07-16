export const DEFAULT_API_BASE = "https://www.hivellm.com/api/human";

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function loadConfig(env = process.env) {
  return {
    apiBase: asText(env.HIVELLM_API_BASE || env.CASTELLAR_HUMAN_API_BASE, DEFAULT_API_BASE),
    apiKey: asText(env.HIVELLM_API_KEY || env.CASTELLAR_HUMAN_API_KEY),
    clientName: asText(env.HIVELLM_CLIENT_NAME, "MCP client"),
  };
}

export function requireApiKey(config) {
  if (!asText(config?.apiKey)) {
    throw new Error("HIVELLM_API_KEY is required. Create an install command at https://www.hivellm.com/install.");
  }
  return config.apiKey;
}
