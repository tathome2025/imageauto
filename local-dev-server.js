const fs = require("fs");
const path = require("path");
const http = require("http");
const dotenv = require("dotenv");

dotenv.config();

const configHandler = require("./api/config");
const renderHandler = require("./api/render");

const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function createResponse(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    json(payload) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(payload));
    },
  };
}

async function readRequestBody(req) {
  let raw = "";

  for await (const chunk of req) {
    raw += chunk;
  }

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function serveStaticFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const extension = path.extname(filePath);
  res.setHeader("Content-Type", contentTypes[extension] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/config") {
    return configHandler(req, createResponse(res));
  }

  if (url.pathname === "/api/render") {
    req.body = await readRequestBody(req);
    return renderHandler(req, createResponse(res));
  }

  const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(publicDir, safePath);
  return serveStaticFile(res, filePath);
});

server.listen(port, () => {
  console.log(`Bannerbear app running at http://localhost:${port}`);
});
