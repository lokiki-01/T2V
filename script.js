const dimensions = [
  { key: "subject", label: "Subject", cn: "主体", weight: 0.18, low: "Subject Missing" },
  { key: "attribute", label: "Attribute", cn: "属性", weight: 0.16, low: "Attribute Error" },
  { key: "action", label: "Action", cn: "动作", weight: 0.2, low: "Action Missing" },
  { key: "relation", label: "Relation", cn: "关系", weight: 0.18, low: "Relation Error" },
  { key: "scene", label: "Scene", cn: "场景", weight: 0.12, low: "Scene Deviation" },
  { key: "temporal", label: "Temporal", cn: "时序", weight: 0.16, low: "Temporal Drift" }
];

const lexicon = {
  colors: ["red", "blue", "green", "yellow", "black", "white", "purple", "brown", "orange", "pink", "灰色", "红色", "蓝色", "绿色", "黄色", "黑色", "白色"],
  actions: ["run", "runs", "running", "walk", "walking", "drive", "drives", "driving", "jump", "jumps", "fly", "flying", "turn", "turns", "climb", "climbs", "sit", "sits", "ride", "riding", "eat", "eating", "chase", "chases", "跑", "走", "开", "飞", "转", "爬", "坐", "骑", "追逐"],
  relations: ["left", "right", "beside", "near", "under", "above", "behind", "front", "through", "past", "on", "in", "next to", "左", "右", "旁边", "下面", "上方", "后面", "前面", "穿过"],
  scenes: ["field", "street", "road", "room", "beach", "forest", "table", "sky", "sunny", "night", "grass", "kitchen", "park", "田野", "街道", "房间", "海边", "森林", "桌子", "夜晚", "草地"],
  objects: ["dog", "cat", "car", "bus", "bicycle", "person", "man", "woman", "tree", "vase", "ball", "cup", "bird", "horse", "机器人", "狗", "猫", "汽车", "公交车", "自行车", "人", "树", "花瓶", "球", "杯子", "鸟"]
};

const state = {
  videoFile: null,
  current: null,
  selectedCaseId: null,
  cases: [],
  keyframes: [],
  scores: Object.fromEntries(dimensions.map((d) => [d.key, 3.5]))
};

const $ = (selector) => document.querySelector(selector);

function init() {
  if (state.cases.length) {
    state.current = state.cases[0];
    state.selectedCaseId = state.current.videoId;
    state.scores = { ...state.current.scores };
  }
  renderRubric();
  renderKeyframes([]);
  if (state.current) {
    renderResult(state.current);
  }
  loadModelComparison();
  renderBars();
  drawRadar(state.scores);
  bindEvents();
  renderCaseTable();
  updateStats();
}

async function loadModelComparison() {
  try {
    const response = await fetch("data/model-comparison.json", { cache: "no-store" });
    if (!response.ok) throw new Error("comparison data missing");
    const data = await response.json();
    renderModelComparison(data);
  } catch (error) {
    $("#comparison-source").textContent = "No comparison data found.";
    $("#comparison-pair-list").innerHTML = `<article class="panel empty-detail">还没有模型对比数据。</article>`;
  }
}

