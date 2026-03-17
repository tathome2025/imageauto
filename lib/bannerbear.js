function getBannerbearConfig() {
  const secondaryLayerNames = (process.env.SECONDARY_IMAGE_LAYER_NAMES ||
    "product1,product2,product3")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const itemLayerNames = (process.env.ITEM_LAYER_NAMES || "items1,items2,items3")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return {
    apiKey: process.env.BANNERBEAR_API_KEY || "",
    templateId: process.env.BANNERBEAR_TEMPLATE_ID || "",
    apiBase: process.env.BANNERBEAR_API_BASE || "https://sync.api.bannerbear.com",
    upload: {
      blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    },
    layers: {
      title: process.env.TITLE_LAYER_NAME || "car_model",
      subtitle: process.env.SUBTITLE_LAYER_NAME || "car_brand",
      mainImage: process.env.MAIN_IMAGE_LAYER_NAME || "car_image",
      secondaryImages: secondaryLayerNames,
      items: itemLayerNames,
    },
  };
}

function buildModifications(payload, layers) {
  const modifications = [];

  if (payload.title) {
    modifications.push({ name: layers.title, text: payload.title, hide: false });
  } else {
    modifications.push({ name: layers.title, hide: true });
  }

  if (payload.subtitle) {
    modifications.push({ name: layers.subtitle, text: payload.subtitle, hide: false });
  } else {
    modifications.push({ name: layers.subtitle, hide: true });
  }

  if (payload.mainImage?.show === false || !payload.mainImage?.imageUrl) {
    modifications.push({ name: layers.mainImage, hide: true });
  } else if (payload.mainImage?.imageUrl) {
    modifications.push({ name: layers.mainImage, image_url: payload.mainImage.imageUrl, hide: false });
  }

  if (Array.isArray(payload.secondaryImageUrls)) {
    payload.secondaryImageUrls.forEach((imageUrl, index) => {
      if (!layers.secondaryImages[index]) {
        return;
      }

      if (
        Array.isArray(payload.secondaryImageVisibility) &&
        payload.secondaryImageVisibility[index] === false
      ) {
        modifications.push({
          name: layers.secondaryImages[index],
          hide: true,
        });
        return;
      }

      if (!imageUrl) {
        modifications.push({
          name: layers.secondaryImages[index],
          hide: true,
        });
        return;
      }

      modifications.push({
        name: layers.secondaryImages[index],
        image_url: imageUrl,
        hide: false,
      });
    });
  }

  if (Array.isArray(payload.itemEntries)) {
    payload.itemEntries.forEach((entry, index) => {
      if (!layers.items[index]) {
        return;
      }

      if (!entry?.show || !entry.text) {
        modifications.push({
          name: layers.items[index],
          hide: true,
        });
        return;
      }

      modifications.push({
        name: layers.items[index],
        text: entry.text,
        hide: false,
      });
    });
  }

  if (payload.logoVisibility && typeof payload.logoVisibility === "object") {
    Object.entries(payload.logoVisibility).forEach(([name, visible]) => {
      modifications.push({
        name,
        hide: !visible,
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
