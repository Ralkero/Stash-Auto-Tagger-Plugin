(function () {
  "use strict";

  var ROOT_CLASS = "sat-descriptor-review";
  var LAUNCH_CLASS = "sat-descriptor-launch";
  var STORAGE_KEY = "scene-auto-tagger:descriptor-review:v1";
  var VOCABULARY_STORAGE_KEY = "scene-auto-tagger:descriptor-vocabulary:v1";
  var SEEK_STEP_STORAGE_KEY = "scene-auto-tagger:descriptor-seek-step:v1";
  var KEYBIND_STORAGE_KEY = "scene-auto-tagger:descriptor-keybinds:v1";
  var FIELD_ACTS = "r34_sex_acts_positions";
  var FIELD_ENDINGS = "r34_ending_descriptors";
  var FIELD_STATUS = "r34_scene_descriptor_status";
  var FIELD_SOURCE = "r34_scene_descriptor_source";
  var REVIEW_ROUTE = "/plugins/scene-descriptor-review";
  var STORYBOARD_RATIOS = Array.from({ length: 18 }, function (_, index) {
    return (index + 0.5) / 18;
  });
  var KEYBIND_ACTIONS = [
    { id: "play_pause", category: "Playback", label: "Play / Pause", defaultBinding: "Space" },
    { id: "mute", category: "Playback", label: "Mute", defaultBinding: "M" },
    { id: "fullscreen", category: "Playback", label: "Fullscreen", defaultBinding: "F" },
    { id: "loop", category: "Playback", label: "Toggle Loop", defaultBinding: "Shift+L" },
    { id: "volume_up", category: "Playback", label: "Volume Up", defaultBinding: "ArrowUp" },
    { id: "volume_down", category: "Playback", label: "Volume Down", defaultBinding: "ArrowDown" },
    { id: "seek_back", category: "Seeking", label: "Seek Back (step)", defaultBinding: "A" },
    { id: "seek_forward", category: "Seeking", label: "Seek Forward (step)", defaultBinding: "D" },
    { id: "seek_back_standard", category: "Seeking", label: "Seek Back 10s", defaultBinding: "ArrowLeft" },
    { id: "seek_forward_standard", category: "Seeking", label: "Seek Forward 10s", defaultBinding: "ArrowRight" },
    { id: "seek_back_minute", category: "Seeking", label: "Seek Back 60s", defaultBinding: "Ctrl+ArrowLeft" },
    { id: "seek_forward_minute", category: "Seeking", label: "Seek Forward 60s", defaultBinding: "Ctrl+ArrowRight" },
    { id: "seek_back_percent", category: "Seeking", label: "Seek Back 10%", defaultBinding: "[" },
    { id: "seek_forward_percent", category: "Seeking", label: "Seek Forward 10%", defaultBinding: "]" },
    { id: "seek_step_increase", category: "Seeking", label: "Increase Seek Step", defaultBinding: "Ctrl+Plus" },
    { id: "seek_step_decrease", category: "Seeking", label: "Decrease Seek Step", defaultBinding: "Ctrl+Minus" },
    { id: "review_previous", category: "Review", label: "Previous Scene", defaultBinding: "Alt+P" },
    { id: "review_skip", category: "Review", label: "Skip Scene", defaultBinding: "Alt+N" },
    { id: "review_save", category: "Review", label: "Save & Next", defaultBinding: "Ctrl+Enter" },
    { id: "review_not_applicable", category: "Review", label: "Not Applicable", defaultBinding: "Ctrl+Shift+N" },
    { id: "review_undo", category: "Review", label: "Undo Last Save", defaultBinding: "Ctrl+Z" }
  ];
  var baseURL = (document.querySelector("base") && document.querySelector("base").getAttribute("href")) || "/";

  var ACT_ALIASES = {
    "anal doggystyle": "Anal Doggystyle",
    "pov cowgirl": "POV Cowgirl",
    "prone bone": "Prone Bone",
    "standing sex": "Standing Sex",
    "reverse cowgirl": "Reverse Cowgirl",
    "doggy style": "Doggystyle",
    "doggystyle": "Doggystyle",
    "doggy": "Doggystyle",
    "missionary": "Missionary",
    "cowgirl": "Cowgirl",
    "blow job": "Blowjob",
    "blowjob": "Blowjob",
    "bj": "Blowjob",
    "hand job": "Handjob",
    "handjob": "Handjob",
    "hj": "Handjob",
    "paizuri": "Paizuri",
    "tit job": "Paizuri",
    "titjob": "Paizuri",
    "tit fuck": "Paizuri",
    "titfuck": "Paizuri",
    "deep throat": "Deepthroat",
    "deepthroat": "Deepthroat",
    "face sitting": "Facesitting",
    "facesitting": "Facesitting",
    "facesit": "Facesitting",
    "pile driver": "Piledriver",
    "piledriver": "Piledriver",
    "spooning": "Spooning",
    "riding": "Riding",
    "on top": "On Top",
    "foot job": "Footjob",
    "footjob": "Footjob",
    "butt job": "Buttjob",
    "buttjob": "Buttjob",
    "thigh job": "Thighjob",
    "thighjob": "Thighjob",
    "cunnilingus": "Cunnilingus",
    "fingering": "Fingering",
    "masturbation": "Masturbation",
    "anal": "Anal",
    "oral": "Oral",
    "69": "69"
  };

  var ENDING_ALIASES = {
    "loop": "Loop",
    "creampie": "Creampie",
    "cream pie": "Creampie",
    "swallow": "Swallow",
    "swallowing": "Swallow",
    "facial": "Facial",
    "cumshot": "Cumshot",
    "cum shot": "Cumshot"
  };

  function gql(query, variables) {
    return fetch(baseURL + "graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function (response) { return response.json(); }).then(function (payload) {
      if (payload.errors && payload.errors.length) {
        throw new Error(payload.errors.map(function (item) { return item.message; }).join("; "));
      }
      return payload.data;
    });
  }

  function announceDescriptorChange(sceneId, customFields) {
    window.dispatchEvent(new CustomEvent("scene-auto-tagger:descriptors-changed", {
      detail: { sceneId: String(sceneId), customFields: customFields || {} }
    }));
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function uniq(values) {
    var seen = {};
    return (values || []).filter(function (value) {
      var key = normalize(value);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function canonicalValues(aliases) {
    return uniq(Object.keys(aliases).map(function (key) { return aliases[key]; })).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });
  }

  function aliasPattern(alias) {
    var words = String(alias || "").match(/[A-Za-z0-9]+/g) || [];
    if (!words.length) return null;
    var body = words.map(function (word) { return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("[\\s_.-]+");
    return new RegExp("(^|[^A-Za-z0-9])(" + body + ")(?=$|[^A-Za-z0-9])", "ig");
  }

  function extractOrdered(text, aliases) {
    var candidates = [];
    Object.keys(aliases).forEach(function (alias) {
      var pattern = aliasPattern(alias);
      if (!pattern) return;
      var match;
      while ((match = pattern.exec(String(text || "")))) {
        var start = match.index + match[1].length;
        var end = start + match[2].length;
        candidates.push({ start: start, end: end, length: end - start, value: aliases[alias] });
        if (match.index === pattern.lastIndex) pattern.lastIndex++;
      }
    });
    candidates.sort(function (a, b) { return a.start - b.start || b.length - a.length || a.value.localeCompare(b.value); });
    var occupied = [];
    var values = [];
    candidates.forEach(function (item) {
      if (occupied.some(function (span) { return item.start < span.end && item.end > span.start; })) return;
      occupied.push({ start: item.start, end: item.end });
      if (values.indexOf(item.value) === -1) values.push(item.value);
    });
    return values;
  }

  function parseFilenameDescriptors(text) {
    return {
      acts: extractOrdered(text, ACT_ALIASES),
      endings: extractOrdered(text, ENDING_ALIASES)
    };
  }

  function readList(fields, key) {
    var raw = fields && fields[key];
    if (!raw) return [];
    if (Array.isArray(raw)) return uniq(raw.map(String));
    try {
      var parsed = JSON.parse(String(raw));
      if (Array.isArray(parsed)) return uniq(parsed.map(String));
    } catch (ignore) {}
    return uniq(String(raw).split(/[|,]/).map(function (item) { return item.trim(); }));
  }

  function sourceText(scene) {
    var file = scene && scene.files && scene.files[0] || {};
    return [scene && scene.title, file.basename, file.path].filter(Boolean).join(" ");
  }

  function scenePath(scene) {
    return String(scene && scene.files && scene.files[0] && scene.files[0].path || "");
  }

  function isRule34Scene(scene) {
    var path = scenePath(scene).replace(/\//g, "\\");
    return /\\Rule34(?:\\|$)/i.test(path) && !/\\_r34_[^\\]*(?:\\|$)/i.test(path);
  }

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (ignore) { return {}; }
  }

  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (ignore) {}
  }

  function clampSeekStep(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) numeric = 5;
    return Math.max(1, Math.min(60, Math.round(numeric)));
  }

  function loadSeekStep() {
    try { return clampSeekStep(localStorage.getItem(SEEK_STEP_STORAGE_KEY) || 5); } catch (ignore) { return 5; }
  }

  function saveSeekStep(value) {
    try { localStorage.setItem(SEEK_STEP_STORAGE_KEY, String(clampSeekStep(value))); } catch (ignore) {}
  }

  function defaultKeybinds() {
    var defaults = {};
    KEYBIND_ACTIONS.forEach(function (action) { defaults[action.id] = action.defaultBinding; });
    return defaults;
  }

  function loadKeybinds() {
    var bindings = defaultKeybinds();
    try {
      var stored = JSON.parse(localStorage.getItem(KEYBIND_STORAGE_KEY) || "{}");
      KEYBIND_ACTIONS.forEach(function (action) {
        if (Object.prototype.hasOwnProperty.call(stored, action.id) && typeof stored[action.id] === "string") {
          bindings[action.id] = stored[action.id];
        }
      });
    } catch (ignore) {}
    return bindings;
  }

  function saveKeybinds(bindings) {
    try { localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify(bindings || {})); } catch (ignore) {}
  }

  function normalizedEventKey(event) {
    var key = String(event && event.key || "");
    var code = String(event && event.code || "");
    if (key === " " || code === "Space") return "Space";
    if (key === "+" || code === "NumpadAdd" || key === "=" && event.shiftKey) return "Plus";
    if (key === "-" || key === "_" || code === "NumpadSubtract") return "Minus";
    if (key === "Esc") return "Escape";
    if (key.length === 1 && /[a-z]/i.test(key)) return key.toUpperCase();
    return key;
  }

  function eventToBinding(event) {
    if (!event) return "";
    var key = normalizedEventKey(event);
    if (!key || /^(Control|Alt|Shift|Meta)$/i.test(key)) return "";
    var parts = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey && key !== "Plus") parts.push("Shift");
    if (event.metaKey) parts.push("Meta");
    parts.push(key);
    return parts.join("+");
  }

  function actionForEvent(event, bindings) {
    var binding = eventToBinding(event);
    if (!binding) return "";
    var matched = KEYBIND_ACTIONS.find(function (action) {
      return String(bindings && bindings[action.id] || "") === binding;
    });
    return matched ? matched.id : "";
  }

  function keybindAction(actionId) {
    return KEYBIND_ACTIONS.find(function (action) { return action.id === actionId; }) || null;
  }

  function assignKeybind(bindings, actionId, binding) {
    var next = Object.assign({}, bindings || defaultKeybinds());
    var displacedActionId = "";
    KEYBIND_ACTIONS.forEach(function (action) {
      if (action.id !== actionId && binding && next[action.id] === binding) {
        next[action.id] = "";
        displacedActionId = action.id;
      }
    });
    next[actionId] = String(binding || "");
    return { keybinds: next, displacedActionId: displacedActionId };
  }

  function loadDescriptorVocabulary() {
    try {
      var stored = JSON.parse(localStorage.getItem(VOCABULARY_STORAGE_KEY) || "{}");
      return { acts: uniq(stored.acts || []), endings: uniq(stored.endings || []) };
    } catch (ignore) {
      return { acts: [], endings: [] };
    }
  }

  function saveDescriptorVocabulary(vocabulary) {
    try {
      localStorage.setItem(VOCABULARY_STORAGE_KEY, JSON.stringify({
        acts: uniq(vocabulary && vocabulary.acts || []),
        endings: uniq(vocabulary && vocabulary.endings || [])
      }));
    } catch (ignore) {}
  }

  function descriptorVocabularyFromScenes(scenes) {
    var acts = [];
    var endings = [];
    (scenes || []).forEach(function (scene) {
      acts = acts.concat(readList(scene && scene.custom_fields, FIELD_ACTS));
      endings = endings.concat(readList(scene && scene.custom_fields, FIELD_ENDINGS));
    });
    return { acts: uniq(acts), endings: uniq(endings) };
  }

  function fetchReviewScenes(onProgress) {
    var query = "query DescriptorReviewScenes($filter: FindFilterType) { findScenes(filter: $filter) { count scenes { id title custom_fields paths { stream screenshot } files { path basename duration } } } }";
    var page = 1;
    var perPage = 250;
    var all = [];
    function next() {
      return gql(query, { filter: { page: page, per_page: perPage, sort: "id", direction: "ASC" } }).then(function (data) {
        var found = data && data.findScenes || { count: 0, scenes: [] };
        all = all.concat(found.scenes || []);
        if (onProgress) onProgress(all.length, found.count || all.length);
        if (all.length < found.count && (found.scenes || []).length) {
          page++;
          return next();
        }
        return all.filter(isRule34Scene);
      });
    }
    return next();
  }

  function fetchReviewScene(sceneId) {
    var query = "query DescriptorReviewScene($id: ID!) { findScene(id: $id) { id title date details rating100 o_counter organized interactive interactive_speed resume_time captions { language_code caption_type } files { id path basename size width height duration fingerprints { type value } } paths { screenshot preview stream vtt sprite funscript interactive_heatmap caption } sceneStreams { url mime_type label } studio { id name image_path } groups { group { id name front_image_path } scene_index } tags { id name } performers { id name image_path favorite } scene_markers { id title seconds end_seconds primary_tag { id name } tags { id name } } galleries { id title } custom_fields } }";
    return gql(query, { id: String(sceneId) }).then(function (data) {
      if (!data || !data.findScene) throw new Error("Scene " + sceneId + " was not found.");
      return data.findScene;
    });
  }

  function parseVttTime(value) {
    var parts = String(value || "").trim().split(":").map(Number);
    if (parts.some(function (part) { return !Number.isFinite(part); })) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  function parseStoryboardVtt(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n");
    var cues = [];
    for (var index = 0; index < lines.length; index++) {
      if (lines[index].indexOf("-->") === -1) continue;
      var times = lines[index].split("-->");
      var media = "";
      for (var next = index + 1; next < lines.length && lines[next].trim(); next++) {
        if (lines[next].indexOf("#xywh=") !== -1 || /\.(?:jpe?g|png|webp)(?:$|[?#])/i.test(lines[next])) {
          media = lines[next].trim();
          break;
        }
      }
      if (!media) continue;
      var crop = media.match(/#xywh=(\d+),(\d+),(\d+),(\d+)/i);
      cues.push({
        start: parseVttTime(times[0]),
        end: parseVttTime(times[1]),
        image: media.replace(/#xywh=.*$/i, ""),
        x: crop ? Number(crop[1]) : 0,
        y: crop ? Number(crop[2]) : 0,
        width: crop ? Number(crop[3]) : 160,
        height: crop ? Number(crop[4]) : 90
      });
    }
    return cues;
  }

  function selectStoryboardCues(cues, ratios) {
    if (!cues || !cues.length) return [];
    var wanted = ratios || STORYBOARD_RATIOS;
    var duration = Math.max.apply(Math, cues.map(function (cue) { return cue.end; }));
    var selected = [];
    var seen = {};
    wanted.forEach(function (ratio) {
      var target = duration * ratio;
      var best = cues[0];
      var bestDistance = Infinity;
      cues.forEach(function (cue) {
        var midpoint = (cue.start + cue.end) / 2;
        var distance = target >= cue.start && target <= cue.end ? 0 : Math.abs(midpoint - target);
        if (distance < bestDistance) {
          best = cue;
          bestDistance = distance;
        }
      });
      var key = [best.image, best.x, best.y, best.width, best.height].join(":");
      if (!seen[key]) {
        seen[key] = true;
        selected.push(best);
      }
    });
    return selected;
  }

  function storyboardFrameMetrics(pixelData) {
    var pixels = Math.floor((pixelData && pixelData.length || 0) / 4);
    if (!pixels) return { usable: false, mean: 0, deviation: 0, detail: 0, darkRatio: 1, brightRatio: 0, transparentRatio: 1, quality: -Infinity };
    var luminance = new Array(pixels);
    var total = 0;
    var totalSquared = 0;
    var dark = 0;
    var bright = 0;
    var transparent = 0;
    for (var index = 0; index < pixels; index++) {
      var offset = index * 4;
      var alpha = pixelData[offset + 3];
      var value = 0.2126 * pixelData[offset] + 0.7152 * pixelData[offset + 1] + 0.0722 * pixelData[offset + 2];
      luminance[index] = value;
      total += value;
      totalSquared += value * value;
      if (value <= 16) dark++;
      if (value >= 245) bright++;
      if (alpha <= 16) transparent++;
    }
    var mean = total / pixels;
    var deviation = Math.sqrt(Math.max(0, totalSquared / pixels - mean * mean));
    var width = 48;
    var height = Math.max(1, Math.round(pixels / width));
    var detailTotal = 0;
    var detailCount = 0;
    for (var row = 0; row < height; row++) {
      for (var column = 0; column < width; column++) {
        var position = row * width + column;
        if (position >= pixels) break;
        if (column + 1 < width && position + 1 < pixels) {
          detailTotal += Math.abs(luminance[position] - luminance[position + 1]);
          detailCount++;
        }
        if (row + 1 < height && position + width < pixels) {
          detailTotal += Math.abs(luminance[position] - luminance[position + width]);
          detailCount++;
        }
      }
    }
    var detail = detailCount ? detailTotal / detailCount : 0;
    var darkRatio = dark / pixels;
    var brightRatio = bright / pixels;
    var transparentRatio = transparent / pixels;
    var flatFrame = deviation < 4 && detail < 2;
    var usable = transparentRatio < 0.85
      && darkRatio < 0.86
      && mean >= 10
      && !(mean < 22 && deviation < 9 && detail < 4)
      && !(brightRatio > 0.94 && deviation < 7 && detail < 3)
      && !flatFrame;
    var quality = deviation * 1.2 + detail * 1.5 + Math.min(mean, 255 - mean) * 0.15 - darkRatio * 20 - transparentRatio * 40;
    return {
      usable: usable,
      mean: mean,
      deviation: deviation,
      detail: detail,
      darkRatio: darkRatio,
      brightRatio: brightRatio,
      transparentRatio: transparentRatio,
      quality: quality
    };
  }

  function selectScoredStoryboardCues(scoredCues, ratios) {
    var wanted = ratios || STORYBOARD_RATIOS;
    var usable = (scoredCues || []).filter(function (item) { return item && item.metrics && item.metrics.usable; });
    if (!usable.length) return [];
    var duration = Math.max.apply(Math, usable.map(function (item) { return item.cue.end; }));
    var selected = [];
    var selectedKeys = {};
    wanted.forEach(function (ratio, slot) {
      var start = duration * slot / wanted.length;
      var end = duration * (slot + 1) / wanted.length;
      var target = duration * ratio;
      var available = usable.filter(function (item) {
        var key = [item.cue.image, item.cue.x, item.cue.y, item.cue.width, item.cue.height].join(":");
        return !selectedKeys[key];
      });
      var inSlot = available.filter(function (item) {
        var midpoint = (item.cue.start + item.cue.end) / 2;
        return midpoint >= start && midpoint < end;
      });
      var candidates = inSlot.length ? inSlot : available;
      candidates.sort(function (a, b) {
        if (inSlot.length && b.metrics.quality !== a.metrics.quality) return b.metrics.quality - a.metrics.quality;
        var distanceA = Math.abs((a.cue.start + a.cue.end) / 2 - target);
        var distanceB = Math.abs((b.cue.start + b.cue.end) / 2 - target);
        return distanceA - distanceB || b.metrics.quality - a.metrics.quality || a.cue.start - b.cue.start;
      });
      if (!candidates.length) return;
      var chosen = candidates[0];
      var chosenKey = [chosen.cue.image, chosen.cue.x, chosen.cue.y, chosen.cue.width, chosen.cue.height].join(":");
      selectedKeys[chosenKey] = true;
      selected.push(chosen.cue);
    });
    return selected.sort(function (a, b) { return a.start - b.start; });
  }

  function scoreStoryboardCues(cues, vttUrl) {
    var imageCache = {};
    var canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 27;
    var context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return Promise.reject(new Error("Canvas frame inspection is unavailable."));
    function loadImage(url) {
      if (!imageCache[url]) {
        imageCache[url] = new Promise(function (resolve, reject) {
          var image = new Image();
          image.onload = function () { resolve(image); };
          image.onerror = function () { reject(new Error("Storyboard image failed to load.")); };
          image.src = url;
        });
      }
      return imageCache[url];
    }
    return Promise.all((cues || []).map(function (cue) {
      var imageUrl = new URL(cue.image, vttUrl).href;
      return loadImage(imageUrl).then(function (image) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, cue.x, cue.y, cue.width, cue.height, 0, 0, canvas.width, canvas.height);
        return { cue: cue, metrics: storyboardFrameMetrics(context.getImageData(0, 0, canvas.width, canvas.height).data) };
      }).catch(function () { return { cue: cue, metrics: null }; });
    }));
  }

  function selectUsableStoryboardCues(cues, vttUrl, ratios) {
    return scoreStoryboardCues(cues, vttUrl).then(function (scored) {
      var inspected = scored.filter(function (item) { return item.metrics; });
      if (!inspected.length) return selectStoryboardCues(cues, ratios);
      return selectScoredStoryboardCues(inspected, ratios);
    });
  }

  function formatTimestamp(seconds) {
    var total = Math.max(0, Math.round(Number(seconds) || 0));
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var remainder = total % 60;
    return (hours ? hours + ":" + String(minutes).padStart(2, "0") : minutes) + ":" + String(remainder).padStart(2, "0");
  }

  function isReviewPlayerShortcut(event) {
    var key = String(event && event.key || "");
    return Boolean(actionForEvent(event, defaultKeybinds())) || /^[0-9]$/.test(key)
      || key === "MediaTrackNext" || key === "MediaTrackPrevious";
  }

  function seekStepAdjustment(event) {
    var actionId = actionForEvent(event, defaultKeybinds());
    if (actionId === "seek_step_increase") return 1;
    if (actionId === "seek_step_decrease") return -1;
    return 0;
  }

  function applyReviewPlayerAction(actionId, player, options) {
    var media = player && player.querySelector("video");
    if (!media) return false;
    var settings = options || {};
    var preciseSeekStep = clampSeekStep(settings.seekStep || 5);
    function feedback(message) {
      if (typeof settings.onFeedback === "function") settings.onFeedback(message, true);
    }
    var duration = Number(media.duration) || 0;
    var direction = actionId.indexOf("forward") !== -1 ? 1 : -1;

    if (actionId === "seek_back_standard" || actionId === "seek_forward_standard") {
      media.currentTime = Math.max(0, Math.min(duration || Infinity, media.currentTime + direction * 10));
      feedback((direction > 0 ? "+" : "-") + "10s");
      return true;
    }
    if (actionId === "seek_back_minute" || actionId === "seek_forward_minute") {
      media.currentTime = Math.max(0, Math.min(duration || Infinity, media.currentTime + direction * 60));
      feedback((direction > 0 ? "+" : "-") + "60s");
      return true;
    }
    if (actionId === "loop") {
      media.loop = !media.loop;
      return true;
    }
    if (actionId === "seek_back" || actionId === "seek_forward") {
      media.currentTime = Math.max(0, Math.min(duration || Infinity, media.currentTime + direction * preciseSeekStep));
      feedback((direction > 0 ? "+" : "-") + preciseSeekStep + "s");
      return true;
    }
    if (actionId === "play_pause") {
      if (media.paused) {
        var playPromise = media.play();
        if (playPromise && playPromise.catch) playPromise.catch(function () {});
      } else {
        media.pause();
      }
      return true;
    }
    if (actionId === "volume_up" || actionId === "volume_down") {
      media.volume = Math.max(0, Math.min(1, media.volume + (actionId === "volume_up" ? 0.1 : -0.1)));
      return true;
    }
    if (actionId === "mute") {
      media.muted = !media.muted;
      return true;
    }
    if (actionId === "fullscreen") {
      var fullscreen = player.querySelector(".vjs-fullscreen-control");
      if (fullscreen) fullscreen.click();
      else if (player.requestFullscreen) player.requestFullscreen().catch(function () {});
      return true;
    }
    if ((actionId === "seek_back_percent" || actionId === "seek_forward_percent") && duration) {
      media.currentTime = Math.max(0, Math.min(duration, media.currentTime + duration * direction * 0.1));
      feedback((direction > 0 ? "+" : "-") + "10%");
      return true;
    }
    return false;
  }

  function applyReviewPlayerShortcut(event, player, options) {
    var actionId = actionForEvent(event, defaultKeybinds());
    if (actionId && applyReviewPlayerAction(actionId, player, options)) return true;
    var media = player && player.querySelector("video");
    var key = String(event && event.key || "");
    var duration = Number(media && media.duration) || 0;
    if (/^[0-9]$/.test(key) && !event.ctrlKey && !event.altKey && !event.metaKey && duration) {
      media.currentTime = duration * Number(key) / 10;
      if (options && typeof options.onFeedback === "function") options.onFeedback("Seek " + (Number(key) * 10) + "%", true);
      return true;
    }
    if (key === "MediaTrackNext" || key === "MediaTrackPrevious") {
      var selector = key === "MediaTrackNext" ? ".vjs-icon-next-item" : ".vjs-icon-previous-item";
      var skip = player && player.querySelector(selector);
      if (skip) skip.click();
      return Boolean(skip);
    }
    return false;
  }

  function updateDescriptorFields(scene, acts, endings, status) {
    var mutation = "mutation SaveDescriptorReview($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id custom_fields } }";
    var partial = {};
    partial[FIELD_ACTS] = JSON.stringify(uniq(acts));
    partial[FIELD_ENDINGS] = JSON.stringify(uniq(endings));
    partial[FIELD_STATUS] = status;
    partial[FIELD_SOURCE] = "manual_review";
    return gql(mutation, { input: { id: String(scene.id), custom_fields: { partial: partial } } });
  }

  function restoreDescriptorFields(sceneId, previous) {
    var mutation = "mutation UndoDescriptorReview($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id custom_fields } }";
    var partial = {};
    var remove = [];
    [FIELD_ACTS, FIELD_ENDINGS, FIELD_STATUS, FIELD_SOURCE].forEach(function (key) {
      if (previous && Object.prototype.hasOwnProperty.call(previous, key)) partial[key] = previous[key];
      else remove.push(key);
    });
    var custom = {};
    if (Object.keys(partial).length) custom.partial = partial;
    if (remove.length) custom.remove = remove;
    return gql(mutation, { input: { id: String(sceneId), custom_fields: custom } });
  }

  function currentSelection(scene) {
    var fields = scene.custom_fields || {};
    var detected = parseFilenameDescriptors(sourceText(scene));
    var acts = readList(fields, FIELD_ACTS);
    var endings = readList(fields, FIELD_ENDINGS);
    return {
      acts: acts.length ? acts : detected.acts,
      endings: endings.length ? endings : detected.endings,
      detectedActs: detected.acts,
      detectedEndings: detected.endings
    };
  }

  function openReview() {
    window.location.assign(baseURL.replace(/\/?$/, "/") + REVIEW_ROUTE.replace(/^\//, ""));
  }

  function registerReviewPage() {
    var api = window.PluginApi;
    if (!api || !api.React || !api.register || !api.register.route || window.__satDescriptorReviewRegistered) return;
    window.__satDescriptorReviewRegistered = true;
    var React = api.React;
    var h = React.createElement;
    var scenePlayerPromise;
    try {
      var scenePlayerLoader = api.loadableComponents && api.loadableComponents.ScenePlayer
        || api.components && api.components.ScenePlayer;
      scenePlayerPromise = scenePlayerLoader
        ? Promise.resolve(scenePlayerLoader()).then(function (module) { return module && (module.ScenePlayer || module.default || module); })
        : Promise.reject(new Error("Stash ScenePlayer is unavailable."));
    } catch (error) {
      scenePlayerPromise = Promise.reject(error);
    }

    function ChipEditor(props) {
      var searchState = React.useState("");
      var search = searchState[0];
      var setSearch = searchState[1];
      var available = uniq(props.values.concat(props.selected)).sort(function (a, b) {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      });
      var query = normalize(search);
      var visible = available.filter(function (value) { return !query || normalize(value).indexOf(query) !== -1; });

      function toggle(value) {
        props.onChange(props.selected.indexOf(value) === -1
          ? props.selected.concat([value])
          : props.selected.filter(function (item) { return item !== value; }));
      }

      function addTyped(event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        var typed = String(search || "").trim().replace(/\s+/g, " ");
        if (!typed) return;
        var existing = available.filter(function (value) { return normalize(value) === normalize(typed); })[0];
        var value = existing || typed.replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
        if (!existing && props.onAddValue) props.onAddValue(value);
        if (props.selected.indexOf(value) === -1) props.onChange(props.selected.concat([value]));
        setSearch("");
      }

      return h("section", { className: "sat-descriptor-section " + props.className },
        h("h3", null, props.title),
        h("input", {
          className: "sat-descriptor-search",
          type: "search",
          value: search,
          placeholder: "Type to filter or add a value",
          onChange: function (event) { setSearch(event.target.value); },
          onKeyDown: addTyped
        }),
        h("div", { className: "sat-descriptor-chips" }, visible.map(function (value) {
          return h("button", {
            key: value,
            type: "button",
            className: "sat-descriptor-chip",
            "aria-pressed": props.selected.indexOf(value) !== -1 ? "true" : "false",
            onClick: function () { toggle(value); }
          }, value);
        }))
      );
    }

    function FallbackPlayer(props) {
      var videoRef = React.useRef(null);
      React.useEffect(function () {
        props.sendSetTimestamp(function (seconds) {
          if (videoRef.current) videoRef.current.currentTime = Math.max(0, Number(seconds) || 0);
        });
        return function () { props.sendSetTimestamp(null); };
      }, [props.sendSetTimestamp]);
      return h("video", {
        ref: videoRef,
        className: "sat-descriptor-video",
        src: props.scene.paths && props.scene.paths.stream || "",
        poster: props.scene.paths && props.scene.paths.screenshot || "",
        controls: true,
        autoPlay: true,
        preload: "metadata"
      });
    }

    function ReviewPlayer(props) {
      var componentState = React.useState(null);
      var ScenePlayer = componentState[0];
      var setScenePlayer = componentState[1];
      var errorState = React.useState("");
      var error = errorState[0];
      var setError = errorState[1];
      React.useEffect(function () {
        var cancelled = false;
        var fallbackTimer = window.setTimeout(function () {
          if (!cancelled) setError("Stash player took too long to load; using the basic fallback player.");
        }, 5000);
        scenePlayerPromise.then(function (component) {
          if (cancelled) return;
          window.clearTimeout(fallbackTimer);
          setScenePlayer(function () { return component; });
        }).catch(function (reason) {
          if (cancelled) return;
          window.clearTimeout(fallbackTimer);
          setError(String(reason && reason.message || reason));
        });
        return function () { cancelled = true; window.clearTimeout(fallbackTimer); };
      }, []);

      if (error) return h("div", { className: "sat-descriptor-player-fallback" },
        h(FallbackPlayer, { scene: props.scene, sendSetTimestamp: props.sendSetTimestamp }),
        h("small", null, error)
      );
      if (!ScenePlayer) return h("div", { className: "sat-descriptor-player-loading" }, "Loading Stash player...");
      return h(ScenePlayer, {
        scene: props.scene,
        hideScrubberOverride: false,
        autoplay: true,
        permitLoop: true,
        sendSetTimestamp: props.sendSetTimestamp,
        onComplete: function () {},
        onNext: props.onNext,
        onPrevious: props.onPrevious
      });
    }

    function StoryboardFrame(props) {
      var sizeState = React.useState(null);
      var imageSize = sizeState[0];
      var setImageSize = sizeState[1];
      var imageUrl = new URL(props.cue.image, props.vttUrl).href;
      React.useEffect(function () {
        var cancelled = false;
        var image = new Image();
        image.onload = function () {
          if (!cancelled) setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
        };
        image.src = imageUrl;
        return function () { cancelled = true; };
      }, [imageUrl]);
      var cue = props.cue;
      var style = {
        aspectRatio: cue.width + " / " + cue.height,
        backgroundImage: 'url("' + imageUrl.replace(/"/g, "%22") + '")'
      };
      if (imageSize) {
        style.backgroundSize = (imageSize.width / cue.width * 100) + "% " + (imageSize.height / cue.height * 100) + "%";
        style.backgroundPosition = (imageSize.width === cue.width ? 0 : cue.x / (imageSize.width - cue.width) * 100) + "% " + (imageSize.height === cue.height ? 0 : cue.y / (imageSize.height - cue.height) * 100) + "%";
      }
      return h("button", {
        type: "button",
        className: "sat-descriptor-storyboard-frame" + (imageSize ? " is-ready" : ""),
        title: "Seek to " + formatTimestamp(cue.start),
        "aria-label": "Seek to " + formatTimestamp(cue.start),
        onClick: function () { props.onSeek(cue.start); }
      },
        h("span", { className: "sat-descriptor-storyboard-image", style: style }),
        h("span", { className: "sat-descriptor-storyboard-time" }, formatTimestamp(cue.start))
      );
    }

    function SceneStoryboard(props) {
      var cueState = React.useState([]);
      var cues = cueState[0];
      var setCues = cueState[1];
      var statusState = React.useState(props.vttUrl ? "Loading scene overview..." : "Scene overview unavailable");
      var storyboardStatus = statusState[0];
      var setStoryboardStatus = statusState[1];
      React.useEffect(function () {
        var cancelled = false;
        setCues([]);
        if (!props.vttUrl) {
          setStoryboardStatus("Scene overview unavailable");
          return function () { cancelled = true; };
        }
        setStoryboardStatus("Loading scene overview...");
        fetch(props.vttUrl, { credentials: "same-origin" }).then(function (response) {
          if (!response.ok) throw new Error("Storyboard request failed with " + response.status);
          return response.text();
        }).then(function (text) {
          if (cancelled) return;
          setStoryboardStatus("Checking overview frames...");
          var parsed = parseStoryboardVtt(text);
          return selectUsableStoryboardCues(parsed, props.vttUrl).then(function (selected) {
            if (cancelled) return;
            setCues(selected);
            setStoryboardStatus(selected.length ? "" : "No usable overview frames found");
          });
        }).catch(function () {
          if (!cancelled) setStoryboardStatus("Scene overview unavailable");
        });
        return function () { cancelled = true; };
      }, [props.vttUrl]);
      return h("section", { className: "sat-descriptor-storyboard", "aria-label": "Scene overview" },
        h("div", { className: "sat-descriptor-storyboard-heading" },
          h("strong", null, "Scene Overview"),
          cues.length > 0 && h("span", null, cues.length + " frames")
        ),
        storyboardStatus && h("div", { className: "sat-descriptor-storyboard-status" }, storyboardStatus),
        cues.length > 0 && h("div", { className: "sat-descriptor-storyboard-grid" }, cues.map(function (cue, index) {
          return h(StoryboardFrame, { key: cue.start + ":" + index, cue: cue, vttUrl: props.vttUrl, onSeek: props.onSeek });
        }))
      );
    }

    function KeybindPanel(props) {
      var categories = ["Playback", "Seeking", "Review"];
      return h("section", { className: "sat-descriptor-keybind-panel", "aria-label": "Keyboard shortcut settings" },
        h("div", { className: "sat-descriptor-keybind-header" },
          h("h3", null, "Keyboard Shortcuts"),
          h("button", {
            type: "button",
            className: "sat-descriptor-keybind-reset",
            title: "Restore every descriptor-review shortcut to its default",
            onClick: props.onReset
          }, "Reset Defaults")
        ),
        categories.map(function (category) {
          return h("div", { key: category, className: "sat-descriptor-keybind-group" },
            h("div", { className: "sat-descriptor-keybind-category" }, category),
            KEYBIND_ACTIONS.filter(function (action) { return action.category === category; }).map(function (action) {
              var recording = props.recordingAction === action.id;
              var binding = props.bindings[action.id] || "Unassigned";
              return h("div", { key: action.id, className: "sat-descriptor-keybind-row" + (recording ? " is-recording" : "") },
                h("span", null, action.label),
                h("button", {
                  type: "button",
                  className: "sat-descriptor-keybind-value",
                  "aria-pressed": recording,
                  title: recording ? "Press a key combination, Delete to clear, or Escape to cancel" : "Click to rebind " + action.label,
                  onClick: function () { props.onRecord(action.id); }
                }, recording ? "Press keys..." : binding)
              );
            })
          );
        }),
        h("div", { className: "sat-descriptor-keybind-native" },
          h("span", null, "Timeline percentage"),
          h("kbd", null, "0-9"),
          h("small", null, "Native player shortcut")
        ),
        h("p", { className: "sat-descriptor-keybind-help" }, "Click a binding and press a key combination. Delete clears it; Esc cancels.")
      );
    }

    function DescriptorReviewPage() {
      var queueState = React.useState(null);
      var scenes = queueState[0];
      var setScenes = queueState[1];
      var indexState = React.useState(0);
      var index = indexState[0];
      var setIndex = indexState[1];
      var totalState = React.useState(0);
      var totalRule34 = totalState[0];
      var setTotalRule34 = totalState[1];
      var detailState = React.useState(null);
      var detail = detailState[0];
      var setDetail = detailState[1];
      var loadingState = React.useState("Loading Rule34 scenes...");
      var loading = loadingState[0];
      var setLoading = loadingState[1];
      var statusState = React.useState("");
      var status = statusState[0];
      var setStatus = statusState[1];
      var errorState = React.useState("");
      var error = errorState[0];
      var setError = errorState[1];
      var busyState = React.useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];
      var historyState = React.useState([]);
      var history = historyState[0];
      var setHistory = historyState[1];
      var actsState = React.useState([]);
      var acts = actsState[0];
      var setActs = actsState[1];
      var endingsState = React.useState([]);
      var endings = endingsState[0];
      var setEndings = endingsState[1];
      var knownActsState = React.useState(function () {
        return uniq(canonicalValues(ACT_ALIASES).concat(loadDescriptorVocabulary().acts));
      });
      var knownActs = knownActsState[0];
      var setKnownActs = knownActsState[1];
      var knownEndingsState = React.useState(function () {
        return uniq(canonicalValues(ENDING_ALIASES).concat(loadDescriptorVocabulary().endings));
      });
      var knownEndings = knownEndingsState[0];
      var setKnownEndings = knownEndingsState[1];
      var seekStepState = React.useState(loadSeekStep);
      var preciseSeekStep = seekStepState[0];
      var setPreciseSeekStep = seekStepState[1];
      var keybindState = React.useState(loadKeybinds);
      var keybinds = keybindState[0];
      var setKeybinds = keybindState[1];
      var recordingState = React.useState("");
      var recordingAction = recordingState[0];
      var setRecordingAction = recordingState[1];
      var seekFeedbackState = React.useState(null);
      var seekFeedback = seekFeedbackState[0];
      var setSeekFeedback = seekFeedbackState[1];
      var playerSeek = React.useRef(null);
      var seekFeedbackTimer = React.useRef(null);
      var lastExplicitSeekFeedback = React.useRef(0);
      var current = scenes && scenes[index];

      var showSeekFeedback = React.useCallback(function (message, explicit) {
        if (explicit) lastExplicitSeekFeedback.current = Date.now();
        if (seekFeedbackTimer.current) window.clearTimeout(seekFeedbackTimer.current);
        setSeekFeedback({ message: String(message || ""), nonce: Date.now() });
        seekFeedbackTimer.current = window.setTimeout(function () { setSeekFeedback(null); }, 850);
      }, []);

      React.useEffect(function () {
        return function () {
          if (seekFeedbackTimer.current) window.clearTimeout(seekFeedbackTimer.current);
        };
      }, []);

      React.useEffect(function () {
        var cancelled = false;
        fetchReviewScenes(function (loaded, total) {
          if (!cancelled) setLoading("Loading Rule34 scenes: " + loaded + " / " + total);
        }).then(function (allScenes) {
          if (cancelled) return;
          var pending = allScenes.filter(function (scene) {
            var reviewStatus = String(scene.custom_fields && scene.custom_fields[FIELD_STATUS] || "");
            return reviewStatus !== "reviewed" && reviewStatus !== "not_applicable";
          });
          var saved = loadState();
          var savedIndex = pending.findIndex(function (scene) { return String(scene.id) === String(saved.sceneId || ""); });
          if (savedIndex < 0) savedIndex = Math.max(0, Math.min(Number(saved.index || 0), Math.max(0, pending.length - 1)));
          var libraryVocabulary = descriptorVocabularyFromScenes(allScenes);
          setKnownActs(function (existing) { return uniq(existing.concat(libraryVocabulary.acts)); });
          setKnownEndings(function (existing) { return uniq(existing.concat(libraryVocabulary.endings)); });
          setTotalRule34(allScenes.length);
          setScenes(pending);
          setIndex(savedIndex);
          setLoading("");
        }).catch(function (reason) {
          if (!cancelled) setError(String(reason && reason.message || reason));
        });
        return function () { cancelled = true; };
      }, []);

      React.useEffect(function () {
        if (!current) {
          setDetail(null);
          return undefined;
        }
        var cancelled = false;
        setDetail(null);
        setError("");
        fetchReviewScene(current.id).then(function (scene) {
          if (cancelled) return;
          setDetail(scene);
          var selection = currentSelection(scene);
          setActs(selection.acts);
          setEndings(selection.endings);
        }).catch(function (reason) {
          if (!cancelled) setError(String(reason && reason.message || reason));
        });
        return function () { cancelled = true; };
      }, [current && current.id]);

      React.useEffect(function () {
        if (!current) return;
        saveState({ index: index, sceneId: current.id, updatedAt: new Date().toISOString() });
      }, [current && current.id, index]);

      React.useEffect(function () {
        saveDescriptorVocabulary({ acts: knownActs, endings: knownEndings });
      }, [knownActs, knownEndings]);

      React.useEffect(function () {
        saveSeekStep(preciseSeekStep);
      }, [preciseSeekStep]);

      React.useEffect(function () {
        saveKeybinds(keybinds);
      }, [keybinds]);

      var registerSeek = React.useCallback(function (setter) { playerSeek.current = setter; }, []);
      function seek(seconds) {
        if (typeof playerSeek.current !== "function") return;
        showSeekFeedback("Seek " + formatTimestamp(seconds), true);
        playerSeek.current(seconds);
      }
      function go(delta) {
        if (!scenes || !scenes.length || busy) return;
        setStatus("");
        setIndex(Math.max(0, Math.min(index + delta, scenes.length - 1)));
      }

      React.useEffect(function () {
        function onKeyDown(event) {
          if (recordingAction) {
            event.preventDefault();
            event.stopPropagation();
            var capturedKey = normalizedEventKey(event);
            if (/^(Control|Alt|Shift|Meta)$/i.test(capturedKey)) return;
            if (capturedKey === "Escape") {
              setRecordingAction("");
              setStatus("Shortcut change cancelled.");
              return;
            }
            if (capturedKey === "Backspace" || capturedKey === "Delete") {
              setKeybinds(function (existing) { return assignKeybind(existing, recordingAction, "").keybinds; });
              setRecordingAction("");
              setStatus("Cleared shortcut for " + (keybindAction(recordingAction) || {}).label + ".");
              return;
            }
            var capturedBinding = eventToBinding(event);
            if (!capturedBinding) return;
            var assignment = assignKeybind(keybinds, recordingAction, capturedBinding);
            var displaced = keybindAction(assignment.displacedActionId);
            setKeybinds(assignment.keybinds);
            setRecordingAction("");
            setStatus("Set " + (keybindAction(recordingAction) || {}).label + " to " + capturedBinding + "." + (displaced ? " Cleared the conflicting " + displaced.label + " binding." : ""));
            return;
          }

          var actionId = actionForEvent(event, keybinds);
          var player = document.querySelector(".sat-descriptor-player-host .VideoPlayer");
          var handled = false;
          if (actionId === "seek_step_increase" || actionId === "seek_step_decrease") {
            var adjustment = actionId === "seek_step_increase" ? 1 : -1;
            var nextStep = clampSeekStep(preciseSeekStep + adjustment);
            setPreciseSeekStep(nextStep);
            showSeekFeedback("Seek step: " + nextStep + "s", true);
            handled = true;
          } else if (actionId === "review_previous") {
            go(-1);
            handled = true;
          } else if (actionId === "review_skip") {
            go(1);
            handled = true;
          } else if (actionId === "review_save") {
            saveCurrent(acts, endings, "reviewed");
            handled = Boolean(detail && !busy);
          } else if (actionId === "review_not_applicable") {
            saveCurrent([], [], "not_applicable");
            handled = Boolean(detail && !busy);
          } else if (actionId === "review_undo") {
            undoLast();
            handled = Boolean(history.length && !busy);
          } else if (actionId && player) {
            handled = applyReviewPlayerAction(actionId, player, { seekStep: preciseSeekStep, onFeedback: showSeekFeedback });
          } else if (!actionId && player && /^[0-9]$/.test(String(event.key || ""))) {
            handled = applyReviewPlayerShortcut(event, player, { seekStep: preciseSeekStep, onFeedback: showSeekFeedback });
          }
          if (!handled) return;
          var editable = event.target && (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable);
          var reviewAction = actionId && actionId.indexOf("review_") === 0;
          if (!editable || event.ctrlKey || event.altKey || event.metaKey || reviewAction) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
        window.addEventListener("keydown", onKeyDown, true);
        return function () { window.removeEventListener("keydown", onKeyDown, true); };
      }, [acts, endings, busy, detail, history, index, keybinds, preciseSeekStep, recordingAction, scenes, showSeekFeedback]);

      React.useEffect(function () {
        if (!detail) return undefined;
        var cancelled = false;
        var media = null;
        var retryTimer = null;
        function onSeeking() {
          if (Date.now() - lastExplicitSeekFeedback.current < 180) return;
          showSeekFeedback("Seek " + formatTimestamp(media && media.currentTime), false);
        }
        function attach() {
          if (cancelled) return;
          media = document.querySelector(".sat-descriptor-player-host video");
          if (media) media.addEventListener("seeking", onSeeking);
          else retryTimer = window.setTimeout(attach, 100);
        }
        attach();
        return function () {
          cancelled = true;
          if (retryTimer) window.clearTimeout(retryTimer);
          if (media) media.removeEventListener("seeking", onSeeking);
        };
      }, [detail && detail.id, showSeekFeedback]);

      function saveCurrent(actValues, endingValues, reviewStatus) {
        if (!detail || busy) return;
        var previous = {};
        [FIELD_ACTS, FIELD_ENDINGS, FIELD_STATUS, FIELD_SOURCE].forEach(function (key) {
          if (detail.custom_fields && Object.prototype.hasOwnProperty.call(detail.custom_fields, key)) previous[key] = detail.custom_fields[key];
        });
        setBusy(true);
        setStatus("Saving scene " + detail.id + "...");
        updateDescriptorFields(detail, actValues, endingValues, reviewStatus).then(function (data) {
          var savedFields = data && data.sceneUpdate && data.sceneUpdate.custom_fields || detail.custom_fields || {};
          detail.custom_fields = savedFields;
          current.custom_fields = savedFields;
          announceDescriptorChange(detail.id, savedFields);
          setHistory(history.concat([{ sceneId: String(detail.id), scene: detail, queueScene: current, index: index, previous: previous }]));
          var nextScenes = scenes.slice();
          nextScenes.splice(index, 1);
          setScenes(nextScenes);
          setIndex(Math.max(0, Math.min(index, nextScenes.length - 1)));
          setStatus("Saved scene " + detail.id + ".");
        }).catch(function (reason) {
          setError(String(reason && reason.message || reason));
        }).then(function () { setBusy(false); });
      }

      function undoLast() {
        if (!history.length || busy) return;
        var item = history[history.length - 1];
        setBusy(true);
        setStatus("Restoring scene " + item.sceneId + "...");
        restoreDescriptorFields(item.sceneId, item.previous).then(function (data) {
          var restored = data && data.sceneUpdate && data.sceneUpdate.custom_fields || item.previous;
          item.scene.custom_fields = restored || {};
          item.queueScene.custom_fields = restored || {};
          announceDescriptorChange(item.sceneId, restored);
          var restoreIndex = Math.max(0, Math.min(item.index, scenes.length));
          var nextScenes = scenes.slice();
          nextScenes.splice(restoreIndex, 0, item.queueScene);
          setScenes(nextScenes);
          setIndex(restoreIndex);
          setHistory(history.slice(0, -1));
          setStatus("Restored scene " + item.sceneId + ".");
        }).catch(function (reason) {
          setError(String(reason && reason.message || reason));
        }).then(function () { setBusy(false); });
      }

      var detected = detail ? parseFilenameDescriptors(sourceText(detail)) : { acts: [], endings: [] };
      var sceneTitle = detail && (detail.title || detail.files && detail.files[0] && detail.files[0].basename || "Scene " + detail.id);
      return h("main", { className: ROOT_CLASS + " sat-descriptor-review-page" },
        h("header", { className: "sat-descriptor-header" },
          h("div", { className: "sat-descriptor-heading" },
            h("strong", null, "Scene Descriptor Review"),
            scenes && h("span", { className: "sat-descriptor-progress" }, scenes.length ? (index + 1) + " / " + scenes.length + " pending (" + totalRule34 + " scanned)" : "Complete")
          ),
          h("button", { type: "button", className: "sat-descriptor-icon", title: "Close descriptor review", "aria-label": "Close descriptor review", onClick: function () { window.location.assign(baseURL.replace(/\/?$/, "/") + "scenes"); } }, "x")
        ),
        error && h("div", { className: "sat-descriptor-route-error" }, error),
        !scenes && !error && h("div", { className: "sat-descriptor-loading" }, loading),
        scenes && !scenes.length && h("div", { className: "sat-descriptor-complete" },
          h("strong", null, "No unreviewed Rule34 scenes remain."),
          h("span", null, totalRule34 + " Rule34 scenes checked.")
        ),
        scenes && scenes.length > 0 && h("div", { className: "sat-descriptor-body" },
          h("section", { className: "sat-descriptor-player-pane" },
            h("div", { className: "sat-descriptor-player-host" },
              detail ? h(ReviewPlayer, { key: detail.id, scene: detail, sendSetTimestamp: registerSeek, onNext: function () { go(1); }, onPrevious: function () { go(-1); } }) : h("div", { className: "sat-descriptor-player-loading" }, "Loading scene..."),
              seekFeedback && h("div", { key: seekFeedback.nonce, className: "sat-descriptor-seek-feedback", role: "status", "aria-live": "polite" }, seekFeedback.message)
            ),
            detail && h(SceneStoryboard, { key: detail.id, vttUrl: detail.paths && detail.paths.vtt || "", onSeek: seek }),
            detail ? h("a", {
              className: "sat-descriptor-scene-title",
              href: baseURL.replace(/\/?$/, "/") + "scenes/" + detail.id,
              title: "Open this scene's normal playback page"
            }, sceneTitle) : h("div", { className: "sat-descriptor-scene-title" }, "Loading scene..."),
            h("div", { className: "sat-descriptor-scene-path", title: detail ? scenePath(detail) : "" }, detail ? scenePath(detail) : "")
          ),
          h("aside", { className: "sat-descriptor-controls" },
            detail && Boolean(detected.acts.length || detected.endings.length) && h("div", { className: "sat-descriptor-detected" }, "Filename detected: " + detected.acts.concat(detected.endings).join(", ")),
            detail && h(ChipEditor, { title: "Sex Acts & Positions", className: "sat-descriptor-acts", values: knownActs, selected: acts, onChange: setActs, onAddValue: function (value) { setKnownActs(function (existing) { return uniq(existing.concat([value])); }); } }),
            detail && h(ChipEditor, { title: "Endings", className: "sat-descriptor-endings", values: knownEndings, selected: endings, onChange: setEndings, onAddValue: function (value) { setKnownEndings(function (existing) { return uniq(existing.concat([value])); }); } }),
            h("div", { className: "sat-descriptor-actions" },
              h("button", { type: "button", className: "sat-descriptor-action secondary", disabled: busy || index <= 0, title: "Go to the previous scene without saving", onClick: function () { go(-1); } }, "Previous"),
              h("button", { type: "button", className: "sat-descriptor-action secondary", disabled: busy || index >= scenes.length - 1, title: "Leave this scene unchanged and continue", onClick: function () { go(1); } }, "Skip"),
              h("button", { type: "button", className: "sat-descriptor-action secondary", disabled: busy || !detail, title: "Mark this scene reviewed with no applicable descriptors", onClick: function () { saveCurrent([], [], "not_applicable"); } }, "Not Applicable"),
              h("button", { type: "button", className: "sat-descriptor-action secondary", disabled: busy || !history.length, title: "Restore the plugin-owned descriptor fields from the latest save", onClick: undoLast }, "Undo Last Save"),
              h("button", { type: "button", className: "sat-descriptor-action primary", disabled: busy || !detail, title: "Save both descriptor categories and continue", onClick: function () { saveCurrent(acts, endings, "reviewed"); } }, "Save & Next")
            ),
            h(KeybindPanel, {
              bindings: keybinds,
              recordingAction: recordingAction,
              onRecord: function (actionId) {
                setRecordingAction(recordingAction === actionId ? "" : actionId);
                setStatus(recordingAction === actionId ? "Shortcut change cancelled." : "Press a key combination for " + (keybindAction(actionId) || {}).label + ".");
              },
              onReset: function () {
                setKeybinds(defaultKeybinds());
                setRecordingAction("");
                setStatus("Keyboard shortcuts restored to defaults.");
              }
            })
          )
        ),
        h("div", { className: "sat-descriptor-status" + (error ? " sat-descriptor-error" : "") }, status)
      );
    }

    api.register.route(REVIEW_ROUTE, DescriptorReviewPage);
  }

  function routeSupportsReview() {
    return /(?:^|\/)scenes(?:\/\d+)?\/?$/.test(window.location.pathname);
  }

  function setupLauncher() {
    var existing = document.querySelector("." + LAUNCH_CLASS);
    if (!routeSupportsReview()) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    var button = el("button", LAUNCH_CLASS, "Descriptor Review");
    button.type = "button";
    button.title = "Review Sex Acts & Positions and Endings one scene at a time";
    button.addEventListener("click", openReview);
    document.body.appendChild(button);
  }

  function start() {
    registerReviewPage();
    setupLauncher();
    if (window.PluginApi && PluginApi.Event && PluginApi.Event.addEventListener) {
      PluginApi.Event.addEventListener("stash:location", function () { window.setTimeout(setupLauncher, 100); });
    }
    new MutationObserver(setupLauncher).observe(document.body, { childList: true, subtree: true });
  }

  window.SceneDescriptorReview = {
    open: openReview,
    parse: parseFilenameDescriptors,
    parseStoryboardVtt: parseStoryboardVtt,
    selectStoryboardCues: selectStoryboardCues,
    selectScoredStoryboardCues: selectScoredStoryboardCues,
    storyboardFrameMetrics: storyboardFrameMetrics,
    storyboardRatios: STORYBOARD_RATIOS.slice(),
    isPlayerShortcut: isReviewPlayerShortcut,
    applyPlayerShortcut: applyReviewPlayerShortcut,
    applyPlayerAction: applyReviewPlayerAction,
    seekStepAdjustment: seekStepAdjustment,
    clampSeekStep: clampSeekStep,
    eventToBinding: eventToBinding,
    actionForEvent: actionForEvent,
    assignKeybind: assignKeybind,
    defaultKeybinds: defaultKeybinds,
    keybindActions: KEYBIND_ACTIONS.slice(),
    vocabularyFromScenes: descriptorVocabularyFromScenes,
    fields: { acts: FIELD_ACTS, endings: FIELD_ENDINGS, status: FIELD_STATUS }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