function renderModelComparison(data) {
  const seedance = data.summary["seedance2.0"];
  const kling = data.summary["kling3.0"];
  const videosById = Object.fromEntries(data.videos.map((item) => [item.video_id, item]));

  $("#comparison-source").textContent = `${data.source} · ${data.videos.length} videos`;
  $("#model-comparison-overview").innerHTML = `
    <article class="panel"><span>Seedance 2.0 Average</span><strong>${seedance.average_final_score.toFixed(1)}</strong></article>
    <article class="panel"><span>Kling 3.0 Average</span><strong>${kling.average_final_score.toFixed(1)}</strong></article>
    <article class="panel"><span>Total Videos</span><strong>${data.videos.length}</strong></article>
    <article class="panel"><span>Prompt Pairs</span><strong>${data.pairs.length}</strong></article>
  `;

  const dimRows = [
    ["主体", "average_subject"],
    ["属性", "average_attribute"],
    ["动作", "average_action"],
    ["关系", "average_relation"],
    ["场景", "average_scene"],
    ["时序", "average_temporal"]
  ];
  $("#model-dimension-bars").innerHTML = dimRows.map(([label, key]) => `
    <div class="model-dim-row">
      <span>${label}</span>
      <div class="model-dim-bar"><span>Seedance 2.0</span><i><em style="width:${(seedance[key] / 5) * 100}%"></em></i><b>${seedance[key].toFixed(2)}</b></div>
      <div class="model-dim-bar kling"><span>Kling 3.0</span><i><em style="width:${(kling[key] / 5) * 100}%"></em></i><b>${kling[key].toFixed(2)}</b></div>
    </div>
  `).join("");

  $("#comparison-pair-list").innerHTML = data.pairs.map((pair) => {
    const left = videosById[pair.seedance_video_id];
    const right = videosById[pair.kling_video_id];
    return `
      <article class="panel pair-card">
        <div class="pair-head">
          <div>
            <h3>${escapeHTML(pair.prompt_id)} · ${escapeHTML(pair.category)}</h3>
            <p>${escapeHTML(pair.prompt)}</p>
          </div>
          <span class="winner-pill">Winner: ${escapeHTML(pair.winner)}</span>
        </div>
        <div class="pair-videos">
          ${renderModelVideoCard(left)}
          ${renderModelVideoCard(right)}
        </div>
      </article>
    `;
  }).join("");
}

function renderModelVideoCard(item) {
  return `
    <section class="model-video-card">
      <header>
        <h4>${escapeHTML(item.model)} · ${escapeHTML(item.video_id)}</h4>
        <strong class="${scoreClass(item.final_score)}">${item.final_score.toFixed(1)}</strong>
      </header>
      <video src="${escapeHTML(item.video)}" controls preload="metadata" playsinline></video>
      <div class="score-grid">
        <span>主体 <b>${item.subject_score}</b></span>
        <span>属性 <b>${item.attribute_score}</b></span>
        <span>动作 <b>${item.action_score}</b></span>
        <span>关系 <b>${item.relation_score}</b></span>
        <span>场景 <b>${item.scene_score}</b></span>
        <span>时序 <b>${item.temporal_score}</b></span>
      </div>
      <div class="label-list">${item.error_type.length ? item.error_type.map((label) => `<span class="chip warn">${escapeHTML(label)}</span>`).join("") : `<span class="chip">No Obvious Error</span>`}</div>
      <p class="reason-text">${escapeHTML(item.reason)}</p>
    </section>
  `;
}

function bindEvents() {
  $("#video-input").addEventListener("change", handleVideoInput);
  $("#eval-form").addEventListener("submit", handleEvaluation);
  $("#load-demo").addEventListener("click", loadDemo);
  $("#case-search").addEventListener("input", renderCaseTable);
  $("#case-category").addEventListener("change", renderCaseTable);
  $("#case-list").addEventListener("click", handleCaseClick);
  $("#case-detail").addEventListener("click", handleCaseDetailAction);
  $("#export-json").addEventListener("click", exportJSON);
  $("#export-csv").addEventListener("click", exportCSV);
}

function handleVideoInput(event) {
  const file = event.target.files[0];
  if (!file) return;
  state.videoFile = file;
  state.keyframes = [];
  renderKeyframes([]);
  $("#meta-samples").textContent = "0";
  $("#keyframe-status").textContent = "等待视频元数据...";
  const video = $("#video-preview");
  video.src = URL.createObjectURL(file);
  $("#empty-video").style.display = "none";
  $("#meta-size").textContent = formatBytes(file.size);
  video.onloadedmetadata = async () => {
    $("#meta-duration").textContent = formatTime(video.duration);
    $("#meta-resolution").textContent = `${video.videoWidth}×${video.videoHeight}`;
    $("#keyframe-status").textContent = "正在截取 8 个关键帧...";
    try {
      state.keyframes = await extractKeyframes(video, 8);
      renderKeyframes(state.keyframes);
      $("#meta-samples").textContent = state.keyframes.length;
      $("#keyframe-status").textContent = `已截取 ${state.keyframes.length} 个关键帧`;
    } catch (error) {
      $("#keyframe-status").textContent = "关键帧截取失败，请确认视频可播放";
      console.warn(error);
    }
  };
}

