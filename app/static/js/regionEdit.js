// 他のスクリプトでイベントリスナーを追加できるようにエクスポート
export function onTextSaved(callback) {
  window.addEventListener("text-saved", callback);
}

// 動的にモーダル要素を生成し、DOMに追加
function createModal() {
  const modal = document.createElement("div");
  modal.id = "modal";
  modal.style.display = "none";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0, 0, 0, 0.5)";
  modal.style.zIndex = "1000";

  const modalContent = document.createElement("div");
  modalContent.style.position = "absolute";
  modalContent.style.top = "50%";
  modalContent.style.left = "50%";
  modalContent.style.transform = "translate(-50%, -50%)";
  modalContent.style.width = "300px";
  modalContent.style.background = "white";
  modalContent.style.padding = "20px";
  modalContent.style.boxShadow = "0px 0px 10px rgba(0,0,0,0.2)";

  const title = document.createElement("h3");
  title.textContent = "Edit Region Content";
  modalContent.appendChild(title);

  const input = document.createElement("input");
  input.type = "text";
  input.id = "modalInput";
  input.style.width = "100%";
  input.style.padding = "5px";
  modalContent.appendChild(input);

  const saveButton = document.createElement("button");
  saveButton.id = "modalSave";
  saveButton.textContent = "Save";
  modalContent.appendChild(saveButton);

  const closeButton = document.createElement("button");
  closeButton.id = "modalClose";
  closeButton.textContent = "Close";
  modalContent.appendChild(closeButton);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  return modal;
}

// モーダル要素を取得
const modal = document.getElementById("modal") || createModal();
const modalInput = document.getElementById("modalInput");
const modalSave = document.getElementById("modalSave");
const modalClose = document.getElementById("modalClose");

let currentRegion = null;

// モーダルの表示関数
export function showModal(wavesurfer, region) {
  modal.style.display = "block";
  modalInput.value = region.content.textContent;
  modalInput.focus(); // 入力フィールドにフォーカス
  // 現在のリジョンを一時保存
  currentRegion = region;
}

// モーダルの非表示関数
export function hideModal() {
  modal.style.display = "none";
  modalInput.value = ""; // 入力内容をクリア
  currentRegion = null;
}

modalSave.addEventListener("click", () => {
  if (currentRegion) {
    currentRegion.content.textContent = modalInput.value;
    const e = new CustomEvent("text-saved", { detail: currentRegion });
    window.dispatchEvent(e);
    hideModal();
  }
});

// モーダル内の「Close」ボタンでモーダルを閉じる
modalClose.addEventListener("click", hideModal);
