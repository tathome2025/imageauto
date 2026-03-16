import { upload } from "https://esm.sh/@vercel/blob/client";

const statusNode = document.getElementById("status");
const messageNode = document.getElementById("message");
const resultImage = document.getElementById("result-image");
const resultLink = document.getElementById("result-link");
const form = document.getElementById("render-form");
const submitButton = document.getElementById("submit-button");
const mainImageInput = document.getElementById("mainImage");
const plateEditor = document.getElementById("plate-editor");
const plateStage = document.getElementById("plate-stage");
const platePreviewImage = document.getElementById("plate-preview-image");
const plateOverlay = document.getElementById("plate-overlay");
const platePolygon = document.getElementById("plate-polygon");
const platePointStatus = document.getElementById("plate-point-status");
const resetPlatePointsButton = document.getElementById("reset-plate-points");
const maskPlateCheckbox = document.getElementById("maskPlate");
const multipartThreshold = 4.5 * 1024 * 1024;
const cropperIds = ["mainImage", "secondaryImage1", "secondaryImage2"];
const brandLogoLayerNames = [
  "brand_benz",
  "brand_bmw",
  "brand_honda",
  "brand_kia",
  "brand_mini",
  "brand_lexus",
  "brand_mazda",
  "brand_porsche",
  "brand_subaru",
  "brand_tesla",
  "brand_toyota",
  "brand_volvo",
  "brand_vw",
  "brand_byd",
  "bradn_audi",
];
const productLogoLayerNames = [
  "product_res",
  "product_ur",
  "product_army",
  "product_NGK",
  "product_endless",
  "product_bmc",
  "product_eibach",
];
const logoLayerNames = [
  ...productLogoLayerNames,
  ...brandLogoLayerNames,
];
const plateMaskState = {
  imageUrl: "",
  naturalWidth: 0,
  naturalHeight: 0,
  points: [],
};
const cropperStates = Object.fromEntries(
  cropperIds.map((id) => [
    id,
    {
      id,
      input: document.getElementById(id),
      editor: document.getElementById(`crop-editor-${id}`),
      stage: document.getElementById(`crop-stage-${id}`),
      image: document.getElementById(`crop-image-${id}`),
      zoom: document.getElementById(`crop-zoom-${id}`),
      file: null,
      imageUrl: "",
      naturalWidth: 0,
      naturalHeight: 0,
      scale: 1,
      baseScale: 1,
      x: 0,
      y: 0,
      drag: null,
    },
  ]),
);

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

