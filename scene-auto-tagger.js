/**
 * Scene Auto-Tagger - Embedded JS plugin for Stash v0.30.1+
 *
 * Safety posture:
 * - dryRun defaults to true
 * - dryRun never calls create/update mutations
 * - review confidence never applies inferred metadata
 * - existing groups/tags are preserved by additive updates
 * - existing studio is preserved unless allowOverwriteExistingMetadata is true
 *
 * Logging:
 * - All plugin-visible output goes through console.log for Stash v0.30.1.
 * - If the runtime exposes log/progress helpers, the plugin also attempts to use them.
 */

const PLUGIN_VERSION = "0.1.16";

safeConsoleLog("[scene-auto-tagger] STARTUP version=" + PLUGIN_VERSION + " mode=embedded-js dryRunDefault=true");

// ============================ CONFIG & CONSTANTS ============================

const DEFAULT_CONFIG = {
  dryRun: true,
  createMissingTags: true,
  createMissingGroups: true,
  createMissingStudios: true,
  confidenceThreshold: 0.9,
  characterParentTag: "Characters",
  addNeedsReviewTag: true,
  removeNeedsReviewOnApply: false,
  allowOverwriteExistingMetadata: false,
  discoverScenesWhenNoSceneIds: true,
  sceneDiscoveryLimit: 25,
  sceneDiscoveryPage: 1,
  sceneDiscoverySort: "id",
  sceneDiscoveryDirection: "DESC",
  sceneDiscoveryQuery: "",
  sceneDiscoveryOnlyUnorganized: true,
  sceneDiscoveryOnlyIncomplete: true,
  sceneDiscoveryIncludeMissingStudioOnly: false,
  sceneDiscoverySkipNeedsReview: true,
  sceneDiscoveryOnlyActionable: true,
  sceneDiscoveryRepairNeedsReview: true,
  sceneDiscoveryPageSize: 100,
  sceneDiscoveryScanPages: 50,
  allowDiscoveredWrites: false,
  useRuntimeStashAliases: true,
  runtimeAliasPageSize: 250,
  runtimeAliasScanPages: 40,
  runtimeAliasIncludeTopLevelTagAliases: true,
  missReportLimit: 50
};

const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG);
const NEEDS_REVIEW_TAG = "Needs Review";

const CSV_COLUMNS = [
  "timestamp", "run_id", "mode", "hook_type", "scene_id", "scene_title", "scene_path",
  "current_studio_id", "current_group_ids", "current_tag_ids",
  "detected_studios", "detected_groups", "detected_characters",
  "matched_studio_id", "matched_group_ids", "matched_tag_ids",
  "confidence_studio", "confidence_group", "confidence_character_tags",
  "final_confidence", "action_taken", "result", "error"
];

const CSV_HEADER = CSV_COLUMNS.join(",");
const BULK_PROGRESS_INTERVAL = 5;
const MAX_SCENE_DISCOVERY_LIMIT = 100;

const GENERIC_FOLDER_NAMES = makeSet([
  "animation", "animations", "download", "downloads", "hydrafxx", "rule34",
  "scene", "scenes", "video", "videos", "3d", "content", "new", "misc"
]);

const JUNK_CHARACTER_TOKENS = makeSet([
  "1080p", "720p", "2160p", "4k", "8k", "hd", "uhd", "web", "webdl", "reencode",
  "re encode", "cam", "camera", "part", "pt", "version", "ver", "scene",
  "anal", "bj", "blowjob", "cowgirl", "missionary", "reverse", "threesome",
  "teased", "fucked", "fuck", "fucks", "ride", "riding", "vibrator", "sofa",
  "office", "bathroom", "beach", "woods", "pod", "ball", "christmas", "backshot"
]);

const NON_CHARACTER_TAG_NAMES = makeSet([
  "needs review", "character", "characters", "animated", "animation", "animations",
  "loop", "nude", "white", "black", "blue", "red", "green", "yellow", "pink",
  "4k", "1080p", "720p", "vr", "video", "scene", "scenes", "unknown"
]);

