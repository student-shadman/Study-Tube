/*
  StudyTube
  Local distraction-free study shell around the official YouTube IFrame Player API.
  It does not remove or bypass YouTube ads or playback restrictions.
*/

const STORAGE_KEYS = {
  history: "studytube_history_v2",
  favorites: "studytube_favorites_v2",
  focus: "studytube_focus_v2",
  progress: "studytube_progress_v1",
  settings: "studytube_settings_v1"
};

// Appearance lives in its own storage key, completely separate from study
// data — Reset Appearance must never be able to touch history/favorites/
// progress, and vice versa (Clear Data leaves appearance untouched too).
const APPEARANCE_KEY = "studytube_appearance_v1";
// The 5 dark theme personalities. Paper Study isn't in this list on purpose:
// it's reached via MODE ("light"), not via darkTheme — see resolveActiveTheme().
const DARK_THEMES = ["midnight", "sakura", "neon", "ocean", "sunset"];
// Light themes are a list too (not a single hardcoded "paper"), so a second
// light theme (Princess Bloom) slots in the same way Sunset Bloom slotted
// into the dark list — mode="light" resolves to whichever one is chosen,
// exactly like mode="dark" already resolves to whichever dark theme is chosen.
const LIGHT_THEMES = ["paper", "princess"];
const ACCENTS = ["violet", "blue", "cyan", "green", "pink", "orange"];
const MODES = ["system", "light", "dark"];
const MOTIONS = ["off", "minimal", "standard", "expressive"];
const DEFAULT_APPEARANCE = { mode: "dark", darkTheme: "midnight", lightTheme: "paper", accent: "violet", motion: "standard" };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

let player = null;
let playerApiReady = false;
let playerReady = false;
let currentVideoId = "";
let currentTitle = "";
let currentPlaylistId = "";
let isPlaylist = false;
let progressTimer = null;
let progressSaveTimer = null; // separate, coarser interval — see ProgressStore section for why
let isSeeking = false;
let pendingLoad = null; // only the most recent pre-ready load survives
let loadGeneration = 0; // bumped on every loadMediaInternal call; stale async work checks this before touching the DOM
let isFullscreen = false;
let resumeContext = null; // { videoId, positionSeconds, generation } — the pending "Continue from X?" prompt, if any
let captionsOn = false;
let sleepTimer = null;
let sleepAtVideoEnd = false;

const QUALITY_LABELS = {
  auto: "Auto", highres: "Highest available", hd2160: "2160p (4K)", hd1440: "1440p",
  hd1080: "1080p", hd720: "720p", large: "480p", medium: "360p", small: "240p", tiny: "144p"
};

const $ = (id) => document.getElementById(id);

const els = {
  url: $("youtubeUrl"),
  loadBtn: $("loadBtn"),
  status: $("statusText"),
  playerWrap: $("playerWrap"),
  emptyState: $("emptyState"),
  loading: $("loadingOverlay"),
  loadingText: $("loadingText"),
  videoTitle: $("videoTitle"),
  videoIdText: $("videoIdText"),
  favoriteBtn: $("favoriteBtn"),
  progressBar: $("progressBar"),
  currentTime: $("currentTime"),
  duration: $("duration"),
  playPauseBtn: $("playPauseBtn"),
  rewindBtn: $("rewindBtn"),
  forwardBtn: $("forwardBtn"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  volumeBar: $("volumeBar"),
  muteBtn: $("muteBtn"),
  speedSelect: $("speedSelect"),
  fullscreenBtn: $("fullscreenBtn"),
  focusModeBtn: $("focusModeBtn"),
  clearAllBtn: $("clearAllBtn"),
  historyList: $("historyList"),
  favoriteList: $("favoriteList"),
  historyCount: $("historyCount"),
  favoriteCount: $("favoriteCount"),
  playerStateText: $("playerStateText"),
  playlistText: $("playlistText"),
  rateSupportText: $("rateSupportText"),
  fsOverlay: $("fsOverlay"),
  fsFocusBtn: $("fsFocusBtn"),
  fsExitBtn: $("fsExitBtn"),
  fsPlayPauseBtn: $("fsPlayPauseBtn"),
  fsRewindBtn: $("fsRewindBtn"),
  fsForwardBtn: $("fsForwardBtn"),
  fsSpeedSelect: $("fsSpeedSelect"),
  fsMuteBtn: $("fsMuteBtn"),
  fsVolumeBar: $("fsVolumeBar"),
  completeBtn: $("completeBtn"),
  resumeBehaviorSelect: $("resumeBehaviorSelect"),
  resumePrompt: $("resumePrompt"),
  resumePromptText: $("resumePromptText"),
  resumeBtn: $("resumeBtn"),
  startOverBtn: $("startOverBtn"),
  qualitySelect: $("qualitySelect"),
  ccBtn: $("ccBtn"),
  captionTrackSelect: $("captionTrackSelect"),
  sleepTimerSelect: $("sleepTimerSelect"),
  appearanceBtn: $("appearanceBtn"),
  appearancePanel: $("appearancePanel"),
  themeGrid: $("themeGrid"),
  modeRow: $("modeRow"),
  accentRow: $("accentRow"),
  motionRow: $("motionRow"),
  resetAppearanceBtn: $("resetAppearanceBtn")
};

window.onYouTubeIframeAPIReady = () => {
  playerApiReady = true;
  createPlayer();
};

function createPlayer() {
  if (!window.YT || !YT.Player) {
    updateStatus("YouTube player API is unavailable. Check your internet connection.", "error");
    return;
  }

  player = new YT.Player("player", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 0,
      controls: 0,
      rel: 0,
      playsinline: 1,
      iv_load_policy: 3,
      enablejsapi: 1,
      origin: window.location.origin
    },
    events: {
      onReady: handlePlayerReady,
      onStateChange: handlePlayerStateChange,
      onError: handlePlayerError,
      onPlaybackRateChange: handlePlaybackRateChange,
      onPlaybackQualityChange: handlePlaybackQualityChange,
      onAutoplayBlocked: handleAutoplayBlocked
    }
  });
}

function handlePlayerReady() {
  playerReady = true;
  hideLoading();
  setPlayerIframePermissions();
  updateVolumeUI();
  refreshSupportedRates();
  updateControlAvailability();
  flushPendingLoad();
}

function setPlayerIframePermissions() {
  const iframe = els.playerWrap.querySelector("iframe");
  if (!iframe) return;
  iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
}

