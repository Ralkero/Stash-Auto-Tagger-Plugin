import assert from "assert";
import fs from "fs";
import vm from "vm";

const source = fs.readFileSync("./ui/scene-descriptor-review.js", "utf8");
const badgeSource = fs.readFileSync("./ui/scene-descriptor-card-badges.js", "utf8");
const browserSource = fs.readFileSync("./ui/scene-descriptor-browser.js", "utf8");
const windowObject = {};
const context = {
  console,
  window: windowObject,
  document: {
    readyState: "loading",
    querySelector() { return null; },
    addEventListener() {},
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
  },
  MutationObserver: function () { this.observe = function () {}; },
  fetch() { throw new Error("Network access is not expected in parser verification"); },
  setTimeout,
  clearTimeout,
};
vm.createContext(context);
vm.runInContext(source, context);

const api = windowObject.SceneDescriptorReview;
assert.ok(api, "review API should be exposed for integration and verification");
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(api.parse("Prone Bone - Nude, Creampie"))),
  { acts: ["Prone Bone"], endings: ["Creampie"] },
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(api.parse("V2, Anal Doggystyle, Loop"))),
  { acts: ["Anal Doggystyle"], endings: ["Loop"] },
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(api.parse("Blowjob, Swallow"))),
  { acts: ["Blowjob"], endings: ["Swallow"] },
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(api.parse("POV Cowgirl, Loop"))),
  { acts: ["POV Cowgirl"], endings: ["Loop"] },
);
assert.strictEqual(api.fields.acts, "r34_sex_acts_positions");
assert.strictEqual(api.fields.endings, "r34_ending_descriptors");
assert.strictEqual(api.fields.status, "r34_scene_descriptor_status");

const storyboardVtt = ["WEBVTT", ""];
for (let index = 0; index < 30; index += 1) {
  const start = String(index * 10).padStart(2, "0");
  const end = String((index + 1) * 10).padStart(2, "0");
  storyboardVtt.push(`00:00:${start}.000 --> 00:00:${end}.000`);
  storyboardVtt.push(`sprite.jpg#xywh=${index * 160},0,160,90`, "");
}
const storyboardCues = JSON.parse(JSON.stringify(api.parseStoryboardVtt(storyboardVtt.join("\n"))));
assert.strictEqual(storyboardCues.length, 30, "all VTT sprite cues should be parsed");
assert.deepStrictEqual(storyboardCues[2], {
  start: 20,
  end: 30,
  image: "sprite.jpg",
  x: 320,
  y: 0,
  width: 160,
  height: 90,
});
const selectedStoryboard = JSON.parse(JSON.stringify(api.selectStoryboardCues(storyboardCues)));
assert.strictEqual(selectedStoryboard.length, 18, "the overview should select three rows of six distinct frames when available");
assert.strictEqual(selectedStoryboard[0].start, 0);
assert.strictEqual(selectedStoryboard.at(-1).start, 290);
assert.strictEqual(api.storyboardRatios.length, 18);
assert.ok(api.storyboardRatios[0] > 0 && api.storyboardRatios.at(-1) < 1);
function solidFrame(value, alpha = 255) {
  const pixels = new Uint8ClampedArray(48 * 27 * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
    pixels[index + 3] = alpha;
  }
  return pixels;
}
const detailedFrame = solidFrame(0);
for (let row = 0; row < 27; row += 1) {
  for (let column = 0; column < 48; column += 1) {
    const offset = (row * 48 + column) * 4;
    const value = (row + column) % 2 ? 210 : 45;
    detailedFrame[offset] = value;
    detailedFrame[offset + 1] = Math.min(255, value + 20);
    detailedFrame[offset + 2] = Math.max(0, value - 20);
  }
}
assert.strictEqual(api.storyboardFrameMetrics(solidFrame(0)).usable, false, "black frames should be rejected");
assert.strictEqual(api.storyboardFrameMetrics(solidFrame(255)).usable, false, "uniform white frames should be rejected");
assert.strictEqual(api.storyboardFrameMetrics(solidFrame(80, 0)).usable, false, "transparent frames should be rejected");
assert.strictEqual(api.storyboardFrameMetrics(detailedFrame).usable, true, "frames with visible detail should remain eligible");
const scoredStoryboard = storyboardCues.map((cue, index) => ({
  cue,
  metrics: { usable: index !== 0, quality: index % 4 },
}));
const qualitySelected = JSON.parse(JSON.stringify(api.selectScoredStoryboardCues(scoredStoryboard)));
assert.strictEqual(qualitySelected.length, 18);
assert.ok(!qualitySelected.some((cue) => cue.start === 0), "rejected empty cues must never be backfilled into the overview");
assert.strictEqual(api.isPlayerShortcut({ key: " ", code: "Space" }), true);
assert.strictEqual(api.isPlayerShortcut({ key: "ArrowRight" }), true);
assert.strictEqual(api.isPlayerShortcut({ key: "ArrowLeft", ctrlKey: true }), true);
assert.strictEqual(api.isPlayerShortcut({ key: "a" }), true);
assert.strictEqual(api.isPlayerShortcut({ key: "d" }), true);
assert.strictEqual(api.isPlayerShortcut({ key: "+", ctrlKey: true, shiftKey: true }), true);
assert.strictEqual(api.isPlayerShortcut({ key: "-", ctrlKey: true }), true);
assert.strictEqual(api.isPlayerShortcut({ key: "m" }), true);
assert.strictEqual(api.isPlayerShortcut({ key: "l", shiftKey: true }), true);
assert.strictEqual(api.isPlayerShortcut({ key: "s", ctrlKey: true }), false);
assert.strictEqual(api.eventToBinding({ key: " ", code: "Space" }), "Space");
assert.strictEqual(api.eventToBinding({ key: "+", code: "Equal", ctrlKey: true, shiftKey: true }), "Ctrl+Plus");
assert.strictEqual(api.eventToBinding({ key: "N", ctrlKey: true, shiftKey: true }), "Ctrl+Shift+N");
assert.strictEqual(api.eventToBinding({ key: "p", altKey: true }), "Alt+P");
assert.strictEqual(api.eventToBinding({ key: "Control", ctrlKey: true }), "");
const defaults = JSON.parse(JSON.stringify(api.defaultKeybinds()));
assert.strictEqual(defaults.review_save, "Ctrl+Enter");
assert.strictEqual(defaults.review_undo, "Alt+U", "undo must not default to the browser's text-undo shortcut");

