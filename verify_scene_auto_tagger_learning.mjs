import fs from "fs";
import vm from "vm";
import assert from "assert";

const src = fs
  .readFileSync("./scene-auto-tagger.js", "utf8")
  .replace(/\(function main\(\) \{[\s\S]*?\}\)\(\);\s*$/, "");

const context = { console };
vm.createContext(context);
vm.runInContext(
  src + `
this.__api = {
  normalize,
  normalizeConfig,
  normalizeAliasMap,
  tokenizePathAndName,
  parseCandidates,
  emptyLearnedStore,
  learnedAliasOverrideFromStore,
  previewLearnedCorrection,
  applyLearnedCorrection,
  listLearnedCorrections,
  disableLearnedCorrection,
  undoLearnedCorrection,
  previewLearnedRepairs,
  applyLearnedRepairs
};`,
  context
);

const api = context.__api;
const mutations = [];
const characterParent = { id: "764", name: "Characters" };
const studios = [
  { id: "62", name: "Dead or Alive", aliases: ["doa"] },
  { id: "84", name: "Original Character", aliases: [] }
];
const groups = [{ id: "102", name: "Redmoa", aliases: [] }];
const tags = [
  { id: "770", name: "Tina Armstrong", aliases: [], ignore_auto_tag: false, parents: [characterParent] },
  { id: "999", name: "Favorite", aliases: [], ignore_auto_tag: true, parents: [] }
];

const correctedScene = {
  id: "4196",
  title: "",
  details: "",
  updated_at: "corrected-1",
  studio: studios[0],
  groups: [{ group: groups[0], scene_index: null }],
  tags: [tags[0], tags[1]],
  files: [{ id: "f4196", path: "E:\\Rule34\\Original Character\\Redmoa\\Redmoa - Tina Armstrong - Bikini [1080P].mp4", basename: "Redmoa - Tina Armstrong - Bikini [1080P].mp4" }]
};

const wrongScene = {
  id: "4197",
  title: "",
  details: "",
  updated_at: "wrong-1",
  studio: studios[1],
  groups: [{ group: groups[0], scene_index: null }],
  tags: [tags[0], tags[1]],
  files: [{ id: "f4197", path: "E:\\Rule34\\Original Character\\Redmoa\\Redmoa - Tina Armstrong - Titfuck [1080P].mp4", basename: "Redmoa - Tina Armstrong - Titfuck [1080P].mp4" }]
};