function handlePlayerStateChange(event) {
  hideLoading();

  const state = event.data;
  updateControlAvailability();
  updateMainPlayButton(state);

  if (state === YT.PlayerState.PLAYING) {
    startProgressLoop();
    startProgressPersistence();
    hideResumePrompt(); // pressing Play without choosing Resume/Start Over = start from wherever cued
    syncCurrentMediaFromPlayer();
    updatePlayerStateText("Playing");
    if (currentVideoId) {
      saveToHistory(currentVideoId, currentTitle || "YouTube video");
      renderSavedLists();
    }
    refreshSupportedRates();
    refreshAvailableQualities();
    refreshCaptionTracks();
  } else if (state === YT.PlayerState.PAUSED) {
    stopProgressLoop();
    stopProgressPersistence();
    persistCurrentProgress(); // force-save on pause
    updateProgress();
    updatePlayerStateText("Paused");
  } else if (state === YT.PlayerState.BUFFERING) {
    updatePlayerStateText("Buffering…");
  } else if (state === YT.PlayerState.CUED) {
    stopProgressLoop();
    stopProgressPersistence();
    syncCurrentMediaFromPlayer();
    updateProgress();
    updatePlayerStateText("Ready — press Play");
    refreshSupportedRates();
    refreshAvailableQualities();
    refreshCaptionTracks();
    updateCompleteButton();
    maybeOfferResume();
  } else if (state === YT.PlayerState.ENDED) {
    stopProgressLoop();
    stopProgressPersistence();
    updateProgress();
    updatePlayerStateText("Finished");
    if (currentVideoId) {
      // Completion is tracked separately from position — rewinding and
      // rewatching later must not silently clear it (see README Phase 4).
      ProgressStore.save(currentVideoId, { completed: true });
      updateCompleteButton();
    }
    if (sleepAtVideoEnd) {
      sleepAtVideoEnd = false;
      els.sleepTimerSelect.value = "off";
      updateStatus("Sleep timer reached — video finished. Nice work.", "success");
    }
    if (isPlaylist && getPlaylistIndex() >= 0) {
      updatePlaylistText();
    }
  }

  // Re-check availability AFTER the branch above has run. The call at the
  // top of this function (line ~151) runs BEFORE syncCurrentMediaFromPlayer()
  // populates currentVideoId in the CUED/PLAYING branches — so without this,
  // Play/seek/volume/etc. could be left permanently disabled after the very
  // first video loads, since nothing else would re-enable them.
  updateControlAvailability();
}

function handlePlayerError(event) {
  hideLoading();
  stopProgressLoop();
  stopProgressPersistence();
  const messages = {
    2: "Invalid YouTube video or playlist parameter.",
    5: "This content cannot be played in the HTML5 embedded player.",
    100: "This video was not found, removed, or is private.",
    101: "The owner does not allow this video to play in embedded players.",
    150: "The owner does not allow this video to play in embedded players.",
    153: "YouTube rejected the embed because the page origin/referrer could not identify the player. Run StudyTube through localhost/Live Server, not file://."
  };
  updatePlayerStateText("Error");
  updateStatus(messages[event.data] || `YouTube player error: ${event.data}`, "error");
}

function handlePlaybackRateChange(event) {
  const rate = Number(event.data) || 1;
  [els.speedSelect, els.fsSpeedSelect].forEach((select) => {
    const option = Array.from(select.options).find((item) => Number(item.value) === rate);
    if (option) select.value = String(rate);
  });
  els.rateSupportText.textContent = `Current speed: ${formatRate(rate)}×`;
}

// --- Quality control -------------------------------------------------------
// setPlaybackQuality is a *request*, not a guarantee — YouTube's own
// adaptive-streaming logic can override it, and getAvailableQualityLevels()
// legitimately returns just ["auto"] for a lot of content. We reflect
// whatever YouTube actually reports rather than pretending every level is
// always selectable.

function refreshAvailableQualities() {
  if (!player || !playerReady) return;
  let levels = [];
  try {
    levels = player.getAvailableQualityLevels() || [];
  } catch {
    levels = [];
  }
  const options = ["auto", ...levels.filter((level) => level !== "auto")];

  const previousValue = els.qualitySelect.value;
  els.qualitySelect.innerHTML = "";
  options.forEach((level) => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = QUALITY_LABELS[level] || level;
    els.qualitySelect.appendChild(option);
  });

  let current = "auto";
  try {
    current = player.getPlaybackQuality() || "auto";
  } catch {
    current = "auto";
  }
  els.qualitySelect.value = options.includes(previousValue) ? previousValue : (options.includes(current) ? current : "auto");
}

function setQuality(value) {
  if (!player || !playerReady) return;
  try {
    player.setPlaybackQuality(value);
  } catch {
    // Some videos/browsers reject this silently — nothing more we can do.
  }
}

function handlePlaybackQualityChange(event) {
  const quality = event.data;
  if (Array.from(els.qualitySelect.options).some((option) => option.value === quality)) {
    els.qualitySelect.value = quality;
  }
}

// --- Captions / subtitles ---------------------------------------------------
// Uses the documented (if slightly old-style) IFrame "captions" module:
// getOption('captions','tracklist') lists what's available for THIS video,
// loadModule/unloadModule('captions') toggles visibility, and
// setOption('captions','track', {languageCode}) picks the language. Track
// lists can be genuinely empty for videos with no captions/auto-captions
// available in the viewer's region — that's a YouTube-side fact, not a bug.

function refreshCaptionTracks() {
  if (!player || !playerReady) return;
  let tracks = [];
  try {
    tracks = (player.getOption && player.getOption("captions", "tracklist")) || [];
  } catch {
    tracks = [];
  }

  els.captionTrackSelect.innerHTML = "";
  if (!tracks.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No captions available";
    els.captionTrackSelect.appendChild(option);
    els.captionTrackSelect.disabled = true;
    els.ccBtn.disabled = true;
    return;
  }

  els.captionTrackSelect.disabled = false;
  els.ccBtn.disabled = false;
  tracks.forEach((track) => {
    const option = document.createElement("option");
    option.value = track.languageCode;
    option.textContent = track.displayName || track.languageName || track.languageCode;
    els.captionTrackSelect.appendChild(option);
  });
}

function toggleCaptions() {
  if (!player || !playerReady || els.ccBtn.disabled) return;
  captionsOn = !captionsOn;
  try {
    if (captionsOn) {
      const lang = els.captionTrackSelect.value || els.captionTrackSelect.options[0]?.value;
      if (lang) {
        player.loadModule("captions");
        player.setOption("captions", "track", { languageCode: lang });
      }
    } else {
      player.unloadModule("captions");
    }
  } catch {
    // Captions module unavailable for this video/browser — button state still reflects intent.
  }
  updateCaptionButton();
}

function handleCaptionTrackChange() {
  if (!captionsOn) return; // remember the choice; it applies next time captions are turned on
  try {
    player.setOption("captions", "track", { languageCode: els.captionTrackSelect.value });
  } catch {
    // ignore
  }
}

function updateCaptionButton() {
  els.ccBtn.classList.toggle("active", captionsOn);
  els.ccBtn.title = captionsOn ? "Turn captions off" : "Turn captions on";
}

// --- Sleep timer -------------------------------------------------------
// Purely a StudyTube-side feature — no YouTube API involved. Deliberately
// NOT reset on video switch (it's a study-session timer, not a per-video
// setting), only on explicit cancel or once it fires.

function setSleepTimer(value) {
  clearSleepTimer();
  if (!value || value === "off") return;

  if (value === "end") {
    sleepAtVideoEnd = true;
    updateStatus("Sleep timer set — playback will pause after this video ends.");
    return;
  }

  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  sleepTimer = window.setTimeout(triggerSleepTimer, minutes * 60000);
  updateStatus(`Sleep timer set — playback will pause in ${minutes} minutes.`);
}

function clearSleepTimer() {
  if (sleepTimer) window.clearTimeout(sleepTimer);
  sleepTimer = null;
  sleepAtVideoEnd = false;
}

function triggerSleepTimer() {
  sleepTimer = null;
  if (player && playerReady) {
    try {
      player.pauseVideo();
    } catch {
      // ignore
    }
  }
  els.sleepTimerSelect.value = "off";
  updateStatus("Sleep timer reached — playback paused. Good stopping point.", "success");
}

function handleAutoplayBlocked() {
  hideLoading();
  updatePlayerStateText("Ready — browser blocked autoplay; press Play");
  updateStatus("Autoplay was blocked. Use the Play button — that click is the user gesture YouTube can use.");
}

function startProgressLoop() {
  stopProgressLoop();
  progressTimer = window.setInterval(updateProgress, 200);
}

