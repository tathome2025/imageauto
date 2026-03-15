const { getBannerbearConfig } = require("../lib/bannerbear");

module.exports = async function handler(_req, res) {
  const config = getBannerbearConfig();

  res.status(200).json({
    configured: Boolean(config.apiKey && config.templateId),
    templateId: config.templateId,
    layers: config.layers,
  });
};
