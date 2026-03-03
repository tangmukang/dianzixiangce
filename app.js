const albumPhotos = [
  { src: "assets/photos/01.svg", title: "Morning Walk", date: "2025.04" },
  { src: "assets/photos/02.svg", title: "Old Bookstore", date: "2025.04" },
  { src: "assets/photos/03.svg", title: "Sea Breeze", date: "2025.05" },
  { src: "assets/photos/04.svg", title: "Coffee Stop", date: "2025.05" },
  { src: "assets/photos/05.svg", title: "Sunset Window", date: "2025.06" },
  { src: "assets/photos/06.svg", title: "Weekend Market", date: "2025.06" },
  { src: "assets/photos/07.svg", title: "Late Train", date: "2025.07" },
  { src: "assets/photos/08.svg", title: "Home Night", date: "2025.07" }
];

const scene = document.getElementById("scene");
const book = document.getElementById("book");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageStatus = document.getElementById("pageStatus");
const pageFlipSound = document.getElementById("pageFlipSound");

const leaves = [];
let currentLeaf = 0;
let dragState = null;
let animating = false;
let audioContext;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function splitIntoLeafSides(photoList) {
  const sides = [];
  for (let i = 0; i < photoList.length; i += 2) {
    sides.push({
      front: photoList[i],
      back: photoList[i + 1] || null
    });
  }
  return sides;
}

function createBasePage(side) {
  const base = document.createElement("div");
  base.className = `base-page ${side}`;
  const caption = document.createElement("div");
  caption.className = "base-caption";
  caption.textContent = side === "left" ? "手势拖动翻页，可在任意角度停住。" : "将示例图片替换为你的真实照片。";
  base.appendChild(caption);
  return base;
}

function createPhotoNode(item, pageNumber) {
  const wrap = document.createElement("div");
  wrap.className = "photo";

  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";

  if (item) {
    img.src = item.src;
    img.alt = `${item.title} photo`;
  } else {
    img.src = "assets/photos/fallback.svg";
    img.alt = "blank page";
  }

  img.addEventListener("error", () => {
    img.src = "assets/photos/fallback.svg";
  });

  wrap.appendChild(img);

  const caption = document.createElement("div");
  caption.className = "caption";
  const title = document.createElement("span");
  const index = document.createElement("span");
  title.textContent = item ? item.title : "相册";
  index.textContent = item ? `${item.date}` : `第 ${pageNumber} 页`;
  caption.append(title, index);
  wrap.appendChild(caption);
  return wrap;
}

function createPageFace(face, item, pageNumber) {
  const page = document.createElement("div");
  page.className = `page ${face}`;

  const texture = document.createElement("div");
  texture.className = "texture";
  page.appendChild(texture);

  page.appendChild(createPhotoNode(item, pageNumber));

  const shadow = document.createElement("div");
  shadow.className = "shadow";
  page.appendChild(shadow);

  const corner = document.createElement("div");
  corner.className = "corner-curl";
  page.appendChild(corner);

  return page;
}

function createLeaf(sidePair, leafIndex) {
  const leaf = document.createElement("div");
  leaf.className = "leaf";
  leaf.dataset.index = String(leafIndex);

  const frontPageNumber = leafIndex * 2 + 1;
  const backPageNumber = leafIndex * 2 + 2;

  const front = createPageFace("front", sidePair.front, frontPageNumber);
  const back = createPageFace("back", sidePair.back, backPageNumber);

  leaf.append(front, back);
  leaf._progress = 0;
  leaf._targetProgress = 0;

  return leaf;
}

function applyLeafState(leaf, progress) {
  const p = clamp(progress, 0, 1);
  leaf._progress = p;

  const angle = -180 * p;
  const bend = Math.sin(Math.PI * p);
  const tilt = (0.5 - Math.abs(0.5 - p)) * 2.1;
  const depth = 1 + bend * 1.4;

  leaf.style.setProperty("--bend", bend.toFixed(3));
  leaf.style.transform = `translateZ(${depth}px) rotateY(${angle}deg) rotateX(${tilt}deg)`;
}

function refreshLayers(activeLeaf = null) {
  const total = leaves.length;

  for (let i = 0; i < total; i += 1) {
    const leaf = leaves[i];
    const isTurned = i < currentLeaf;
    const baseZ = isTurned ? i + 1 : total - i + currentLeaf + 1;
    leaf.style.zIndex = String(baseZ);
  }

  if (activeLeaf) {
    activeLeaf.style.zIndex = String(total + 20);
  }
}

function updateStatus() {
  const total = leaves.length;
  const spreadNow = clamp(currentLeaf + 1, 1, total + 1);
  pageStatus.textContent = `跨页 ${spreadNow} / ${total + 1}`;
  prevBtn.disabled = animating || !!dragState || currentLeaf === 0;
  nextBtn.disabled = animating || !!dragState || currentLeaf >= total;
}

function computeDragProgress(clientX, rect, direction) {
  const centerX = rect.left + rect.width / 2;
  const pageWidth = rect.width / 2;

  if (direction === "forward") {
    const raw = (centerX + pageWidth - clientX) / (pageWidth * 2);
    return clamp(raw, 0, 1);
  }

  const raw = 1 - (clientX - (centerX - pageWidth)) / (pageWidth * 2);
  return clamp(raw, 0, 1);
}