function stopProgressLoop() {
  if (progressTimer) window.clearInterval(progressTimer);
  progressTimer = null;
}

// Progress *persistence* is deliberately decoupled from the 200ms UI-update
// loop above: writing to localStorage every 200ms while a video plays is
// wasteful and pointless (nobody resumes to the exact second). We persist
// every 5s while playing, plus force-saves on pause/switch/hide/unload —
// so the worst case data loss is a few seconds, not a scrubbed position.
function startProgressPersistence() {
  stopProgressPersistence();
  progressSaveTimer = window.setInterval(persistCurrentProgress, 5000);
}

function stopProgressPersistence() {
  if (progressSaveTimer) window.clearInterval(progressSaveTimer);
  progressSaveTimer = null;
}

function updateProgress() {
  if (!player || !playerReady || isSeeking) return;

  try {
    const duration = Number(player.getDuration()) || 0;
    const current = Number(player.getCurrentTime()) || 0;

    els.progressBar.max = Math.max(duration, 1);
    els.progressBar.value = Math.min(current, duration || 1);
    els.currentTime.textContent = formatTime(current);
    els.duration.textContent = formatTime(duration);
  } catch {
    // The API can briefly reject reads while changing playlist items.
  }
}

function loadMedia() {
  const media = parseYouTubeUrl(els.url.value);

  if (!media) {
    updateStatus("Paste a valid YouTube video or playlist URL.", "error");
    return;
  }

  if (!playerApiReady || !player) {
    updateStatus("The YouTube player API is still loading.", "error");
    return;
  }

  if (!playerReady) {
    // Only the latest pre-ready request matters — an earlier queued paste
    // is moot once a newer one has replaced it.
    pendingLoad = () => loadMediaInternal(media);
    updateStatus("Preparing the player…");
    return;
  }

  loadMediaInternal(media);
}

function loadMediaInternal(media) {
  // Every load gets its own generation. Any async work scheduled by an
  // older load checks this before touching shared UI/state, so a slow
  // callback from "Video A" can never clobber "Video C" that loaded after it.
  const generation = ++loadGeneration;

  // Save the OUTGOING video's position before we hand the player new media —
  // read it now, while `player` still reflects the old video (cueVideoById/
  // cuePlaylist below swap it immediately, so this must happen first).
  persistCurrentProgress();
  stopProgressLoop();
  stopProgressPersistence();
  hideResumePrompt(); // a prompt for the old video is meaningless once new media is loading
  captionsOn = false; // captions are per-video; start fresh rather than carrying a stale track over
  updateCaptionButton();

  showLoading("Preparing your study video…");
  els.emptyState.classList.add("hidden");

  currentVideoId = "";
  currentTitle = "";
  currentPlaylistId = "";
  isPlaylist = media.type === "playlist" || media.type === "video+playlist";
  updateFavoriteButton();
  updateControlAvailability();

  const startSeconds = Number.isFinite(media.startSeconds) ? media.startSeconds : 0;
  const startNote = startSeconds > 0 ? `, starting at ${formatTime(startSeconds)}` : "";

  if (media.type === "playlist") {
    currentPlaylistId = media.playlistId;
    els.videoTitle.textContent = "Playlist ready";
    els.videoIdText.textContent = `Playlist: ${media.playlistId}`;
    els.playlistText.textContent = "Playlist loading…";

    // Cue instead of autoplay. This avoids browser autoplay blocking.
    player.cuePlaylist({
      listType: "playlist",
      list: media.playlistId,
      index: media.playlistIndex ?? 0,
      startSeconds
    });

    updateStatus(`Playlist queued${startNote}. Press Play when you are ready.`, "success");
  } else if (media.type === "video+playlist") {
    // Documented policy for URLs carrying both v= and list=: load in
    // *playlist context* (so Previous/Next and the playlist position both
    // work), matching how youtube.com itself opens such links, rather than
    // discarding the playlist and playing the bare video ID. If the URL's
    // index= parameter told us which slot the video occupies we jump
    // straight to it (0-based for the API); otherwise we start the
    // playlist from the top — see README "Known limitations".
    currentPlaylistId = media.playlistId;
    els.videoTitle.textContent = "Video + playlist ready";
    els.videoIdText.textContent = `Playlist: ${media.playlistId} · Video: ${media.videoId}`;
    els.playlistText.textContent = "Playlist loading…";

    player.cuePlaylist({
      listType: "playlist",
      list: media.playlistId,
      index: media.playlistIndex ?? 0,
      startSeconds
    });

    updateStatus(
      `Video + playlist link detected — loaded in playlist context so Previous/Next work${startNote}.`,
      "success"
    );
  } else {
    currentVideoId = media.videoId;
    els.videoTitle.textContent = "Video ready";
    els.videoIdText.textContent = `Video ID: ${media.videoId}`;
    els.playlistText.textContent = "Single video";

    // Cue instead of autoplay. The Play button becomes the intentional user gesture.
    player.cueVideoById({ videoId: media.videoId, startSeconds });

    updateStatus(`Video queued${startNote}. Press Play when you are ready.`, "success");
  }

  // Normal sync happens event-driven, in handlePlayerStateChange (CUED/PLAYING).
  // This is only a watchdog: if the real YouTube events never arrive within a
  // reasonable window (network hiccup, stalled cue), recover the UI instead of
  // leaving a permanent spinner — but only if THIS load is still the active one.
  window.setTimeout(() => {
    if (generation !== loadGeneration) return; // a newer load has since started; ignore
    if (!playerReady) return;
    if (!els.loading.classList.contains("hidden")) {
      syncCurrentMediaFromPlayer();
      refreshSupportedRates();
      updateProgress();
      updateControlAvailability();
      hideLoading();
    }
  }, 4000);
}

function syncCurrentMediaFromPlayer() {
  if (!player || !playerReady) return;

  try {
    const data = player.getVideoData ? player.getVideoData() : null;
    const playerId = data?.video_id || "";
    const title = data?.title || "";

    if (playerId) currentVideoId = playerId;
    if (title) currentTitle = title;

    if (currentTitle) els.videoTitle.textContent = currentTitle;
    if (currentVideoId) {
      els.videoIdText.textContent = isPlaylist
        ? `Playlist: ${currentPlaylistId} · Video: ${currentVideoId}`
        : `Video ID: ${currentVideoId}`;
    }

    updateFavoriteButton();
    updateCompleteButton();
    updatePlaylistText();
  } catch {
    // Ignore transient API reads.
  }
}

function playPause() {
  if (!ensureLoaded()) return;

  try {
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  } catch {
    updateStatus("The player is still preparing. Press Play again in a moment.", "error");
  }
}

function seekBy(seconds) {
  if (!ensureLoaded()) return;

  try {
    const duration = Number(player.getDuration()) || 0;
    const current = Number(player.getCurrentTime()) || 0;
    const next = Math.max(0, Math.min(current + seconds, duration || Infinity));
    player.seekTo(next, true);
    els.progressBar.value = next;
    els.currentTime.textContent = formatTime(next);
  } catch {
    updateStatus("Seeking is temporarily unavailable while the video changes state.", "error");
  }
}

function seekFromSlider(commit = false) {
  if (!ensureLoaded()) return;

  const value = Number(els.progressBar.value) || 0;
  els.currentTime.textContent = formatTime(value);

  if (commit) {
    try {
      player.seekTo(value, true);
    } catch {
      updateStatus("Could not seek to that position.", "error");
    }
  }
}