let pluginConfig = {
  dryRun: true,
  allowOverwriteExistingMetadata: false,
  learnedCorrectionsV1: JSON.stringify(api.emptyLearnedStore())
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const runtime = {
  gql: {
    Do(query, variables) {
      if (query.includes("GetSceneAutoTaggerLearnedState")) {
        return {
          configuration: { plugins: { "scene-auto-tagger": clone(pluginConfig) } },
          plugins: [{ id: "scene-auto-tagger", name: "Scene Auto-Tagger", version: "0.2.0", enabled: true }]
        };
      }
      if (query.includes("RuntimeAliasStudios")) return { findStudios: { count: studios.length, studios: clone(studios) } };
      if (query.includes("RuntimeAliasGroups")) return { findGroups: { count: groups.length, groups: clone(groups) } };
      if (query.includes("RuntimeAliasTags")) return { findTags: { count: tags.length, tags: clone(tags) } };
      if (query.includes("ValidateSceneAutoTaggerLearnedTargets")) {
        return {
          findStudios: { studios: clone(studios.filter(item => (variables.studio_ids || []).includes(item.id))) },
          findGroups: { groups: clone(groups.filter(item => (variables.group_ids || []).includes(item.id))) },
          findTags: { tags: clone(tags.filter(item => (variables.tag_ids || []).includes(item.id))) }
        };
      }
      if (query.includes("GetSceneForTagging")) {
        const scene = String(variables.id) === correctedScene.id ? correctedScene : wrongScene;
        return { findScene: clone(scene) };
      }
      if (query.includes("ConfigureSceneAutoTaggerLearnedState")) {
        mutations.push({ type: "configure", variables: clone(variables) });
        pluginConfig = clone(variables.input);
        return { configurePlugin: clone(pluginConfig) };
      }
      if (query.includes("FindScenesForSceneAutoTaggerRepair")) {
        return { findScenes: { count: 1, scenes: [clone(wrongScene)] } };
      }
      if (query.includes("mutation UpdateScene")) {
        mutations.push({ type: "sceneUpdate", variables: clone(variables) });
        wrongScene.studio = studios.find(item => item.id === variables.input.studio_id) || wrongScene.studio;
        wrongScene.updated_at = "wrong-2";
        return { sceneUpdate: clone(wrongScene) };
      }
      throw new Error("Unexpected GraphQL operation: " + query.slice(0, 80));
    }
  }
};

const preview = api.previewLearnedCorrection({ sceneId: correctedScene.id }, runtime);
assert.strictEqual(mutations.length, 0, "learning preview must be read-only");
assert.strictEqual(preview.predicted.studio, "Original Character");
const studioProposal = preview.proposals.find(item => item.type === "character_studio");
assert.ok(studioProposal, "corrected Tina scene should propose a character-to-Studio lesson");
assert.strictEqual(studioProposal.subjectName, "Tina Armstrong");
assert.strictEqual(studioProposal.targetName, "Dead or Alive");

const saved = api.applyLearnedCorrection({
  sceneId: correctedScene.id,
  expectedRevision: preview.revision,
  rules: [{ proposalId: studioProposal.id }]
}, runtime);
assert.strictEqual(saved.rules.length, 1);
assert.strictEqual(mutations.filter(item => item.type === "configure").length, 1);
assert.strictEqual(pluginConfig.dryRun, true, "saving lessons must preserve existing plugin config");
assert.strictEqual(pluginConfig.allowOverwriteExistingMetadata, false);
const savedConfig = clone(pluginConfig);

const store = JSON.parse(pluginConfig.learnedCorrectionsV1);
const learned = api.learnedAliasOverrideFromStore(store, runtime, "test");
const parsed = api.tokenizePathAndName(wrongScene.files[0].path, "", "");
const combined = api.normalizeAliasMap({
  studios: { "original character": "Original Character" },
  groups: { redmoa: "Redmoa" },
  characters: { "tina armstrong": "Tina Armstrong" },
  characterStudios: {},
  forcedCharacterStudios: learned.forcedCharacterStudios,
  ignoredCharacters: {}
});
const learnedResult = api.parseCandidates(parsed, combined, api.normalizeConfig({ allowTitleFallbackCharacterTags: true }));
assert.strictEqual(learnedResult.studios[0].name, "Dead or Alive");

const repairPreview = api.previewLearnedRepairs({ ruleIds: [saved.rules[0].id] }, runtime);
assert.strictEqual(mutations.filter(item => item.type === "sceneUpdate").length, 0, "repair preview must be read-only");
assert.strictEqual(repairPreview.rows.length, 1);
assert.strictEqual(repairPreview.rows[0].changes[0].field, "studio");
assert.strictEqual(repairPreview.rows[0].changes[0].afterNames[0], "Dead or Alive");

const repairResult = api.applyLearnedRepairs({
  expectedRevision: repairPreview.revision,
  ruleIds: [saved.rules[0].id],
  sceneIds: [wrongScene.id]
}, runtime);
assert.strictEqual(repairResult.updated, 1);
const update = mutations.find(item => item.type === "sceneUpdate");
assert.strictEqual(update.variables.input.studio_id, "62");
assert.ok(!Object.prototype.hasOwnProperty.call(update.variables.input, "tag_ids"), "unrelated tags must remain untouched");
assert.ok(!Object.prototype.hasOwnProperty.call(update.variables.input, "groups"), "existing groups must remain untouched");

assert.throws(
  () => api.disableLearnedCorrection({ ruleId: saved.rules[0].id, expectedRevision: 0 }, runtime),
  /changed/i,
  "a stale correction manager must not overwrite a newer revision"
);

const undone = api.undoLearnedCorrection({
  eventId: saved.event.id,
  expectedRevision: saved.revision
}, runtime);
assert.strictEqual(undone.revision, 2);
assert.strictEqual(JSON.parse(pluginConfig.learnedCorrectionsV1).rules[0].status, "disabled");

pluginConfig = clone(savedConfig);
const disabled = api.disableLearnedCorrection({
  ruleId: saved.rules[0].id,
  expectedRevision: saved.revision
}, runtime);
assert.strictEqual(disabled.revision, 2);
assert.strictEqual(disabled.rule.status, "disabled");

pluginConfig = clone(savedConfig);
studios.splice(studios.findIndex(item => item.id === "62"), 1);
const missingTargetList = api.listLearnedCorrections(runtime);
assert.strictEqual(missingTargetList.rules[0].runtimeValid, false, "deleted targets must invalidate rules");
const missingTargetAliases = api.learnedAliasOverrideFromStore(
  JSON.parse(pluginConfig.learnedCorrectionsV1),
  runtime,
  "missing-target-test"
);
assert.deepStrictEqual(
  Object.keys(missingTargetAliases.forcedCharacterStudios),
  [],
  "a deleted Studio must not be recreated through a learned rule"
);

console.log("learning verification passed");
