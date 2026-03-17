const fs = require("fs");
const path = require("path");

const templatesDir = path.join(__dirname, "..", "templates");

function loadTemplateFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed.id || !parsed.size?.width || !parsed.size?.height) {
    throw new Error(`Invalid template definition in ${path.basename(filePath)}.`);
  }

  return parsed;
}

function listTemplates() {
  if (!fs.existsSync(templatesDir)) {
    return [];
  }

  return fs
    .readdirSync(templatesDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => loadTemplateFile(path.join(templatesDir, fileName)))
    .map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description || "",
      size: template.size,
      variables: Array.isArray(template.variables) ? template.variables : [],
      formatSupport: ["svg", "png"],
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getTemplateById(templateId) {
  const safeId = String(templateId || "").trim();

  if (!safeId || !/^[a-z0-9-]+$/i.test(safeId)) {
    return null;
  }

  const filePath = path.join(templatesDir, `${safeId}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return loadTemplateFile(filePath);
}

module.exports = {
  getTemplateById,
  listTemplates,
  templatesDir,
};
