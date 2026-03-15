const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

const {
  BANNERBEAR_API_KEY,
  BANNERBEAR_TEMPLATE_ID,
  BANNERBEAR_API_BASE = "https://sync.api.bannerbear.com",
  TITLE_LAYER_NAME = "title",
  SUBTITLE_LAYER_NAME = "subtitle",
  IMAGE_LAYER_NAME = "photo",
} = process.env;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (_req, res) => {
  res.json({
    configured: Boolean(BANNERBEAR_API_KEY && BANNERBEAR_TEMPLATE_ID),
    templateId: BANNERBEAR_TEMPLATE_ID || "",
    layers: {
      title: TITLE_LAYER_NAME,
      subtitle: SUBTITLE_LAYER_NAME,
      image: IMAGE_LAYER_NAME,
    },
  });
});

app.post("/api/render", async (req, res) => {
  if (!BANNERBEAR_API_KEY || !BANNERBEAR_TEMPLATE_ID) {
    return res.status(500).json({
      error: "Missing Bannerbear configuration. Check your .env file.",
    });
  }

  const { title, subtitle, imageUrl } = req.body ?? {};
  const modifications = [];

  if (title) {
    modifications.push({ name: TITLE_LAYER_NAME, text: title });
  }

  if (subtitle) {
    modifications.push({ name: SUBTITLE_LAYER_NAME, text: subtitle });
  }

  if (imageUrl) {
    modifications.push({ name: IMAGE_LAYER_NAME, image_url: imageUrl });
  }

  if (modifications.length === 0) {
    return res.status(400).json({
      error: "Please fill in at least one field before rendering.",
    });
  }

  try {
    const response = await fetch(`${BANNERBEAR_API_BASE}/v2/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BANNERBEAR_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template: BANNERBEAR_TEMPLATE_ID,
        modifications,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || "Bannerbear request failed.",
        details: data,
      });
    }

    return res.json({
      imageUrl: data.image_url || "",
      uid: data.uid || "",
      raw: data,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to reach Bannerbear.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(port, () => {
  console.log(`Bannerbear app running at http://localhost:${port}`);
});