async function handleEvaluation(event) {
  event.preventDefault();
  const prompt = $("#prompt").value.trim();
  if (!prompt) {
    alert("请先输入生成视频使用的 Text Prompt。");
    return;
  }
  if (!state.videoFile) {
    alert("请先上传需要评测的视频文件，或点击 Load Demo Case 查看示例。");
    return;
  }

  const video = $("#video-preview");
  const parsed = parsePrompt(prompt);
  let evidence = demoEvidence();

  if (state.videoFile && video.readyState >= 1) {
    if (!state.keyframes.length) {
      state.keyframes = await extractKeyframes(video, 8);
      renderKeyframes(state.keyframes);
      $("#meta-samples").textContent = state.keyframes.length;
      $("#keyframe-status").textContent = `已截取 ${state.keyframes.length} 个关键帧`;
    }
    evidence = await analyzeVideo(video);
  }

  const autoScores = estimateScores(parsed, evidence);
  state.scores = autoScores;
  syncRubricFromScores();

  const result = buildResult(parsed, evidence);
  state.current = result;
  state.selectedCaseId = result.videoId;
  state.cases.unshift(result);
  renderResult(result);
  renderCaseTable();
  updateStats();
  location.hash = "#results";
}

function parsePrompt(prompt) {
  const normalized = prompt.toLowerCase();
  const hit = (items) => items.filter((item) => normalized.includes(item.toLowerCase()));
  return {
    raw: prompt,
    objects: hit(lexicon.objects),
    colors: hit(lexicon.colors),
    actions: hit(lexicon.actions),
    relations: hit(lexicon.relations),
    scenes: hit(lexicon.scenes),
    complexity: prompt.split(/\s+|，|。|、|,/).filter(Boolean).length
  };
}

async function analyzeVideo(video) {
  const canvas = $("#analysis-canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const duration = Math.max(video.duration || 1, 1);
  const points = uniformTimes(duration, 8);
  const frames = [];
  const originalTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;

  for (const time of points) {
    await seekVideo(video, time);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(frameStats(ctx.getImageData(0, 0, canvas.width, canvas.height)));
  }

  await seekVideo(video, Math.min(originalTime, duration - 0.05));

  const motion = average(frames.slice(1).map((frame, index) => frameDiff(frames[index].gray, frame.gray)));
  const brightness = average(frames.map((frame) => frame.brightness));
  const contrast = average(frames.map((frame) => frame.contrast));
  const sharpness = average(frames.map((frame) => frame.sharpness));
  const colorfulness = average(frames.map((frame) => frame.colorfulness));

  $("#meta-samples").textContent = frames.length;

  return {
    samples: frames.length,
    duration: video.duration || 0,
    resolution: `${video.videoWidth}×${video.videoHeight}`,
    keyframes: state.keyframes,
    brightness,
    contrast,
    sharpness,
    motion,
    colorfulness
  };
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.02) {
      resolve();
      return;
    }
    let timer;
    const done = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = time;
    timer = setTimeout(done, 1200);
  });
}

async function extractKeyframes(video, count = 8) {
  const duration = Math.max(video.duration || 1, 1);
  const times = uniformTimes(duration, count);
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");
  const frames = [];
  const originalTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;

  video.pause();

  for (let index = 0; index < times.length; index++) {
    await seekVideo(video, times[index]);
    drawVideoWithPadding(video, ctx, canvas.width, canvas.height);
    frames.push({
      index: index + 1,
      time: times[index],
      label: `Frame ${index + 1}`,
      src: canvas.toDataURL("image/jpeg", 0.88)
    });
  }

  await seekVideo(video, Math.min(originalTime, duration - 0.05));
  return frames;
}

function uniformTimes(duration, count) {
  if (count === 1) return [duration / 2];
  return Array.from({ length: count }, (_, index) => {
    const ratio = 0.05 + (index * 0.9) / (count - 1);
    return Math.min(duration - 0.05, Math.max(0, duration * ratio));
  });
}

function drawVideoWithPadding(video, ctx, targetWidth, targetHeight) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  const sourceWidth = video.videoWidth || targetWidth;
  const sourceHeight = video.videoHeight || targetHeight;
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (targetWidth - drawWidth) / 2;
  const y = (targetHeight - drawHeight) / 2;
  ctx.drawImage(video, x, y, drawWidth, drawHeight);
}