function setVolume(value) {
  if (!ensureLoaded()) return;
  try {
    const volume = Math.max(0, Math.min(100, Number(value) || 0));
    player.setVolume(volume);
    if (volume > 0 && player.isMuted()) player.unMute();
    updateVolumeUI();
  } catch {
    updateStatus("Volume control is temporarily unavailable.", "error");
  }
}

function toggleMute() {
  if (!ensureLoaded()) return;
  try {
    if (player.isMuted()) player.unMute();
    else player.mute();
    updateVolumeUI();
  } catch {
    updateStatus("Mute control is temporarily unavailable.", "error");
  }
}

function updateVolumeUI() {
  if (!player || !playerReady) return;
  try {
    const muted = player.isMuted();
    const volume = Number(player.getVolume()) || 0;
    els.volumeBar.value = muted ? 0 : volume;
    els.muteBtn.textContent = muted ? "🔇" : "🔊";
    els.muteBtn.title = muted ? "Unmute" : "Mute";
    els.fsVolumeBar.value = muted ? 0 : volume;
    els.fsMuteBtn.textContent = muted ? "🔇" : "🔊";
    els.fsMuteBtn.title = muted ? "Unmute" : "Mute";
  } catch {
    // Ignore transient API read errors.
  }
}

function refreshSupportedRates() {
  if (!player || !playerReady) return;

  let available = [1];
  try {
    const rates = player.getAvailablePlaybackRates();
    if (Array.isArray(rates) && rates.length) available = rates;
  } catch {
    // Keep the safe default of 1x.
  }

  [els.speedSelect, els.fsSpeedSelect].forEach((select) => {
    Array.from(select.options).forEach((option) => {
      const value = Number(option.value);
      option.disabled = !available.includes(value);
    });
  });

  const current = getCurrentRate();
  const value = available.includes(current) ? String(current) : "1";
  els.speedSelect.value = value;
  els.fsSpeedSelect.value = value;

  els.rateSupportText.textContent = `Available: ${available.map(formatRate).join("×, ")}×`;
}

function setSpeed(value) {
  if (!ensureLoaded()) return;

  const requested = Number(value);
  let available = [1];

  try {
    available = player.getAvailablePlaybackRates?.() || [1];
  } catch {
    // Use default.
  }

  if (!available.includes(requested)) {
    updateStatus(`This video does not support ${formatRate(requested)}×.`, "error");
    refreshSupportedRates();
    return;
  }

  try {
    player.setPlaybackRate(requested);
    // The API may round or reject a suggested rate. onPlaybackRateChange updates the UI.
    window.setTimeout(() => {
      const actual = getCurrentRate();
      if (Math.abs(actual - requested) > 0.001) {
        refreshSupportedRates();
        updateStatus(`YouTube kept the supported rate at ${formatRate(actual)}×.`);
      }
    }, 250);
  } catch {
    updateStatus("Playback speed could not be changed for this video.", "error");
  }
}

function getCurrentRate() {
  try {
    return Number(player.getPlaybackRate()) || 1;
  } catch {
    return 1;
  }
}

function playPrevious() {
  if (!ensureLoaded() || !isPlaylist) return;
  try {
    player.previousVideo();
  } catch {
    updateStatus("Previous video is unavailable.", "error");
  }
}

function playNext() {
  if (!ensureLoaded() || !isPlaylist) return;
  try {
    player.nextVideo();
  } catch {
    updateStatus("Next video is unavailable.", "error");
  }
}

// --- Fullscreen state manager -------------------------------------------
// The browser is the single source of truth for fullscreen state. We never
// infer "is fullscreen" from which button was clicked — only from the
// fullscreenchange event — so exiting via Esc, the browser's own exit
// control, or our button all stay in sync automatically.

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function enterFullscreen() {
  const target = els.playerWrap;
  const request = target.requestFullscreen || target.webkitRequestFullscreen;
  if (request) {
    request.call(target).catch(() => {
      updateStatus("Fullscreen could not be started by the browser.", "error");
    });
  } else {
    updateStatus("Fullscreen is not supported in this browser.", "error");
  }
}

function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit) exit.call(document);
}

function toggleFullscreen() {
  if (getFullscreenElement()) exitFullscreen();
  else enterFullscreen();
}

function handleFullscreenChange() {
  isFullscreen = getFullscreenElement() === els.playerWrap;
  els.playerWrap.classList.toggle("is-fullscreen", isFullscreen);
  els.fsOverlay.classList.toggle("hidden", !isFullscreen);
  els.fullscreenBtn.textContent = isFullscreen ? "⤡" : "⛶";
  els.fullscreenBtn.title = isFullscreen ? "Exit fullscreen" : "Fullscreen";
  // Re-run the same sync helpers the main controls use, so the in-fullscreen
  // overlay never drifts from real player state.
  updateMainPlayButton(playerReady && player ? safeGetPlayerState() : null);
  updateVolumeUI();
  refreshSupportedRates();
}

function safeGetPlayerState() {
  try {
    return player.getPlayerState();
  } catch {
    return null;
  }
}

function updateMainPlayButton(state) {
  const playing = state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
  els.playPauseBtn.textContent = playing ? "Ⅱ" : "▶";
  els.playPauseBtn.title = playing ? "Pause" : "Play";
  els.fsPlayPauseBtn.textContent = playing ? "Ⅱ" : "▶";
  els.fsPlayPauseBtn.title = playing ? "Pause" : "Play";
}

function updateControlAvailability() {
  const disabled = !playerReady || !currentVideoId;
  [
    els.playPauseBtn, els.rewindBtn, els.forwardBtn, els.progressBar, els.volumeBar,
    els.muteBtn, els.speedSelect, els.fullscreenBtn, els.qualitySelect,
    els.fsPlayPauseBtn, els.fsRewindBtn, els.fsForwardBtn, els.fsSpeedSelect,
    els.fsMuteBtn, els.fsVolumeBar
  ].forEach((element) => {
    element.disabled = disabled;
  });

  els.prevBtn.disabled = disabled || !isPlaylist;
  els.nextBtn.disabled = disabled || !isPlaylist;

  // Captions controls have their own finer-grained disabled logic
  // (whether THIS video actually has caption tracks) — don't blow that
  // away here; only force them off when there's no video at all.
  if (disabled) {
    els.ccBtn.disabled = true;
    els.captionTrackSelect.disabled = true;
  }
}

function ensureLoaded() {
  if (!playerReady || !player || !currentVideoId) {
    updateStatus("Load a video first.", "error");
    return false;
  }
  return true;
}

// --- YouTube URL parser ---------------------------------------------------
// Returns null for anything invalid/unsupported, or:
//   { type: "video" | "playlist" | "video+playlist",
//     videoId, playlistId, playlistIndex, startSeconds }
// Query parameters are always read with URLSearchParams.get(), which is
// order-independent by construction — a param can appear anywhere in the
// query string. Any parameter we don't explicitly read (si, feature, etc.)
// is silently ignored, so tracking params never affect classification.

const ALLOWED_HOSTS = ["youtube.com", "m.youtube.com", "music.youtube.com"];

