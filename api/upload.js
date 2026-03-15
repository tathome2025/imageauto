const { uploadImages } = require("../lib/upload");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const result = await uploadImages(req);
    return res.status(result.status).json(result.body);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to upload images.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