function renderKeyframes(frames, target = "#keyframe-grid") {
  const grid = $(target);
  if (!grid) return;
  grid.innerHTML = frames.length ? frames.map((frame) => `
    <figure class="keyframe-card">
      <img src="${frame.src}" alt="${frame.label}">
      <figcaption>${frame.label} · ${formatTime(frame.time)}</figcaption>
    </figure>
  `).join("") : `<div class="empty-keyframes">暂无关键帧</div>`;
}

function frameStats(imageData) {
  const data = imageData.data;
  const gray = new Float32Array(data.length / 4);
  let sum = 0;
  let sumSq = 0;
  let colorSum = 0;

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[j] = y;
    sum += y;
    sumSq += y * y;
    colorSum += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
  }

  const mean = sum / gray.length;
  const variance = Math.max(0, sumSq / gray.length - mean * mean);
  return {
    gray,
    brightness: mean / 255,
    contrast: Math.sqrt(variance) / 80,
    sharpness: laplacianScore(gray, imageData.width, imageData.height),
    colorfulness: colorSum / gray.length / 255 / 3
  };
}

function laplacianScore(gray, width, height) {
  let total = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = y * width + x;
      const v = Math.abs(gray[i] * 4 - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width]);
      total += v;
      count++;
    }
  }
  return clamp(total / count / 38, 0, 1);
}

function frameDiff(a, b) {
  let sum = 0;
  const step = 4;
  for (let i = 0; i < a.length; i += step) {
    sum += Math.abs(a[i] - b[i]);
  }
  return clamp(sum / (a.length / step) / 45, 0, 1);
}

function estimateScores(parsed, evidence) {
  const visibility = clamp((evidence.contrast + evidence.sharpness + balancedBrightness(evidence.brightness)) / 3, 0, 1);
  const motion = clamp(evidence.motion, 0, 1);
  const sceneRichness = clamp((evidence.colorfulness + evidence.contrast) / 2, 0, 1);

  return {
    subject: scoreBase(visibility, parsed.objects.length > 0),
    attribute: scoreBase((visibility + evidence.colorfulness) / 2, parsed.colors.length > 0),
    action: scoreBase((visibility + motion) / 2, parsed.actions.length > 0),
    relation: scoreBase(visibility * 0.9, parsed.relations.length > 0),
    scene: scoreBase(sceneRichness, parsed.scenes.length > 0),
    temporal: scoreBase((motion + clamp(evidence.samples / 8, 0, 1)) / 2, parsed.actions.length > 0 || parsed.relations.length > 0)
  };
}

function scoreBase(signal, required) {
  const base = required ? 2.7 : 3.4;
  return clamp(base + signal * 1.7, 0, 5);
}

function balancedBrightness(value) {
  return clamp(1 - Math.abs(value - 0.52) * 2.2, 0, 1);
}

function buildResult(parsed, evidence) {
  const score = weightedScore(state.scores);
  const labels = diagnosticLabels(state.scores, evidence);
  return {
    videoId: $("#video-id").value.trim() || `V${String(state.cases.length + 1).padStart(3, "0")}`,
    model: $("#model-name").value.trim() || "Unknown",
    category: $("#category").value,
    evaluator: $("#evaluator").value.trim() || "Guest",
    prompt: parsed.raw,
    scores: { ...state.scores },
    normalizedScore: score,
    labels,
    parsed,
    evidence,
    reason: makeReason(score, labels, parsed, evidence),
    createdAt: new Date().toLocaleString()
  };
}

function weightedScore(scores) {
  const total = dimensions.reduce((sum, dim) => sum + scores[dim.key] * dim.weight, 0);
  return Math.round((total / 5) * 1000) / 10;
}

function diagnosticLabels(scores, evidence) {
  const labels = dimensions.filter((dim) => scores[dim.key] < 3.55).map((dim) => dim.low);
  if (evidence.samples === 0) labels.push("Insufficient Information");
  if (labels.length === 0) labels.push("No Obvious Error");
  return labels;
}

