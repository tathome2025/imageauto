const path = require("path");
const Busboy = require("busboy");
const { put } = require("@vercel/blob");

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const files = {
      mainImage: null,
      secondaryImages: [],
    };

    busboy.on("file", (fieldname, file, info) => {
      const chunks = [];

      file.on("data", (chunk) => {
        chunks.push(chunk);
      });

      file.on("end", () => {
        const uploadedFile = {
          fieldname,
          filename: info.filename || "upload.bin",
          mimeType: info.mimeType || "application/octet-stream",
          buffer: Buffer.concat(chunks),
        };

        if (fieldname === "mainImage") {
          files.mainImage = uploadedFile;
        }

        if (fieldname === "secondaryImages") {
          files.secondaryImages.push(uploadedFile);
        }
      });
    });

    busboy.on("error", reject);
    busboy.on("finish", () => resolve(files));
    req.pipe(busboy);
  });
}

function sanitizeFilename(filename) {
  const extension = path.extname(filename) || ".bin";
  const basename = path.basename(filename, extension).replace(/[^a-zA-Z0-9-_]/g, "-");
  return `${basename || "upload"}${extension}`;
}

async function uploadSingleFile(prefix, file) {
  const safeName = sanitizeFilename(file.filename);
  const blob = await put(`${prefix}/${Date.now()}-${safeName}`, file.buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.mimeType,
  });

  return blob.url;
}

async function uploadImages(req) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      status: 500,
      body: {
        error: "Missing BLOB_READ_WRITE_TOKEN.",
      },
    };
  }

  const files = await parseMultipart(req);

  if (files.secondaryImages.length < 1 || files.secondaryImages.length > 5) {
    return {
      status: 400,
      body: {
        error: "Please upload 1 to 5 secondary images.",
      },
    };
  }

  const mainImageUrl =
    files.mainImage && files.mainImage.buffer.length > 0
      ? await uploadSingleFile("main-images", files.mainImage)
      : "";
  const secondaryImageUrls = [];

  for (const file of files.secondaryImages.slice(0, 5)) {
    secondaryImageUrls.push(await uploadSingleFile("secondary-images", file));
  }

  return {
    status: 200,
    body: {
      mainImageUrl,
      secondaryImageUrls,
    },
  };
}

module.exports = {
  uploadImages,
};