// Embedded fallback generated from aliases.json. Runtime args may override/extend it.
const EMBEDDED_ALIASES = {
  studios: {
    "overwatch": "Overwatch",
    "ow": "Overwatch",
    "rule34": "Rule34",
    "final fantasy": "Final Fantasy",
    "ff": "Final Fantasy",
    "resident evil": "Resident Evil",
    "re": "Resident Evil",
    "devil may cry": "Devil May Cry",
    "dmc": "Devil May Cry",
    "street fighter": "Street Fighter",
    "sf army": "Street Fighter",
    "king of fighters": "King of Fighters",
    "kof": "King of Fighters",
    "soul calibur": "Soul Calibur",
    "paragon": "Paragon",
    "pixar": "Pixar",
    "dead or alive": "Dead or Alive",
    "doa": "Dead or Alive",
    "tekken": "Tekken",
    "metroid": "Metroid",
    "nioh": "Nioh",
    "stellar blade": "Stellar Blade",
    "baldur's gate 3": "Baldur's Gate 3",
    "baldurs gate 3": "Baldur's Gate 3",
    "bg3": "Baldur's Gate 3",
    "nier automata": "Nier: Automata",
    "nier": "Nier: Automata",
    "uncharted": "Uncharted",
    "league of legends": "League of Legends",
    "lol": "League of Legends",
    "atomic heart": "Atomic Heart",
    "genshin": "Genshin Impact",
    "genshin impact": "Genshin Impact",
    "the ring": "The Ring",
    "ringu": "The Ring",
    "expedition 33": "Expedition 33",
    "clair obscur": "Expedition 33",
    "clair obscur expedition 33": "Expedition 33",
    "cyberpunk": "Cyberpunk 2077",
    "cyberpunk 2077": "Cyberpunk 2077",
    "monster hunter": "Monster Hunter",
    "elden ring": "Elden Ring",
    "legend of zelda": "Legend of Zelda",
    "zelda": "Legend of Zelda",
    "tomb raider": "Tomb Raider",
    "teen titans": "Teen Titans",
    "life is strange": "Life Is Strange",
    "dc": "DC Comics",
    "dc comics": "DC Comics",
    "marvel": "Marvel",
    "the witcher": "The Witcher",
    "witcher": "The Witcher",
    "detroit become human": "Detroit: Become Human",
    "dbh": "Detroit: Become Human",
    "rainbow six siege": "Rainbow Six Siege",
    "r6": "Rainbow Six Siege"
  },
  groups: {
    "bewyx": "Bewyx",
    "bewyx_": "Bewyx",
    "artistname": "Artist Name",
    "idemi": "Idemi",
    "hydrafxx": "HydraFXX",
    "hydra fxx": "HydraFXX",
    "bulgingsenpai": "BulgingSenpai",
    "bulging senpai": "BulgingSenpai",
    "bouquetman": "Bouquetman",
    "lvl3toaster": "Lvl3Toaster",
    "lvl3 toaster": "Lvl3Toaster",
    "secazz": "Secazz",
    "pantsushi": "Pantsushi",
    "erovirus": "EroVirus",
    "waifuenjoyer": "WaifuEnjoyer",
    "entduke": "Entduke",
    "aphy3d": "Aphy3D",
    "nagoonimation": "Nagoonimation",
    "milkychu": "Milkychu",
    "darkdreamsvr": "DarkDreamsVR",
    "leeterr": "Leeterr",
    "creamtau": "CreamTau",
    "gretdb": "GretDB",
    "conseitnsfw": "ConseiTNSFW",
    "saveass": "SaveAss",
    "rein": "Rein",
    "mept44": "Mept44",
    "thecount": "TheCount",
    "ffpanda": "FFPanda",
    "splucky": "Splucky",
    "redmoa": "Redmoa",
    "timpossible": "Timpossible",
    "jewelz blu": "Jewelz Blu",
    "nsfwmegaera": "NSFWmegaera",
    "niki3d": "Niki3D",
    "xholy3dx": "xHoly3Dx",
    "ryanreos": "RyanReos",
    "cerbskies": "CerbSkies",
    "lazyprocrastinator": "LazyProcrastinator",
    "rouse3d": "Rouse3D",
    "evilbaka": "Evilbaka",
    "iamfgn": "iamfgn",
    "polishedjadebell": "PolishedJadeBell",
    "axenanim": "AxenAnim",
    "axen anim": "AxenAnim"
  },
  characters: {
    "mei": "Mei",
    "tracer": "Tracer",
    "widowmaker": "Widowmaker",
    "widow": "Widowmaker",
    "d.va": "D.Va",
    "dva": "D.Va",
    "dv.a": "D.Va",
    "juno": "Juno",
    "ashley graham": "Ashley Graham",
    "ashley": "Ashley Graham",
    "leon": "Leon Kennedy",
    "leon kennedy": "Leon Kennedy",
    "bela": "Bela Dimitrescu",
    "bela dimitrescu": "Bela Dimitrescu",
    "cassandra": "Cassandra Dimitrescu",
    "cassandra dimitrescu": "Cassandra Dimitrescu",
    "ethan": "Ethan Winters",
    "ethan winters": "Ethan Winters",
    "eve": "Eve",
    "shadowheart": "Shadowheart",
    "sophitia": "Sophitia",
    "countess": "Countess",
    "countess paragon": "Countess",
    "starfire": "Starfire",
    "raven": "Raven",
    "shani": "Shani",
    "juri": "Juri",
    "cammy": "Cammy White",
    "cammy white": "Cammy White",
    "chun li": "Chun-Li",
    "chun-li": "Chun-Li",
    "chunli": "Chun-Li",
    "taki": "Taki",
    "ayane": "Ayane",
    "honoka": "Honoka",
    "nyotengu": "Nyotengu",
    "nyo": "Nyotengu",
    "marie rose": "Marie Rose",
    "marie": "Marie Rose",
    "sayuri": "Sayuri",
    "lobelia": "Lobelia",
    "tsukushi": "Tsukushi",
    "ivy": "Ivy Valentine",
    "ivy valentine": "Ivy Valentine",
    "hilde": "Hilde",
    "setsuka": "Setsuka",
    "tira": "Tira",
    "angel halloween": "Angel",
    "asuka": "Asuka Kazama",
    "aunt cass": "Aunt Cass",
    "cass instant loss": "Cassandra Alexandra",
    "cass mating press": "Cassandra Alexandra",
    "devil kazumi": "Devil Kazumi",
    "kazumi": "Kazumi Mishima",
    "eliza": "Eliza",
    "josie": "Josie Rizal",
    "julia": "Julia Chang",
    "kunimitsu": "Kunimitsu",
    "lili": "Lili",
    "karin": "Karin",
    "menat": "Menat",
    "sakura": "Sakura",
    "kula": "Kula Diamond",
    "leona": "Leona Heidern",
    "mai": "Mai Shiranui",
    "shermie": "Shermie",
    "maria": "Maria",
    "okatsu": "Okatsu",
    "2p": "2P",
    "samus": "Samus",
    "melina": "Melina",
    "marika": "Marika",
    "tifa": "Tifa Lockhart",
    "tifa lockhart": "Tifa Lockhart",
    "panam": "Panam Palmer",
    "panam palmer": "Panam Palmer",
    "ballerina": "Ballerina",
    "the twins": "The Twins",
    "twins": "The Twins",
    "jinx": "Jinx",
    "mona": "Mona",
    "sadako": "Sadako",
    "witch": "Witch",
    "lune": "Lune",
    "2b": "2B",
    "a2": "A2",
    "9s": "9S",
    "aerith": "Aerith",
    "aerith gainsborough": "Aerith",
    "cloud": "Cloud",
    "lady": "Lady",
    "jessie": "Jessie Rasberry",
    "jessie rasberry": "Jessie Rasberry",
    "lightning": "Lightning",
    "rebecca": "Rebecca Chambers",
    "rebecca chambers": "Rebecca Chambers",
    "sheva": "Sheva Alomar",
    "sheva alomar": "Sheva Alomar",
    "elena fisher": "Elena Fisher",
    "rachel amber": "Rachel Amber",
    "harley": "Harley Quinn",
    "harley quinn": "Harley Quinn",
    "gwen": "Gwen Stacy",
    "gwen stacy": "Gwen Stacy",
    "jill": "Jill Valentine",
    "jill valentine": "Jill Valentine",
    "ingrid hunnigan": "Ingrid Hunnigan",
    "hunnigan": "Ingrid Hunnigan",
    "yennefer": "Yennefer",
    "mizora": "Mizora",
    "wyll": "Wyll",
    "kara": "Kara",
    "clive": "Clive Rosfield",
    "clive rosfield": "Clive Rosfield",
    "claire": "Claire Redfield",
    "claire redfield": "Claire Redfield",
    "ada": "Ada Wong",
    "ada wong": "Ada Wong",
    "mercy": "Mercy",
    "pharah": "Pharah",
    "lara": "Lara Croft",
    "lara croft": "Lara Croft",
    "drake": "Nathan Drake",
    "nathan drake": "Nathan Drake",
    "loba": "Loba",
    "nico": "Nico",
    "nero": "Nero",
    "ahsoka": "Ahsoka Tano",
    "ahsoka tano": "Ahsoka Tano",
    "ela": "Ela",
    "dokkaebi": "Dokkaebi",
    "bloodrayne": "Bloodrayne"
  },
  characterStudios: {
    "mei": "Overwatch",
    "tracer": "Overwatch",
    "widowmaker": "Overwatch",
    "widow": "Overwatch",
    "d.va": "Overwatch",
    "dva": "Overwatch",
    "juno": "Overwatch",
    "mercy": "Overwatch",
    "pharah": "Overwatch",
    "ashley graham": "Resident Evil",
    "ashley": "Resident Evil",
    "leon": "Resident Evil",
    "leon kennedy": "Resident Evil",
    "claire": "Resident Evil",
    "claire redfield": "Resident Evil",
    "ada": "Resident Evil",
    "ada wong": "Resident Evil",
    "bela": "Resident Evil",
    "bela dimitrescu": "Resident Evil",
    "cassandra": "Resident Evil",
    "cassandra dimitrescu": "Resident Evil",
    "ethan": "Resident Evil",
    "ethan winters": "Resident Evil",
    "rachel amber": "Life Is Strange",
    "harley quinn": "DC Comics",
    "gwen stacy": "Marvel",
    "jill": "Resident Evil",
    "jill valentine": "Resident Evil",
    "ingrid hunnigan": "Resident Evil",
    "hunnigan": "Resident Evil",
    "yennefer": "The Witcher",
    "mizora": "Baldur's Gate 3",
    "wyll": "Baldur's Gate 3",
    "kara": "Detroit: Become Human",
    "clive": "Final Fantasy",
    "clive rosfield": "Final Fantasy",
    "tifa": "Final Fantasy",
    "tifa lockhart": "Final Fantasy",
    "aerith": "Final Fantasy",
    "aerith gainsborough": "Final Fantasy",
    "cloud": "Final Fantasy",
    "lady": "Devil May Cry",
    "jessie": "Final Fantasy",
    "jessie rasberry": "Final Fantasy",
    "lightning": "Final Fantasy",
    "rebecca": "Resident Evil",
    "rebecca chambers": "Resident Evil",
    "sheva": "Resident Evil",
    "sheva alomar": "Resident Evil",
    "elena fisher": "Uncharted",
    "2b": "Nier: Automata",
    "a2": "Nier: Automata",
    "9s": "Nier: Automata",
    "lara": "Tomb Raider",
    "lara croft": "Tomb Raider",
    "loba": "Apex Legends",
    "nico": "Devil May Cry",
    "nero": "Devil May Cry",
    "ahsoka": "Star Wars",
    "ela": "Rainbow Six Siege",
    "dokkaebi": "Rainbow Six Siege",
    "eve": "Stellar Blade",
    "shadowheart": "Baldur's Gate 3",
    "sophitia": "Soul Calibur",
    "countess": "Paragon",
    "starfire": "Teen Titans",
    "raven": "Teen Titans",
    "shani": "The Witcher",
    "taki": "Soul Calibur",
    "juri": "Street Fighter",
    "cammy": "Street Fighter",
    "cammy white": "Street Fighter",
    "chun li": "Street Fighter",
    "chunli": "Street Fighter",
    "ayane": "Dead or Alive",
    "honoka": "Dead or Alive",
    "nyotengu": "Dead or Alive",
    "nyo": "Dead or Alive",
    "marie rose": "Dead or Alive",
    "marie": "Dead or Alive",
    "sayuri": "Dead or Alive",
    "lobelia": "Dead or Alive",
    "tsukushi": "Dead or Alive",
    "ivy": "Soul Calibur",
    "ivy valentine": "Soul Calibur",
    "hilde": "Soul Calibur",
    "setsuka": "Soul Calibur",
    "tira": "Soul Calibur",
    "angel": "King of Fighters",
    "asuka": "Tekken",
    "asuka kazama": "Tekken",
    "aunt cass": "Pixar",
    "cass instant loss": "Soul Calibur",
    "cass mating press": "Soul Calibur",
    "cassandra alexandra": "Soul Calibur",
    "devil kazumi": "Tekken",
    "kazumi": "Tekken",
    "kazumi mishima": "Tekken",
    "eliza": "Tekken",
    "josie": "Tekken",
    "josie rizal": "Tekken",
    "julia": "Tekken",
    "julia chang": "Tekken",
    "kunimitsu": "Tekken",
    "lili": "Tekken",
    "karin": "Street Fighter",
    "menat": "Street Fighter",
    "sakura": "Street Fighter",
    "kula": "King of Fighters",
    "kula diamond": "King of Fighters",
    "leona": "King of Fighters",
    "leona heidern": "King of Fighters",
    "mai": "King of Fighters",
    "mai shiranui": "King of Fighters",
    "shermie": "King of Fighters",
    "maria": "Nioh",
    "okatsu": "Nioh",
    "2p": "Nier: Automata",
    "samus": "Metroid",
    "melina": "Elden Ring",
    "marika": "Elden Ring",
    "panam": "Cyberpunk 2077",
    "ballerina": "Atomic Heart",
    "the twins": "Atomic Heart",
    "twins": "Atomic Heart",
    "mona": "Genshin Impact",
    "sadako": "The Ring",
    "witch": "Resident Evil",
    "lune": "Expedition 33",
    "jinx": "League of Legends",
    "bloodrayne": "BloodRayne"
  }
};

// ============================ PURE UTILITIES ============================

function makeSet(values) {
  const s = {};
  for (const v of values) s[normalize(v)] = true;
  return s;
}