// Typing in a descriptor field must not trigger playback, seeking or undo.
const inputTarget = { tagName: "INPUT" };
assert.strictEqual(api.isEditableTarget(inputTarget), true);
assert.strictEqual(api.isEditableTarget({ tagName: "DIV", isContentEditable: false }), false);
assert.strictEqual(api.allowedWhileTyping("fullscreen", { key: "f" }), false, "plain letters stay with the text field");
assert.strictEqual(api.allowedWhileTyping("seek_back", { key: "a" }), false);
assert.strictEqual(api.allowedWhileTyping(null, { key: "6" }), false, "digits must not percentage-seek while typing");
assert.strictEqual(api.allowedWhileTyping("review_undo", { key: "z", ctrlKey: true }), false, "undo must never fire from a text field");
assert.strictEqual(api.allowedWhileTyping("seek_back_minute", { key: "ArrowLeft", ctrlKey: true }), false, "Ctrl+Arrow is word navigation in text");
assert.strictEqual(api.allowedWhileTyping("review_save", { key: "Enter", ctrlKey: true }), true, "Ctrl+Enter still saves from the search box");
assert.strictEqual(api.allowedWhileTyping("review_save", { key: "s" }), false, "a rebinding to a plain key must not fire while typing");

// A stored legacy Ctrl+Z undo binding migrates to the new default.
const originalGetItem = context.localStorage.getItem;
context.localStorage.getItem = key => (key === "scene-auto-tagger:descriptor-keybinds:v1"
  ? JSON.stringify({ ...defaults, review_undo: "Ctrl+Z" })
  : null);
