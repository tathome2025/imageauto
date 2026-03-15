const path = require("path");
const Busboy = require("busboy");
const { put } = require("@vercel/blob");

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const files = {
      mainImage: null,
      secondaryImage1: null,
      secondaryImage2: null,
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

        if (fieldname === "secondaryImage1") {
          files.secondaryImage1 = uploadedFile;
        }

        if (fieldname === "secondaryImage2") {
          files.secondaryImage2 = uploadedFile;
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

  if (!files.secondaryImage1 || files.secondaryImage1.buffer.length === 0) {
    return {
      status: 400,
      body: {
        error: "Secondary image 1 is required.",
      },
    };
  }

  if (!files.secondaryImage2 || files.secondaryImage2.buffer.length === 0) {
    return {
      status: 400,
      body: {
        error: "Secondary image 2 is required.",
      },
    };
  }

  const mainImageUrl =
    files.mainImage && files.mainImage.buffer.length > 0
      ? await uploadSingleFile("main-images", files.mainImage)
      : "";
  const secondaryImageUrls = [
    await uploadSingleFile("secondary-images", files.secondaryImage1),
    await uploadSingleFile("secondary-images", files.secondaryImage2),
  ];

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