function normalize(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(name) {
  if (!name) return name;
  return String(name).replace(/\b\w/g, c => c.toUpperCase());
}

function uniq(values) {
  const out = [];
  const seen = {};
  for (const v of values || []) {
    const key = String(v);
    if (!seen[key]) {
      seen[key] = true;
      out.push(v);
    }
  }
  return out;
}

function uniqByName(candidates) {
  const out = [];
  const seen = {};
  for (const c of candidates || []) {
    const key = normalize(c && c.name);
    if (key && !seen[key]) {
      seen[key] = true;
      out.push(c);
    }
  }
  return out;
}

function tokenizeText(text) {
  return normalize(text).split(/\s+/).filter(Boolean);
}

function pathParts(fullPath) {
  return String(fullPath || "").split(/[\\/]/).filter(Boolean);
}

function tokenizePathAndName(fullPath, title, details) {
  const parts = pathParts(fullPath);
  const baseWithExt = parts.length ? parts[parts.length - 1] : "";
  const baseRaw = baseWithExt.replace(/\.[^.]+$/, "");
  const foldersRaw = parts.slice(0, -1);
  const folderRaw = foldersRaw.length ? foldersRaw[foldersRaw.length - 1] : "";
  const combined = [foldersRaw.join(" "), baseRaw, title || "", details || ""].join(" ");
  return {
    folder: normalize(folderRaw),
    folderRaw,
    folders: foldersRaw.map(normalize),
    foldersRaw,
    base: normalize(baseWithExt),
    baseRaw,
    tokens: tokenizeText(combined)
  };
}

function splitArtistAndTitle(baseRaw) {
  const parts = String(baseRaw || "").split(/\s+[-\u2013\u2014]\s+/);
  if (parts.length <= 1) return { artistRaw: "", titleRaw: baseRaw || "" };
  return {
    artistRaw: parts[0].trim(),
    titleRaw: parts.slice(1).join(" - ").trim()
  };
}

function parseMaybeJSON(value) {
  if (!value || typeof value !== "string") return value || {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function parsePluginArgValue(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

function coerceBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const n = normalize(value);
    if (["true", "yes", "y", "1", "on"].includes(n)) return true;
    if (["false", "no", "n", "0", "off"].includes(n)) return false;
  }
  return fallback;
}

function normalizeThreshold(value) {
  let n = Number(value);
  if (!isFinite(n) || n <= 0) return DEFAULT_CONFIG.confidenceThreshold;
  if (n > 1) n = n / 100;
  return Math.max(0, Math.min(1, n));
}

function coercePositiveInt(value, fallback, min, max) {
  const n = Number(value);
  if (!isFinite(n)) return fallback;
  const rounded = Math.floor(n);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function normalizeSortDirection(value) {
  const n = normalize(value || DEFAULT_CONFIG.sceneDiscoveryDirection);
  if (n === "asc" || n === "ascending") return "ASC";
  return "DESC";
}

function normalizeSceneIds(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) {
    return uniq(value.map(v => String(v).trim()).filter(Boolean));
  }
  if (typeof value === "number") return [String(value)];
  if (typeof value === "string") {
    return uniq(value.split(/[,\s|]+/).map(v => v.trim()).filter(Boolean));
  }
  return [];
}

function normalizePluginArgInput(value) {
  if (!Array.isArray(value)) return value || {};
  const out = {};
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const key = item.name || item.key || item.Name || item.Key;
    if (!key) continue;
    let rawValue = item.value;
    if (rawValue === undefined) rawValue = item.Value;
    if (rawValue === undefined) rawValue = item.val;
    if (rawValue === undefined) rawValue = item.Val;
    out[key] = parsePluginArgValue(rawValue);
  }
  return out;
}

function directConfigFrom(source) {
  const out = {};
  if (!source || typeof source !== "object") return out;
  for (const key of CONFIG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key];
  }
  return out;
}

function normalizeConfig(config) {
  const merged = { ...DEFAULT_CONFIG, ...(config || {}) };
  merged.dryRun = coerceBoolean(merged.dryRun, DEFAULT_CONFIG.dryRun);
  merged.createMissingTags = coerceBoolean(merged.createMissingTags, DEFAULT_CONFIG.createMissingTags);
  merged.createMissingGroups = coerceBoolean(merged.createMissingGroups, DEFAULT_CONFIG.createMissingGroups);
  merged.createMissingStudios = coerceBoolean(merged.createMissingStudios, DEFAULT_CONFIG.createMissingStudios);
  merged.addNeedsReviewTag = coerceBoolean(merged.addNeedsReviewTag, DEFAULT_CONFIG.addNeedsReviewTag);
  merged.removeNeedsReviewOnApply = coerceBoolean(
    merged.removeNeedsReviewOnApply,
    DEFAULT_CONFIG.removeNeedsReviewOnApply
  );
  merged.allowOverwriteExistingMetadata = coerceBoolean(
    merged.allowOverwriteExistingMetadata,
    DEFAULT_CONFIG.allowOverwriteExistingMetadata
  );
  merged.discoverScenesWhenNoSceneIds = coerceBoolean(
    merged.discoverScenesWhenNoSceneIds,
    DEFAULT_CONFIG.discoverScenesWhenNoSceneIds
  );
  merged.sceneDiscoveryLimit = coercePositiveInt(
    merged.sceneDiscoveryLimit,
    DEFAULT_CONFIG.sceneDiscoveryLimit,
    1,
    MAX_SCENE_DISCOVERY_LIMIT
  );
  merged.sceneDiscoveryPage = coercePositiveInt(
    merged.sceneDiscoveryPage,
    DEFAULT_CONFIG.sceneDiscoveryPage,
    1,
    1000000
  );
  merged.sceneDiscoverySort = String(merged.sceneDiscoverySort || DEFAULT_CONFIG.sceneDiscoverySort);
  merged.sceneDiscoveryDirection = normalizeSortDirection(merged.sceneDiscoveryDirection);
  merged.sceneDiscoveryQuery = String(merged.sceneDiscoveryQuery || "");
  merged.sceneDiscoveryOnlyUnorganized = coerceBoolean(
    merged.sceneDiscoveryOnlyUnorganized,
    DEFAULT_CONFIG.sceneDiscoveryOnlyUnorganized
  );
  merged.sceneDiscoveryOnlyIncomplete = coerceBoolean(
    merged.sceneDiscoveryOnlyIncomplete,
    DEFAULT_CONFIG.sceneDiscoveryOnlyIncomplete
  );
  merged.sceneDiscoveryIncludeMissingStudioOnly = coerceBoolean(
    merged.sceneDiscoveryIncludeMissingStudioOnly,
    DEFAULT_CONFIG.sceneDiscoveryIncludeMissingStudioOnly
  );
  merged.sceneDiscoverySkipNeedsReview = coerceBoolean(
    merged.sceneDiscoverySkipNeedsReview,
    DEFAULT_CONFIG.sceneDiscoverySkipNeedsReview
  );
  merged.sceneDiscoveryOnlyActionable = coerceBoolean(
    merged.sceneDiscoveryOnlyActionable,
    DEFAULT_CONFIG.sceneDiscoveryOnlyActionable
  );
  merged.sceneDiscoveryRepairNeedsReview = coerceBoolean(
    merged.sceneDiscoveryRepairNeedsReview,
    DEFAULT_CONFIG.sceneDiscoveryRepairNeedsReview
  );
  merged.sceneDiscoveryPageSize = coercePositiveInt(
    merged.sceneDiscoveryPageSize,
    DEFAULT_CONFIG.sceneDiscoveryPageSize,
    1,
    MAX_SCENE_DISCOVERY_LIMIT
  );
  merged.sceneDiscoveryScanPages = coercePositiveInt(
    merged.sceneDiscoveryScanPages,
    DEFAULT_CONFIG.sceneDiscoveryScanPages,
    1,
    1000
  );
  merged.allowDiscoveredWrites = coerceBoolean(
    merged.allowDiscoveredWrites,
    DEFAULT_CONFIG.allowDiscoveredWrites
  );
  merged.useRuntimeStashAliases = coerceBoolean(
    merged.useRuntimeStashAliases,
    DEFAULT_CONFIG.useRuntimeStashAliases
  );
  merged.runtimeAliasPageSize = coercePositiveInt(
    merged.runtimeAliasPageSize,
    DEFAULT_CONFIG.runtimeAliasPageSize,
    1,
    1000
  );
  merged.runtimeAliasScanPages = coercePositiveInt(
    merged.runtimeAliasScanPages,
    DEFAULT_CONFIG.runtimeAliasScanPages,
    1,
    1000
  );
  merged.runtimeAliasIncludeTopLevelTagAliases = coerceBoolean(
    merged.runtimeAliasIncludeTopLevelTagAliases,
    DEFAULT_CONFIG.runtimeAliasIncludeTopLevelTagAliases
  );
  merged.missReportLimit = coercePositiveInt(
    merged.missReportLimit,
    DEFAULT_CONFIG.missReportLimit,
    0,
    1000
  );
  merged.confidenceThreshold = normalizeThreshold(merged.confidenceThreshold);
  merged.characterParentTag = String(merged.characterParentTag || DEFAULT_CONFIG.characterParentTag);
  return merged;
}

function mergeAliasMaps(base, override) {
  const rawOverride = parseMaybeJSON(override);
  const merged = {
    studios: { ...((base && base.studios) || {}) },
    groups: { ...((base && base.groups) || {}) },
    characters: { ...((base && base.characters) || {}) },
    characterStudios: { ...((base && base.characterStudios) || {}) }
  };
  for (const category of Object.keys(merged)) {
    if (rawOverride && rawOverride[category] && typeof rawOverride[category] === "object") {
      merged[category] = { ...merged[category], ...rawOverride[category] };
    }
  }
  return normalizeAliasMap(merged);
}

function normalizeAliasMap(aliasMap) {
  const out = { studios: {}, groups: {}, characters: {}, characterStudios: {} };
  const input = aliasMap || {};
  for (const category of Object.keys(out)) {
    const map = input[category] || {};
    for (const key of Object.keys(map)) {
      const norm = normalize(key);
      if (norm) out[category][norm] = map[key];
    }
  }
  return out;
}

function buildRuntimeOptions(args) {
  const inputObject = args || {};
  const raw = normalizePluginArgInput(inputObject.args || inputObject.Args || inputObject);
  const argsMap = normalizePluginArgInput(raw.args_map || raw.argsMap || {});
  const config = normalizeConfig({
    ...directConfigFrom(raw),
    ...directConfigFrom(argsMap),
    ...parseMaybeJSON(raw.config),
    ...parseMaybeJSON(argsMap.config)
  });
  const aliasOverride = raw.aliases !== undefined ? raw.aliases : argsMap.aliases;
  const aliasMap = mergeAliasMaps(EMBEDDED_ALIASES, aliasOverride);
  const sceneIds = normalizeSceneIds(raw.scene_ids || raw.sceneIds || argsMap.scene_ids || argsMap.sceneIds);
  return { config, aliasMap, aliasOverride, sceneIds };
}

function containsPhrase(normalizedText, normalizedPhrase) {
  if (!normalizedText || !normalizedPhrase) return false;
  return (" " + normalizedText + " ").indexOf(" " + normalizedPhrase + " ") !== -1;
}

function phraseIndex(normalizedText, normalizedPhrase) {
  if (!normalizedText || !normalizedPhrase) return -1;
  return (" " + normalizedText + " ").indexOf(" " + normalizedPhrase + " ");
}

