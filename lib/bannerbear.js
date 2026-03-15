function getBannerbearConfig() {
  const secondaryLayerNames = (process.env.SECONDARY_IMAGE_LAYER_NAMES ||
    "photo_sub_1,photo_sub_2,photo_sub_3,photo_sub_4,photo_sub_5")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return {
    apiKey: process.env.BANNERBEAR_API_KEY || "",
    templateId: process.env.BANNERBEAR_TEMPLATE_ID || "",
    apiBase: process.env.BANNERBEAR_API_BASE || "https://sync.api.bannerbear.com",
    layers: {
      title: process.env.TITLE_LAYER_NAME || "title",
      subtitle: process.env.SUBTITLE_LAYER_NAME || "subtitle",
      mainImage: process.env.MAIN_IMAGE_LAYER_NAME || "photo_main",
      secondaryImages: secondaryLayerNames,
    },
  };
}

function buildModifications(payload, layers) {
  const modifications = [];

  if (payload.title) {
    modifications.push({ name: layers.title, text: payload.title });
  }

  if (payload.subtitle) {
    modifications.push({ name: layers.subtitle, text: payload.subtitle });
  }

  if (payload.mainImageUrl) {
    modifications.push({ name: layers.mainImage, image_url: payload.mainImageUrl });
  }

  if (Array.isArray(payload.secondaryImageUrls)) {
    payload.secondaryImageUrls.forEach((imageUrl, index) => {
      if (!imageUrl || !layers.secondaryImages[index]) {
        return;
      }

      modifications.push({
        name: layers.secondaryImages[index],
        image_url: imageUrl,
      });
    });
  }

  return modifications;
}

async function renderBanner(payload) {
  const config = getBannerbearConfig();

  if (!config.apiKey || !config.templateId) {
    return {
      status: 500,
      body: {
        error: "Missing Bannerbear configuration. Check your environment variables.",
      },
    };
  }

  const modifications = buildModifications(payload, config.layers);

  if (modifications.length === 0) {
    return {
      status: 400,
      body: {
        error: "Please fill in at least one field before rendering.",
      },
    };
  }

  try {
    const response = await fetch(`${config.apiBase}/v2/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template: config.templateId,
        modifications,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        status: response.status,
        body: {
          error: data?.message || "Bannerbear request failed.",
          details: data,
        },
      };
    }

    return {
      status: 200,
      body: {
        imageUrl: data.image_url || "",
        uid: data.uid || "",
        raw: data,
      },
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        error: "Failed to reach Bannerbear.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

module.exports = {
  getBannerbearConfig,
  renderBanner,
};