function animateLeafTo(leaf, from, to, onDone) {
  const distance = Math.abs(to - from);
  if (distance < 0.001) {
    applyLeafState(leaf, to);
    onDone();
    return;
  }

  const duration = 190 + distance * 260;
  const start = performance.now();

  const frame = (now) => {
    const t = clamp((now - start) / duration, 0, 1);
    const eased = easeOutCubic(t);
    const progress = from + (to - from) * eased;
    applyLeafState(leaf, progress);

    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }

    applyLeafState(leaf, to);
    onDone();
  };

  requestAnimationFrame(frame);
}

function playFallbackFlip(volume = 0.4, speed = 1) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  if (!audioContext) {
    audioContext = new AudioCtx();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  const now = audioContext.currentTime;
  const duration = 0.22 / speed;
  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < channel.length; i += 1) {
    const t = i / channel.length;
    channel[i] = (Math.random() * 2 - 1) * (1 - t) * 0.72;
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = 2800;

  const highPass = audioContext.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 180;

  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume * 0.65, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(lowPass);
  lowPass.connect(highPass);
  highPass.connect(gain);
  gain.connect(audioContext.destination);

  source.start(now);
  source.stop(now + duration + 0.02);
}

function playFlipSound(phase) {
  const rate = phase === "start" ? 0.96 : 1.03;
  const volume = phase === "start" ? 0.25 : 0.42;

  if (!pageFlipSound) {
    playFallbackFlip(volume, rate);
    return;
  }

  try {
    pageFlipSound.pause();
    pageFlipSound.currentTime = 0;
    pageFlipSound.volume = volume;
    pageFlipSound.playbackRate = rate;
    const promise = pageFlipSound.play();
    if (promise) {
      promise.catch(() => playFallbackFlip(volume, rate));
    }
  } catch (error) {
    playFallbackFlip(volume, rate);
  }
}

function finalizeFlip(direction, targetProgress) {
  if (direction === "forward" && targetProgress === 1) {
    currentLeaf += 1;
  }

  if (direction === "backward" && targetProgress === 0) {
    currentLeaf -= 1;
  }

  currentLeaf = clamp(currentLeaf, 0, leaves.length);
}

function endDrag(pointerId) {
  if (!dragState || dragState.pointerId !== pointerId) return;

  const { leaf, direction, progress } = dragState;
  const target = progress >= 0.5 ? 1 : 0;

  animating = true;
  dragState = null;
  updateStatus();

  animateLeafTo(leaf, progress, target, () => {
    finalizeFlip(direction, target);
    refreshLayers();
    animating = false;
    updateStatus();
    playFlipSound("end");
  });
}

function startDrag(event) {
  if (animating || dragState) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;

  const rect = scene.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const direction = event.clientX >= centerX ? "forward" : "backward";

  let leaf = null;
  if (direction === "forward" && currentLeaf < leaves.length) {
    leaf = leaves[currentLeaf];
  }

  if (direction === "backward" && currentLeaf > 0) {
    leaf = leaves[currentLeaf - 1];
  }

  if (!leaf) return;

  dragState = {
    pointerId: event.pointerId,
    direction,
    leaf,
    rect,
    progress: leaf._progress
  };

  scene.setPointerCapture(event.pointerId);
  refreshLayers(leaf);

  const nextProgress = computeDragProgress(event.clientX, rect, direction);
  dragState.progress = nextProgress;
  applyLeafState(leaf, nextProgress);
  updateStatus();
  playFlipSound("start");
}

function onPointerMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { direction, rect, leaf } = dragState;
  const progress = computeDragProgress(event.clientX, rect, direction);
  dragState.progress = progress;
  applyLeafState(leaf, progress);
}

function flipWithButton(direction) {
  if (animating || dragState) return;

  let leaf;
  let from;
  let to;

  if (direction === "forward" && currentLeaf < leaves.length) {
    leaf = leaves[currentLeaf];
    from = leaf._progress;
    to = 1;
  } else if (direction === "backward" && currentLeaf > 0) {
    leaf = leaves[currentLeaf - 1];
    from = leaf._progress;
    to = 0;
  } else {
    return;
  }

  animating = true;
  refreshLayers(leaf);
  updateStatus();
  playFlipSound("start");

  animateLeafTo(leaf, from, to, () => {
    finalizeFlip(direction, to);
    refreshLayers();
    animating = false;
    updateStatus();
    playFlipSound("end");
  });
}

function initAlbum() {
  book.appendChild(createBasePage("left"));
  book.appendChild(createBasePage("right"));

  const sidePairs = splitIntoLeafSides(albumPhotos);
  sidePairs.forEach((pair, index) => {
    const leaf = createLeaf(pair, index);
    leaves.push(leaf);
    book.appendChild(leaf);
  });

  refreshLayers();
  updateStatus();

  scene.addEventListener("pointerdown", startDrag);
  scene.addEventListener("pointermove", onPointerMove);
  scene.addEventListener("pointerup", (event) => endDrag(event.pointerId));
  scene.addEventListener("pointercancel", (event) => endDrag(event.pointerId));

  nextBtn.addEventListener("click", () => flipWithButton("forward"));
  prevBtn.addEventListener("click", () => flipWithButton("backward"));

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") flipWithButton("forward");
    if (event.key === "ArrowLeft") flipWithButton("backward");
  });
}

initAlbum();