function makeReason(score, labels, parsed, evidence) {
  const promptInfo = `prompt 中识别到 ${parsed.objects.length} 个主体线索、${parsed.colors.length} 个属性线索、${parsed.actions.length} 个动作线索、${parsed.relations.length} 个关系线索。`;
  const videoInfo = `视频采样 ${evidence.samples} 帧，清晰度 ${(evidence.sharpness * 100).toFixed(0)}，运动变化 ${(evidence.motion * 100).toFixed(0)}，对比度 ${(evidence.contrast * 100).toFixed(0)}。`;
  const issueInfo = labels.includes("No Obvious Error") ? "当前分数未触发明显错误标签。" : `主要风险标签：${labels.join(" / ")}。`;
  return `${promptInfo}${videoInfo}综合分 ${score}。${issueInfo}`;
}

function renderResult(result) {
  $("#total-score").textContent = result.normalizedScore.toFixed(1);
  $("#score-note").textContent = result.normalizedScore >= 85 ? "High semantic consistency" : result.normalizedScore >= 70 ? "Needs human review" : "Low consistency risk";
  $("#diagnostic-labels").innerHTML = result.labels.map((label) => `<span class="chip ${label === "No Obvious Error" ? "" : "warn"}">${label}</span>`).join("");
  $("#prompt-parse").innerHTML = [
    `主体：${displayList(result.parsed.objects)}`,
    `属性：${displayList(result.parsed.colors)}`,
    `动作：${displayList(result.parsed.actions)}`,
    `关系：${displayList(result.parsed.relations)}`,
    `场景：${displayList(result.parsed.scenes)}`
  ].join("<br>");
  renderBars();
  drawRadar(state.scores);
}

function renderRubric() {
  $("#rubric-grid").innerHTML = dimensions.map((dim) => `
    <label class="rubric-item">
      <span>${dim.cn} / ${dim.label}</span>
      <input type="range" min="0" max="5" step="0.1" value="${state.scores[dim.key]}" data-dim="${dim.key}">
      <output id="out-${dim.key}">${state.scores[dim.key].toFixed(1)}</output>
    </label>
  `).join("");

  document.querySelectorAll("[data-dim]").forEach((input) => {
    input.addEventListener("input", () => {
      state.scores[input.dataset.dim] = Number(input.value);
      $(`#out-${input.dataset.dim}`).textContent = Number(input.value).toFixed(1);
      if (state.current) {
        state.current.scores = { ...state.scores };
        state.current.normalizedScore = weightedScore(state.scores);
        state.current.labels = diagnosticLabels(state.scores, state.current.evidence);
        state.current.reason = makeReason(state.current.normalizedScore, state.current.labels, state.current.parsed, state.current.evidence);
        renderResult(state.current);
        renderCaseTable();
        updateStats();
      } else {
        renderBars();
        drawRadar(state.scores);
      }
    });
  });
}

function syncRubricFromScores() {
  dimensions.forEach((dim) => {
    const input = document.querySelector(`[data-dim="${dim.key}"]`);
    if (input) input.value = state.scores[dim.key].toFixed(1);
    const output = $(`#out-${dim.key}`);
    if (output) output.textContent = state.scores[dim.key].toFixed(1);
  });
}

function renderBars() {
  $("#dimension-bars").innerHTML = dimensions.map((dim) => {
    const value = state.scores[dim.key];
    return `
      <div class="bar-row">
        <div class="bar-label"><span>${dim.cn} ${dim.label}</span><span>${value.toFixed(1)} / 5</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${(value / 5) * 100}%"></div></div>
      </div>
    `;
  }).join("");
}

function drawRadar(scores) {
  const svg = $("#radar");
  const cx = 130;
  const cy = 108;
  const radius = 82;
  const points = dimensions.map((dim, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length;
    const scale = scores[dim.key] / 5;
    return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale];
  });
  const grid = [0.25, 0.5, 0.75, 1].map((scale) => polygonPoints(dimensions.map((_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length;
    return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale];
  }))).map((pts) => `<polygon points="${pts}" fill="none" stroke="#d9e0ea" stroke-width="1" />`).join("");
  const axes = dimensions.map((dim, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length;
    const x = cx + Math.cos(angle) * (radius + 22);
    const y = cy + Math.sin(angle) * (radius + 22);
    return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(angle) * radius}" y2="${cy + Math.sin(angle) * radius}" stroke="#e8edf5"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#667085">${dim.label}</text>`;
  }).join("");
  svg.innerHTML = `${grid}${axes}<polygon points="${polygonPoints(points)}" fill="rgba(37,99,235,.22)" stroke="#2563eb" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="2" fill="#2563eb"/>`;
}