function isChecked(formData, name) {
  return formData.get(name) === "on";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function syncCheckboxWithText(inputId, checkboxId) {
  const input = document.getElementById(inputId);
  const checkbox = document.getElementById(checkboxId);

  if (!input || !checkbox) {
    return;
  }

  const update = () => {
    checkbox.checked = Boolean(input.value.trim());
  };

  input.addEventListener("input", update);
  update();
}

function syncCheckboxWithFile(inputId, checkboxId) {
  const input = document.getElementById(inputId);
  const checkbox = document.getElementById(checkboxId);

  if (!input || !checkbox) {
    return;
  }

  const update = () => {
    checkbox.checked = Boolean(input.files?.length);
  };

  input.addEventListener("change", update);
  update();
}

function syncMainImageCheckbox() {
  const fileInput = document.getElementById("mainImage");
  const urlInput = document.getElementById("mainImageUrl");
  const checkbox = document.getElementById("showMainImage");

  if (!fileInput || !urlInput || !checkbox) {
    return;
  }

  const update = () => {
    checkbox.checked = Boolean(fileInput.files?.length || urlInput.value.trim());
  };

  fileInput.addEventListener("change", update);
  urlInput.addEventListener("input", update);
  update();
}

function setupExclusiveCheckboxes(names) {
  names.forEach((name) => {
    const checkbox = document.getElementById(name);
    if (!checkbox) {
      return;
    }

    checkbox.addEventListener("change", () => {
      if (!checkbox.checked) {
        return;
      }

      names.forEach((otherName) => {
        if (otherName === name) {
          return;
        }

        const other = document.getElementById(otherName);
        if (other) {
          other.checked = false;
        }
      });
    });
  });
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

function constrainCropperPosition(cropper) {
  const stageSize = cropper.stage.clientWidth;
  const imageWidth = cropper.naturalWidth * cropper.scale;
  const imageHeight = cropper.naturalHeight * cropper.scale;
  const minX = Math.min(0, stageSize - imageWidth);
  const minY = Math.min(0, stageSize - imageHeight);

  cropper.x = clamp(cropper.x, minX, 0);
  cropper.y = clamp(cropper.y, minY, 0);
}

function renderCropper(cropper) {
  if (!cropper.image) {
    return;
  }

  cropper.image.style.width = `${cropper.naturalWidth * cropper.scale}px`;
  cropper.image.style.height = `${cropper.naturalHeight * cropper.scale}px`;
  cropper.image.style.transform = `translate(${cropper.x}px, ${cropper.y}px)`;
}

function fitCropper(cropper) {
  const stageSize = cropper.stage.clientWidth;

  if (!stageSize || !cropper.naturalWidth || !cropper.naturalHeight) {
    return;
  }

  cropper.baseScale = Math.max(stageSize / cropper.naturalWidth, stageSize / cropper.naturalHeight);
  cropper.scale = cropper.baseScale * Number(cropper.zoom.value || 1);
  cropper.x = (stageSize - cropper.naturalWidth * cropper.scale) / 2;
  cropper.y = (stageSize - cropper.naturalHeight * cropper.scale) / 2;
  constrainCropperPosition(cropper);
  renderCropper(cropper);
}

async function blobToFile(blob, filename, type) {
  return new File([blob], filename, { type });
}

async function createSquareCroppedFile(cropperId, outputSize = 1200) {
  const cropper = cropperStates[cropperId];

  if (!cropper?.file) {
    return null;
  }

  const stageSize = cropper.stage.clientWidth;

  if (!stageSize) {
    return cropper.file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("無法建立圖片裁剪畫布。");
  }

  const imageBitmap = await createImageBitmap(cropper.file);
  const factor = outputSize / stageSize;
  context.drawImage(
    imageBitmap,
    cropper.x * factor,
    cropper.y * factor,
    cropper.naturalWidth * cropper.scale * factor,
    cropper.naturalHeight * cropper.scale * factor,
  );

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (croppedBlob) => {
        if (croppedBlob) {
          resolve(croppedBlob);
          return;
        }
        reject(new Error("圖片裁剪失敗。"));
      },
      cropper.file.type || "image/jpeg",
      0.95,
    );
  });

  return blobToFile(blob, cropper.file.name, blob.type || cropper.file.type || "image/jpeg");
}

function clearPlatePoints() {
  plateMaskState.points = [];
  plateStage.querySelectorAll(".plate-point").forEach((node) => node.remove());
  platePolygon.setAttribute("points", "");
  platePointStatus.textContent = "尚未選取角點";
}

function renderPlatePoints() {
  const stageWidth = platePreviewImage.clientWidth;
  const stageHeight = platePreviewImage.clientHeight;

  plateStage.querySelectorAll(".plate-point").forEach((node) => node.remove());

  plateMaskState.points.forEach((point, index) => {
    const marker = document.createElement("div");
    marker.className = "plate-point";
    marker.style.left = `${point.x * stageWidth}px`;
    marker.style.top = `${point.y * stageHeight}px`;
    marker.title = `角點 ${index + 1}`;
    plateStage.append(marker);
  });

  if (plateMaskState.points.length === 4) {
    platePolygon.setAttribute(
      "points",
      plateMaskState.points
        .map((point) => `${point.x * stageWidth},${point.y * stageHeight}`)
        .join(" "),
    );
    platePointStatus.textContent = "已選取 4 個角點";
    return;
  }

  platePolygon.setAttribute("points", "");
  platePointStatus.textContent = `已選取 ${plateMaskState.points.length} / 4 個角點`;
}

