import { upload } from "https://esm.sh/@vercel/blob/client";

const statusNode = document.getElementById("status");
const messageNode = document.getElementById("message");
const resultImage = document.getElementById("result-image");
const resultLink = document.getElementById("result-link");
const form = document.getElementById("render-form");
const submitButton = document.getElementById("submit-button");
const multipartThreshold = 4.5 * 1024 * 1024;
const opencvModuleUrl = "https://esm.sh/@techstark/opencv-js@4.12.0-release.1";
let openCvReadyPromise = null;

const brandLogoControls = [
  { controlId: "brand_benz", layerNames: ["brand_benz"] },
  { controlId: "brand_bmw", layerNames: ["brand_bmw"] },
  { controlId: "brand_honda", layerNames: ["brand_honda"] },
  { controlId: "brand_kia", layerNames: ["brand_kia"] },
  { controlId: "brand_mini", layerNames: ["brand_mini"] },
  { controlId: "brand_lexus", layerNames: ["brand_lexus"] },
  { controlId: "brand_mazda", layerNames: ["brand_mazda"] },
  { controlId: "brand_porsche", layerNames: ["brand_porsche"] },
  { controlId: "brand_subaru", layerNames: ["brand_subaru"] },
  { controlId: "brand_tesla", layerNames: ["brand_tesla"] },
  { controlId: "brand_toyota", layerNames: ["brand_toyota"] },
  { controlId: "brand_volvo", layerNames: ["brand_volvo"] },
  { controlId: "brand_vw", layerNames: ["brand_vw"] },
  { controlId: "brand_byd", layerNames: ["brand_byd"] },
  { controlId: "brand_audi", layerNames: ["brand_audi", "bradn_audi"] },
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

function createImageEditor(id, options = {}) {
  const supportsPlateMask = Boolean(options.supportsPlateMask);

  return {
    id,
    label: options.label || id,
    supportsPlateMask,
    input: document.getElementById(id),
    dropzone: document.getElementById(`dropzone-${id}`),
    stage: document.getElementById(`stage-${id}`),
    image: document.getElementById(`image-${id}`),
    placeholder: document.getElementById(`placeholder-${id}`),
    zoom: document.getElementById(`zoom-${id}`),
    resetView: document.getElementById(`reset-view-${id}`),
    detectButton: supportsPlateMask ? document.getElementById(`detect-plate-${id}`) : null,
    toggle: document.getElementById(options.toggleId),
    status: document.getElementById(`status-${id}`),
    maskToggle: supportsPlateMask
      ? document.getElementById(options.maskToggleId || `mask-${id}`)
      : null,
    modeCrop: supportsPlateMask ? document.getElementById(`mode-crop-${id}`) : null,
    modePlate: supportsPlateMask ? document.getElementById(`mode-plate-${id}`) : null,
    resetPlate: supportsPlateMask ? document.getElementById(`reset-plate-${id}`) : null,
    overlay: supportsPlateMask ? document.getElementById(`overlay-${id}`) : null,
    polygon: supportsPlateMask ? document.getElementById(`polygon-${id}`) : null,
    file: null,
    fileUrl: "",
    naturalWidth: 0,
    naturalHeight: 0,
    baseScale: 1,
    scale: 1,
    x: 0,
    y: 0,
    drag: null,
    mode: "crop",
    platePoints: [],
  };
}

const editors = {
  mainImage: createImageEditor("mainImage", {
    label: "主圖",
    supportsPlateMask: true,
    toggleId: "showMainImage",
    maskToggleId: "maskPlate",
  }),
  secondaryImage1: createImageEditor("secondaryImage1", {
    label: "副圖 1",
    supportsPlateMask: true,
    toggleId: "showSecondaryImage1",
  }),
  secondaryImage2: createImageEditor("secondaryImage2", {
    label: "副圖 2-1",
    supportsPlateMask: true,
    toggleId: "showSecondaryImage2",
  }),
  secondaryImage3: createImageEditor("secondaryImage3", {
    label: "副圖 2-2",
    supportsPlateMask: true,
    toggleId: "showSecondaryImage3",
  }),
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function isChecked(id) {
  const node = document.getElementById(id);
  return Boolean(node?.checked);
}

async function readApiResponse(response) {
  const raw = await response.text();

  try {
    return JSON.parse(raw);
  } catch {
    return { error: raw || `Request failed with status ${response.status}.` };
  }
}

async function ensureOpenCvReady() {
  if (window.__opencvReady?.Mat) {
    return window.__opencvReady;
  }

  if (!openCvReadyPromise) {
    openCvReadyPromise = import(opencvModuleUrl)
      .then(async (module) => {
        const candidate = module.default ?? module;
        const resolved = await candidate;
        const cv = resolved?.Mat
          ? resolved
          : resolved?.default?.Mat
            ? resolved.default
            : resolved?.cv?.Mat
              ? resolved.cv
              : module.cv?.Mat
                ? module.cv
                : null;

        if (!cv?.Mat) {
          throw new Error("OpenCV.js 載入失敗。");
        }

        window.__opencvReady = cv;
        return cv;
      })
      .catch((error) => {
        openCvReadyPromise = null;
        throw error;
      });
  }

  return openCvReadyPromise;
}

function extractContourPoints(mat) {
  const points = [];

  for (let index = 0; index < mat.rows; index += 1) {
    const point = mat.intPtr(index, 0);
    points.push({ x: point[0], y: point[1] });
  }

  return points;
}

function rectToPoints(rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

function normalizePlatePoints(points, outputSize) {
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 },
  );
  const sorted = [...points].sort(
    (left, right) =>
      Math.atan2(left.y - center.y, left.x - center.x) -
      Math.atan2(right.y - center.y, right.x - center.x),
  );
  const startIndex = sorted.reduce(
    (bestIndex, point, index, array) =>
      point.x + point.y < array[bestIndex].x + array[bestIndex].y ? index : bestIndex,
    0,
  );
  const reordered = sorted.slice(startIndex).concat(sorted.slice(0, startIndex));

  return reordered.map((point) => ({
    x: clamp(point.x / outputSize, 0, 1),
    y: clamp(point.y / outputSize, 0, 1),
  }));
}

function scorePlateCandidate(points, area, outputSize) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const ratio = width / height;
  const areaRatio = area / (outputSize * outputSize);
  const fillRatio = area / Math.max(width * height, 1);

  if (ratio < 1.35 || ratio > 7.5 || areaRatio < 0.003 || areaRatio > 0.22 || fillRatio < 0.35) {
    return Number.NEGATIVE_INFINITY;
  }

  const centerX = (minX + maxX) / 2 / outputSize;
  const centerY = (minY + maxY) / 2 / outputSize;
  const ratioScore = Math.max(0, 1 - Math.abs(ratio - 3.2) / 3.8);
  const areaScore = Math.max(0, 1 - Math.abs(areaRatio - 0.035) / 0.08);
  const centerScore = Math.max(0, 1 - Math.hypot(centerX - 0.5, (centerY - 0.62) * 1.15) / 0.85);

  return ratioScore * 0.38 + areaScore * 0.22 + centerScore * 0.28 + Math.min(fillRatio, 1) * 0.12;
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
  } catch {
    statusNode.textContent = "無法讀取伺服器設定。";
    statusNode.className = "status error";
  }
}

