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
  EMBEDDED_ALIASES,
  normalizeAliasMap,
  tokenizePathAndName,
  parseCandidates,
  normalize,
  addCharacterObjectNameAndAliases,
  imageFranchiseFromPath,
  taskModeFromInput,
  normalizeSceneIds
};`,
  context
);

const api = context.__api;
const aliases = api.normalizeAliasMap(api.EMBEDDED_ALIASES);

function charsFor(path, config = {}, aliasInput = aliases) {
  const parsed = api.tokenizePathAndName(path, "", "");
  const raw = api.parseCandidates(parsed, aliasInput, {
    allowTitleFallbackCharacterTags: false,
    strictCharacterTagNames: true,
    ...config
  });
  return raw.characters.map(c => c.name).sort();
}

function assertSameArray(actual, expected) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected));
}

assertSameArray(
  charsFor("E:\\Rule34\\Nier Automata\\Artist - 2Booty Riding Cock [1080p].mp4"),
  ["2B"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Nier Automata\\Artist - 2bb Kaine V2 [1080p].mp4"),
  ["2B", "Kaine"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Baldur's Gate 3\\BluelightSFM - Shadowheart - A Long Rest [1080p].mp4"),
  ["Shadowheart"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Resident Evil\\Artist - Ada Leon Ashley [1080P].mp4"),
  ["Ada Wong", "Ashley Graham", "Leon Kennedy"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Final Fantasy\\Artist - Tifa Cloud Panel2 Bikini [4K].mp4"),
  ["Cloud Strife", "Tifa Lockhart"]
);

assert.strictEqual(
  api.imageFranchiseFromPath("E:\\James' Stuff\\Rule34 Pictures\\Zenless Zone Zero\\yanagi_nsfw.jpg", {}),
  "Zenless Zone Zero"
);

assert.strictEqual(
  api.imageFranchiseFromPath("E:\\James' Stuff\\Rule34 Pictures\\_Unsorted_Franchise\\unknown.jpg", {}),
  ""
);

assert.strictEqual(api.taskModeFromInput({ args_map: { mode: "image_folder_tagging" } }), "image folder tagging");
assertSameArray(api.normalizeSceneIds('["4196", "4197"]'), ["4196", "4197"]);

assertSameArray(
  charsFor("E:\\Rule34\\Zenless Zone Zero\\KinkyCat3D - Jane Doe, Burnice White [1080P].mp4", { allowTitleFallbackCharacterTags: true }),
  ["Burnice White", "Jane Doe"]
);

assertSameArray(
  charsFor("E:\\Rule34\\League of Legends\\KinkyCat3D - Seraphine Star Guardian H-Job 2 [1080P].mp4", { allowTitleFallbackCharacterTags: true }),
  ["Seraphine"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Original Character\\KinkyCat3D\\KinkyCat3D - Bunnygirl Catwalk - Official Censored [1080P].mp4", { allowTitleFallbackCharacterTags: true }),
  []
);

assertSameArray(
  charsFor("E:\\Rule34\\Nier Automata\\KinkyCat3D - Commander White - BJ [1080P].mp4", { allowTitleFallbackCharacterTags: true }),
  ["Commander White"]
);

const runtimeAliases = api.normalizeAliasMap({
  studios: aliases.studios,
  groups: { ...aliases.groups, redmoa: "Redmoa" },
  characters: { ...aliases.characters },
  characterStudios: aliases.characterStudios
});
api.addCharacterObjectNameAndAliases(runtimeAliases, { name: "Helen Parr", aliases: [] });
api.addCharacterObjectNameAndAliases(runtimeAliases, { name: "Black Widow", aliases: [] });

assertSameArray(
  charsFor("E:\\Rule34\\Original Character\\Redmoa\\Redmoa - Tinkerbell - Tease 2 [1080P].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Tinkerbell"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Original Character\\Redmoa\\Redmoa - Operation - Cocktease [1080P].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  []
);

assertSameArray(
  charsFor("E:\\Rule34\\Original Character\\Redmoa\\Redmoa - Helenparr - Elastibutt [1080P].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Helen Parr"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Final Fantasy\\SaveAss - Scarlet, Top - Sound [4K].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Scarlet"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Final Fantasy\\SaveAss - Tifa Lockhart - Dress s - Black [4K].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Tifa Lockhart"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Overwatch\\Artist - Marisol's Wedding [4K].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Marisol"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Genshin Impact\\Artist - Ganyu Pov Dressonly [4K].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Ganyu"]
);

assertSameArray(
  charsFor("E:\\Rule34 Pictures\\Pokemon\\poke_night_clothed.mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  []
);

assertSameArray(
  charsFor("E:\\Rule34\\Original Character\\Yeero\\Yeero - Jillxclaire [4K].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Claire Redfield", "Jill Valentine"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Overwatch\\Yeero - Brig Buttplug [4K].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Brigitte Lindholm"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Elden Ring\\Artist - Fia Baldachin's Blessing [4K].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Fia"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Final Fantasy\\Artist - Yshtola Rhul [4K].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Y'shtola Rhul"]
);

assertSameArray(
  charsFor("E:\\Rule34\\League of Legends\\Artist - Qiyana Face Remake [4K].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Qiyana"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Teen Titans\\Redmoa - Gwen Tennyson And Raven - GwenRaven Bustamove [720P].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Gwen Tennyson", "Raven"]
);

assertSameArray(
  charsFor("E:\\Rule34\\Marvel\\Artist - Gwen Stacy [4K].mp4", { allowTitleFallbackCharacterTags: true }, runtimeAliases),
  ["Gwen Stacy"]
);

console.log("strict verification passed");
