import { DEFAULT_API_BASE, requireApiKey } from "./config.js";

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function normalizeApiBase(value) {
  const base = asText(value, DEFAULT_API_BASE).replace(/\/$/, "");

  try {
    const url = new URL(base);
    if (url.hostname === "hivellm.com") {
      url.hostname = "www.hivellm.com";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return base;
  }
}

export function apiUrl(base, path) {
  const normalized = normalizeApiBase(base);
  if (normalized.endsWith("/api/human")) {
    return `${normalized}?path=${encodeURIComponent(path)}`;
  }
  return `${normalized}${path}`;
}

async function responsePayload(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function callHiveApi(config, method, path, body = null, options = {}) {
  const apiKey = options.allowAnonymous ? asText(config?.apiKey) : requireApiKey(config);
  const fetchImpl = options.fetchImpl || fetch;
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetchImpl(apiUrl(config?.apiBase, path), {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body || {}),
    signal: options.signal,
  });
  const payload = await responsePayload(response);

  if (!response.ok) {
    const message = payload?.error || payload?.message || `${method} ${path} failed with HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}