function setEditorStatus(editor, text) {
  editor.status.textContent = text;
}

function clearPlatePoints(editor, text) {
  if (!editor.supportsPlateMask) {
    return;
  }

  editor.platePoints = [];
  editor.stage.querySelectorAll(".editor-point").forEach((node) => node.remove());
  editor.polygon.setAttribute("points", "");

  if (text) {
    setEditorStatus(editor, text);
  }
}

function renderPlatePoints(editor) {
  if (!editor.supportsPlateMask) {
    return;
  }

  const size = editor.stage.clientWidth;
  editor.stage.querySelectorAll(".editor-point").forEach((node) => node.remove());

  editor.platePoints.forEach((point, index) => {
    const marker = document.createElement("div");
    marker.className = "editor-point";
    marker.style.left = `${point.x * size}px`;
    marker.style.top = `${point.y * size}px`;
    marker.title = `角點 ${index + 1}`;
    editor.stage.append(marker);
  });

  if (editor.platePoints.length === 4) {
    editor.polygon.setAttribute(
      "points",
      editor.platePoints.map((point) => `${point.x * size},${point.y * size}`).join(" "),
    );
    setEditorStatus(editor, "已選取 4 個角點，可直接生成。");
    return;
  }

  editor.polygon.setAttribute("points", "");
  setEditorStatus(editor, `遮牌模式：已選 ${editor.platePoints.length} / 4 個角點`);
}