function renderCaseTable() {
  const query = $("#case-search").value.toLowerCase();
  const category = $("#case-category").value;
  const rows = state.cases.filter((item) => {
    const matchText = JSON.stringify(item).toLowerCase().includes(query);
    const matchCategory = category === "all" || item.category === category;
    return matchText && matchCategory;
  });

  $("#case-count").textContent = `${rows.length} cases`;
  $("#case-list").innerHTML = rows.length ? rows.map((item) => `
    <button class="case-card ${item.videoId === state.selectedCaseId ? "active" : ""}" type="button" data-case-id="${escapeHTML(item.videoId)}">
      <span class="case-topline">
        <b>${escapeHTML(item.videoId)}</b>
        <strong>${item.normalizedScore.toFixed(1)}</strong>
      </span>
      <span class="case-meta">${escapeHTML(item.model)} · ${escapeHTML(item.category)}</span>
      <span class="case-prompt">${escapeHTML(item.prompt)}</span>
    </button>
  `).join("") : `<div class="empty-detail">没有匹配样本。</div>`;

  const selected = state.cases.find((item) => item.videoId === state.selectedCaseId) || rows[0] || state.cases[0];
  if (selected) {
    state.selectedCaseId = selected.videoId;
    renderCaseDetail(selected);
  } else {
    $("#case-detail").innerHTML = `<div class="empty-detail">还没有评测记录。上传视频并点击 Start Evaluation。</div>`;
  }
}

function handleCaseClick(event) {
  const card = event.target.closest("[data-case-id]");
  if (!card) return;
  state.selectedCaseId = card.dataset.caseId;
  const selected = state.cases.find((item) => item.videoId === state.selectedCaseId);
  if (!selected) return;
  renderCaseTable();
  renderCaseDetail(selected);
}

function handleCaseDetailAction(event) {
  const action = event.target.dataset.action;
  if (!action) return;
  const selected = state.cases.find((item) => item.videoId === state.selectedCaseId);
  if (!selected) return;

  state.current = selected;
  state.scores = { ...selected.scores };
  syncRubricFromScores();
  renderResult(selected);
  if (action === "open-results") {
    location.hash = "#results";
  }
}

function renderCaseDetail(item) {
  $("#case-detail").innerHTML = `
    <div class="case-detail-head">
      <div>
        <p>CASE DETAIL</p>
        <h3>${escapeHTML(item.videoId)}</h3>
      </div>
      <strong class="${scoreClass(item.normalizedScore)}">${item.normalizedScore.toFixed(1)}</strong>
    </div>
    <div class="detail-meta">
      <span>Model <b>${escapeHTML(item.model)}</b></span>
      <span>Category <b>${escapeHTML(item.category)}</b></span>
      <span>Evaluator <b>${escapeHTML(item.evaluator || "Guest")}</b></span>
      <span>Created <b>${escapeHTML(item.createdAt || "--")}</b></span>
    </div>
    <div class="prompt-review">
      <span>Prompt</span>
      <p>${escapeHTML(item.prompt)}</p>
    </div>
    <div class="detail-split">
      <div>
        <h3>Dimension Score</h3>
        <div class="mini-bars">
          ${dimensions.map((dim) => `
            <div class="mini-bar">
              <span>${dim.label}</span>
              <b>${item.scores[dim.key].toFixed(1)}</b>
              <i><em style="width:${(item.scores[dim.key] / 5) * 100}%"></em></i>
            </div>
          `).join("")}
        </div>
      </div>
      <div>
        <h3>Diagnostic Labels</h3>
        <div class="label-list">${item.labels.map((label) => `<span class="chip ${label === "No Obvious Error" ? "" : "warn"}">${label}</span>`).join("")}</div>
        <h3>Evidence</h3>
        <div class="evidence-grid">
          <span>Samples <b>${item.evidence.samples}</b></span>
          <span>Sharpness <b>${Math.round(item.evidence.sharpness * 100)}</b></span>
          <span>Motion <b>${Math.round(item.evidence.motion * 100)}</b></span>
          <span>Contrast <b>${Math.round(item.evidence.contrast * 100)}</b></span>
        </div>
      </div>
    </div>
    <div class="reason-box">
      <span>Review Reason</span>
      <p>${escapeHTML(item.reason)}</p>
    </div>
    <div class="case-keyframes">
      <div class="keyframe-head">
        <h3>Key Frames</h3>
        <span>${item.evidence.keyframes?.length || 0} frames</span>
      </div>
      <div class="keyframe-grid compact">
        ${renderKeyframesMarkup(item.evidence.keyframes || [])}
      </div>
    </div>
    <div class="button-row">
      <button class="primary-button" type="button" data-action="open-results">Load to Results</button>
      <button class="ghost-button" type="button" data-action="apply-scores">Apply Scores to Rubric</button>
    </div>
  `;
}