function openPlateEditor(file) {
  if (plateMaskState.imageUrl) {
    URL.revokeObjectURL(plateMaskState.imageUrl);
  }

  const objectUrl = URL.createObjectURL(file);
  plateMaskState.imageUrl = objectUrl;
  plateEditor.hidden = false;
  platePreviewImage.src = objectUrl;
}

async function refreshMainPlatePreview() {
  const cropper = cropperStates.mainImage;

  if (!cropper?.file) {
    if (plateMaskState.imageUrl) {
      URL.revokeObjectURL(plateMaskState.imageUrl);
      plateMaskState.imageUrl = "";
    }
    plateEditor.hidden = true;
    return;
  }

  const croppedMainFile = await createSquareCroppedFile("mainImage", 960);

  if (!croppedMainFile) {
    plateEditor.hidden = true;
    return;
  }

  openPlateEditor(croppedMainFile);
}

function setupCropper(cropperId) {
  const cropper = cropperStates[cropperId];

  if (!cropper?.input || !cropper.editor || !cropper.stage || !cropper.image || !cropper.zoom) {
    return;
  }

  cropper.input.addEventListener("change", () => {
    const file = cropper.input.files?.[0];

    if (!file) {
      if (cropper.imageUrl) {
        URL.revokeObjectURL(cropper.imageUrl);
        cropper.imageUrl = "";
      }
      cropper.file = null;
      cropper.editor.hidden = true;

      if (cropperId === "mainImage") {
        refreshMainPlatePreview();
      }
      return;
    }

    if (cropper.imageUrl) {
      URL.revokeObjectURL(cropper.imageUrl);
    }

    cropper.file = file;
    cropper.imageUrl = URL.createObjectURL(file);
    cropper.editor.hidden = false;
    cropper.zoom.value = "1";
    cropper.image.src = cropper.imageUrl;
  });

  cropper.image.addEventListener("load", async () => {
    cropper.naturalWidth = cropper.image.naturalWidth;
    cropper.naturalHeight = cropper.image.naturalHeight;
    fitCropper(cropper);

    if (cropperId === "mainImage") {
      await refreshMainPlatePreview();
    }
  });

  cropper.zoom.addEventListener("input", async () => {
    if (!cropper.naturalWidth || !cropper.naturalHeight) {
      return;
    }

    const stageSize = cropper.stage.clientWidth;
    const currentCenterX = (stageSize / 2 - cropper.x) / cropper.scale;
    const currentCenterY = (stageSize / 2 - cropper.y) / cropper.scale;
    cropper.scale = cropper.baseScale * Number(cropper.zoom.value || 1);
    cropper.x = stageSize / 2 - currentCenterX * cropper.scale;
    cropper.y = stageSize / 2 - currentCenterY * cropper.scale;
    constrainCropperPosition(cropper);
    renderCropper(cropper);

    if (cropperId === "mainImage") {
      await refreshMainPlatePreview();
    }
  });

  cropper.stage.addEventListener("pointerdown", (event) => {
    if (!cropper.file) {
      return;
    }

    cropper.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startImageX: cropper.x,
      startImageY: cropper.y,
    };
    cropper.stage.setPointerCapture(event.pointerId);
  });

  cropper.stage.addEventListener("pointermove", (event) => {
    if (!cropper.drag || cropper.drag.pointerId !== event.pointerId) {
      return;
    }

    cropper.x = cropper.drag.startImageX + (event.clientX - cropper.drag.startX);
    cropper.y = cropper.drag.startImageY + (event.clientY - cropper.drag.startY);
    constrainCropperPosition(cropper);
    renderCropper(cropper);
  });

  const endDrag = async (event) => {
    if (!cropper.drag || cropper.drag.pointerId !== event.pointerId) {
      return;
    }

    cropper.drag = null;
    cropper.stage.releasePointerCapture(event.pointerId);

    if (cropperId === "mainImage") {
      await refreshMainPlatePreview();
    }
  };

  cropper.stage.addEventListener("pointerup", endDrag);
  cropper.stage.addEventListener("pointercancel", endDrag);
}