function constrainEditorPosition(editor) {
  const stageSize = editor.stage.clientWidth;
  const imageWidth = editor.naturalWidth * editor.scale;
  const imageHeight = editor.naturalHeight * editor.scale;
  const minX = Math.min(0, stageSize - imageWidth);
  const minY = Math.min(0, stageSize - imageHeight);

  editor.x = clamp(editor.x, minX, 0);
  editor.y = clamp(editor.y, minY, 0);
}

function renderEditor(editor) {
  const hasFile = Boolean(editor.file);
  editor.placeholder.hidden = hasFile;
  editor.image.hidden = !hasFile;

  if (!hasFile) {
    if (editor.supportsPlateMask) {
      editor.overlay.hidden = true;
    }
    return;
  }

  editor.image.style.width = `${editor.naturalWidth * editor.scale}px`;
  editor.image.style.height = `${editor.naturalHeight * editor.scale}px`;
  editor.image.style.transform = `translate(${editor.x}px, ${editor.y}px)`;

  if (editor.supportsPlateMask) {
    editor.overlay.hidden = false;
    editor.stage.classList.toggle("is-plate-mode", editor.mode === "plate");
    editor.modeCrop.classList.toggle("is-active", editor.mode === "crop");
    editor.modePlate.classList.toggle("is-active", editor.mode === "plate");
    renderPlatePoints(editor);
  }
}

function fitEditor(editor) {
  const stageSize = editor.stage.clientWidth;

  if (!stageSize || !editor.naturalWidth || !editor.naturalHeight) {
    return;
  }

  editor.baseScale = Math.max(stageSize / editor.naturalWidth, stageSize / editor.naturalHeight);
  editor.scale = editor.baseScale * Number(editor.zoom.value || 1);
  editor.x = (stageSize - editor.naturalWidth * editor.scale) / 2;
  editor.y = (stageSize - editor.naturalHeight * editor.scale) / 2;
  constrainEditorPosition(editor);
  renderEditor(editor);
}

function invalidatePlate(editor) {
  if (!editor.supportsPlateMask || editor.platePoints.length === 0) {
    return;
  }

  clearPlatePoints(editor, "裁圖已變更，請重新點選車牌四角。");
}

function setEditorFile(editor, file) {
  if (editor.fileUrl) {
    URL.revokeObjectURL(editor.fileUrl);
  }

  editor.file = file;
  editor.fileUrl = URL.createObjectURL(file);
  editor.image.src = editor.fileUrl;
  editor.zoom.value = "1";
  editor.toggle.checked = true;

  if (editor.supportsPlateMask) {
    editor.mode = "crop";
    clearPlatePoints(editor, `${editor.label}已載入，請先裁圖。`);
  } else {
    setEditorStatus(editor, `${editor.label}已載入，可調整正方裁切範圍。`);
  }
}

function openFileDialog(editor) {
  editor.input.click();
}

function handleDroppedFile(editor, file) {
  if (!file || !file.type.startsWith("image/")) {
    setEditorStatus(editor, "請拖拉圖片檔。");
    return;
  }

  setEditorFile(editor, file);
}

function setupDropzone(editor) {
  editor.dropzone.addEventListener("click", () => openFileDialog(editor));
  editor.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    editor.dropzone.classList.add("is-dragover");
  });
  editor.dropzone.addEventListener("dragleave", () => {
    editor.dropzone.classList.remove("is-dragover");
  });
  editor.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    editor.dropzone.classList.remove("is-dragover");
    handleDroppedFile(editor, event.dataTransfer?.files?.[0]);
  });
  editor.input.addEventListener("change", () => {
    handleDroppedFile(editor, editor.input.files?.[0]);
  });
}