function parseYouTubeUrl(rawUrl) {
  const value = (rawUrl || "").trim();
  if (!value) return null;

  // Bare ID paste (no URL at all). isValidVideoId is an exact 11-char
  // charset match and isValidPlaylistId requires only ID-safe characters,
  // so a full URL (which contains ":", "/", ".", "?") can never satisfy
  // either check — safe to try both before attempting URL parsing.
  if (isValidVideoId(value)) return buildMediaResult({ videoId: value });
  if (isValidPlaylistId(value)) return buildMediaResult({ playlistId: value });

  let url;
  try {
    url = new URL(value);
  } catch {
    return null; // not a URL and not a bare ID — unsupported/malformed input
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const params = url.searchParams;

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    if (!isValidVideoId(id)) return null;
    return buildMediaResult({ videoId: id, playlistId: extractPlaylistId(params), params });
  }

  if (!ALLOWED_HOSTS.includes(host)) return null; // do not accept arbitrary domains as YouTube content

  const playlistId = extractPlaylistId(params);
  const watchId = params.get("v");

  if (watchId && isValidVideoId(watchId)) {
    return buildMediaResult({ videoId: watchId, playlistId, params });
  }

  if (url.pathname === "/playlist" && playlistId) {
    return buildMediaResult({ playlistId, params });
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (["shorts", "embed", "live"].includes(parts[0]) && isValidVideoId(parts[1])) {
    return buildMediaResult({ videoId: parts[1], playlistId, params });
  }

  // No usable video ID, but a valid list= survives on its own (e.g. a
  // playlist URL YouTube rewrote with an unrecognized path segment).
  if (playlistId) return buildMediaResult({ playlistId, params });

  return null;
}

function buildMediaResult({ videoId = null, playlistId = null, params = null }) {
  const startSeconds = params ? parseStartSeconds(params) : null;
  const playlistIndex = params ? parsePlaylistIndex(params) : null;

  if (videoId && playlistId) {
    return { type: "video+playlist", videoId, playlistId, playlistIndex, startSeconds };
  }
  if (videoId) {
    return { type: "video", videoId, playlistId: null, playlistIndex: null, startSeconds };
  }
  if (playlistId) {
    return { type: "playlist", videoId: null, playlistId, playlistIndex, startSeconds };
  }
  return null;
}

function extractPlaylistId(params) {
  const id = params.get("list");
  return isValidPlaylistId(id) ? id : null; // malformed list= is dropped, not trusted
}

// Accepts t=90, t=90s, t=2m30s, t=1h2m10s, or a plain start=<seconds>.
// Any malformed value returns null rather than throwing or half-parsing.
function parseStartSeconds(params) {
  const raw = params.get("t") ?? params.get("start");
  if (raw === null || raw === "") return null;
  return parseTimestampToSeconds(raw);
}

function parseTimestampToSeconds(raw) {
  const value = String(raw).trim();

  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match || !(match[1] || match[2] || match[3])) return null;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(total) && total >= 0 ? total : null;
}

// YouTube's own index= query param is 1-based; the IFrame API's
// cuePlaylist/playVideoAt index is 0-based.
function parsePlaylistIndex(params) {
  const raw = params.get("index");
  if (raw === null) return null;
  const oneBased = Number(raw);
  return Number.isInteger(oneBased) && oneBased >= 1 ? oneBased - 1 : null;
}

function isValidVideoId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id);
}

function isValidPlaylistId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{8,200}$/.test(id);
}

function showLoading(message) {
  els.loadingText.textContent = message || "Preparing…";
  els.loading.classList.remove("hidden");
}

function hideLoading() {
  els.loading.classList.add("hidden");
}

function updateStatus(message, type = "") {
  els.status.textContent = message;
  els.status.className = "status";
  if (type) els.status.classList.add(type);
}

function updatePlayerStateText(text) {
  els.playerStateText.textContent = text;
}

function updatePlaylistText() {
  if (!isPlaylist) {
    els.playlistText.textContent = "Single video";
    return;
  }

  try {
    const list = player.getPlaylist?.() || [];
    const index = getPlaylistIndex();
    if (list.length && index >= 0) {
      els.playlistText.textContent = `Playlist · ${index + 1}/${list.length}`;
    } else {
      els.playlistText.textContent = "Playlist";
    }
  } catch {
    els.playlistText.textContent = "Playlist";
  }
}

function getPlaylistIndex() {
  try {
    const index = Number(player.getPlaylistIndex());
    return Number.isFinite(index) ? index : -1;
  } catch {
    return -1;
  }
}

function formatRate(rate) {
  return Number(rate).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function flushPendingLoad() {
  if (!pendingLoad) return;
  const load = pendingLoad;
  pendingLoad = null;
  load();
}

function getHistory() {
  return safeReadArray(STORAGE_KEYS.history);
}

function getFavorites() {
  return safeReadArray(STORAGE_KEYS.favorites);
}

function safeReadArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function safeWriteArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function safeReadObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function safeWriteObject(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- Per-video progress storage (Phase 4) ---------------------------------
// A single dict keyed by videoId: { [videoId]: ProgressRecord }. This is a
// deliberately thin abstraction — localStorage today, but every read/write
// in the app goes through ProgressStore rather than touching localStorage
// directly, so swapping the implementation for IndexedDB later (Phase 10)
// only means rewriting these four methods, not the player/UI logic that
// calls them.
const ProgressStore = {
  _read() {
    return safeReadObject(STORAGE_KEYS.progress);
  },
  _write(map) {
    safeWriteObject(STORAGE_KEYS.progress, map);
  },
  get(videoId) {
    if (!videoId) return null;
    return this._read()[videoId] || null;
  },
  // Merges `patch` into the existing record (creating one if needed) and
  // recomputes progressPercent from position/duration — except completion
  // is tracked as its own flag (see handlePlayerStateChange ENDED and
  // toggleManualCompletion) so rewinding a finished video never silently
  // un-completes it.
  save(videoId, patch) {
    if (!videoId) return null;
    const map = this._read();
    const existing = map[videoId] || {
      videoId,
      positionSeconds: 0,
      durationSeconds: 0,
      progressPercent: 0,
      completed: false,
      lastWatchedAt: 0
    };
    const merged = { ...existing, ...patch, videoId, lastWatchedAt: Date.now() };
    if (merged.durationSeconds > 0) {
      merged.progressPercent = Math.min(100, Math.round((merged.positionSeconds / merged.durationSeconds) * 100));
    }
    if (patch.completed === true) merged.progressPercent = 100;
    map[videoId] = merged;
    this._write(map);
    return merged;
  }
};

// Reads the LIVE player state and persists it — but only if the player's
// actual current video still matches our own currentVideoId. This is the
// guard from Phase 4 section 3: a stale/late call can never overwrite the
// wrong video's progress, because by the time it runs the live check fails.
function persistCurrentProgress() {
  if (!player || !playerReady || !currentVideoId) return;
  let liveId = "";
  let position = 0;
  let duration = 0;
  try {
    const data = player.getVideoData ? player.getVideoData() : null;
    liveId = data?.video_id || "";
    position = Number(player.getCurrentTime()) || 0;
    duration = Number(player.getDuration()) || 0;
  } catch {
    return; // transient API read failure — nothing to persist safely
  }
  if (!liveId || liveId !== currentVideoId) return; // player has already moved on; don't misattribute
  if (duration <= 0) return; // duration not known yet — nothing meaningful to save
  ProgressStore.save(currentVideoId, { positionSeconds: position, durationSeconds: duration });
}

// --- Resume prompt (Phase 4) ----------------------------------------------

function getResumeBehavior() {
  try {
    const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings));
    return settings && ["ask", "always", "never"].includes(settings.resumeBehavior)
      ? settings.resumeBehavior
      : "ask";
  } catch {
    return "ask";
  }
}

function setResumeBehavior(value) {
  const safe = ["ask", "always", "never"].includes(value) ? value : "ask";
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ resumeBehavior: safe }));
}

