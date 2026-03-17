const { authorizeRequest } = require("../../lib/api-auth");
const { listTemplates } = require("../../lib/template-store");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const auth = authorizeRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.body);
  }

  return res.status(200).json({
    templates: listTemplates(),
  });
};