function setupEditorInteractions(editor) {
  setupDropzone(editor);

  editor.image.addEventListener("load", () => {
    editor.naturalWidth = editor.image.naturalWidth;
    editor.naturalHeight = editor.image.naturalHeight;
    fitEditor(editor);

    if (editor.supportsPlateMask && editor.maskToggle?.checked) {
      void autoDetectPlate(editor);
    }
  });

  editor.zoom.addEventListener("input", () => {
    if (!editor.file) {
      return;
    }

    const stageSize = editor.stage.clientWidth;
    const centerX = (stageSize / 2 - editor.x) / editor.scale;
    const centerY = (stageSize / 2 - editor.y) / editor.scale;
    editor.scale = editor.baseScale * Number(editor.zoom.value || 1);
    editor.x = stageSize / 2 - centerX * editor.scale;
    editor.y = stageSize / 2 - centerY * editor.scale;
    constrainEditorPosition(editor);
    invalidatePlate(editor);
    renderEditor(editor);
  });

  editor.resetView.addEventListener("click", () => {
    if (!editor.file) {
      return;
    }

    editor.zoom.value = "1";
    fitEditor(editor);
    invalidatePlate(editor);
  });

  editor.stage.addEventListener("pointerdown", (event) => {
    if (!editor.file || (editor.supportsPlateMask && editor.mode !== "crop")) {
      return;
    }

    editor.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startImageX: editor.x,
      startImageY: editor.y,
    };
    editor.stage.setPointerCapture(event.pointerId);
  });

  editor.stage.addEventListener("pointermove", (event) => {
    if (!editor.drag || editor.drag.pointerId !== event.pointerId) {
      return;
    }

    editor.x = editor.drag.startImageX + (event.clientX - editor.drag.startX);
    editor.y = editor.drag.startImageY + (event.clientY - editor.drag.startY);
    constrainEditorPosition(editor);
    renderEditor(editor);
  });

  const endDrag = (event) => {
    if (!editor.drag || editor.drag.pointerId !== event.pointerId) {
      return;
    }

    editor.drag = null;
    editor.stage.releasePointerCapture(event.pointerId);
    invalidatePlate(editor);
    renderEditor(editor);
  };

  editor.stage.addEventListener("pointerup", endDrag);
  editor.stage.addEventListener("pointercancel", endDrag);

  if (!editor.supportsPlateMask) {
    return;
  }

  editor.modeCrop.addEventListener("click", () => {
    editor.mode = "crop";
    setEditorStatus(editor, "裁圖模式：拖拉圖片與縮放，決定最終正方構圖。");
    renderEditor(editor);
  });

  editor.modePlate.addEventListener("click", () => {
    if (!editor.file) {
      return;
    }

    editor.mode = "plate";
    setEditorStatus(editor, "遮牌模式：依序點選車牌四個角。");
    renderEditor(editor);
  });

  editor.resetPlate.addEventListener("click", () => {
    clearPlatePoints(editor, "已清除角點，請重新點選。");
  });

  editor.detectButton?.addEventListener("click", async () => {
    await autoDetectPlate(editor);
  });

  editor.stage.addEventListener("click", (event) => {
    if (!editor.file || editor.mode !== "plate") {
      return;
    }

    const bounds = editor.stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      return;
    }

    if (editor.platePoints.length >= 4) {
      setEditorStatus(editor, "已選滿 4 個角點，如需重選請按「清除四角」。");
      return;
    }

    editor.platePoints.push({
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    });
    renderEditor(editor);
  });
}

async function renderSquareCanvas(editor, options = {}) {
  if (!editor.file) {
    return null;
  }

  const outputSize = options.outputSize || 1200;
  const stageSize = editor.stage.clientWidth;

  if (!stageSize) {
    throw new Error("圖片編輯器尚未就緒。");
  }

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("無法建立圖片裁剪畫布。");
  }

  const imageBitmap = await createImageBitmap(editor.file);
  const factor = outputSize / stageSize;
  context.drawImage(
    imageBitmap,
    editor.x * factor,
    editor.y * factor,
    editor.naturalWidth * editor.scale * factor,
    editor.naturalHeight * editor.scale * factor,
  );

  return { canvas, context, outputSize };
}

