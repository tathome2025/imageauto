const { handleUpload } = require("@vercel/blob/client");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body =
      typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(req.body || "{}");
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (
          !pathname.startsWith("main-images/") &&
          !pathname.startsWith("secondary-images/")
        ) {
          throw new Error("Invalid upload path.");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          addRandomSuffix: true,
          maximumSizeInBytes: 50 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {},
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({
      error: "Failed to upload images.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};
