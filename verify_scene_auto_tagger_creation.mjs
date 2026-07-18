import fs from "fs";
import vm from "vm";
import assert from "assert";

const calls = [];
const gql = {
  Do(query, variables) {
    calls.push({ query, variables });
    if (query.includes("tagCreate")) {
      return {
        tagCreate: {
          id: "new-character-1",
          name: variables.input.name,
          parents: [{ id: "character-parent", name: "Characters" }]
        }
      };
    }
    if (query.includes("findTags")) {
      const requestedName = variables && variables.tag_filter && variables.tag_filter.name && variables.tag_filter.name.value;
      if (requestedName === "Characters") {
        return { findTags: { tags: [{ id: "character-parent", name: "Characters", aliases: [], parents: [] }] } };
      }
      return { findTags: { tags: [] } };
    }
    throw new Error("Unexpected GraphQL operation in creation verification");
  }
};

const src = fs
  .readFileSync("./scene-auto-tagger.js", "utf8")
  .replace(/\(function main\(\) \{[\s\S]*?\}\)\(\);\s*$/, "");

const context = { console, gql };
vm.createContext(context);
vm.runInContext(
  src + `
this.__api = {
  normalizeConfig,
  resolveApplyMatches
};`,
  context
);

const api = context.__api;
const config = api.normalizeConfig({
  dryRun: false,
  createMissingTags: true,
  allowTitleFallbackCharacterTags: true,
  strictCharacterTagNames: true
});
const candidates = {
  studio: null,
  groups: [],
  characters: [{
    name: "Tinkerbell",
    source: "title_franchise_fallback",
    aliasText: "Tinkerbell",
    sourceText: "Tinkerbell - Tease 2",
    score: 0.93
  }]
};

const dryCallsBefore = calls.length;
const dryResult = api.resolveApplyMatches(candidates, config, null, true);
assert.strictEqual(calls.filter(call => call.query.includes("tagCreate")).length, 0);
assert.ok(calls.length > dryCallsBefore);
assert.deepStrictEqual(Array.from(dryResult.wouldCreate), ["tag:Tinkerbell"]);

calls.length = 0;
const applyResult = api.resolveApplyMatches(candidates, config, null, false);
const createCalls = calls.filter(call => call.query.includes("tagCreate"));
assert.strictEqual(createCalls.length, 1);
assert.strictEqual(createCalls[0].variables.input.name, "Tinkerbell");
assert.deepStrictEqual(Array.from(createCalls[0].variables.input.parent_ids), ["character-parent"]);
assert.deepStrictEqual(Array.from(applyResult.tagIds), ["new-character-1"]);

console.log("creation verification passed");