assert.strictEqual(api.loadKeybinds().review_undo, "Alt+U");
context.localStorage.getItem = key => (key === "scene-auto-tagger:descriptor-keybinds:v1"
  ? JSON.stringify({ ...defaults, review_undo: "Ctrl+Z", review_skip: "Alt+U" })
  : null);
assert.strictEqual(api.loadKeybinds().review_undo, "", "migration must not create a duplicate binding");
context.localStorage.getItem = originalGetItem;
assert.strictEqual(api.keybindActions.length, 21);
assert.strictEqual(api.actionForEvent({ key: "k", ctrlKey: true }, { seek_forward: "Ctrl+K" }), "seek_forward");
const reassigned = JSON.parse(JSON.stringify(api.assignKeybind(defaults, "seek_back", "D")));
assert.strictEqual(reassigned.keybinds.seek_back, "D");
assert.strictEqual(reassigned.keybinds.seek_forward, "");
assert.strictEqual(reassigned.displacedActionId, "seek_forward");
const shortcutMedia = {
  currentTime: 5,
  duration: 100,
  volume: 0.5,
  muted: false,
  loop: false,
  paused: true,
  play() { return Promise.resolve(); },
  pause() {},
};
const shortcutPlayer = {
  querySelector(selector) { return selector === "video" ? shortcutMedia : null; },
};
assert.strictEqual(api.applyPlayerShortcut({ key: "ArrowRight" }, shortcutPlayer), true);
assert.strictEqual(shortcutMedia.currentTime, 15);
assert.strictEqual(api.applyPlayerShortcut({ key: "ArrowLeft", ctrlKey: true }, shortcutPlayer), true);
assert.strictEqual(shortcutMedia.currentTime, 0);
shortcutMedia.currentTime = 20;
const seekFeedback = [];
const seekOptions = { seekStep: 7, onFeedback(message) { seekFeedback.push(message); } };
assert.strictEqual(api.applyPlayerShortcut({ key: "d" }, shortcutPlayer, seekOptions), true);
assert.strictEqual(shortcutMedia.currentTime, 27);
assert.strictEqual(api.applyPlayerShortcut({ key: "a" }, shortcutPlayer, seekOptions), true);
assert.strictEqual(shortcutMedia.currentTime, 20);
assert.deepStrictEqual(seekFeedback, ["+7s", "-7s"]);
assert.strictEqual(api.applyPlayerShortcut({ key: "m" }, shortcutPlayer), true);
assert.strictEqual(shortcutMedia.muted, true);
assert.strictEqual(api.applyPlayerShortcut({ key: "l", shiftKey: true }, shortcutPlayer), true);
assert.strictEqual(shortcutMedia.loop, true);
shortcutMedia.currentTime = 20;
assert.strictEqual(api.applyPlayerAction("seek_forward", shortcutPlayer, seekOptions), true);
assert.strictEqual(shortcutMedia.currentTime, 27);
assert.strictEqual(api.seekStepAdjustment({ key: "+", ctrlKey: true, shiftKey: true }), 1);
assert.strictEqual(api.seekStepAdjustment({ key: "-", ctrlKey: true }), -1);
assert.strictEqual(api.seekStepAdjustment({ key: "+" }), 0);
assert.strictEqual(api.clampSeekStep(0), 1);
assert.strictEqual(api.clampSeekStep(1), 1);
assert.strictEqual(api.clampSeekStep(61), 60);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(api.vocabularyFromScenes([
    { custom_fields: { r34_sex_acts_positions: '["Cowgirl","Custom Position"]', r34_ending_descriptors: '["Loop"]' } },
    { custom_fields: { r34_sex_acts_positions: '["Custom Position","Standing"]', r34_ending_descriptors: '["Custom Ending"]' } },
  ]))),
  { acts: ["Cowgirl", "Custom Position", "Standing"], endings: ["Loop", "Custom Ending"] },
);