async function autoDetectPlate(editor, options = {}) {
  if (!editor.supportsPlateMask || !editor.file) {
    return false;
  }

  const quiet = Boolean(options.quiet);

  if (!quiet) {
    setEditorStatus(editor, `${editor.label} OpenCV 偵測中...`);
  }

  let cv;
  let src;
  let gray;
  let blurred;
  let edges;
  let morphed;
  let contours;
  let hierarchy;
  let kernel;

  try {
    cv = await ensureOpenCvReady();
    const { canvas, outputSize } = await renderSquareCanvas(editor, { outputSize: 960 });
    src = cv.imread(canvas);
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    morphed = new cv.Mat();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blurred, edges, 70, 180, 3, false);
    cv.morphologyEx(edges, morphed, cv.MORPH_CLOSE, kernel);
    cv.findContours(morphed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let bestCandidate = null;

    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      const contourArea = Math.abs(cv.contourArea(contour));
      const approx = new cv.Mat();

      try {
        if (contourArea < outputSize * outputSize * 0.003 || contourArea > outputSize * outputSize * 0.24) {
          continue;
        }

        const perimeter = cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approx, 0.03 * perimeter, true);

        const isQuad = approx.rows === 4 && cv.isContourConvex(approx);
        const polygonPoints = isQuad ? extractContourPoints(approx) : rectToPoints(cv.boundingRect(contour));
        const score = scorePlateCandidate(polygonPoints, contourArea, outputSize) + (isQuad ? 0.12 : 0);

        if (!Number.isFinite(score) || (bestCandidate && score <= bestCandidate.score)) {
          continue;
        }

        bestCandidate = {
          score,
          points: polygonPoints,
          outputSize,
        };
      } finally {
        approx.delete();
        contour.delete();
      }
    }

    if (!bestCandidate) {
      if (!quiet) {
        setEditorStatus(editor, `${editor.label} 未找到明顯車牌，請切到「遮牌」模式手動點四角。`);
      }
      return false;
    }

    editor.platePoints = normalizePlatePoints(bestCandidate.points, bestCandidate.outputSize);
    editor.mode = "plate";
    renderEditor(editor);
    setEditorStatus(editor, `${editor.label} 已用 OpenCV 自動偵測，可直接生成；如需修正請清除四角後重選。`);
    return true;
  } catch (error) {
    if (!quiet) {
      setEditorStatus(
        editor,
        error instanceof Error ? error.message : `${editor.label} 自動偵測失敗，請手動點四角。`,
      );
    }
    return false;
  } finally {
    kernel?.delete();
    hierarchy?.delete();
    contours?.delete();
    morphed?.delete();
    edges?.delete();
    blurred?.delete();
    gray?.delete();
    src?.delete();
  }
}