function maybeOfferResume() {
  if (!currentVideoId) return;

  const saved = ProgressStore.get(currentVideoId);
  if (!saved || !saved.positionSeconds || !saved.durationSeconds) {
    hideResumePrompt();
    return;
  }

  // Resume safety (Phase 4 section 6): don't prompt for a position that's
  // basically the start, basically the end, or already marked complete.
  const nearStart = saved.positionSeconds < 8;
  const nearEnd = saved.durationSeconds - saved.positionSeconds < 5;
  if (nearStart || nearEnd || saved.completed) {
    hideResumePrompt();
    return;
  }

  const behavior = getResumeBehavior();
  if (behavior === "never") {
    hideResumePrompt();
    return;
  }

  if (behavior === "always") {
    applyResume(saved.positionSeconds, currentVideoId);
    hideResumePrompt();
    return;
  }

  resumeContext = { videoId: currentVideoId, positionSeconds: saved.positionSeconds, generation: loadGeneration };
  els.resumePromptText.textContent = `Continue from ${formatTime(saved.positionSeconds)}?`;
  els.resumePrompt.classList.remove("hidden");
}

function hideResumePrompt() {
  resumeContext = null;
  els.resumePrompt.classList.add("hidden");
}

function handleResumeClick() {
  if (!resumeContext) return;
  // If the media changed while this prompt was sitting on screen, the saved
  // position no longer belongs to what's loaded now — drop it silently
  // rather than seeking the wrong video (Phase 4 section 6).
  if (resumeContext.generation !== loadGeneration || resumeContext.videoId !== currentVideoId) {
    hideResumePrompt();
    return;
  }
  applyResume(resumeContext.positionSeconds, resumeContext.videoId);
  hideResumePrompt();
}

function handleStartOverClick() {
  hideResumePrompt();
}

function applyResume(positionSeconds, videoId) {
  if (!player || !playerReady) return;
  try {
    const liveId = player.getVideoData ? player.getVideoData().video_id : "";
    if (liveId !== videoId) return; // stale guard
    player.seekTo(positionSeconds, true);
    updateStatus(`Resumed at ${formatTime(positionSeconds)}.`, "success");
  } catch {
    // Ignore — the player will simply start from wherever it was cued.
  }
}

// --- Manual completion (Phase 4 section 7) --------------------------------

function toggleManualCompletion() {
  if (!currentVideoId) {
    updateStatus("Load a video first.", "error");
    return;
  }
  const saved = ProgressStore.get(currentVideoId);
  const nowCompleted = !(saved && saved.completed);
  ProgressStore.save(currentVideoId, { completed: nowCompleted });
  updateCompleteButton();
  updateStatus(nowCompleted ? "Marked complete." : "Marked incomplete.");
  renderSavedLists();
}

function updateCompleteButton() {
  const saved = currentVideoId ? ProgressStore.get(currentVideoId) : null;
  const completed = Boolean(saved && saved.completed);
  els.completeBtn.classList.toggle("active", completed);
  els.completeBtn.textContent = completed ? "✓ Completed" : "Mark Complete";
}

function saveToHistory(videoId, title) {
  if (!videoId) return;
  // History now carries a snapshot of progress at save time (Phase 4
  // section 9) so the History panel can show "42% watched" / "✓ Completed"
  // without a second lookup. It's a snapshot, not a link — ProgressStore
  // stays the single source of truth for anything the player itself reads.
  const progress = ProgressStore.get(videoId);
  const history = getHistory().filter((item) => item.id !== videoId);
  history.unshift({
    id: videoId,
    title: title || "YouTube video",
    savedAt: Date.now(),
    progressPercent: progress ? progress.progressPercent : 0,
    positionSeconds: progress ? progress.positionSeconds : 0,
    completed: progress ? Boolean(progress.completed) : false
  });
  safeWriteArray(STORAGE_KEYS.history, history.slice(0, 20));
}

// Old history records (pre-Phase 4) only have {id, title, savedAt}. Fill in
// the new fields with safe defaults, once, so nothing downstream has to
// guard against undefined — running this twice is a no-op (idempotent).
function migrateHistoryRecords() {
  const history = getHistory();
  let changed = false;
  const migrated = history.map((item) => {
    if (item.progressPercent !== undefined && item.positionSeconds !== undefined && item.completed !== undefined) {
      return item;
    }
    changed = true;
    return {
      id: item.id,
      title: item.title || "YouTube video",
      savedAt: item.savedAt || Date.now(),
      progressPercent: item.progressPercent ?? 0,
      positionSeconds: item.positionSeconds ?? 0,
      completed: item.completed ?? false
    };
  });
  if (changed) safeWriteArray(STORAGE_KEYS.history, migrated);
}

function isFavorite(videoId) {
  return getFavorites().some((item) => item.id === videoId);
}

function toggleFavorite() {
  if (!currentVideoId) {
    updateStatus("Load a video first.", "error");
    return;
  }

  const favorites = getFavorites();
  const index = favorites.findIndex((item) => item.id === currentVideoId);

  if (index >= 0) {
    favorites.splice(index, 1);
    updateStatus("Removed from favorites.");
  } else {
    favorites.unshift({ id: currentVideoId, title: currentTitle || "YouTube video", savedAt: Date.now() });
    updateStatus("Added to favorites.", "success");
  }

  safeWriteArray(STORAGE_KEYS.favorites, favorites);
  updateFavoriteButton();
  renderSavedLists();
}

function updateFavoriteButton() {
  const active = Boolean(currentVideoId && isFavorite(currentVideoId));
  els.favoriteBtn.classList.toggle("active", active);
  els.favoriteBtn.textContent = active ? "★" : "☆";
  els.favoriteBtn.title = active ? "Remove from favorites" : "Add to favorites";
}

function renderSavedLists() {
  const history = getHistory();
  const favorites = getFavorites();
  els.historyCount.textContent = history.length;
  els.favoriteCount.textContent = favorites.length;
  renderList(els.historyList, history, "history");
  renderList(els.favoriteList, favorites, "favorites");
}

function renderList(container, items, type) {
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = '<div class="empty-list">Nothing saved yet.</div>';
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "saved-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "saved-load";
    button.title = "Load this video";
    button.addEventListener("click", () => {
      els.url.value = `https://www.youtube.com/watch?v=${item.id}`;
      loadMedia();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const thumb = document.createElement("img");
    thumb.className = "saved-thumb";
    thumb.src = `https://i.ytimg.com/vi/${encodeURIComponent(item.id)}/mqdefault.jpg`;
    thumb.alt = "";
    thumb.loading = "lazy";

    const info = document.createElement("span");
    info.className = "saved-info";
    // Live lookup (not the possibly-stale snapshot on the record) so both
    // History and Favorites always reflect current progress/completion.
    const progress = ProgressStore.get(item.id);
    const completed = progress ? Boolean(progress.completed) : Boolean(item.completed);
    const percent = progress ? progress.progressPercent : item.progressPercent || 0;
    const progressLabel = completed ? "✓ Completed" : percent ? `${percent}% watched` : "Not started";
    info.innerHTML = `<span class="saved-title">${escapeHtml(item.title || "YouTube video")}</span><span class="saved-id">${escapeHtml(progressLabel)}</span>`;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-saved";
    deleteButton.textContent = "×";
    deleteButton.title = `Remove from ${type}`;
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeSaved(type, item.id);
    });

    button.append(thumb, info);
    row.append(button, deleteButton);
    container.appendChild(row);
  });
}

