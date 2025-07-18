import WaveSurfer from "https://unpkg.com/wavesurfer.js@7.8.8/dist/wavesurfer.esm.js";
import TimelinePlugin from "https://unpkg.com/wavesurfer.js@7.8.8/dist/plugins/timeline.esm.js";
import RegionsPlugin from "https://unpkg.com/wavesurfer.js@7.8.8/dist/plugins/regions.esm.js";
import ZoomPlugin from "https://unpkg.com/wavesurfer.js@7.8.8/dist/plugins/zoom.esm.js";

import { showModal, onTextSaved } from "./regionEdit.js";
import { getCurrentTimestamp } from "./util.js";

let currentOriginalAudioFileName = "";
let currentManagedAudioFileName = "";

const regionsPlugin = RegionsPlugin.create();

const wavesurfer = WaveSurfer.create({
  container: "#waveform",
  plugins: [
    regionsPlugin,
    TimelinePlugin.create(),
    ZoomPlugin.create({
      // the amount of zoom per wheel step, e.g. 0.5 means a 50% magnification per scroll
      scale: 0.5,
      // Optionally, specify the maximum pixels-per-second factor while zooming
      maxZoom: 100,
    }),
  ],
  minPxPerSec: 100,
});

wavesurfer.on("interaction", () => {
  console.log("interaction");
});

wavesurfer.on("load", function () {
  console.log("load");
});

wavesurfer.on("ready", function () {
  console.log("ready");
});

// すべてのリジョンに対してクリックイベントを設定
regionsPlugin.on("region-clicked", (region, e) => {
  e.stopPropagation();

  // 選択状態チェック
  if (!region.selected) {
    const selectedRegions = regionsPlugin
      .getRegions()
      .filter((r) => r.selected);

    // 最大2つのみとする
    if (selectedRegions.length == 2) return;

    // 選択済みリジョンと隣接しているなら可能
    if (selectedRegions.length) {
      const canSelect = selectedRegions.some(
        (r) => r.next === region || r.previous === region
      );

      if (!canSelect) return;
    }
  }

  region.selected = !region.selected;
  if (region.selected) {
    region.element.style.fontWeight = "bold";
    region.element.style.boxShadow = "0 0 10px rgba(0, 0, 255, 0.5)"; // 青色の影を追加
  } else {
    region.element.style.fontWeight = "";
    region.element.style.boxShadow = "";
  }
});

document.querySelector("#play").onclick = () => {
  wavesurfer.playPause();
};

// UI

async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to upload file");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

function getFasterWhisperParams() {
  const model = document.getElementById("faster-whisper-model").value;
  const lang = document.getElementById("faster-whisper-lang").value;
  const prompt = document.getElementById("faster-whisper-initial-prompt").value;

  return { model: model, lang: lang, prompt: prompt };
}

