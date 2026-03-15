const statusNode = document.getElementById("status");
const messageNode = document.getElementById("message");
const resultImage = document.getElementById("result-image");
const resultLink = document.getElementById("result-link");
const form = document.getElementById("render-form");
const submitButton = document.getElementById("submit-button");

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  messageNode.textContent = "生成中...";
  resultImage.hidden = true;
  resultLink.hidden = true;

  const formData = new FormData(form);
  const payload = {
    title: formData.get("title")?.toString().trim(),
    subtitle: formData.get("subtitle")?.toString().trim(),
    imageUrl: formData.get("imageUrl")?.toString().trim(),
  };

  try {
    const response = await fetch("/api/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

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
    messageNode.textContent = "連線失敗，請檢查伺服器與網路。";
  } finally {
    submitButton.disabled = false;
  }
});

loadConfig();
