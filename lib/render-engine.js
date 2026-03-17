const { Resvg } = require("@resvg/resvg-js");
const { getTemplateById } = require("./template-store");

const DATA_URL_PREFIX = "data:";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isWideCharacter(character) {
  return /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7AF\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/u.test(
    character,
  );
}

function estimateTextUnits(text) {
  let units = 0;

  for (const character of Array.from(String(text))) {
    if (character === " ") {
      units += 0.45;
      continue;
    }

    if (isWideCharacter(character)) {
      units += 1.8;
      continue;
    }

    if (/[ilI\.,'!:;|]/.test(character)) {
      units += 0.45;
      continue;
    }

    if (/[MW@#%&]/.test(character)) {
      units += 1.25;
      continue;
    }

    units += 1;
  }

  return units;
}

function tokenizeText(text) {
  const tokens = [];
  let buffer = "";

  for (const character of Array.from(String(text))) {
    if (isWideCharacter(character)) {
      if (buffer) {
        tokens.push(buffer);
        buffer = "";
      }

      tokens.push(character);
      continue;
    }

    if (/\s/.test(character)) {
      if (buffer) {
        tokens.push(buffer);
        buffer = "";
      }

      tokens.push(character);
      continue;
    }

    buffer += character;
  }

  if (buffer) {
    tokens.push(buffer);
  }

  return tokens;
}

function clampTextToLines(text, maxWidth, fontSize, maxLines) {
  const tokens = tokenizeText(text);
  const maxUnits = Math.max(1, maxWidth / Math.max(1, fontSize * 0.58));
  const lines = [];
  let current = "";

  for (const token of tokens) {
    const next = `${current}${token}`;
    const visibleNext = next.trim();

    if (!visibleNext) {
      current = next;
      continue;
    }

    if (estimateTextUnits(visibleNext) <= maxUnits) {
      current = next;
      continue;
    }

    if (current.trim()) {
      lines.push(current.trim());
      current = token.trimStart();
    } else {
      const characters = Array.from(token);
      let partial = "";

      for (const character of characters) {
        const attempt = `${partial}${character}`;
        if (estimateTextUnits(attempt) > maxUnits && partial) {
          lines.push(partial);
          partial = character;
        } else {
          partial = attempt;
        }
      }

      current = partial;
    }

    if (maxLines && lines.length >= maxLines) {
      break;
    }
  }

  if (current.trim() && (!maxLines || lines.length < maxLines)) {
    lines.push(current.trim());
  }

  if (maxLines && lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (maxLines && lines.length === maxLines && tokens.length > 0) {
    const joined = lines.join(" ");
    if (joined.replace(/\s+/g, " ").trim() !== String(text).replace(/\s+/g, " ").trim()) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[ .,:;!?-]+$/u, "")}...`;
    }
  }

  return lines;
}

function normalizeColor(value, fallback = "transparent") {
  if (!value) {
    return fallback;
  }

  return String(value);
}

function getTextAnchor(align) {
  if (align === "center") {
    return "middle";
  }

  if (align === "right") {
    return "end";
  }

  return "start";
}

function getTextX(layer) {
  if (layer.align === "center") {
    return layer.x + layer.maxWidth / 2;
  }

  if (layer.align === "right") {
    return layer.x + layer.maxWidth;
  }

  return layer.x;
}

function buildRectMarkup(layer) {
  const radius = Number(layer.radius || 0);
  const fill = normalizeColor(layer.fill, "transparent");
  const stroke = normalizeColor(layer.stroke, "none");
  const strokeWidth = Number(layer.strokeWidth || 0);

  return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" ry="${radius}" fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" />`;
}

async function fetchImageAsDataUrl(imageUrl) {
  const url = String(imageUrl || "").trim();

  if (!url) {
    return "";
  }

  if (url.startsWith(DATA_URL_PREFIX)) {
    return url;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to fetch image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return `data:${contentType};base64,${base64}`;
}

async function buildImageMarkup(layer, variables, index) {
  const imageUrl = variables[layer.key];
  const background = normalizeColor(layer.background, "#E5E7EB");
  const radius = Number(layer.radius || 0);
  const clipId = `clip-${index}-${Math.random().toString(36).slice(2, 8)}`;
  const fragments = [
    `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" ry="${radius}" fill="${escapeXml(background)}" />`,
  ];

  if (!imageUrl) {
    return {
      defs: "",
      markup: fragments.join(""),
    };
  }

  const href = await fetchImageAsDataUrl(imageUrl);
  const defs = `<clipPath id="${clipId}"><rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${radius}" ry="${radius}" /></clipPath>`;

  fragments.push(
    `<image href="${escapeXml(href)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`,
  );

  return {
    defs,
    markup: fragments.join(""),
  };
}

function buildTextMarkup(layer, variables) {
  const rawValue = Object.prototype.hasOwnProperty.call(variables, layer.key)
    ? variables[layer.key]
    : layer.value;
  const textValue = String(rawValue || "");

  if (!textValue) {
    return "";
  }

  const fontSize = Number(layer.fontSize || 24);
  const lineHeight = Number(layer.lineHeight || Math.round(fontSize * 1.25));
  const fontWeight = Number(layer.fontWeight || 400);
  const fontFamily = escapeXml(layer.fontFamily || "Helvetica, Arial, sans-serif");
  const fill = escapeXml(normalizeColor(layer.fill, "#111827"));
  const opacity = layer.opacity == null ? 1 : Number(layer.opacity);
  const letterSpacing = Number(layer.letterSpacing || 0);
  const textAnchor = getTextAnchor(layer.align);
  const x = getTextX(layer);
  const lines = clampTextToLines(
    layer.uppercase ? textValue.toUpperCase() : textValue,
    Number(layer.maxWidth || 400),
    fontSize,
    Number(layer.maxLines || 0) || undefined,
  );

  const tspans = lines
    .map((line, lineIndex) => {
      const y = layer.y + lineIndex * lineHeight;
      return `<tspan x="${x}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text text-anchor="${textAnchor}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" opacity="${opacity}" letter-spacing="${letterSpacing}">${tspans}</text>`;
}

async function buildSvg(template, variables) {
  const width = Number(template.size.width);
  const height = Number(template.size.height);
  const defs = [];
  const body = [];

  if (template.background) {
    body.push(
      `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXml(template.background)}" />`,
    );
  }

  for (const [index, layer] of (template.layers || []).entries()) {
    if (layer.type === "rect") {
      body.push(buildRectMarkup(layer));
      continue;
    }

    if (layer.type === "text") {
      body.push(buildTextMarkup(layer, variables));
      continue;
    }

    if (layer.type === "image") {
      const imageLayer = await buildImageMarkup(layer, variables, index);
      if (imageLayer.defs) {
        defs.push(imageLayer.defs);
      }
      body.push(imageLayer.markup);
    }
  }

  const defsMarkup = defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${defsMarkup}${body.join("")}</svg>`;
}

async function renderTemplate(payload) {
  const templateId = String(payload.templateId || "").trim();
  const format = String(payload.format || "png").trim().toLowerCase();
  const variables =
    payload.variables && typeof payload.variables === "object" ? payload.variables : {};

  if (!templateId) {
    return {
      status: 400,
      body: {
        error: "templateId is required.",
      },
    };
  }

  if (!["png", "svg"].includes(format)) {
    return {
      status: 400,
      body: {
        error: "Unsupported format. Use png or svg.",
      },
    };
  }

  const template = getTemplateById(templateId);

  if (!template) {
    return {
      status: 404,
      body: {
        error: `Template "${templateId}" not found.`,
      },
    };
  }

  try {
    const svg = await buildSvg(template, variables);
    const width = Number(template.size.width);
    const height = Number(template.size.height);

    if (format === "svg") {
      const buffer = Buffer.from(svg, "utf8");
      return {
        status: 200,
        asset: {
          templateId,
          width,
          height,
          format,
          mimeType: "image/svg+xml",
          extension: "svg",
          buffer,
          text: svg,
        },
      };
    }

    const pngBuffer = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: width,
      },
    })
      .render()
      .asPng();

    return {
      status: 200,
      asset: {
        templateId,
        width,
        height,
        format,
        mimeType: "image/png",
        extension: "png",
        buffer: Buffer.from(pngBuffer),
      },
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        error: "Failed to render template.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

module.exports = {
  renderTemplate,
};