assert.ok(source.includes("custom_fields: { partial: partial }"), "saves must use partial custom fields");
assert.ok(!source.includes("tag_ids:"), "descriptor review must not write Stash character tags");
assert.ok(source.includes("custom.remove = remove"), "undo must remove fields that were previously absent");
assert.ok(source.includes("scene-auto-tagger:descriptors-changed"), "save and undo must announce card badge updates");
assert.ok(source.includes("api.loadableComponents && api.loadableComponents.ScenePlayer"), "descriptor review should use Stash's native loadable ScenePlayer");
assert.ok(source.includes("api.register.route(REVIEW_ROUTE, DescriptorReviewPage)"), "native player review must run inside Stash's React route context");
assert.ok(source.includes("sceneStreams { url mime_type label }"), "the detailed query should load native player stream options");
assert.ok(source.includes("paths { screenshot preview stream vtt sprite"), "the detailed query should load Stash player and storyboard paths");
assert.ok(source.includes("selectUsableStoryboardCues(parsed, props.vttUrl)"), "the quick overview should inspect Stash's VTT storyboard frames before selection");
assert.ok(source.includes('context.getImageData(0, 0, canvas.width, canvas.height)'), "storyboard crops should be evaluated from their actual pixels");
assert.ok(source.includes('darkRatio < 0.86'), "near-black overview frames should be rejected");
assert.ok(source.includes('"No usable overview frames found"'), "the UI should not backfill rejected blank frames");
assert.ok(source.includes('href: baseURL.replace(/\\/?$/, "/") + "scenes/" + detail.id'), "the overview title should link to the normal Stash scene page");
assert.ok(source.includes('title: "Open this scene\'s normal playback page"'), "the scene-title link should explain its destination");
assert.ok(source.includes('window.addEventListener("keydown", onKeyDown, true)'), "review shortcuts should be captured regardless of the focused review control");
assert.ok(source.includes('applyReviewPlayerShortcut(event, player, { seekStep: preciseSeekStep'), "review shortcuts should control Stash's native media element");
assert.ok(source.includes('media.currentTime = Math.max'), "review shortcuts should seek directly and reliably");
assert.ok(!source.includes('player.contains(event.target)'), "A and D shortcuts should also work while focus is inside the native player");
assert.ok(source.includes('className: "sat-descriptor-seek-feedback"'), "seek actions should render visible player feedback");
assert.ok(source.includes('media.addEventListener("seeking", onSeeking)'), "timeline and scrubber seeks should also show feedback");
assert.ok(source.includes('"Seek step: " + nextStep + "s"'), "seek-step adjustments should report the new interval");
assert.ok(source.includes('scene-auto-tagger:descriptor-seek-step:v1'), "the adjustable A and D seek interval should persist");
assert.ok(source.includes('scene-auto-tagger:descriptor-keybinds:v1'), "custom keybindings should persist");
assert.ok(source.includes('className: "sat-descriptor-keybind-panel"'), "the sidebar should include the shortcut configuration panel");
assert.ok(source.includes('recording ? "Press keys..." : binding'), "binding buttons should visibly enter capture mode");
assert.ok(source.includes('capturedKey === "Backspace" || capturedKey === "Delete"'), "captured shortcuts should support clearing a binding");
assert.ok(source.includes('displacedActionId'), "conflicting shortcuts should be resolved explicitly");
assert.ok(source.includes('actionId === "review_save"'), "the global dispatcher should support Save & Next");
assert.ok(source.includes('actionId === "review_undo"'), "the global dispatcher should support Undo Last Save");
assert.ok(source.includes('scene-auto-tagger:descriptor-vocabulary:v1'), "custom descriptor values should persist across review sessions");
assert.ok(source.includes('descriptorVocabularyFromScenes(allScenes)'), "saved descriptor values should be learned from all Rule34 scenes");
assert.ok(source.includes('props.onAddValue(value)'), "new values should be promoted immediately into the shared picker vocabulary");

