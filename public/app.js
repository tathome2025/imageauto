import { upload } from "https://esm.sh/@vercel/blob/client";

const statusNode = document.getElementById("status");
const messageNode = document.getElementById("message");
const resultImage = document.getElementById("result-image");
const resultLink = document.getElementById("result-link");
const form = document.getElementById("render-form");
const submitButton = document.getElementById("submit-button");
const multipartThreshold = 4.5 * 1024 * 1024;

async function readApiResponse(response) {
  const raw = await response.text();

  try {
    return JSON.parse(raw);
  } catch {
    return {
      error: raw || `Request failed with status ${response.status}.`,
    };
  }
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await readApiResponse(response);

    if (data.configured) {
      statusNode.textContent = `已連接 template: ${data.templateId}`;
      statusNode.className = "status ok";
      return;
    }

    statusNode.textContent = "尚未設定 Bannerbear API key 或 template id。";
    statusNode.className = "status error";
  } catch (error) {
    statusNode.textContent = "無法讀取伺服器設定。";
    statusNode.className = "status error";
  }
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function uploadImageFile(prefix, file) {
  const blob = await upload(`${prefix}/${Date.now()}-${sanitizeFilename(file.name)}`, file, {
    access: "public",
    contentType: file.type || "application/octet-stream",
    handleUploadUrl: "/api/upload",
    multipart: file.size > multipartThreshold,
  });

  return blob.url;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  messageNode.textContent = "生成中...";
  resultImage.hidden = true;
  resultLink.hidden = true;

  const formData = new FormData(form);

  try {
    const mainImageFile = formData.get("mainImage");
    const secondaryImage1 = formData.get("secondaryImage1");
    const secondaryImage2 = formData.get("secondaryImage2");
    const manualMainImageUrl = formData.get("mainImageUrl")?.toString().trim();
    const itemTexts = [
      formData.get("item1")?.toString().trim(),
      formData.get("item2")?.toString().trim(),
      formData.get("item3")?.toString().trim(),
    ];

    if (!manualMainImageUrl && (!(mainImageFile instanceof File) || mainImageFile.size === 0)) {
      messageNode.textContent = "請提供 1 張主圖。";
      return;
    }

    if (!(secondaryImage1 instanceof File) || secondaryImage1.size === 0) {
      messageNode.textContent = "請上傳副圖 1。";
      return;
    }

    if (!(secondaryImage2 instanceof File) || secondaryImage2.size === 0) {
      messageNode.textContent = "請上傳副圖 2。";
      return;
    }

    let uploadedMainImageUrl = manualMainImageUrl;
    let uploadedSecondaryImageUrls = [];

    if (!manualMainImageUrl || secondaryImage1.size > 0 || secondaryImage2.size > 0) {
      try {
        const uploads = [
          uploadImageFile("secondary-images", secondaryImage1),
          uploadImageFile("secondary-images", secondaryImage2),
        ];

        if (!manualMainImageUrl && mainImageFile instanceof File && mainImageFile.size > 0) {
          uploads.unshift(uploadImageFile("main-images", mainImageFile));
        }

        const uploadedUrls = await Promise.all(uploads);

        if (!manualMainImageUrl && mainImageFile instanceof File && mainImageFile.size > 0) {
          uploadedMainImageUrl = uploadedUrls[0] || "";
          uploadedSecondaryImageUrls = uploadedUrls.slice(1);
        } else {
          uploadedSecondaryImageUrls = uploadedUrls;
        }
      } catch (error) {
        messageNode.textContent =
          error instanceof Error ? error.message : "圖片上傳失敗。";
        return;
      }
    }

    const payload = {
      title: formData.get("title")?.toString().trim(),
      subtitle: formData.get("subtitle")?.toString().trim(),
      itemTexts,
      mainImageUrl: uploadedMainImageUrl,
      secondaryImageUrls: uploadedSecondaryImageUrls,
    };

    const response = await fetch("/api/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await readApiResponse(response);

    if (!response.ok) {
      messageNode.textContent = data.error || "生成失敗。";
      return;
    }

    if (!data.imageUrl) {
      messageNode.textContent = "Bannerbear 已回應，但沒有回傳圖片網址。";
      return;
    }

    messageNode.textContent = `已生成，UID: ${data.uid || "unknown"}`;
    resultImage.src = data.imageUrl;
    resultImage.hidden = false;
    resultLink.href = data.imageUrl;
    resultLink.hidden = false;
  } catch (error) {
    messageNode.textContent =
      error instanceof Error ? error.message : "連線失敗，請檢查伺服器與網路。";
  } finally {
    submitButton.disabled = false;
  }
});

loadConfig();