async function fetchTranscript(filename) {
  try {
    let param = {
      tool: document.querySelector("#transcriptToolForm").transcriptTool.value,
    };

    param = { ...param, ...getFasterWhisperParams() };

    const response = await fetch(`/transcript/${filename}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(param),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch transcript");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

async function fetchSpeechDataset(filename) {
  try {
    let param = {
      segments: getSegmentsFromTable(),
      "original-file-name": currentOriginalAudioFileName,
    };

    const response = await fetch(`/export_speech_dataset/${filename}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(param), // JSON形式でパラメータを送信
    });

    if (!response.ok) {
      throw new Error("Failed to fetch speech dataset");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fileNameWithoutExtension = currentOriginalAudioFileName
      .split(".")
      .slice(0, -1)
      .join(".");
    const fileName = `${fileNameWithoutExtension}.zip`;
    link.download = fileName;

    link.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

function setSegmentRowColumnElem(row) {
  // 開始時間
  const startCell = document.createElement("td");
  startCell.setAttribute("data-column", "start");
  row.appendChild(startCell);

  // 終了時間
  const endCell = document.createElement("td");
  endCell.setAttribute("data-column", "end");
  row.appendChild(endCell);

  // 長さ
  const durCell = document.createElement("td");
  durCell.setAttribute("data-column", "duration");
  row.appendChild(durCell);

  // テキスト
  const textCell = document.createElement("td");
  textCell.setAttribute("data-column", "text");
  row.appendChild(textCell);
}

// 行に値を設定する
function setTableRowValues(row, segment) {
  row.id = segment.id;
  row.querySelector('[data-column="start"]').textContent =
    segment.start.toFixed(2);
  row.querySelector('[data-column="end"]').textContent = segment.end.toFixed(2);
  row.querySelector('[data-column="duration"]').textContent = (
    segment.end - segment.start
  ).toFixed(2);
  row.querySelector('[data-column="text"]').textContent = segment.text;
}

function getTableRowValues(row) {
  return {
    id: row.id,
    start: parseFloat(row.querySelector('[data-column="start"]').textContent),
    end: parseFloat(row.querySelector('[data-column="end"]').textContent),
    duration: parseFloat(
      row.querySelector('[data-column="duration"]').textContent
    ),
    text: row.querySelector('[data-column="text"]').textContent,
  };
}

function addSegmentTableRow(segment) {
  // テーブルの tbody 要素を取得
  const tbody = document
    .getElementById("segmentsTable")
    .getElementsByTagName("tbody")[0];

  const row = document.createElement("tr");
  row.addEventListener("click", () => seekToRegion(segment.id));
  setSegmentRowColumnElem(row);
  setTableRowValues(row, segment);
  tbody.appendChild(row);
}

function insertSegmentTableRow(segment, index) {
  // テーブルの tbody 要素を取得
  const table = document
    .getElementById("segmentsTable")
    .getElementsByTagName("tbody")[0];

  const newRow = table.insertRow(index);
  newRow.addEventListener("click", () => seekToRegion(segment.id));
  setSegmentRowColumnElem(newRow);
  setTableRowValues(newRow, segment);
}

function removeSegmentTableRow(id) {
  const row = document.getElementById(id);
  if (row) {
    row.remove(); // 行が存在すれば削除
  } else {
    console.log(`Segment row with ID ${id} not found.`);
  }
}

function updateSegmentTableRow(id, segment) {
  const row = document.getElementById(id);
  if (row) {
    setTableRowValues(row, segment);
  } else {
    console.log(`Segment row with ID ${id} not found.`);
  }
}

function getSegmentsFromTable() {
  // 表から取る
  // テーブルの tbody 要素を取得
  const tbody = document
    .getElementById("segmentsTable")
    .getElementsByTagName("tbody")[0];
  const rows = tbody.getElementsByTagName("tr");
  return [...rows].map((r) => getTableRowValues(r));
}

function getSelectedRegions() {
  return regionsPlugin.getRegions().filter((r) => r.selected);
}

function concatRegions() {
  const selectedRegions = getSelectedRegions();
  const newStart = selectedRegions[0].start;
  const newEnd = selectedRegions[selectedRegions.length - 1].end;
  const newContent = selectedRegions.map((r) => r.content.textContent).join("");
  const segment = assignSegmentID({
    start: newStart,
    end: newEnd,
    text: newContent,
  });

  const index = regionsPlugin
    .getRegions()
    .findIndex((r) => r.start == newStart);
  selectedRegions.forEach((r) => {
    r.remove();
    // イベント経由で表は削除
  });

  addRegionFromSegment(segment);
  insertSegmentTableRow(segment, index);
}

// https://wavesurfer.xyz/examples/?regions.js
const random = (min, max) => Math.random() * (max - min) + min;
const randomColor = () =>
  `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.5)`;

function addRegionFromSegment(segment) {
  let region = regionsPlugin.addRegion({
    id: segment.id,
    content: segment.text,
    start: segment.start,
    end: segment.end,
    color: randomColor(),
    drag: true,
    resize: true,
  });

  // コンテキストメニューの表示処理
  region.element.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    createContextMenu(e.pageX, e.pageY, region);
  });

  // 表からも削除
  region.on("remove", () => {
    removeSegmentTableRow(region.id);
  });

  // 表を更新
  region.on("update-end", () => {
    const newSegment = {
      id: segment.id,
      start: region.start,
      end: region.end,
      text: region.content.textContent,
    };

    updateSegmentTableRow(newSegment.id, newSegment);
  });

  // 参照の追加
  const regions = regionsPlugin.getRegions();
  if (regions.length > 1) {
    const previousRegion = regions[regions.length - 2];
    previousRegion.next = region;
    region.previous = previousRegion;
  }
}

function initWaveRegions(segments) {
  regionsPlugin.clearRegions();
  for (let s of segments) {
    addRegionFromSegment(s);
    addSegmentTableRow(s);
  }
}

function assignSegmentID(segment) {
  const copy = structuredClone(segment);
  copy.id = crypto.randomUUID();
  return copy;
}

document.getElementById("uploadButton").addEventListener("click", async () => {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];

  if (!file) {
    alert("Please select a file.");
    return;
  }

  try {
    let result = await uploadFile(file);
    currentOriginalAudioFileName = file.name;
    currentManagedAudioFileName = result.filename;
    const statusElem = document.getElementById("status");
    statusElem.innerText = `File uploaded successfully: ${result.filename}`;

    wavesurfer.load(result.file_url);
    statusElem.innerText += `\nWave loaded successfully`;
  } catch (error) {
    console.error("Error:", error);
    document.getElementById("status").innerText = error;
  }
});

