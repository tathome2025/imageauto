const { renderBanner } = require("../lib/bannerbear");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const payload = typeof req.body === "object" && req.body !== null ? req.body : {};
  const result = await renderBanner(payload);

  return res.status(result.status).json(result.body);
};
