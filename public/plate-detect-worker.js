let cvReadyPromise = null;

function ensureCvReady() {
  if (self.cv?.Mat) {
    return Promise.resolve(self.cv);
  }

  if (!cvReadyPromise) {
    cvReadyPromise = new Promise((resolve, reject) => {
      try {
        if (!self.cv) {
          self.importScripts("/vendor/opencv.js");
        }
      } catch (error) {
        reject(error);
        return;
      }

      if (!self.cv?.then) {
        reject(new Error("OpenCV.js 初始化介面不存在。"));
        return;
      }

      self.cv.then((readyCv) => {
        if (!readyCv?.Mat) {
          reject(new Error("OpenCV.js 載入失敗。"));
          return;
        }

        resolve(readyCv);
      });
    }).catch((error) => {
      cvReadyPromise = null;
      throw error;
    });
  }

  return cvReadyPromise;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

async function detectPlate(data) {
  const cv = await ensureCvReady();
  const imageData = new ImageData(new Uint8ClampedArray(data.buffer), data.width, data.height);
  let src;
  let gray;
  let blurred;
  let edges;
  let morphed;
  let contours;
  let hierarchy;
  let kernel;

  try {
    src = cv.matFromImageData(imageData);
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
        if (contourArea < data.width * data.height * 0.003 || contourArea > data.width * data.height * 0.24) {
          continue;
        }

        const perimeter = cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approx, 0.03 * perimeter, true);

        const isQuad = approx.rows === 4 && cv.isContourConvex(approx);
        const polygonPoints = isQuad ? extractContourPoints(approx) : rectToPoints(cv.boundingRect(contour));
        const score = scorePlateCandidate(polygonPoints, contourArea, data.width) + (isQuad ? 0.12 : 0);

        if (!Number.isFinite(score) || (bestCandidate && score <= bestCandidate.score)) {
          continue;
        }

        bestCandidate = {
          score,
          points: polygonPoints,
        };
      } finally {
        approx.delete();
        contour.delete();
      }
    }

    if (!bestCandidate) {
      return { found: false };
    }

    return {
      found: true,
      points: normalizePlatePoints(bestCandidate.points, data.width),
    };
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

self.addEventListener("message", async (event) => {
  const data = event.data;

  if (!data || data.type !== "detect") {
    return;
  }

  try {
    const result = await detectPlate(data);
    self.postMessage({ id: data.id, ...result });
  } catch (error) {
    self.postMessage({
      id: data.id,
      found: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