async function createMaskedMainImage(file) {
  if (!maskPlateCheckbox.checked || !plateMaskState.naturalWidth || !plateMaskState.naturalHeight) {
    return file;
  }

  if (plateMaskState.points.length !== 4) {
    throw new Error("請先點選主圖車牌的四個角。");
  }

  const stageWidth = platePreviewImage.clientWidth;
  const stageHeight = platePreviewImage.clientHeight;

  if (!stageWidth || !stageHeight) {
    return file;
  }

  const scaleX = plateMaskState.naturalWidth / stageWidth;
  const scaleY = plateMaskState.naturalHeight / stageHeight;
  const canvas = document.createElement("canvas");
  canvas.width = plateMaskState.naturalWidth;
  canvas.height = plateMaskState.naturalHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("無法建立主圖處理畫布。");
  }

  const imageBitmap = await createImageBitmap(file);
  context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.beginPath();
  plateMaskState.points.forEach((point, index) => {
    const scaledX = point.x * stageWidth * scaleX;
    const scaledY = point.y * stageHeight * scaleY;

    if (index === 0) {
      context.moveTo(scaledX, scaledY);
      return;
    }

    context.lineTo(scaledX, scaledY);
  });
  context.closePath();
  context.fill();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (maskedBlob) => {
        if (maskedBlob) {
          resolve(maskedBlob);
          return;
        }
        reject(new Error("主圖遮牌失敗。"));
      },
      file.type || "image/jpeg",
      0.95,
    );
  });

  return new File([blob], file.name, {
    type: blob.type || file.type || "image/jpeg",
  });
}

platePreviewImage.addEventListener("load", () => {
  plateMaskState.naturalWidth = platePreviewImage.naturalWidth;
  plateMaskState.naturalHeight = platePreviewImage.naturalHeight;
  plateOverlay.setAttribute("viewBox", `0 0 ${platePreviewImage.clientWidth} ${platePreviewImage.clientHeight}`);
  clearPlatePoints();
});

syncCheckboxWithText("item1", "showItem1");
syncCheckboxWithText("item2", "showItem2");
syncCheckboxWithText("item3", "showItem3");
syncMainImageCheckbox();
syncCheckboxWithFile("secondaryImage1", "showSecondaryImage1");
syncCheckboxWithFile("secondaryImage2", "showSecondaryImage2");
setupExclusiveCheckboxes(brandLogoLayerNames);
cropperIds.forEach(setupCropper);

resetPlatePointsButton.addEventListener("click", () => {
  clearPlatePoints();
});

plateStage.addEventListener("click", (event) => {
  if (
    event.target !== platePreviewImage &&
    event.target !== plateOverlay &&
    event.target !== platePolygon &&
    event.target !== plateStage
  ) {
    return;
  }

  if (plateMaskState.points.length >= 4) {
    platePointStatus.textContent = "已選滿 4 個角點，如需重選請按「重設四角」。";
    return;
  }

  const bounds = platePreviewImage.getBoundingClientRect();
  if (!bounds.width || !bounds.height) {
    return;
  }

  plateMaskState.points.push({
    x: (event.clientX - bounds.left) / bounds.width,
    y: (event.clientY - bounds.top) / bounds.height,
  });
  renderPlatePoints();
});