function removeSaved(type, id) {
  const key = type === "history" ? STORAGE_KEYS.history : STORAGE_KEYS.favorites;
  safeWriteArray(key, safeReadArray(key).filter((item) => item.id !== id));
  updateFavoriteButton();
  renderSavedLists();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- Appearance (theme / accent / motion) ---------------------------------
// Deliberately isolated from every player/study function above: it only
// ever touches `document.documentElement`'s data-attributes and its own
// localStorage key. It never reads or writes currentVideoId, player state,
// history, favorites, or progress — per the "theme change must never touch
// player state" rule.

function systemPrefersLight() {
  try {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
  } catch {
    return false;
  }
}

// mode "dark"/"light" is an explicit, permanent choice. mode "system" means
// "whatever the OS says, right now" — resolved live, every time this runs,
// never cached — so switching your OS theme while StudyTube is open in
// System mode takes effect without any reload (see the matchMedia listener
// near the bottom of this section).
function resolveActiveTheme(appearance) {
  if (appearance.mode === "light") return appearance.lightTheme;
  if (appearance.mode === "dark") return appearance.darkTheme;
  return systemPrefersLight() ? appearance.lightTheme : appearance.darkTheme;
}

// Migrates the OLDEST single-`theme` appearance shape (before Mode existed
// at all) into the current {mode, darkTheme, lightTheme} shape, WITHOUT
// losing what the person had actually chosen. Returns null if `old` isn't
// that oldest shape (nothing to migrate), so the caller can fall back to
// normal field-by-field validation instead.
function migrateLegacyAppearance(old) {
  if (!old || typeof old.theme !== "string") return null;
  const wasLight = LIGHT_THEMES.includes(old.theme);
  return {
    mode: wasLight ? "light" : "dark",
    darkTheme: !wasLight && DARK_THEMES.includes(old.theme) ? old.theme : DEFAULT_APPEARANCE.darkTheme,
    lightTheme: wasLight ? old.theme : DEFAULT_APPEARANCE.lightTheme,
    accent: ACCENTS.includes(old.accent) ? old.accent : DEFAULT_APPEARANCE.accent,
    motion: old.reduceMotion === true ? "off" : DEFAULT_APPEARANCE.motion
  };
}

function getAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (raw === null) return smartFirstVisitDefault(); // nothing saved yet — see comment below
    const saved = JSON.parse(raw);

    const migrated = migrateLegacyAppearance(saved);
    if (migrated) {
      saveAppearance(migrated); // persist the migration once so it doesn't re-run every load
      return migrated;
    }

    return {
      mode: MODES.includes(saved?.mode) ? saved.mode : DEFAULT_APPEARANCE.mode,
      darkTheme: DARK_THEMES.includes(saved?.darkTheme) ? saved.darkTheme : DEFAULT_APPEARANCE.darkTheme,
      lightTheme: LIGHT_THEMES.includes(saved?.lightTheme) ? saved.lightTheme : DEFAULT_APPEARANCE.lightTheme,
      accent: ACCENTS.includes(saved?.accent) ? saved.accent : DEFAULT_APPEARANCE.accent,
      motion: MOTIONS.includes(saved?.motion) ? saved.motion : DEFAULT_APPEARANCE.motion
    };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

// This is the ONE place a brand-new visitor (nothing saved at all yet) gets
// a live-following default: mode "system", so their very first impression
// already matches their OS. The moment they touch anything in the
// Appearance panel, mode becomes an explicit "light"/"dark" choice and
// StudyTube stops following the OS for them, permanently, until they
// deliberately switch back to "System" themselves.
function smartFirstVisitDefault() {
  return { ...DEFAULT_APPEARANCE, mode: "system" };
}

function saveAppearance(appearance) {
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
}

function applyAppearance(appearance) {
  const activeTheme = resolveActiveTheme(appearance);
  document.documentElement.setAttribute("data-theme", activeTheme);
  document.documentElement.setAttribute("data-motion", appearance.motion);
  if (appearance.accent === "violet") {
    document.documentElement.removeAttribute("data-accent"); // violet IS the default --accent; no override needed
  } else {
    document.documentElement.setAttribute("data-accent", appearance.accent);
  }
  syncAppearanceUI(appearance, activeTheme);
}

function syncAppearanceUI(appearance, activeTheme) {
  document.querySelectorAll(".theme-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.themeChoice === activeTheme);
  });
  document.querySelectorAll(".accent-dot").forEach((dot) => {
    dot.classList.toggle("selected", dot.dataset.accentChoice === appearance.accent);
  });
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.modeChoice === appearance.mode);
  });
  document.querySelectorAll(".motion-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.motionChoice === appearance.motion);
  });
}

// Clicking a dark-theme card is an explicit "I want dark, and specifically
// this one" choice. Clicking a light-theme card (Paper Study or Princess
// Bloom) is an explicit "I want light, and specifically this one" choice.
// Either way it's deliberate, so it always turns System mode off (matches
// how every OS-level app that supports both an explicit theme AND a
// "follow system" option behaves).
function setTheme(theme) {
  const appearance = getAppearance();
  if (LIGHT_THEMES.includes(theme)) {
    appearance.mode = "light";
    appearance.lightTheme = theme;
  } else if (DARK_THEMES.includes(theme)) {
    appearance.mode = "dark";
    appearance.darkTheme = theme;
  } else {
    return; // unrecognized value — ignore rather than corrupt saved state
  }
  saveAppearance(appearance);
  applyAppearance(appearance);
}

function setMode(mode) {
  const appearance = getAppearance();
  appearance.mode = MODES.includes(mode) ? mode : DEFAULT_APPEARANCE.mode;
  saveAppearance(appearance);
  applyAppearance(appearance);
}

function setAccent(accent) {
  const appearance = getAppearance();
  appearance.accent = ACCENTS.includes(accent) ? accent : DEFAULT_APPEARANCE.accent;
  saveAppearance(appearance);
  applyAppearance(appearance);
}

function setMotion(motion) {
  const appearance = getAppearance();
  appearance.motion = MOTIONS.includes(motion) ? motion : DEFAULT_APPEARANCE.motion;
  saveAppearance(appearance);
  applyAppearance(appearance);
}

function resetAppearance() {
  saveAppearance({ ...DEFAULT_APPEARANCE });
  applyAppearance({ ...DEFAULT_APPEARANCE });
  updateStatus("Appearance reset to defaults.");
}

// Live System-mode following: if the OS preference changes WHILE mode is
// "system", re-resolve and re-apply immediately — no reload, no player
// touch. If mode is "light"/"dark" (an explicit choice), this listener
// still fires but applyAppearance() ignores the OS value entirely for
// those modes, so it's a safe no-op.
function watchSystemColorScheme() {
  try {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const appearance = getAppearance();
      if (appearance.mode === "system") applyAppearance(appearance);
    };
    if (query.addEventListener) query.addEventListener("change", handler);
    else if (query.addListener) query.addListener(handler); // older Safari
  } catch {
    // matchMedia unavailable — System mode simply won't live-update; it
    // still resolves correctly on every normal applyAppearance() call.
  }
}

function isAppearancePanelOpen() {
  return !els.appearancePanel.classList.contains("hidden");
}

function toggleAppearancePanel(forceOpen) {
  const open = typeof forceOpen === "boolean" ? forceOpen : !isAppearancePanelOpen();
  els.appearancePanel.classList.toggle("hidden", !open);
  els.appearanceBtn.setAttribute("aria-expanded", String(open));
}