const badgeWindow = {};
const badgeContext = {
  console,
  window: badgeWindow,
  document: {
    readyState: "loading",
    querySelector() { return null; },
    addEventListener() {},
  },
  MutationObserver: function () { this.observe = function () {}; },
  fetch() { throw new Error("Network access is not expected in badge verification"); },
  setTimeout,
  clearTimeout,
};
vm.createContext(badgeContext);
vm.runInContext(badgeSource, badgeContext);
const badges = badgeWindow.SceneDescriptorCardBadges;
assert.ok(badges, "scene card badge API should be exposed for verification");
const summary = JSON.parse(JSON.stringify(badges.summarize({
  r34_sex_acts_positions: '["Blowjob","Reverse Cowgirl","Blowjob"]',
  r34_ending_descriptors: '["Swallow","Creampie"]',
})));
assert.deepStrictEqual(summary, {
  acts: ["Blowjob", "Reverse Cowgirl"],
  endings: ["Swallow", "Creampie"],
  count: 4,
});
assert.strictEqual(
  badges.tooltip(summary),
  "4 scene descriptors\nSex Acts & Positions: Blowjob, Reverse Cowgirl\nEndings: Swallow, Creampie",
);
assert.ok(badgeSource.includes("findScenes(ids: $ids"), "visible scene custom fields should load in a batch");
assert.ok(badgeSource.includes(".smv-card-variant-menu"), "descriptor badges should align with variant counts when present");
assert.ok(badgeSource.includes('document.createElement("button")'), "descriptor counts should be clickable buttons");
assert.ok(badgeSource.includes('popover.setAttribute("role", "dialog")'), "clicking a badge should open an accessible descriptor list");
assert.ok(badgeSource.includes('appendDescriptorSection(popover, "Sex Acts & Positions"'), "the list should separate acts and positions");
assert.ok(badgeSource.includes('appendDescriptorSection(popover, "Endings"'), "the list should separate endings");

const browserWindow = {};
const browserContext = {
  console,
  window: browserWindow,
  document: {
    readyState: "loading",
    querySelector() { return null; },
    addEventListener() {},
  },
  MutationObserver: function () { this.observe = function () {}; },
  fetch() { throw new Error("Network access is not expected in descriptor browser verification"); },
  URLSearchParams,
  URL,
  setTimeout,
  clearTimeout,
};
vm.createContext(browserContext);
vm.runInContext(browserSource, browserContext);
const browser = browserWindow.SceneDescriptorBrowser;
assert.ok(browser, "descriptor browser API should be exposed for verification");
const descriptorIndex = JSON.parse(JSON.stringify(browser.aggregateScenes([
  { custom_fields: { r34_sex_acts_positions: '["Blowjob","Blowjob","Cowgirl"]', r34_ending_descriptors: '["Swallow"]' } },
  { custom_fields: { r34_sex_acts_positions: '["Blowjob"]', r34_ending_descriptors: '["Creampie"]' } },
  { custom_fields: {} },
])));
assert.deepStrictEqual(descriptorIndex, {
  acts: [{ name: "Blowjob", count: 2 }, { name: "Cowgirl", count: 1 }],
  endings: [{ name: "Creampie", count: 1 }, { name: "Swallow", count: 1 }],
  taggedScenes: 2,
  totalScenes: 3,
});
const sceneFilter = JSON.parse(JSON.stringify(browser.matchingSceneFilter("r34_sex_acts_positions", "Blowjob")));
assert.deepStrictEqual(sceneFilter, {
  custom_fields: [{ field: "r34_sex_acts_positions", value: ["Blowjob"], modifier: "INCLUDES" }],
});
assert.strictEqual(
  browser.selectionPath({ field: "r34_sex_acts_positions", name: "Reverse Cowgirl" }),
  "/plugins/scene-descriptors?field=r34_sex_acts_positions&value=Reverse+Cowgirl",
);
assert.ok(browserSource.includes("api.register.route(ROUTE, DescriptorBrowserPage)"), "the descriptor browser should register a Stash route");
assert.ok(browserSource.includes('pathname === "/tags"'), "the navigation entry should anchor beside Characters/Tags");
assert.ok(browserSource.includes("wrapper.nextSibling"), "the navigation entry should be inserted directly after Characters");
assert.ok(browserSource.includes("api.components.SceneCard()"), "filtered results should use native Stash scene cards");
assert.ok(browserSource.includes("loadMatchingScenes(selected.field, selected.name, page, perPage)"), "descriptor selection should load matching scenes on the page");
assert.ok(!browserSource.includes('return "/scenes?"'), "descriptor selection must not redirect to the generic Scenes page");

console.log("scene descriptor review verification passed");