function updateStats() {
  $("#stat-total").textContent = state.cases.length;
  if (!state.cases.length) {
    $("#stat-average").textContent = "--";
    $("#stat-lowest").textContent = "--";
    $("#stat-issue").textContent = "--";
    return;
  }

  $("#stat-average").textContent = average(state.cases.map((item) => item.normalizedScore)).toFixed(1);
  const dimMeans = dimensions.map((dim) => ({
    label: dim.label,
    value: average(state.cases.map((item) => item.scores[dim.key]))
  })).sort((a, b) => a.value - b.value);
  $("#stat-lowest").textContent = dimMeans[0].label;

  const labelCounts = {};
  state.cases.forEach((item) => item.labels.forEach((label) => {
    if (label !== "No Obvious Error") labelCounts[label] = (labelCounts[label] || 0) + 1;
  }));
  const top = Object.entries(labelCounts).sort((a, b) => b[1] - a[1])[0];
  $("#stat-issue").textContent = top ? top[0] : "No Obvious Error";
}

function loadDemo() {
  $("#video-id").value = "V001";
  $("#model-name").value = "Kling-1.0";
  $("#category").value = "关系";
  $("#evaluator").value = "Guest";
  $("#prompt").value = "A dog running on the left of a bicycle in a sunny park";
  const parsed = parsePrompt($("#prompt").value);
  const evidence = { ...demoEvidence(), samples: 8 };
  state.scores = {
    subject: 4.5,
    attribute: 4.1,
    action: 4.0,
    relation: 2.8,
    scene: 4.3,
    temporal: 3.7
  };
  syncRubricFromScores();
  const result = buildResult(parsed, evidence);
  state.current = result;
  state.selectedCaseId = result.videoId;
  state.cases.unshift(result);
  renderResult(result);
  renderCaseTable();
  updateStats();
  location.hash = "#results";
}

