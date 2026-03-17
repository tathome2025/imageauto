const { authorizeRequest } = require("../../lib/api-auth");
const { renderTemplate } = require("../../lib/render-engine");

function wantsRawResponse(req) {
  const url = new URL(req.url, "http://localhost");
  if (url.searchParams.get("download") === "1") {
    return true;
  }

  const accept = req.headers.accept || "";
  return accept.includes("image/png") || accept.includes("image/svg+xml");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const auth = authorizeRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.body);
  }

  const payload = typeof req.body === "object" && req.body !== null ? req.body : {};
  const result = await renderTemplate(payload);

  if (result.body) {
    return res.status(result.status).json(result.body);
  }

  if (!result.asset) {
    return res.status(500).json({ error: "Renderer returned no output." });
  }

  const raw = wantsRawResponse(req);
  const base64 = result.asset.buffer.toString("base64");

  if (raw) {
    res.setHeader("Content-Type", result.asset.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.asset.templateId}.${result.asset.extension}"`,
    );
    return res.status(200).send(result.asset.buffer);
  }

  return res.status(200).json({
    templateId: result.asset.templateId,
    format: result.asset.format,
    width: result.asset.width,
    height: result.asset.height,
    mimeType: result.asset.mimeType,
    dataUrl: `data:${result.asset.mimeType};base64,${base64}`,
    base64,
  });
};
