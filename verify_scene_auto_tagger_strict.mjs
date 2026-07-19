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

for (const [path, expected] of [
  ["E:\\Rule34\\Final Fantasy\\Artist - Tifa Mating Press [4K].mp4", ["Tifa Lockhart"]],
  ["E:\\Rule34\\Overwatch\\Artist - Cute Dva Washroom Sex [1080P].mp4", ["D.Va"]],
  ["E:\\Rule34\\Street Fighter\\Artist - Can Juri Handle It [4K].mp4", ["Juri Han"]],
  ["E:\\Rule34\\Nier Automata\\Artist - Horny 2Booty [4K].mp4", ["2B"]],
  ["E:\\Rule34\\Elden Ring\\Artist - Maidenless No More [1080P].mp4", []],
  ["E:\\Rule34\\Nioh\\Artist - Nioh Missionary (Maria) [4K].mp4", ["Maria"]]
]) {
  assertSameArray(
    charsFor(path, { allowTitleFallbackCharacterTags: true }),
    expected
  );
}

assertSameArray(
  charsFor(
    "E:\\Rule34\\Final Fantasy\\KnownArtist - Lysandra Vale - Arrival [4K].mp4",
    { allowTitleFallbackCharacterTags: true }
  ),
  ["Lysandra Vale"]
);

const removedMalformedCharacterTags = [
  "Calming Raven", "Cammy At The", "Cammy Elevator", "Cammy Sf",
  "Cammy Throat Training", "Can Juri Handle It", "Cloud Triple Feature",
  "Cute Dva Washroom Sex", "Dimitrescu Daughters", "Divine Hospitality Sif",
  "Dream Dive Judy", "Dva Arcade", "Dva Bounces On It", "Dva Bouncing",
  "Dva Bouncing On Cock", "Dva Bouncing On It", "Dva Doggystyle",
  "Dva Double Penetrated", "Dva Gamer Girl", "Dva Get Tickets", "Dva Gets A D",
  "Dva Has Some Fun", "Dva Hot Shower", "Dva Mating Press", "Dva Pink Dress",
  "Dva Shaking Ass", "Dva Suck", "Evelynn 4some", "Get Jinxed", "Good Times",
  "Horny 2booty", "In Nyotengu", "Ivy On Top", "Jessie Eating Tifas Ass",
  "Judy Braindance", "Kazumi Irrumatio", "Lara Unleased Ep", "Leon Overtime",
  "Maidenless No More", "Male", "Nioh", "Panam Doggystyle",
  "Panam Mating Press", "Panam Suck", "Panam The Best Girl", "Raven Craves It",
  "Raven Dc", "Raven Gothic Fantasy", "Raven Halloween", "Raven Lucky Day",
  "Schoolgirl Dva Creampied", "Sex Doll Dva", "Steps", "Takes Leon",
  "Tempting Training", "Test Drive", "Tifa 100k Followers",
  "Tifa Backing Onto It", "Tifa Chair", "Tifa Costa Del Sol", "Tifa Femdom",
  "Tifa From Behind", "Tifa Is Angry", "Tifa Is Lonely", "Tifa Likes To Suck",
  "Tifa Maid Service", "Tifa Mating", "Tifa Mating Press", "Tifa Nightclub",
  "Tifa Plays Final Fantasy", "Tifa Preworkout", "Tifa Rubbing", "Tifa Shower",
  "Tifa Strip Searched", "Tifa The Heavenly Beauty", "Tifa Throated Cumshot",
  "Tifa Titjob", "Tifa Wants It Inside", "Tifa Work", "Toy Hunter Yuffie",
  "Twin Moon Knight", "Widow Cockrider", "Widow Sharing", "Wrapped In Ivy",
  "Yorha", "Yorha Android", "Yorha Type A No", "Yuffie The"
];

for (const malformedName of removedMalformedCharacterTags) {
  const parsed = api.tokenizePathAndName(
    "E:\\Rule34\\Final Fantasy\\KnownArtist - " + malformedName + " [4K].mp4",
    "",
    ""
  );
  const inferred = api.parseCandidates(parsed, aliases, {
    allowTitleFallbackCharacterTags: true,
    strictCharacterTagNames: true
  });
  assert.ok(
    !inferred.characters.some(character => api.normalize(character.name) === api.normalize(malformedName)),
    "malformed character tag was inferred again: " + malformedName
  );
}

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