function findAliasMatches(text, aliasCategoryMap, options) {
  const opts = options || {};
  const normText = normalize(text);
  const matches = [];
  const seen = {};
  const hits = [];

  for (const key of Object.keys(aliasCategoryMap || {})) {
    if (opts.skipShortFreeText && key.length < 3 && !/\d/.test(key)) continue;
    const index = phraseIndex(normText, key);
    if (index < 0) continue;
    hits.push({ key, index });
  }

  hits.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return b.key.length - a.key.length;
  });

  for (const hit of hits) {
    const key = hit.key;
    const canonical = aliasCategoryMap[key];
    const dedupeKey = normalize(canonical);
    if (dedupeKey && !seen[dedupeKey]) {
      seen[dedupeKey] = true;
      matches.push({ key, name: canonical, index: hit.index });
    }
  }
  return matches;
}

function resolveWithAliases(candidates, aliasMap, category) {
  const map = normalizeAliasMap(aliasMap || {})[category] || {};
  const resolved = [];
  for (const c of candidates || []) {
    const norm = normalize(c);
    resolved.push(map[norm] || c);
  }
  return uniq(resolved);
}

function scoreConfidence(candidate, context) {
  if (!candidate) return 0;
  const c = context || {};
  let score = 0.6;
  if (c.isExactAlias) score = 0.97;
  else if (c.isCharacterStudio) score = 0.93;
  else if (c.isFolderAlias) score = 0.92;
  else if (c.isFolderMatch) score = 0.82;
  else if (c.isCleanFallback) score = 0.55;
  if (String(candidate).length <= 12 && /^[a-z0-9 .:]+$/i.test(String(candidate))) score += 0.02;
  return Math.min(1.0, Math.max(0.0, score));
}

function fieldDecision(score, threshold) {
  if (!score) return "skip";
  if (score >= threshold) return "apply";
  if (score >= 0.6) return "review";
  return "skip";
}

function computeDecision(studioScore, groupScore, charScore, threshold) {
  const studio = { score: studioScore || 0, decision: fieldDecision(studioScore || 0, threshold) };
  const group = { score: groupScore || 0, decision: fieldDecision(groupScore || 0, threshold) };
  const character = { score: charScore || 0, decision: fieldDecision(charScore || 0, threshold) };
  const consideredScores = [studio, group, character]
    .filter(d => d.decision !== "skip")
    .map(d => d.score)
    .filter(s => s > 0);
  const final = consideredScores.length ? Math.min(...consideredScores) : 0;
  const needsReview = [studio, group, character].some(d => d.decision === "review");
  const hasApply = [studio, group, character].some(d => d.decision === "apply");
  return {
    studio,
    group,
    character,
    finalConfidence: final,
    needsReview,
    overallDecision: needsReview ? "review" : (hasApply ? "apply" : "skip")
  };
}