window.addEventListener("resize", () => {
  cropperIds.forEach((cropperId) => {
    const cropper = cropperStates[cropperId];
    if (cropper?.file) {
      fitCropper(cropper);
    }
  });

  if (!plateEditor.hidden) {
    plateOverlay.setAttribute("viewBox", `0 0 ${platePreviewImage.clientWidth} ${platePreviewImage.clientHeight}`);
    renderPlatePoints();
  }
});

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
    const itemEntries = [
      {
        text: formData.get("item1")?.toString().trim(),
        show: isChecked(formData, "showItem1"),
      },
      {
        text: formData.get("item2")?.toString().trim(),
        show: isChecked(formData, "showItem2"),
      },
      {
        text: formData.get("item3")?.toString().trim(),
        show: isChecked(formData, "showItem3"),
      },
    ];
    const showMainImage = isChecked(formData, "showMainImage");
    const showSecondaryImage1 = isChecked(formData, "showSecondaryImage1");
    const showSecondaryImage2 = isChecked(formData, "showSecondaryImage2");
    const logoVisibility = Object.fromEntries(
      logoLayerNames.map((name) => [name, isChecked(formData, name)]),
    );

    if (
      showMainImage &&
      !manualMainImageUrl &&
      (!(mainImageFile instanceof File) || mainImageFile.size === 0)
    ) {
      messageNode.textContent = "請提供 1 張主圖。";
      return;
    }

    if (
      showSecondaryImage1 &&
      (!(secondaryImage1 instanceof File) || secondaryImage1.size === 0)
    ) {
      messageNode.textContent = "請上傳副圖 1。";
      return;
    }

    if (
      showSecondaryImage2 &&
      (!(secondaryImage2 instanceof File) || secondaryImage2.size === 0)
    ) {
      messageNode.textContent = "請上傳副圖 2。";
      return;
    }

    let uploadedMainImageUrl = manualMainImageUrl;
    const uploadedSecondaryImageUrls = ["", ""];

    if (
      (showMainImage &&
        !manualMainImageUrl &&
        mainImageFile instanceof File &&
        mainImageFile.size > 0) ||
      (showSecondaryImage1 && secondaryImage1 instanceof File && secondaryImage1.size > 0) ||
      (showSecondaryImage2 && secondaryImage2 instanceof File && secondaryImage2.size > 0)
    ) {
      try {
        const uploadJobs = [];

        if (
          showMainImage &&
          !manualMainImageUrl &&
          mainImageFile instanceof File &&
          mainImageFile.size > 0
        ) {
          const croppedMainImage = await createSquareCroppedFile("mainImage");
          const preparedMainImage = await createMaskedMainImage(croppedMainImage || mainImageFile);
          uploadJobs.push(
            uploadImageFile("main-images", preparedMainImage).then((url) => {
              uploadedMainImageUrl = url;
            }),
          );
        }

        if (showSecondaryImage1 && secondaryImage1 instanceof File && secondaryImage1.size > 0) {
          const croppedSecondaryImage1 = await createSquareCroppedFile("secondaryImage1");
          uploadJobs.push(
            uploadImageFile("secondary-images", croppedSecondaryImage1 || secondaryImage1).then((url) => {
              uploadedSecondaryImageUrls[0] = url;
            }),
          );
        }

        if (showSecondaryImage2 && secondaryImage2 instanceof File && secondaryImage2.size > 0) {
          const croppedSecondaryImage2 = await createSquareCroppedFile("secondaryImage2");
          uploadJobs.push(
            uploadImageFile("secondary-images", croppedSecondaryImage2 || secondaryImage2).then((url) => {
              uploadedSecondaryImageUrls[1] = url;
            }),
          );
        }

        await Promise.all(uploadJobs);
      } catch (error) {
        messageNode.textContent =
          error instanceof Error ? error.message : "圖片上傳失敗。";
        return;
      }
    }

    const payload = {
      title: formData.get("title")?.toString().trim(),
      subtitle: formData.get("subtitle")?.toString().trim(),
      itemEntries,
      mainImage: {
        show: showMainImage,
        imageUrl: showMainImage ? uploadedMainImageUrl : "",
      },
      secondaryImageUrls: uploadedSecondaryImageUrls,
      secondaryImageVisibility: [showSecondaryImage1, showSecondaryImage2],
      logoVisibility,
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