function seedCases() {
  const data = [
    {
      videoId: "V001",
      model: "Pika-1.0",
      category: "属性",
      prompt: "A blue car drives past a white picket fence on a sunny day",
      scores: { subject: 5, attribute: 5, action: 5, relation: 5, scene: 5, temporal: 5 },
      labels: ["No Obvious Error"],
      reason: "视频中清楚呈现蓝色汽车、白色尖桩篱笆和晴朗白天场景，与文本提示词高度一致。汽车在连续关键帧中沿篱笆前方行驶，主体、属性、动作、关系、场景和时序均无明显偏差。"
    },
    {
      videoId: "V003",
      model: "Pika-1.0",
      category: "动作",
      prompt: "A dog runs through a field while a cat climbs a tree",
      scores: { subject: 4.2, attribute: 4.1, action: 3.1, relation: 3.0, scene: 4.4, temporal: 3.2 },
      labels: ["Action Missing", "Relation Error", "Temporal Drift", "Insufficient Information"],
      reason: "视频中能够看到狗、草地和大树，也能看到猫状动物，因此主体和场景与文本基本相关。主要偏差在于猫没有明确爬树，狗的奔跑过程也不够连续清楚，猫与树之间的动作关系需要人工复核。"
    },
    {
      videoId: "V006",
      model: "Kling-1.0",
      category: "关系",
      prompt: "A dog running on the left of a bicycle",
      scores: { subject: 4.8, attribute: 4.4, action: 4.6, relation: 3.1, scene: 4.5, temporal: 4.2 },
      labels: ["Relation Error"],
      reason: "视频中清楚呈现狗和自行车，狗也在持续奔跑。主要偏差在于文本要求狗位于自行车左侧，但关键帧中狗主要位于自行车右侧，左右空间关系未正确呈现。"
    },
    {
      videoId: "V013",
      model: "Pika-1.0",
      category: "属性",
      prompt: "Red toaster toasting bread beside a white refrigerator",
      scores: { subject: 2.8, attribute: 2.4, action: 2.6, relation: 2.5, scene: 3.2, temporal: 2.8 },
      labels: ["Subject Missing", "Attribute Error", "Action Missing", "Relation Error"],
      reason: "画面未稳定呈现红色烤面包机和白色冰箱的组合关系，烤面包动作也不充分。主体、属性绑定和空间关系均存在明显不确定性。"
    },
    {
      videoId: "V018",
      model: "Kling-1.0",
      category: "关系",
      prompt: "A bird flying on the left side of a hot air balloon",
      scores: { subject: 5, attribute: 4.8, action: 5, relation: 5, scene: 4.9, temporal: 4.8 },
      labels: ["No Obvious Error"],
      reason: "视频中鸟、热气球和天空场景清晰可见，鸟的飞行动作与左侧位置关系较稳定，整体语义一致性高。"
    },
    {
      videoId: "V045",
      model: "Pika-1.0",
      category: "动作",
      prompt: "A snail crosses the path as a butterfly flutters above",
      scores: { subject: 2.6, attribute: 3.4, action: 1.8, relation: 2.4, scene: 3.5, temporal: 2.1 },
      labels: ["Subject Missing", "Action Missing", "Relation Error", "Temporal Drift"],
      reason: "蜗牛与蝴蝶主体不够清楚，穿过道路与上方振翅的同步关系没有稳定体现。动作和时序维度明显偏弱。"
    }
  ];

  return data.map((item) => ({
    ...item,
    evaluator: "Demo",
    parsed: parsePrompt(item.prompt),
    evidence: { ...demoEvidence(), samples: 8, sharpness: 0.68, motion: item.scores.temporal / 5, contrast: 0.7 },
    normalizedScore: weightedScore(item.scores),
    createdAt: "Demo Dataset"
  }));
}

function demoEvidence() {
  return {
    samples: 0,
    duration: 0,
    resolution: "--",
    keyframes: [],
    brightness: 0.56,
    contrast: 0.72,
    sharpness: 0.66,
    motion: 0.58,
    colorfulness: 0.62
  };
}

function scoreClass(score) {
  if (score >= 85) return "score-good";
  if (score >= 70) return "score-mid";
  return "score-low";
}

function renderKeyframesMarkup(frames) {
  return frames.length ? frames.map((frame) => `
    <figure class="keyframe-card">
      <img src="${frame.src}" alt="${frame.label}">
      <figcaption>${frame.label} · ${formatTime(frame.time)}</figcaption>
    </figure>
  `).join("") : `<div class="empty-keyframes">该样本暂无关键帧</div>`;
}

function exportJSON() {
  if (!state.cases.length) return alert("还没有可导出的评测记录。");
  download(`t2v-evaluation-${Date.now()}.json`, JSON.stringify(state.cases, null, 2), "application/json");
}

function exportCSV() {
  if (!state.cases.length) return alert("还没有可导出的评测记录。");
  const header = ["video_id", "model", "category", "prompt", "score", "labels", "reason"];
  const rows = state.cases.map((item) => [item.videoId, item.model, item.category, item.prompt, item.normalizedScore, item.labels.join("; "), item.reason]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  download(`t2v-evaluation-${Date.now()}.csv`, csv, "text/csv");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function displayList(items) {
  return items.length ? [...new Set(items)].join("、") : "未识别";
}

function polygonPoints(points) {
  return points.map((point) => point.map((n) => n.toFixed(1)).join(",")).join(" ");
}

function formatBytes(bytes) {
  if (!bytes) return "--";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value > 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

init();
