function getImageApiConfig() {
  const keys = (process.env.IMAGE_API_KEYS || "demo-key")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    enabled: process.env.DISABLE_IMAGE_API_AUTH !== "true",
    keys,
  };
}

function readApiKey(req) {
  const bearer = req.headers.authorization || "";

  if (bearer.startsWith("Bearer ")) {
    return bearer.slice("Bearer ".length).trim();
  }

  const headerValue = req.headers["x-api-key"];
  return typeof headerValue === "string" ? headerValue.trim() : "";
}

function authorizeRequest(req) {
  const config = getImageApiConfig();

  if (!config.enabled) {
    return { ok: true };
  }

  const apiKey = readApiKey(req);

  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      body: {
        error: "Missing API key.",
        details: "Pass X-API-Key or Authorization: Bearer <key>.",
      },
    };
  }

  if (!config.keys.includes(apiKey)) {
    return {
      ok: false,
      status: 403,
      body: {
        error: "Invalid API key.",
      },
    };
  }

  return { ok: true, apiKey };
}

module.exports = {
  authorizeRequest,
  getImageApiConfig,
};