function toggleFocusMode() {
  const active = !document.body.classList.contains("focus-mode");
  document.body.classList.toggle("focus-mode", active);
  els.focusModeBtn.textContent = active ? "Exit Focus Mode" : "Focus Mode";
  els.fsFocusBtn.textContent = active ? "Exit Focus Mode" : "Focus Mode";
}

// Focus Mode is intentionally NEVER auto-restored on page load. It used to
// read a saved on/off flag from localStorage here — but that meant anyone
// who'd ever turned it on landed back in Focus Mode on every future load,
// before any video was even cued, with the URL bar hidden. Every session
// now starts in Normal Mode; the user opts in explicitly, every time.
function restoreFocusMode() {
  document.body.classList.remove("focus-mode");
  els.focusModeBtn.textContent = "Focus Mode";
  els.fsFocusBtn.textContent = "Focus Mode";
}

function clearAllData() {
  if (!window.confirm("Clear StudyTube history and favorites?")) return;
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  document.body.classList.remove("focus-mode");
  els.focusModeBtn.textContent = "Focus Mode";
  els.fsFocusBtn.textContent = "Focus Mode";
  renderSavedLists();
  updateFavoriteButton();
  updateStatus("Saved StudyTube data cleared.");
}

function handleKeyboard(event) {
  // Escape is the universal "get me out" key and must work regardless of
  // whether a video is loaded or the URL input has focus — this is the
  // deliberate third layer of defense against ever being stuck in Focus
  // Mode again (alongside: the Exit button staying visible in CSS, and
  // Focus Mode never auto-restoring on page load).
  if (event.key === "Escape") {
    if (isAppearancePanelOpen()) {
      toggleAppearancePanel(false);
      return;
    }
    if (resumeContext) {
      handleStartOverClick();
      return;
    }
    if (document.body.classList.contains("focus-mode") && !getFullscreenElement()) {
      toggleFocusMode();
    }
    return; // fullscreen Escape is handled natively by the browser + fullscreenchange listener
  }

  const tag = document.activeElement?.tagName?.toLowerCase();
  if (["input", "textarea", "select", "button"].includes(tag)) return;
  if (!currentVideoId) return;

  switch (event.key) {
    case " ":
      event.preventDefault();
      playPause();
      break;
    case "ArrowLeft":
      event.preventDefault();
      seekBy(event.shiftKey ? -10 : -5);
      break;
    case "ArrowRight":
      event.preventDefault();
      seekBy(event.shiftKey ? 10 : 5);
      break;
    case "ArrowUp":
      event.preventDefault();
      setVolume(Math.min(100, Number(els.volumeBar.value) + 5));
      break;
    case "ArrowDown":
      event.preventDefault();
      setVolume(Math.max(0, Number(els.volumeBar.value) - 5));
      break;
    case "m":
    case "M":
      event.preventDefault();
      toggleMute();
      break;
    case "f":
    case "F":
      event.preventDefault();
      toggleFullscreen();
      break;
  }
}

els.loadBtn.addEventListener("click", loadMedia);
els.url.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadMedia();
});
els.playPauseBtn.addEventListener("click", playPause);
els.rewindBtn.addEventListener("click", () => seekBy(-10));
els.forwardBtn.addEventListener("click", () => seekBy(10));
els.prevBtn.addEventListener("click", playPrevious);
els.nextBtn.addEventListener("click", playNext);
els.volumeBar.addEventListener("input", (event) => setVolume(event.target.value));
els.muteBtn.addEventListener("click", toggleMute);
els.speedSelect.addEventListener("change", (event) => setSpeed(event.target.value));
els.fullscreenBtn.addEventListener("click", toggleFullscreen);
els.favoriteBtn.addEventListener("click", toggleFavorite);
els.focusModeBtn.addEventListener("click", toggleFocusMode);
els.clearAllBtn.addEventListener("click", clearAllData);

// Appearance panel
els.appearanceBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleAppearancePanel();
});
els.themeGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".theme-card");
  if (card) setTheme(card.dataset.themeChoice);
});
els.modeRow.addEventListener("click", (event) => {
  const btn = event.target.closest(".mode-btn");
  if (btn) setMode(btn.dataset.modeChoice);
});
els.accentRow.addEventListener("click", (event) => {
  const dot = event.target.closest(".accent-dot");
  if (dot) setAccent(dot.dataset.accentChoice);
});
els.motionRow.addEventListener("click", (event) => {
  const btn = event.target.closest(".motion-btn");
  if (btn) setMotion(btn.dataset.motionChoice);
});
els.resetAppearanceBtn.addEventListener("click", resetAppearance);
document.addEventListener("click", (event) => {
  if (isAppearancePanelOpen() && !els.appearancePanel.contains(event.target) && event.target !== els.appearanceBtn) {
    toggleAppearancePanel(false);
  }
});

// In-fullscreen overlay controls mirror the main controls exactly, so every
// action (play/pause, seek, speed, volume, focus mode, exit) stays available
// once the native Fullscreen API hides everything outside #playerWrap.
els.fsPlayPauseBtn.addEventListener("click", playPause);
els.fsRewindBtn.addEventListener("click", () => seekBy(-10));
els.fsForwardBtn.addEventListener("click", () => seekBy(10));
els.fsSpeedSelect.addEventListener("change", (event) => setSpeed(event.target.value));
els.fsMuteBtn.addEventListener("click", toggleMute);
els.fsVolumeBar.addEventListener("input", (event) => setVolume(event.target.value));
els.fsFocusBtn.addEventListener("click", toggleFocusMode);
els.fsExitBtn.addEventListener("click", exitFullscreen);

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

// Phase 4 — progress/resume/completion controls
els.completeBtn.addEventListener("click", toggleManualCompletion);
els.resumeBtn.addEventListener("click", handleResumeClick);
els.startOverBtn.addEventListener("click", handleStartOverClick);
els.resumeBehaviorSelect.addEventListener("change", (event) => setResumeBehavior(event.target.value));

// Quality / captions / sleep timer
els.qualitySelect.addEventListener("change", (event) => setQuality(event.target.value));
els.ccBtn.addEventListener("click", toggleCaptions);
els.captionTrackSelect.addEventListener("change", handleCaptionTrackChange);
els.sleepTimerSelect.addEventListener("change", (event) => setSleepTimer(event.target.value));

els.progressBar.addEventListener("pointerdown", () => {
  isSeeking = true;
});
els.progressBar.addEventListener("input", () => {
  const value = Number(els.progressBar.value) || 0;
  els.currentTime.textContent = formatTime(value);
});
els.progressBar.addEventListener("pointerup", () => {
  isSeeking = false;
  seekFromSlider(true);
});
els.progressBar.addEventListener("change", () => {
  isSeeking = false;
  seekFromSlider(true);
});

window.addEventListener("keydown", handleKeyboard);
window.addEventListener("beforeunload", () => {
  stopProgressLoop();
  stopProgressPersistence();
  persistCurrentProgress(); // best-effort final save; not guaranteed on every browser/OS
});

// Force-save the instant the tab is hidden (backgrounded, phone locked, tab
// switched) — this is a real "the user might not come back" moment, unlike
// the routine 5s persistence tick, which we let lapse when hidden anyway
// since a hidden tab's setInterval is throttled/unreliable in most browsers.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    persistCurrentProgress();
  }
});

migrateHistoryRecords();
els.resumeBehaviorSelect.value = getResumeBehavior();
updateCaptionButton();
applyAppearance(getAppearance()); // independent of player/study state — safe to run first
watchSystemColorScheme(); // live-update if System mode is active and the OS preference changes
renderSavedLists();
restoreFocusMode();
updateControlAvailability();