async function renderSquareFile(editor, options = {}) {
  if (!editor.file) {
    return null;
  }

  const { canvas, context, outputSize } = await renderSquareCanvas(editor, options);

  if (editor.supportsPlateMask && options.applyPlateMask) {
    if (editor.platePoints.length !== 4) {
      throw new Error(`請先在${editor.label}點選車牌四個角。`);
    }

    context.fillStyle = "#ffffff";
    context.beginPath();
    editor.platePoints.forEach((point, index) => {
      const x = point.x * outputSize;
      const y = point.y * outputSize;

      if (index === 0) {
        context.moveTo(x, y);
        return;
      }

      context.lineTo(x, y);
    });
    context.closePath();
    context.fill();
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("圖片輸出失敗。"));
      },
      editor.file.type || "image/jpeg",
      0.95,
    );
  });

  return new File([blob], editor.file.name, {
    type: blob.type || editor.file.type || "image/jpeg",
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

function setupTextToggleSync(inputId, toggleId) {
  const input = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);

  const update = () => {
    toggle.checked = Boolean(input.value.trim());
  };

  input.addEventListener("input", update);
  update();
}

function setupBrandLogoExclusivity() {
  brandLogoControls.forEach((control) => {
    const checkbox = document.getElementById(control.controlId);

    checkbox.addEventListener("change", () => {
      if (!checkbox.checked) {
        return;
      }

      brandLogoControls.forEach((otherControl) => {
        if (otherControl.controlId === control.controlId) {
          return;
        }

        document.getElementById(otherControl.controlId).checked = false;
      });
    });
  });
}

Object.values(editors).forEach(setupEditorInteractions);
setupTextToggleSync("item1", "showItem1");
setupTextToggleSync("item2", "showItem2");
setupTextToggleSync("item3", "showItem3");
setupBrandLogoExclusivity();

window.addEventListener("resize", () => {
  Object.values(editors).forEach((editor) => {
    if (editor.file) {
      fitEditor(editor);
    }
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  messageNode.textContent = "生成中...";
  resultImage.hidden = true;
  resultLink.hidden = true;

  try {
    const showMainImage = isChecked("showMainImage");
    const showSecondaryImage1 = isChecked("showSecondaryImage1");
    const showSecondaryImage2 = isChecked("showSecondaryImage2");
    const showSecondaryImage3 = isChecked("showSecondaryImage3");

    if (showMainImage && !editors.mainImage.file) {
      messageNode.textContent = "請先上傳主圖。";
      return;
    }

    if (showSecondaryImage1 && !editors.secondaryImage1.file) {
      messageNode.textContent = "請先上傳副圖 1。";
      return;
    }

    if (showSecondaryImage2 && !editors.secondaryImage2.file) {
      messageNode.textContent = "請先上傳副圖 2-1。";
      return;
    }

    if (showSecondaryImage3 && !editors.secondaryImage3.file) {
      messageNode.textContent = "請先上傳副圖 2-2。";
      return;
    }

    const uploadJobs = [];
    let uploadedMainImageUrl = "";
    const uploadedSecondaryImageUrls = ["", "", ""];

    if (showMainImage) {
      const renderedMain = await renderSquareFile(editors.mainImage, {
        applyPlateMask: editors.mainImage.maskToggle.checked,
      });
      uploadJobs.push(
        uploadImageFile("main-images", renderedMain).then((url) => {
          uploadedMainImageUrl = url;
        }),
      );
    }

    if (showSecondaryImage1) {
      const renderedSecondary1 = await renderSquareFile(editors.secondaryImage1, {
        applyPlateMask: editors.secondaryImage1.maskToggle.checked,
      });
      uploadJobs.push(
        uploadImageFile("secondary-images", renderedSecondary1).then((url) => {
          uploadedSecondaryImageUrls[0] = url;
        }),
      );
    }

    if (showSecondaryImage2) {
      const renderedSecondary2 = await renderSquareFile(editors.secondaryImage2, {
        applyPlateMask: editors.secondaryImage2.maskToggle.checked,
      });
      uploadJobs.push(
        uploadImageFile("secondary-images", renderedSecondary2).then((url) => {
          uploadedSecondaryImageUrls[1] = url;
        }),
      );
    }

    if (showSecondaryImage3) {
      const renderedSecondary3 = await renderSquareFile(editors.secondaryImage3, {
        applyPlateMask: editors.secondaryImage3.maskToggle.checked,
      });
      uploadJobs.push(
        uploadImageFile("secondary-images", renderedSecondary3).then((url) => {
          uploadedSecondaryImageUrls[2] = url;
        }),
      );
    }

    await Promise.all(uploadJobs);

    const logoVisibility = Object.fromEntries(
      productLogoLayerNames.map((name) => [name, isChecked(name)]),
    );

    brandLogoControls.forEach((control) => {
      const visible = isChecked(control.controlId);
      control.layerNames.forEach((layerName) => {
        logoVisibility[layerName] = visible;
      });
    });

    const payload = {
      title: document.getElementById("title").value.trim(),
      subtitle: document.getElementById("subtitle").value.trim(),
      itemEntries: [
        { text: document.getElementById("item1").value.trim(), show: isChecked("showItem1") },
        { text: document.getElementById("item2").value.trim(), show: isChecked("showItem2") },
        { text: document.getElementById("item3").value.trim(), show: isChecked("showItem3") },
      ],
      mainImage: {
        show: showMainImage,
        imageUrl: showMainImage ? uploadedMainImageUrl : "",
      },
      secondaryImageUrls: uploadedSecondaryImageUrls,
      secondaryImageVisibility: [showSecondaryImage1, showSecondaryImage2, showSecondaryImage3],
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

void ensureOpenCvReady().catch(() => {});
loadConfig();