const transcriptButton = document.getElementById("transcriptButton");
transcriptButton
  .addEventListener("click", async () => {
    if (!currentManagedAudioFileName) return;
    transcriptButton.disabled = true;

    try {
      let param = {
        tool: document.querySelector("#transcriptToolForm").transcriptTool.value,
      };

      param = { ...param, ...getFasterWhisperParams() };

      const startResp = await fetch(`/transcript/${currentManagedAudioFileName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(param),
      });

      const { result_id } = await startResp.json();

      const poll = async () => {
        const statusResp = await fetch(`/transcript_result/${result_id}`);
        const data = await statusResp.json();

        if (!data.ready) {
          setTimeout(poll, 1000);
        } else if (!data.successful) {
          console.error("Task failed");
          transcriptButton.disabled = false;
        } else {
          console.log("Transcribed successfully");
          initWaveRegions(data.segments.map((s) => assignSegmentID(s)));
          transcriptButton.disabled = false;
        }
      };

      poll();

    } catch (error) {
      console.error("Error:", error);
      transcriptButton.disabled = false;
      throw error;
    }

  });

document
  .getElementById("importSegmentsButton")
  .addEventListener("click", async () => {
    if (!currentManagedAudioFileName) return;
    const segments = getSegmentsFromTable();
    if (segments.length > 0) {
      if (window.confirm("Do you really want to import segments?")) {
        // CONTINUE
      } else {
        return;
      }
    }

    const fileInput = document.getElementById("segmentInput");
    const file = fileInput.files[0];
    if (!file) {
      alert("Please select a file.");
      return;
    }

    // ファイルを処理するコードを追加
    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const segments = JSON.parse(event.target.result);
        initWaveRegions(segments.map((s) => assignSegmentID(s)));
      } catch (error) {
        console.error("Error parsing JSON:", error);
        alert("Invalid JSON file.");
      }
    };

    reader.readAsText(file);
  });

document
  .getElementById("exportSegmentsButton")
  .addEventListener("click", async () => {
    const segments = getSegmentsFromTable();
    if (segments.length == 0) return;
    const jsonData = JSON.stringify(segments, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    // ダウンロード用のURLを生成
    const url = URL.createObjectURL(blob);

    // ダウンロード用リンクを作成
    const link = document.createElement("a");
    link.href = url;
    const timestamp = getCurrentTimestamp();
    const fileNameWithoutExtension = currentOriginalAudioFileName
      .split(".")
      .slice(0, -1)
      .join(".");
    const fileName = `${fileNameWithoutExtension}_segments_${timestamp}.json`;
    link.download = fileName;

    // 自動的にクリックしてダウンロードを実行
    link.click();

    // URLを解放
    URL.revokeObjectURL(url);
  });

document
  .getElementById("exportSpeechDatasetButton")
  .addEventListener("click", async () => {
    const segments = getSegmentsFromTable();
    if (segments.length == 0) return;
    fetchSpeechDataset(currentManagedAudioFileName);
  });

// コンテキストメニューを生成する関数
function createContextMenu(x, y, region) {
  // 既存のメニューを削除
  removeContextMenu();

  // コンテキストメニューの要素を作成
  const contextMenu = document.createElement("div");
  contextMenu.id = "contextMenu";
  contextMenu.style.position = "absolute";
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.style.background = "#fff";
  contextMenu.style.border = "1px solid #ccc";
  contextMenu.style.zIndex = "1000";
  contextMenu.style.padding = "10px";

  // 状況に応じてメニュー項目を追加
  {
    const playOption = document.createElement("div");
    playOption.textContent = "Play Region";
    playOption.style.cursor = "pointer";
    playOption.onclick = () => {
      region.play();
      removeContextMenu();
    };
    contextMenu.appendChild(playOption);
  }

  // テキスト編集
  {
    const editTextOption = document.createElement("div");
    editTextOption.textContent = "Edit Text";
    editTextOption.style.cursor = "pointer";
    editTextOption.onclick = () => {
      showModal(wavesurfer, region);
      removeContextMenu();
    };
    contextMenu.appendChild(editTextOption);
  }

  // 2つ以上の連続したリジョンの結合
  if (getSelectedRegions().length >= 2) {
    const concatRegionsOption = document.createElement("div");
    concatRegionsOption.textContent = "Concat Regions";
    concatRegionsOption.style.cursor = "pointer";
    concatRegionsOption.onclick = () => {
      concatRegions();
      removeContextMenu();
    };

    contextMenu.appendChild(concatRegionsOption);
  }

  // TODO: 無音区間を消せるとよい

  document.body.appendChild(contextMenu);
}

// 既存のコンテキストメニューを削除する関数
function removeContextMenu() {
  const existingMenu = document.getElementById("contextMenu");
  if (existingMenu) {
    existingMenu.remove();
  }
}

// クリックした場所がメニュー以外の場合、メニューを閉じる
document.addEventListener("click", (e) => {
  if (!e.target.closest("#contextMenu")) {
    removeContextMenu();
  }
});

onTextSaved((event) => {
  const region = event.detail;
  if (region) {
    const newSegment = {
      id: region.id,
      start: region.start,
      end: region.end,
      text: region.content.textContent,
    };
    updateSegmentTableRow(region.id, newSegment);
  }
});

function seekToRegion(segmentId) {
  // リジョンをIDで検索
  const region = regionsPlugin
    .getRegions()
    .find((region) => region.id === segmentId);
  if (region) {
    wavesurfer.seekTo(region.start / wavesurfer.getDuration()); // 指定の位置にシーク
  } else {
    console.log(`Region with ID ${segmentId} not found.`);
  }
}