function parseCandidates(parsed, aliasMap) {
  const aliases = normalizeAliasMap(aliasMap || EMBEDDED_ALIASES);
  const baseSplit = splitArtistAndTitle(parsed.baseRaw);
  const titleText = [baseSplit.titleRaw, parsed.folderRaw, parsed.foldersRaw.join(" ")].join(" ");
  const fullText = [parsed.baseRaw, parsed.folderRaw, parsed.foldersRaw.join(" ")].join(" ");
  const studios = [];
  const groups = [];
  const characters = [];

  const explicitStudioMatches = findAliasMatches(baseSplit.titleRaw, aliases.studios, { skipShortFreeText: true });
  for (const m of explicitStudioMatches) {
    studios.push({
      name: m.name,
      source: "alias",
      score: scoreConfidence(m.name, { isExactAlias: true })
    });
  }

  for (let i = parsed.foldersRaw.length - 1; i >= 0; i--) {
    const folderRaw = parsed.foldersRaw[i];
    const folderNorm = normalize(folderRaw);
    if (!folderNorm || GENERIC_FOLDER_NAMES[folderNorm]) continue;
    const canonical = aliases.studios[folderNorm];
    if (canonical) {
      studios.push({
        name: canonical,
        source: "folder_alias",
        score: scoreConfidence(canonical, { isFolderAlias: true })
      });
      break;
    }
  }

  const groupNorm = normalize(baseSplit.artistRaw);
  if (groupNorm) {
    const canonicalGroup = aliases.groups[groupNorm];
    groups.push({
      name: canonicalGroup || baseSplit.artistRaw.trim(),
      source: canonicalGroup ? "alias" : "fallback",
      score: scoreConfidence(canonicalGroup || baseSplit.artistRaw.trim(), canonicalGroup ? { isExactAlias: true } : { isCleanFallback: true })
    });
  }

  const charMatches = findAliasMatches(titleText, aliases.characters, { skipShortFreeText: false });
  for (const m of charMatches) {
    if (JUNK_CHARACTER_TOKENS[m.key]) continue;
    characters.push({
      name: m.name,
      source: "alias",
      score: scoreConfidence(m.name, { isExactAlias: true })
    });
  }

  const characterStudios = [];
  for (const ch of characters) {
    const charNorm = normalize(ch.name);
    const studioName = aliases.characterStudios[charNorm];
    if (studioName) characterStudios.push(studioName);
  }
  const uniqueCharacterStudios = uniq(characterStudios);
  if (!explicitStudioMatches.length && characterStudios.length) {
    const inferredStudio = characterStudios[0];
    studios.unshift({
      name: inferredStudio,
      source: uniqueCharacterStudios.length === 1 ? "character_studio" : "first_character_studio",
      score: scoreConfidence(inferredStudio, { isCharacterStudio: true })
    });
  }

  return {
    studios: uniqByName(studios),
    groups: uniqByName(groups),
    characters: uniqByName(characters),
    fullText
  };
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function setUnion(a, values) {
  const out = new Set(a || []);
  for (const v of values || []) if (v) out.add(String(v));
  return out;
}

function compareBeforeWrite(proposed, current) {
  const sameStudio = (proposed.studioId || null) === (current.currentStudioId || null);
  const sameGroups = setsEqual(new Set(proposed.groupIds || []), current.currentGroupIds);
  const sameTags = setsEqual(new Set(proposed.tagIds || []), current.currentTagIds);
  return sameStudio && sameGroups && sameTags;
}

function buildUpdateInput(sceneId, finalAssignments, current) {
  const input = { id: sceneId };
  if ((finalAssignments.studioId || null) !== (current.currentStudioId || null)) {
    input.studio_id = finalAssignments.studioId || undefined;
  }
  if (!setsEqual(new Set(finalAssignments.groupIds), current.currentGroupIds)) {
    input.groups = finalAssignments.groupIds.map(id => ({ group_id: id }));
  }
  if (!setsEqual(new Set(finalAssignments.tagIds), current.currentTagIds)) {
    input.tag_ids = finalAssignments.tagIds;
  }
  return input;
}

function csvEscape(value) {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ============================ GRAPHQL LAYER ============================

function doGraphQL(query, variables, runtime, operationName) {
  const op = operationName || "GraphQL operation";
  let client = null;
  if (runtime && runtime.gql && typeof runtime.gql.Do === "function") client = runtime.gql;
  else if (runtime && typeof runtime.Do === "function") client = runtime;
  else if (typeof gql !== "undefined" && gql && typeof gql.Do === "function") client = gql;

  if (!client) {
    throw new Error("gql.Do not available in this Stash JS runtime for " + op);
  }

  try {
    return client.Do(query, variables || {});
  } catch (e) {
    throw new Error(op + " failed: " + String((e && e.message) || e));
  }
}

function emptyAliasMapObject() {
  return { studios: {}, groups: {}, characters: {}, characterStudios: {} };
}

function aliasValuesForObject(obj) {
  const aliases = obj && obj.aliases;
  if (!aliases) return [];
  if (Array.isArray(aliases)) return aliases.map(a => String(a || "").trim()).filter(Boolean);
  if (typeof aliases === "string") {
    return aliases.split(/[,|;\r\n]+/).map(a => a.trim()).filter(Boolean);
  }
  return [];
}

function addAliasValue(aliasMap, category, key, canonical) {
  if (!aliasMap || !aliasMap[category] || !key || !canonical) return false;
  const norm = normalize(key);
  if (!norm) return false;
  if (!aliasMap[category][norm]) {
    aliasMap[category][norm] = canonical;
    return true;
  }
  return false;
}

function addObjectNameAndAliases(aliasMap, category, obj, canonicalName) {
  const canonical = canonicalName || (obj && obj.name);
  let added = 0;
  if (!canonical) return added;
  if (addAliasValue(aliasMap, category, canonical, canonical)) added++;
  for (const alias of aliasValuesForObject(obj)) {
    if (addAliasValue(aliasMap, category, alias, canonical)) added++;
  }
  return added;
}

function fetchPagedGraphQL(query, variablesBase, rootKey, itemKey, config, runtime, opName) {
  const items = [];
  let total = 0;
  let pages = 0;
  const pageSize = config.runtimeAliasPageSize;
  for (let page = 1; page <= config.runtimeAliasScanPages; page++) {
    const variables = { ...(variablesBase || {}), filter: { page, per_page: pageSize } };
    const res = doGraphQL(query, variables, runtime, opName + " page " + page);
    const root = res && res[rootKey];
    const pageItems = (root && root[itemKey]) || [];
    if (page === 1) total = (root && root.count) || 0;
    pages++;
    for (const item of pageItems) items.push(item);
    if (pageItems.length < pageSize) break;
  }
  return { items, total, pages };
}

function fetchRuntimeStudios(config, runtime) {
  try {
    return fetchPagedGraphQL(
      FIND_STUDIOS_FOR_ALIAS_INDEX,
      {},
      "findStudios",
      "studios",
      config,
      runtime,
      "RuntimeAliasStudios"
    );
  } catch (err) {
    const fallback = fetchPagedGraphQL(
      FIND_STUDIOS_FOR_ALIAS_INDEX_NO_ALIASES,
      {},
      "findStudios",
      "studios",
      config,
      runtime,
      "RuntimeAliasStudiosNoAliases"
    );
    fallback.warning = String((err && err.message) || err);
    return fallback;
  }
}

function fetchRuntimeGroups(config, runtime) {
  return fetchPagedGraphQL(
    FIND_GROUPS_FOR_ALIAS_INDEX,
    {},
    "findGroups",
    "groups",
    config,
    runtime,
    "RuntimeAliasGroups"
  );
}

function fetchRuntimeTags(config, runtime) {
  return fetchPagedGraphQL(
    FIND_TAGS_FOR_ALIAS_INDEX,
    {},
    "findTags",
    "tags",
    config,
    runtime,
    "RuntimeAliasTags"
  );
}

function studioNameFromParents(parents, studioLookup) {
  const studios = (studioLookup && studioLookup.studios) || {};
  for (const parent of parents || []) {
    const parentName = parent && parent.name;
    const canonical = studios[normalize(parentName)];
    if (canonical) return canonical;
  }
  return null;
}

function tagHasParentNamed(tag, parentName) {
  const target = normalize(parentName);
  if (!target) return false;
  for (const parent of (tag && tag.parents) || []) {
    if (normalize(parent && parent.name) === target) return true;
  }
  return false;
}

function isSafeTopLevelAliasTag(tag) {
  const nameNorm = normalize(tag && tag.name);
  if (!nameNorm || NON_CHARACTER_TAG_NAMES[nameNorm] || JUNK_CHARACTER_TOKENS[nameNorm]) return false;
  if (((tag && tag.parents) || []).length) return false;
  return aliasValuesForObject(tag).length > 0;
}

function isRuntimeCharacterTag(tag, config, studioLookup) {
  const nameNorm = normalize(tag && tag.name);
  if (tag && tag.ignore_auto_tag) return false;
  if (!nameNorm || NON_CHARACTER_TAG_NAMES[nameNorm] || JUNK_CHARACTER_TOKENS[nameNorm]) return false;
  if (tagHasParentNamed(tag, config.characterParentTag)) return true;
  if (studioNameFromParents((tag && tag.parents) || [], studioLookup)) return true;
  return config.runtimeAliasIncludeTopLevelTagAliases && isSafeTopLevelAliasTag(tag);
}

function buildRuntimeStashAliasMap(runtime, configInput, baseAliasMapInput, runId) {
  const config = normalizeConfig(configInput);
  const dynamic = emptyAliasMapObject();
  const stats = {
    studios: 0,
    groups: 0,
    tags: 0,
    studioAliases: 0,
    groupAliases: 0,
    characterAliases: 0,
    characterStudioLinks: 0,
    warnings: []
  };

  if (!config.useRuntimeStashAliases) {
    pluginLog("RUNTIME_ALIAS_INDEX run=" + runId + " disabled", runtime);
    return normalizeAliasMap(dynamic);
  }

  try {
    const studioResult = fetchRuntimeStudios(config, runtime);
    if (studioResult.warning) stats.warnings.push("studio_aliases_unavailable");
    for (const studio of studioResult.items) {
      stats.studios++;
      stats.studioAliases += addObjectNameAndAliases(dynamic, "studios", studio);
    }
  } catch (err) {
    stats.warnings.push("studios_failed:" + String((err && err.message) || err));
  }

  try {
    const groupResult = fetchRuntimeGroups(config, runtime);
    for (const group of groupResult.items) {
      stats.groups++;
      stats.groupAliases += addObjectNameAndAliases(dynamic, "groups", group);
    }
  } catch (err) {
    stats.warnings.push("groups_failed:" + String((err && err.message) || err));
  }

  const baseAliasMap = normalizeAliasMap(baseAliasMapInput || EMBEDDED_ALIASES);
  const studioLookup = normalizeAliasMap({
    studios: { ...baseAliasMap.studios, ...dynamic.studios },
    groups: {},
    characters: {},
    characterStudios: {}
  });

  try {
    const tagResult = fetchRuntimeTags(config, runtime);
    for (const tag of tagResult.items) {
      stats.tags++;
      if (!isRuntimeCharacterTag(tag, config, studioLookup)) continue;

      const before = Object.keys(dynamic.characters).length;
      addObjectNameAndAliases(dynamic, "characters", tag);
      stats.characterAliases += Object.keys(dynamic.characters).length - before;

      const studioName = studioNameFromParents((tag && tag.parents) || [], studioLookup);
      if (studioName) {
        const names = [tag.name].concat(aliasValuesForObject(tag));
        for (const name of names) {
          if (addAliasValue(dynamic, "characterStudios", name, studioName)) {
            stats.characterStudioLinks++;
          }
        }
      }
    }
  } catch (err) {
    stats.warnings.push("tags_failed:" + String((err && err.message) || err));
  }

  pluginLog(
    "RUNTIME_ALIAS_INDEX run=" + runId +
    " studios=" + stats.studios +
    " groups=" + stats.groups +
    " tags=" + stats.tags +
    " studioAliases=" + stats.studioAliases +
    " groupAliases=" + stats.groupAliases +
    " characterAliases=" + stats.characterAliases +
    " characterStudioLinks=" + stats.characterStudioLinks +
    " warnings=" + (stats.warnings.length ? stats.warnings.join("|") : "none"),
    runtime
  );
  return normalizeAliasMap(dynamic);
}

function buildEffectiveAliasMap(options, runtime, runId) {
  const dynamic = buildRuntimeStashAliasMap(runtime, options.config, EMBEDDED_ALIASES, runId);
  return mergeAliasMaps(mergeAliasMaps(EMBEDDED_ALIASES, dynamic), options.aliasOverride);
}

function discoverSceneIds(configInput, runtime, runId, aliasMapInput) {
  const config = normalizeConfig(configInput);
  const aliasMap = normalizeAliasMap(aliasMapInput || EMBEDDED_ALIASES);
  const selected = [];
  let totalAvailable = 0;
  let pagesScanned = 0;
  const skipped = { needsReview: 0, noAction: 0, complete: 0 };
  const missReport = { emitted: 0, suppressed: 0 };
  const sceneFilter = config.sceneDiscoveryOnlyUnorganized ? { organized: false } : null;
  pluginLog(
    "BULK DISCOVERY run=" + runId +
    " limit=" + config.sceneDiscoveryLimit +
    " startPage=" + config.sceneDiscoveryPage +
    " pageSize=" + config.sceneDiscoveryPageSize +
    " scanPages=" + config.sceneDiscoveryScanPages +
    " sort=" + config.sceneDiscoverySort +
    " direction=" + config.sceneDiscoveryDirection +
    " onlyUnorganized=" + config.sceneDiscoveryOnlyUnorganized +
    " onlyIncomplete=" + config.sceneDiscoveryOnlyIncomplete +
    " includeMissingStudioOnly=" + config.sceneDiscoveryIncludeMissingStudioOnly +
    " skipNeedsReview=" + config.sceneDiscoverySkipNeedsReview +
    " onlyActionable=" + config.sceneDiscoveryOnlyActionable +
    " repairNeedsReview=" + config.sceneDiscoveryRepairNeedsReview,
    runtime
  );

  for (let i = 0; i < config.sceneDiscoveryScanPages && selected.length < config.sceneDiscoveryLimit; i++) {
    const page = config.sceneDiscoveryPage + i;
    const filter = {
      page,
      per_page: config.sceneDiscoveryPageSize,
      sort: config.sceneDiscoverySort,
      direction: config.sceneDiscoveryDirection
    };
    if (config.sceneDiscoveryQuery) filter.q = config.sceneDiscoveryQuery;

    const res = doGraphQL(
      FIND_SCENES_FOR_BULK,
      { scene_filter: sceneFilter, filter },
      runtime,
      "FindScenesForBulkAutoTagger"
    );
    const found = (res && res.findScenes) || {};
    const scenes = found.scenes || [];
    if (i === 0) totalAvailable = found.count || 0;
    pagesScanned++;

    for (const scene of scenes) {
      if (!scene || !scene.id) continue;
      const need = sceneAutoTaggingNeed(scene, config, aliasMap);
      if (config.sceneDiscoveryOnlyIncomplete && !need.needed) {
        if (need.reason === "needs_review") skipped.needsReview++;
        else if (need.reason === "no_actionable_candidates") {
          skipped.noAction++;
          if (missReport.emitted < config.missReportLimit) {
            emitMissCandidate(scene, need.reason, aliasMap, runtime, runId);
            missReport.emitted++;
          } else {
            missReport.suppressed++;
          }
        }
        else skipped.complete++;
        continue;
      }
      selected.push(String(scene.id));
      if (selected.length >= config.sceneDiscoveryLimit) break;
    }

    if (scenes.length < config.sceneDiscoveryPageSize) break;
  }

  pluginLog(
    "BULK DISCOVERY RESULT run=" + runId +
    " totalAvailable=" + totalAvailable +
    " pagesScanned=" + pagesScanned +
    " selected=" + selected.length +
    " skippedNeedsReview=" + skipped.needsReview +
    " skippedNoAction=" + skipped.noAction +
    " skippedComplete=" + skipped.complete +
    " missReports=" + missReport.emitted +
    " missReportsSuppressed=" + missReport.suppressed +
    " ids=" + selected.join("|"),
    runtime
  );
  return { sceneIds: selected, count: totalAvailable };
}

function sceneHasTagNamed(scene, tagName) {
  const target = normalize(tagName);
  for (const tag of scene.tags || []) {
    if (normalize(tag && tag.name) === target) return true;
  }
  return false;
}

function sceneTagIdsNamed(scene, tagName) {
  const target = normalize(tagName);
  const ids = [];
  for (const tag of (scene && scene.tags) || []) {
    if (normalize(tag && tag.name) === target && tag && tag.id) ids.push(String(tag.id));
  }
  return uniq(ids);
}

function primaryScenePath(scene) {
  const file = scene && scene.files && scene.files[0];
  return (file && (file.path || file.basename)) || "";
}

function logSafeValue(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/[\r\n|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokenHints(titleRaw) {
  const cleaned = String(titleRaw || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:extended|uncut|loop|part|pt|white|nude|gym|army|teleport)\b/gi, " ");
  const parts = cleaned
    .split(/\b(?:x|vs|v|and)\b|[,;+|/\\]+|\s+[-\u2013\u2014]\s+/i)
    .map(p => p.trim())
    .filter(Boolean);
  const hints = [];
  for (const part of parts) {
    const norm = normalize(part);
    if (!norm || JUNK_CHARACTER_TOKENS[norm] || NON_CHARACTER_TAG_NAMES[norm]) continue;
    hints.push(part);
  }
  return uniq(hints).slice(0, 12);
}

function emitMissCandidate(scene, reason, aliasMap, runtime, runId) {
  const filePath = primaryScenePath(scene);
  const parsed = tokenizePathAndName(filePath, scene && scene.title, scene && scene.details);
  const split = splitArtistAndTitle(parsed.baseRaw);
  const candidates = parseCandidates(parsed, aliasMap || EMBEDDED_ALIASES);
  const hints = titleTokenHints(split.titleRaw);
  pluginLog(
    "MISS_CANDIDATE run=" + runId +
    " scene=" + logSafeValue(scene && scene.id) +
    " reason=" + logSafeValue(reason) +
    " artist=" + logSafeValue(split.artistRaw) +
    " title=" + logSafeValue(split.titleRaw || (scene && scene.title)) +
    " hints=" + logSafeValue(hints.join(",")) +
    " detectedStudios=" + logSafeValue(candidates.studios.map(c => c.name).join(",")) +
    " detectedGroups=" + logSafeValue(candidates.groups.map(c => c.name).join(",")) +
    " detectedCharacters=" + logSafeValue(candidates.characters.map(c => c.name).join(",")),
    runtime
  );
}

function normalizedSceneGroupNames(scene) {
  const names = {};
  for (const item of (scene && scene.groups) || []) {
    const name = item && item.group && item.group.name;
    const norm = normalize(name);
    if (norm) names[norm] = true;
  }
  return names;
}

function normalizedSceneTagNames(scene) {
  const names = {};
  for (const tag of (scene && scene.tags) || []) {
    const norm = normalize(tag && tag.name);
    if (norm) names[norm] = true;
  }
  return names;
}

function candidateDecision(candidate, threshold) {
  return fieldDecision((candidate && candidate.score) || 0, threshold);
}

function sceneHasActionableCandidate(scene, config, aliasMap) {
  const filePath = primaryScenePath(scene);
  if (!filePath) return false;

  const parsed = tokenizePathAndName(filePath, scene.title, scene.details);
  const raw = parseCandidates(parsed, aliasMap || EMBEDDED_ALIASES);
  const threshold = config.confidenceThreshold;
  const hasNeedsReview = sceneHasTagNamed(scene, NEEDS_REVIEW_TAG);
  let hasApplyCandidate = false;
  const groupNames = normalizedSceneGroupNames(scene);
  const tagNames = normalizedSceneTagNames(scene);

  const studioCandidate = raw.studios[0] || null;
  if (studioCandidate && candidateDecision(studioCandidate, threshold) === "apply") {
    hasApplyCandidate = true;
    const currentStudioName = scene.studio && scene.studio.name;
    if (!scene.studio || !scene.studio.id) return true;
    if (config.allowOverwriteExistingMetadata && normalize(currentStudioName) !== normalize(studioCandidate.name)) return true;
  }

  for (const groupCandidate of raw.groups || []) {
    if (candidateDecision(groupCandidate, threshold) !== "apply") continue;
    hasApplyCandidate = true;
    if (!groupNames[normalize(groupCandidate.name)]) return true;
  }

  for (const characterCandidate of raw.characters || []) {
    if (candidateDecision(characterCandidate, threshold) !== "apply") continue;
    hasApplyCandidate = true;
    if (!tagNames[normalize(characterCandidate.name)]) return true;
  }

  if (hasNeedsReview && config.removeNeedsReviewOnApply && hasApplyCandidate) return true;
  return false;
}

function sceneAutoTaggingNeed(scene, configInput, aliasMapInput) {
  const config = normalizeConfig(configInput);
  const hasNeedsReview = sceneHasTagNamed(scene, NEEDS_REVIEW_TAG);

  if (config.sceneDiscoveryOnlyActionable) {
    const actionable = sceneHasActionableCandidate(scene, config, aliasMapInput || EMBEDDED_ALIASES);
    if (actionable && (!hasNeedsReview || config.sceneDiscoveryRepairNeedsReview || !config.sceneDiscoverySkipNeedsReview)) {
      return { needed: true, reason: "actionable" };
    }
    if (hasNeedsReview && config.sceneDiscoverySkipNeedsReview) return { needed: false, reason: "needs_review" };
    return { needed: false, reason: "no_actionable_candidates" };
  }

  if (config.sceneDiscoverySkipNeedsReview && hasNeedsReview) return { needed: false, reason: "needs_review" };
  const groups = scene.groups || [];
  const tags = scene.tags || [];
  if (!groups.length) return { needed: true, reason: "missing_groups" };
  if (!tags.length) return { needed: true, reason: "missing_tags" };
  if (config.sceneDiscoveryIncludeMissingStudioOnly && !(scene.studio && scene.studio.id)) {
    return { needed: true, reason: "missing_studio" };
  }
  return { needed: false, reason: "complete" };
}

function sceneNeedsAutoTagging(scene, configInput, aliasMapInput) {
  return sceneAutoTaggingNeed(scene, configInput, aliasMapInput).needed;
}

// ============================ CORE ORCHESTRATOR ============================

function processScene(sceneId, mode, configInput, aliasMapInput, runtime, runId, hookType) {
  const config = normalizeConfig(configInput);
  const aliasMap = normalizeAliasMap(aliasMapInput || EMBEDDED_ALIASES);
  const start = new Date().toISOString();
  const csvRow = {
    timestamp: start,
    run_id: runId || "manual",
    mode: mode || "bulk",
    hook_type: hookType || "",
    scene_id: sceneId,
    scene_title: "",
    scene_path: "",
    current_studio_id: "", current_group_ids: "", current_tag_ids: "",
    detected_studios: "", detected_groups: "", detected_characters: "",
    matched_studio_id: "", matched_group_ids: "", matched_tag_ids: "",
    confidence_studio: "", confidence_group: "", confidence_character_tags: "",
    final_confidence: "", action_taken: "", result: "", error: ""
  };

  try {
    const sceneData = doGraphQL(GET_SCENE, { id: sceneId }, runtime, "GetSceneForTagging");
    const scene = sceneData && sceneData.findScene;
    if (!scene) throw new Error("Scene not found: " + sceneId);

    csvRow.scene_title = scene.title || "";
    const filePath = (scene.files && scene.files[0] && scene.files[0].path) || "";
    csvRow.scene_path = filePath;

    const current = {
      currentStudioId: (scene.studio && scene.studio.id) || null,
      currentGroupIds: new Set((scene.groups || []).map(g => g && g.group && String(g.group.id)).filter(Boolean)),
      currentTagIds: new Set((scene.tags || []).map(t => t && String(t.id)).filter(Boolean)),
      currentNeedsReviewTagIds: sceneTagIdsNamed(scene, NEEDS_REVIEW_TAG)
    };

    csvRow.current_studio_id = current.currentStudioId || "";
    csvRow.current_group_ids = Array.from(current.currentGroupIds).join("|");
    csvRow.current_tag_ids = Array.from(current.currentTagIds).join("|");

    const parsed = tokenizePathAndName(filePath, scene.title, scene.details);
    const raw = parseCandidates(parsed, aliasMap);

    const studioCandidate = raw.studios[0] || null;
    const groupCandidates = raw.groups;
    const characterCandidates = raw.characters;

    const confStudio = studioCandidate ? studioCandidate.score : 0;
    const confGroup = groupCandidates.length ? Math.max(...groupCandidates.map(g => g.score || 0)) : 0;
    const confChar = characterCandidates.length ? Math.max(...characterCandidates.map(c => c.score || 0)) : 0;
    const decision = computeDecision(confStudio, confGroup, confChar, config.confidenceThreshold);

    csvRow.detected_studios = raw.studios.map(c => c.name).join("|");
    csvRow.detected_groups = groupCandidates.map(c => c.name).join("|");
    csvRow.detected_characters = characterCandidates.map(c => c.name).join("|");
    csvRow.confidence_studio = confStudio.toFixed(2);
    csvRow.confidence_group = confGroup.toFixed(2);
    csvRow.confidence_character_tags = confChar.toFixed(2);
    csvRow.final_confidence = decision.finalConfidence.toFixed(2);
    csvRow.action_taken = decision.overallDecision;

    if (decision.overallDecision === "skip") {
      csvRow.result = "skipped_low_confidence";
      emitCSV(csvRow);
      pluginLog("SKIP low confidence scene=" + sceneId + " final=" + csvRow.final_confidence, runtime);
      emitMissCandidate(scene, "low_confidence", aliasMap, runtime, runId || "manual");
      return csvRow;
    }

    if (decision.overallDecision === "review") {
      return handleReviewScene(sceneId, config, current, runtime, csvRow);
    }

    const matched = resolveApplyMatches(
      {
        studio: decision.studio.decision === "apply" ? studioCandidate : null,
        groups: decision.group.decision === "apply" ? groupCandidates : [],
        characters: decision.character.decision === "apply" ? characterCandidates : []
      },
      config,
      runtime,
      config.dryRun
    );

    csvRow.matched_studio_id = matched.studioId || "";
    csvRow.matched_group_ids = matched.groupIds.join("|");
    csvRow.matched_tag_ids = matched.tagIds.join("|");

    const finalAssignments = buildFinalAssignments(current, matched, config);

    if (config.dryRun) {
      csvRow.matched_studio_id = finalAssignments.studioId || "";
      csvRow.matched_group_ids = finalAssignments.groupIds.join("|");
      csvRow.matched_tag_ids = finalAssignments.tagIds.join("|");
      csvRow.result = matched.wouldCreate.length ? "dry_run_would_create" : "dry_run_proposed";
      emitCSV(csvRow);
      pluginLog(
        "DRY-RUN scene=" + sceneId +
        " wouldCreate=" + matched.wouldCreate.join("|") +
        " wouldRemoveNeedsReview=" + (finalAssignments.removedNeedsReviewTagIds || []).join("|"),
        runtime
      );
      return csvRow;
    }

    if (compareBeforeWrite(finalAssignments, current)) {
      csvRow.action_taken = "no-op";
      csvRow.result = "already_compliant";
      emitCSV(csvRow);
      pluginLog("NO-OP scene=" + sceneId, runtime);
      return csvRow;
    }

    const updateInput = buildUpdateInput(sceneId, finalAssignments, current);
    doGraphQL(UPDATE_SCENE, { input: updateInput }, runtime, "UpdateScene");

    csvRow.matched_studio_id = finalAssignments.studioId || "";
    csvRow.matched_group_ids = finalAssignments.groupIds.join("|");
    csvRow.matched_tag_ids = finalAssignments.tagIds.join("|");
    csvRow.result = "updated";
    emitCSV(csvRow);
    pluginLog(
      "UPDATED scene=" + sceneId +
      " removedNeedsReview=" + (finalAssignments.removedNeedsReviewTagIds || []).join("|"),
      runtime
    );
    return csvRow;
  } catch (err) {
    csvRow.error = String((err && err.message) || err).replace(/[\r\n]/g, " ");
    csvRow.result = "error";
    emitCSV(csvRow);
    pluginLog("ERROR scene=" + sceneId + ": " + csvRow.error, runtime);
    return csvRow;
  }
}

function handleReviewScene(sceneId, config, current, runtime, csvRow) {
  csvRow.action_taken = "review";

  if (config.dryRun) {
    csvRow.result = "dry_run_review";
    emitCSV(csvRow);
    pluginLog("REVIEW dry-run scene=" + sceneId, runtime);
    return csvRow;
  }

  if (!config.addNeedsReviewTag) {
    csvRow.result = "skipped_needs_review";
    emitCSV(csvRow);
    pluginLog("REVIEW skipped scene=" + sceneId, runtime);
    return csvRow;
  }

  const reviewTag = findOrCreateTagByName(NEEDS_REVIEW_TAG, config.createMissingTags, runtime);
  if (!reviewTag || !reviewTag.id) {
    csvRow.result = "skipped_needs_review_missing_tag";
    emitCSV(csvRow);
    pluginLog("REVIEW missing tag scene=" + sceneId, runtime);
    return csvRow;
  }

  const finalAssignments = {
    studioId: current.currentStudioId || null,
    groupIds: Array.from(current.currentGroupIds),
    tagIds: Array.from(setUnion(current.currentTagIds, [reviewTag.id]))
  };

  if (compareBeforeWrite(finalAssignments, current)) {
    csvRow.action_taken = "no-op";
    csvRow.result = "already_compliant";
    csvRow.matched_tag_ids = finalAssignments.tagIds.join("|");
    emitCSV(csvRow);
    pluginLog("NO-OP review scene=" + sceneId, runtime);
    return csvRow;
  }

  doGraphQL(UPDATE_SCENE, { input: buildUpdateInput(sceneId, finalAssignments, current) }, runtime, "UpdateScene");
  csvRow.matched_tag_ids = finalAssignments.tagIds.join("|");
  csvRow.result = "needs_review_tagged";
  emitCSV(csvRow);
  pluginLog("REVIEW tagged scene=" + sceneId, runtime);
  return csvRow;
}

function buildFinalAssignments(current, matched, config) {
  let studioId = current.currentStudioId || null;
  if (matched.studioId && (!studioId || config.allowOverwriteExistingMetadata)) {
    studioId = matched.studioId;
  }

  let tagIds = Array.from(setUnion(current.currentTagIds, matched.tagIds)).sort();
  let removedNeedsReviewTagIds = [];
  const hasResolvedApplyMetadata = !!matched.studioId || !!(matched.groupIds && matched.groupIds.length) || !!(matched.tagIds && matched.tagIds.length);
  if (config.removeNeedsReviewOnApply && hasResolvedApplyMetadata && current.currentNeedsReviewTagIds && current.currentNeedsReviewTagIds.length) {
    const reviewIds = new Set(current.currentNeedsReviewTagIds.map(String));
    const beforeCount = tagIds.length;
    tagIds = tagIds.filter(id => !reviewIds.has(String(id)));
    if (tagIds.length !== beforeCount) removedNeedsReviewTagIds = current.currentNeedsReviewTagIds.slice().sort();
  }

  return {
    studioId,
    groupIds: Array.from(setUnion(current.currentGroupIds, matched.groupIds)).sort(),
    tagIds,
    removedNeedsReviewTagIds
  };
}

function resolveApplyMatches(candidates, config, runtime, dryRun) {
  const result = { studioId: null, groupIds: [], tagIds: [], wouldCreate: [] };

  if (candidates.studio) {
    const s = findStudio(candidates.studio.name, runtime);
    if (s && s.id) result.studioId = String(s.id);
    else if (!dryRun && config.createMissingStudios) {
      const created = createStudio(candidates.studio.name, runtime);
      if (created && created.id) result.studioId = String(created.id);
    } else if (config.createMissingStudios) {
      result.wouldCreate.push("studio:" + candidates.studio.name);
    }
  }

  for (const gCandidate of candidates.groups || []) {
    const g = findGroup(gCandidate.name, runtime);
    if (g && g.id) result.groupIds.push(String(g.id));
    else if (!dryRun && config.createMissingGroups) {
      const created = createGroup(gCandidate.name, runtime);
      if (created && created.id) result.groupIds.push(String(created.id));
    } else if (config.createMissingGroups) {
      result.wouldCreate.push("group:" + gCandidate.name);
    }
  }

  if ((candidates.characters || []).length) {
    let parentId = null;

    for (const cCandidate of candidates.characters) {
      const existingGlobal = findTagByName(cCandidate.name, runtime);
      if (existingGlobal && existingGlobal.id) {
        result.tagIds.push(String(existingGlobal.id));
        continue;
      }

      if (!parentId) {
        const parent = findTagByName(config.characterParentTag, runtime);
        if (parent && parent.id) parentId = String(parent.id);
        else if (!dryRun && config.createMissingTags) {
          const createdParent = createTag(config.characterParentTag, [], runtime);
          if (createdParent && createdParent.id) parentId = String(createdParent.id);
        } else if (config.createMissingTags) {
          result.wouldCreate.push("tag:" + config.characterParentTag);
        }
      }

      if (parentId) {
        const t = findTagUnderParent(cCandidate.name, parentId, runtime);
        if (t && t.id) result.tagIds.push(String(t.id));
        else if (!dryRun && config.createMissingTags) {
          const created = createTag(cCandidate.name, [parentId], runtime);
          if (created && created.id) result.tagIds.push(String(created.id));
        } else if (config.createMissingTags) {
          result.wouldCreate.push("tag:" + cCandidate.name);
        }
      } else if (dryRun && config.createMissingTags) {
        result.wouldCreate.push("tag:" + cCandidate.name);
      }
    }
  }

  result.groupIds = uniq(result.groupIds);
  result.tagIds = uniq(result.tagIds);
  result.wouldCreate = uniq(result.wouldCreate);
  return result;
}

// ============================ FIND / CREATE HELPERS ============================

function findStudio(name, runtime) {
  const res = doGraphQL(
    FIND_STUDIO,
    { studio_filter: { name: { value: name, modifier: "EQUALS" } }, filter: { per_page: 5 } },
    runtime,
    "FindStudio"
  );
  return (res && res.findStudios && res.findStudios.studios && res.findStudios.studios[0]) || null;
}

function createStudio(name, runtime) {
  const res = doGraphQL(CREATE_STUDIO, { input: { name } }, runtime, "CreateStudio");
  return (res && res.studioCreate) || null;
}

function findGroup(name, runtime) {
  const res = doGraphQL(
    FIND_GROUP,
    { group_filter: { name: { value: name, modifier: "EQUALS" } }, filter: { per_page: 5 } },
    runtime,
    "FindGroup"
  );
  return (res && res.findGroups && res.findGroups.groups && res.findGroups.groups[0]) || null;
}

function createGroup(name, runtime) {
  const res = doGraphQL(CREATE_GROUP, { input: { name } }, runtime, "CreateGroup");
  return (res && res.groupCreate) || null;
}

function findTagByName(name, runtime) {
  const res = doGraphQL(
    FIND_TAG,
    { tag_filter: { name: { value: name, modifier: "EQUALS" } }, filter: { per_page: 5 } },
    runtime,
    "FindTagByName"
  );
  return (res && res.findTags && res.findTags.tags && res.findTags.tags[0]) || null;
}

function findTagUnderParent(name, parentId, runtime) {
  const res = doGraphQL(
    FIND_TAG,
    {
      tag_filter: {
        name: { value: name, modifier: "EQUALS" },
        parents: { value: [parentId], modifier: "INCLUDES" }
      },
      filter: { per_page: 5 }
    },
    runtime,
    "FindTagUnderParent"
  );
  return (res && res.findTags && res.findTags.tags && res.findTags.tags[0]) || null;
}

function createTag(name, parentIds, runtime) {
  const res = doGraphQL(CREATE_TAG, { input: { name, parent_ids: parentIds || [] } }, runtime, "CreateTag");
  return (res && res.tagCreate) || null;
}

function findOrCreateTagByName(name, mayCreate, runtime) {
  const found = findTagByName(name, runtime);
  if (found) return found;
  if (!mayCreate) return null;
  return createTag(name, [], runtime);
}

// ============================ LOG / CSV EMISSION ============================

function safeConsoleLog(line) {
  if (typeof console !== "undefined" && console && typeof console.log === "function") {
    console.log(line);
  }
}

function emitRuntimeLog(runtime, line) {
  try {
    if (runtime && typeof runtime.log === "function") {
      runtime.log(line);
      return;
    }
    if (runtime && runtime.log && typeof runtime.log.info === "function") {
      runtime.log.info(line);
      return;
    }
    if (runtime && runtime.log && typeof runtime.log.Info === "function") {
      runtime.log.Info(line);
      return;
    }
    if (runtime && runtime.logger && typeof runtime.logger.info === "function") {
      runtime.logger.info(line);
      return;
    }
    if (runtime && typeof runtime.Log === "function") {
      runtime.Log(line);
    }
  } catch (e) {
    // console.log remains the reliable Stash v0.30.1 output path.
  }
}

function pluginLog(msg, runtime) {
  const line = "[scene-auto-tagger] " + msg;
  safeConsoleLog(line);
  emitRuntimeLog(runtime, line);
}

function emitProgress(runtime, processed, total, message) {
  if (!runtime || !total) return;
  const percent = Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
  const fraction = Math.max(0, Math.min(1, processed / total));
  try {
    if (runtime.log && typeof runtime.log.Progress === "function") {
      runtime.log.Progress(fraction);
      return;
    }
    if (typeof runtime.progress === "function") {
      runtime.progress(percent, message);
      return;
    }
    if (runtime.progress && typeof runtime.progress.update === "function") {
      runtime.progress.update(percent, message);
      return;
    }
    if (typeof runtime.setProgress === "function") {
      runtime.setProgress(percent);
      return;
    }
    if (runtime.task && typeof runtime.task.setProgress === "function") {
      runtime.task.setProgress(percent);
    }
  } catch (e) {
    // Progress helpers vary by runtime; logging continues through console.log.
  }
}

function emptySummary() {
  return {
    processed: 0,
    updated: 0,
    dryRun: 0,
    review: 0,
    noOp: 0,
    skipped: 0,
    errors: 0
  };
}

function recordSummary(summary, row) {
  summary.processed++;
  const result = row && row.result ? String(row.result) : "";
  if (result === "updated" || result === "needs_review_tagged") summary.updated++;
  else if (result.indexOf("dry_run") === 0) summary.dryRun++;
  else if (result.indexOf("skipped_needs_review") === 0) summary.review++;
  else if (result === "already_compliant") summary.noOp++;
  else if (result === "error") summary.errors++;
  else if (result.indexOf("skipped") === 0) summary.skipped++;
}

function formatSummary(summary) {
  return (
    "processed=" + summary.processed +
    " updated=" + summary.updated +
    " dryRun=" + summary.dryRun +
    " review=" + summary.review +
    " noOp=" + summary.noOp +
    " skipped=" + summary.skipped +
    " errors=" + summary.errors
  );
}

function emitCSV(row) {
  const values = CSV_COLUMNS.map(k => csvEscape(row[k]));
  safeConsoleLog("CSV_ROW: " + values.join(","));
}

function emitTaskErrorCSV(runId, errorMessage) {
  const row = {
    timestamp: new Date().toISOString(),
    run_id: runId || "bulk-error",
    mode: "bulk",
    hook_type: "",
    scene_id: "",
    scene_title: "",
    scene_path: "",
    current_studio_id: "",
    current_group_ids: "",
    current_tag_ids: "",
    detected_studios: "",
    detected_groups: "",
    detected_characters: "",
    matched_studio_id: "",
    matched_group_ids: "",
    matched_tag_ids: "",
    confidence_studio: "",
    confidence_group: "",
    confidence_character_tags: "",
    final_confidence: "",
    action_taken: "task_error",
    result: "error",
    error: errorMessage || "unknown task error"
  };
  emitCSV(row);
}

// ============================ GRAPHQL STRINGS (VERIFIED v0.30.1) ============================

const GET_SCENE = `query GetSceneForTagging($id: ID!) {
  findScene(id: $id) {
    id title details date organized updated_at
    studio { id name }
    groups { group { id name } scene_index }
    files { id path basename duration }
    tags { id name aliases ignore_auto_tag parents { id name } }
  }
}`;

const FIND_STUDIO = `query FindStudioCandidates($studio_filter: StudioFilterType, $filter: FindFilterType) {
  findStudios(studio_filter: $studio_filter, filter: $filter) {
    count studios { id name }
  }
}`;

const FIND_GROUP = `query FindGroupCandidates($group_filter: GroupFilterType, $filter: FindFilterType) {
  findGroups(group_filter: $group_filter, filter: $filter) {
    count groups { id name aliases }
  }
}`;

const FIND_TAG = `query FindTagCandidates($tag_filter: TagFilterType, $filter: FindFilterType) {
  findTags(tag_filter: $tag_filter, filter: $filter) {
    count tags { id name aliases ignore_auto_tag parents { id name } }
  }
}`;

const FIND_STUDIOS_FOR_ALIAS_INDEX = `query RuntimeAliasStudios($filter: FindFilterType) {
  findStudios(filter: $filter) {
    count studios { id name aliases }
  }
}`;

const FIND_STUDIOS_FOR_ALIAS_INDEX_NO_ALIASES = `query RuntimeAliasStudiosNoAliases($filter: FindFilterType) {
  findStudios(filter: $filter) {
    count studios { id name }
  }
}`;

const FIND_GROUPS_FOR_ALIAS_INDEX = `query RuntimeAliasGroups($filter: FindFilterType) {
  findGroups(filter: $filter) {
    count groups { id name aliases }
  }
}`;

const FIND_TAGS_FOR_ALIAS_INDEX = `query RuntimeAliasTags($filter: FindFilterType) {
  findTags(filter: $filter) {
    count tags { id name aliases ignore_auto_tag parents { id name } }
  }
}`;

const CREATE_STUDIO = `mutation CreateStudio($input: StudioCreateInput!) { studioCreate(input: $input) { id name } }`;
const CREATE_GROUP = `mutation CreateGroup($input: GroupCreateInput!) { groupCreate(input: $input) { id name } }`;
const CREATE_TAG = `mutation CreateTag($input: TagCreateInput!) { tagCreate(input: $input) { id name parents { id name } } }`;

const UPDATE_SCENE = `mutation UpdateScene($input: SceneUpdateInput!) {
  sceneUpdate(input: $input) {
    id updated_at
    studio { id name }
    groups { group { id name } scene_index }
    tags { id name }
  }
}`;

const FIND_SCENES_FOR_BULK = `query FindScenesForBulkAutoTagger($scene_filter: SceneFilterType, $filter: FindFilterType) {
  findScenes(scene_filter: $scene_filter, filter: $filter) {
    count
    scenes {
      id title organized updated_at
      studio { id name }
      groups { group { id name } scene_index }
      tags { id name parents { id name } }
      files { id path basename }
    }
  }
}`;

// ============================ ENTRYPOINTS ============================

function runBulkTask(args, runtime) {
  const runId = "bulk-" + Date.now();
  const summary = emptySummary();
  let total = 0;
  let sceneSource = "args";
  let discoveredTotal = 0;

  try {
    const options = buildRuntimeOptions(args);
    options.aliasMap = buildEffectiveAliasMap(options, runtime, runId);
    const explicitSceneIds = options.sceneIds.length > 0;

    if (!explicitSceneIds && options.config.discoverScenesWhenNoSceneIds) {
      sceneSource = "discovery";
      if (!options.config.dryRun && !options.config.allowDiscoveredWrites) {
        options.config.dryRun = true;
        pluginLog(
          "BULK SAFETY run=" + runId +
          " no explicit scene_ids supplied; forcing dryRun=true for discovered scenes",
          runtime
        );
      }
      const discovered = discoverSceneIds(options.config, runtime, runId, options.aliasMap);
      options.sceneIds = discovered.sceneIds;
      discoveredTotal = discovered.count;
    } else if (!explicitSceneIds) {
      sceneSource = "none";
    }

    total = options.sceneIds.length;
    pluginLog(
      "BULK START run=" + runId +
      " version=" + PLUGIN_VERSION +
      " dryRun=" + options.config.dryRun +
      " threshold=" + options.config.confidenceThreshold +
      " scenes=" + total +
      " source=" + sceneSource +
      " discoveredTotal=" + discoveredTotal,
      runtime
    );
    pluginLog("BULK OUTPUT run=" + runId + " all audit rows are emitted as console.log CSV_ROW lines", runtime);

    if (!total) {
      pluginLog(
        "BULK NOTICE run=" + runId +
        " no scenes selected; supply args_map.scene_ids or enable discovery with matching scenes",
        runtime
      );
      emitProgress(runtime, 0, 0, "No scenes supplied");
    } else {
      emitProgress(runtime, 0, total, "Scene Auto-Tagger started");

      for (let i = 0; i < options.sceneIds.length; i++) {
        const id = options.sceneIds[i];
        pluginLog("BULK SCENE run=" + runId + " index=" + (i + 1) + "/" + total + " scene=" + id, runtime);
        const row = processScene(id, "bulk", options.config, options.aliasMap, runtime, runId, "");
        recordSummary(summary, row);

        if ((i + 1) % BULK_PROGRESS_INTERVAL === 0 || i + 1 === total) {
          const message = "BULK PROGRESS run=" + runId + " " + formatSummary(summary) + " total=" + total;
          pluginLog(message, runtime);
          emitProgress(runtime, i + 1, total, message);
        }
      }
    }
  } catch (err) {
    const errorMessage = String((err && err.message) || err).replace(/[\r\n]/g, " ");
    summary.errors++;
    pluginLog("BULK TASK ERROR run=" + runId + " error=" + errorMessage, runtime);
    emitTaskErrorCSV(runId, errorMessage);
  } finally {
    const finalMessage = (
      "===== SCENE AUTO-TAGGER FINAL SUMMARY run=" + runId +
      " version=" + PLUGIN_VERSION +
      " total=" + total +
      " " + formatSummary(summary) +
      " ====="
    );
    pluginLog(finalMessage, runtime);
    emitProgress(runtime, total ? Math.min(summary.processed, total) : 0, total, finalMessage);
  }

  return {
    Output: "Scene Auto-Tagger complete. run=" + runId + " " + formatSummary(summary),
    output: "Scene Auto-Tagger complete. run=" + runId + " " + formatSummary(summary)
  };
}

function onSceneCreateHook(hookContext, runtime) {
  const sceneId = hookContext && hookContext.id;
  if (!sceneId) {
    pluginLog("HOOK received with no id - skipping", runtime);
    return;
  }
  const options = buildRuntimeOptions({ config: { dryRun: true } });
  pluginLog("HOOK Scene.Create.Post id=" + sceneId + " forced dryRun=true", runtime);
  return processScene(sceneId, "hook_create", options.config, options.aliasMap, runtime, "hook-" + Date.now(), "Scene.Create.Post");
}

function loadAliasMapSafe() {
  return normalizeAliasMap(EMBEDDED_ALIASES);
}

function loadSettingsSafe() {
  return {};
}

function getEmbeddedRuntime() {
  const runtime = {};
  if (typeof gql !== "undefined") runtime.gql = gql;
  if (typeof log !== "undefined") runtime.log = log;
  return runtime;
}

function getEmbeddedInput() {
  if (typeof input !== "undefined" && input) return input;
  return {};
}

(function main() {
  return runBulkTask(getEmbeddedInput(), getEmbeddedRuntime());
})();
