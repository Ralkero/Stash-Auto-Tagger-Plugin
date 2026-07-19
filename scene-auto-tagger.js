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

const PLUGIN_VERSION = "0.2.2";
const PLUGIN_ID = "scene-auto-tagger";
const LEGACY_PLUGIN_ID = "plugin";
const LEARNED_CORRECTIONS_KEY = "learnedCorrectionsV1";
const LEARNED_SCHEMA_VERSION = 1;
const LEARNED_HISTORY_LIMIT = 500;
const REPAIR_PREVIEW_LIMIT = 500;

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
  sceneDiscoveryLimit: 10000,
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
  sceneDiscoveryPageSize: 250,
  sceneDiscoveryScanPages: 10000,
  allowDiscoveredWrites: false,
  useRuntimeStashAliases: true,
  runtimeAliasPageSize: 250,
  runtimeAliasScanPages: 40,
  runtimeAliasIncludeTopLevelTagAliases: true,
  runtimeAliasIncludeTopLevelCharacterNames: true,
  runtimeAliasIncludeSingleTokenCharacterNames: true,
  autoAliasMode: "suggest",
  minAutoAliasConfidence: 0.9,
  autoAliasMaxLength: 80,
  preferExistingCloseMatches: true,
  closeMatchMinConfidence: 0.92,
  sceneDiscoveryPathIncludes: "",
  sceneDiscoveryPathExcludes: "",
  missReportLimit: 50,
  finalLibraryAuditEnabled: true,
  finalLibraryAuditPageSize: 250,
  finalLibraryAuditMaxPages: 1000,
  allowTitleFallbackCharacterTags: false,
  strictCharacterTagNames: true,
  imageTaggingPathIncludes: "Rule34 Pictures",
  imageTaggingPathExcludes: "_Unsorted_Franchise|_Delete_Review|Futa|mp4|zip",
  imageTaggingLimit: 10000,
  imageTaggingPageSize: 250,
  imageTaggingScanPages: 10000,
  imageTaggingCreateMissingTags: true
};

const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG);
const NEEDS_REVIEW_TAG = "Needs Review";

const CSV_COLUMNS = [
  "timestamp", "run_id", "mode", "hook_type", "scene_id", "scene_title", "scene_path",
  "current_studio_id", "current_group_ids", "current_tag_ids",
  "detected_studios", "detected_groups", "detected_characters",
  "matched_studio_id", "matched_group_ids", "matched_tag_ids",
  "confidence_studio", "confidence_group", "confidence_character_tags",
  "final_confidence", "pre_tag_state",
  "detected_group_count", "detected_tag_count",
  "missing_group_count", "missing_tag_count",
  "added_group_count", "added_tag_count",
  "metadata_gap",
  "action_taken", "result", "error"
];

const CSV_HEADER = CSV_COLUMNS.join(",");
const BULK_PROGRESS_INTERVAL = 5;
const MAX_SCENE_DISCOVERY_LIMIT = 10000;
const MAX_SCENE_DISCOVERY_PAGE_SIZE = 250;

const GENERIC_FOLDER_NAMES = makeSet([
  "animation", "animations", "download", "downloads", "hydrafxx", "rule34",
  "scene", "scenes", "video", "videos", "3d", "content", "new", "misc",
  "artist oc", "artist ocs", "oc", "ocs"
]);

const JUNK_CHARACTER_TOKENS = makeSet([
  "1080p", "720p", "2160p", "4k", "8k", "hd", "uhd", "web", "webdl", "reencode",
  "re encode", "cam", "camera", "part", "pt", "version", "ver", "scene",
  "anal", "bj", "blowjob", "cowgirl", "missionary", "reverse", "threesome",
  "teased", "fucked", "fuck", "fucks", "ride", "riding", "vibrator", "sofa",
  "office", "bathroom", "beach", "woods", "pod", "ball", "christmas", "backshot"
]);

const CHARACTER_TITLE_STOP_WORDS = makeSet([
  "anal", "bj", "blowjob", "bath", "baths", "bent", "compilation", "cowgirl",
  "doggy", "floor", "gym", "hip", "loop", "losing", "missionary", "mommy",
  "nude", "playful", "prone", "ride", "riding", "standing", "table",
  "teleport", "young", "official", "censored", "concept", "h", "job", "handjob",
  "her", "with", "without", "breed", "brat", "backdoor", "deepthroat", "remake",
  "session", "bonking", "realistic", "allure", "pov", "thighjob", "buttplug",
  "academy", "cademy", "mk", "morning", "workout", "foursome", "vortex", "club",
  "bonus", "serviced", "bikini", "clothed", "topless", "dressonly", "toponly",
  "creampie", "pole", "dance", "3p", "face", "baldachin",
  "arcade", "backing", "beauty", "bounces", "bouncing", "braindance",
  "calming", "can", "chair", "cock", "cockrider", "costa", "craves",
  "creampied", "cute", "daughters", "dc", "del", "demons", "dive",
  "divine", "doggystyle", "double", "dream", "eating", "elevator",
  "ep", "feature", "femdom", "followers", "from", "gamer", "get",
  "gets", "girl", "good", "gothic", "handle", "has", "heavenly",
  "horny", "hospitality", "hot", "in", "inside", "irrumatio", "is",
  "likes", "lonely", "lucky", "maid", "maidenless", "mating", "more", "nightclub",
  "no", "on", "overtime", "penetrated", "pink", "plays", "press",
  "preworkout", "rubbing", "schoolgirl", "searched", "service", "sex",
  "sharing", "shaking", "some", "steps", "strip", "suck", "takes",
  "tempting", "test", "the", "throated", "tickets", "times", "titjob",
  "toy", "training", "triple", "unleashed", "unleased", "wants", "washroom", "work",
  "wrapped"
]);

const CHARACTER_TITLE_SUFFIX_WORDS = makeSet([
  "all", "angle", "angles", "army", "bath", "baths", "battle", "bent",
  "bj", "blowjob", "christmas", "compilation", "cut", "dildo", "doggy",
  "extended", "floor", "goddess", "gym", "hip", "loop", "missionary",
  "mommy", "nude", "playful", "prone", "ride", "riding", "standing",
  "table", "teleport", "wiggle", "official", "censored", "concept", "h", "job", "handjob",
  "her", "with", "without", "breed", "brat", "backdoor", "deepthroat", "remake",
  "session", "bonking", "realistic", "allure", "pov", "thighjob", "buttplug",
  "academy", "cademy", "mk", "morning", "workout", "foursome", "vortex", "club",
  "bonus", "serviced", "bikini", "clothed", "topless", "dressonly", "toponly",
  "creampie", "pole", "dance", "3p", "face", "baldachin"
]);

const CHARACTER_TITLE_TRAILING_PHRASES = [
  "star guardian",
  "noxus owned",
  "official censored",
  "official uncensored",
  "h job",
  "hand job"
];

const COLOR_ONLY_TOKENS = makeSet([
  "white", "black", "blue", "red", "green", "yellow", "pink", "purple", "orange"
]);

const GENERIC_TITLE_CHARACTER_NAMES = makeSet([
  "operation", "succubus", "petite", "elven", "bunnygirl", "bunnygirl catwalk",
  "catwalk", "kda", "unknown", "original character", "top", "bottom", "sound",
  "dress", "variant", "version", "academy", "view", "vr1", "vr2", "vr3",
  "plugsuit", "censor", "poke night", "pokemon yuri", "fromsoftware",
  "vnude nopiercing", "dimitrescu", "dimitrescu daughters", "twin moon knight",
  "yorha", "yorha android", "yorha type a no"
]);

const NON_CHARACTER_TAG_NAMES = makeSet([
  "needs review", "character", "characters", "animated", "animation", "animations",
  "loop", "nude", "kda",
  "4k", "1080p", "720p", "vr", "video", "scene", "scenes", "unknown",
  "male", "female",
  "dimitrescu daughters", "twin moon knight", "yorha", "yorha android",
  "yorha type a no"
]);

const CLOSE_MATCH_SUFFIXES = [
  "sfm", "3d", "vr", "r34", "xxx", "anim", "animation", "animations", "nsfw", "studio"
];

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
    "ben 10": "Ben 10",
    "ben10": "Ben 10",
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
    "nodu": "NoduSFM",
    "nodusfm": "NoduSFM",
    "nodu sfm": "NoduSFM",
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
    "juri": "Juri Han",
    "juri han": "Juri Han",
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
    "brig": "Brigitte Lindholm",
    "brigitte": "Brigitte Lindholm",
    "brigitte lindholm": "Brigitte Lindholm",
    "fia": "Fia",
    "fia baldachin": "Fia",
    "yshtola": "Y'shtola Rhul",
    "yshtola rhul": "Y'shtola Rhul",
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
    "2booty": "2B",
    "2 booty": "2B",
    "2bb": "2B",
    "2bs": "2B",
    "a2": "A2",
    "9s": "9S",
    "kaine": "Kaine",
    "aerith": "Aerith Gainsborough",
    "aerith gainsborough": "Aerith Gainsborough",
    "yuffie": "Yuffie Kisaragi",
    "yuffie kisaragi": "Yuffie Kisaragi",
    "cloud": "Cloud Strife",
    "cloud strife": "Cloud Strife",
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
    "gwen tennyson": "Gwen Tennyson",
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
    "gwen tennyson": "Ben 10",
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
    "yuffie": "Final Fantasy",
    "yuffie kisaragi": "Final Fantasy",
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
    "fia": "Elden Ring",
    "fia baldachin": "Elden Ring",
    "yshtola": "Final Fantasy",
    "yshtola rhul": "Final Fantasy",
    "brig": "Overwatch",
    "brigitte": "Overwatch",
    "brigitte lindholm": "Overwatch",
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

function normalizeAutoAliasMode(value) {
  const n = normalize(value || DEFAULT_CONFIG.autoAliasMode);
  if (n === "apply" || n === "write" || n === "on" || n === "true") return "apply";
  if (n === "suggest" || n === "preview" || n === "log") return "suggest";
  return "off";
}

function normalizeSceneIds(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) {
    return uniq(value.map(v => String(v).trim()).filter(Boolean));
  }
  if (typeof value === "number") return [String(value)];
  if (typeof value === "string") {
    const parsed = parseMaybeJSON(value);
    if (Array.isArray(parsed)) return normalizeSceneIds(parsed);
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
    MAX_SCENE_DISCOVERY_PAGE_SIZE
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
  merged.runtimeAliasIncludeTopLevelCharacterNames = coerceBoolean(
    merged.runtimeAliasIncludeTopLevelCharacterNames,
    DEFAULT_CONFIG.runtimeAliasIncludeTopLevelCharacterNames
  );
  merged.runtimeAliasIncludeSingleTokenCharacterNames = coerceBoolean(
    merged.runtimeAliasIncludeSingleTokenCharacterNames,
    DEFAULT_CONFIG.runtimeAliasIncludeSingleTokenCharacterNames
  );
  merged.autoAliasMode = normalizeAutoAliasMode(merged.autoAliasMode);
  merged.minAutoAliasConfidence = normalizeThreshold(merged.minAutoAliasConfidence);
  merged.autoAliasMaxLength = coercePositiveInt(
    merged.autoAliasMaxLength,
    DEFAULT_CONFIG.autoAliasMaxLength,
    8,
    200
  );
  merged.preferExistingCloseMatches = coerceBoolean(
    merged.preferExistingCloseMatches,
    DEFAULT_CONFIG.preferExistingCloseMatches
  );
  merged.closeMatchMinConfidence = normalizeThreshold(merged.closeMatchMinConfidence);
  merged.sceneDiscoveryPathIncludes = String(merged.sceneDiscoveryPathIncludes || "");
  merged.sceneDiscoveryPathExcludes = String(merged.sceneDiscoveryPathExcludes || "");
  merged.missReportLimit = coercePositiveInt(
    merged.missReportLimit,
    DEFAULT_CONFIG.missReportLimit,
    0,
    1000
  );
  merged.finalLibraryAuditEnabled = coerceBoolean(
    merged.finalLibraryAuditEnabled,
    DEFAULT_CONFIG.finalLibraryAuditEnabled
  );
  merged.finalLibraryAuditPageSize = coercePositiveInt(
    merged.finalLibraryAuditPageSize,
    DEFAULT_CONFIG.finalLibraryAuditPageSize,
    1,
    500
  );
  merged.finalLibraryAuditMaxPages = coercePositiveInt(
    merged.finalLibraryAuditMaxPages,
    DEFAULT_CONFIG.finalLibraryAuditMaxPages,
    1,
    10000
  );
  merged.allowTitleFallbackCharacterTags = coerceBoolean(
    merged.allowTitleFallbackCharacterTags,
    DEFAULT_CONFIG.allowTitleFallbackCharacterTags
  );
  merged.strictCharacterTagNames = coerceBoolean(
    merged.strictCharacterTagNames,
    DEFAULT_CONFIG.strictCharacterTagNames
  );
  merged.imageTaggingPathIncludes = String(merged.imageTaggingPathIncludes || "");
  merged.imageTaggingPathExcludes = String(merged.imageTaggingPathExcludes || "");
  merged.imageTaggingLimit = coercePositiveInt(
    merged.imageTaggingLimit,
    DEFAULT_CONFIG.imageTaggingLimit,
    1,
    100000
  );
  merged.imageTaggingPageSize = coercePositiveInt(
    merged.imageTaggingPageSize,
    DEFAULT_CONFIG.imageTaggingPageSize,
    1,
    500
  );
  merged.imageTaggingScanPages = coercePositiveInt(
    merged.imageTaggingScanPages,
    DEFAULT_CONFIG.imageTaggingScanPages,
    1,
    10000
  );
  merged.imageTaggingCreateMissingTags = coerceBoolean(
    merged.imageTaggingCreateMissingTags,
    DEFAULT_CONFIG.imageTaggingCreateMissingTags
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
    characterStudios: { ...((base && base.characterStudios) || {}) },
    forcedCharacterStudios: { ...((base && base.forcedCharacterStudios) || {}) },
    ignoredCharacters: { ...((base && base.ignoredCharacters) || {}) }
  };
  for (const category of Object.keys(merged)) {
    if (rawOverride && rawOverride[category] && typeof rawOverride[category] === "object") {
      merged[category] = { ...merged[category], ...rawOverride[category] };
    }
  }
  return normalizeAliasMap(merged);
}

function normalizeAliasMap(aliasMap) {
  const out = {
    studios: {},
    groups: {},
    characters: {},
    characterStudios: {},
    forcedCharacterStudios: {},
    ignoredCharacters: {}
  };
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
  const acceptedSpans = [];

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
    const end = hit.index + key.length;
    const shadowed = !!opts.preferLongestOverlaps && acceptedSpans.some(span => (
      span.index === hit.index && span.end >= end && span.key.length > key.length
    ));
    if (shadowed) continue;
    const canonical = aliasCategoryMap[key];
    const dedupeKey = normalize(canonical);
    if (dedupeKey && !seen[dedupeKey]) {
      seen[dedupeKey] = true;
      matches.push({ key, name: canonical, index: hit.index });
      acceptedSpans.push({ key, index: hit.index, end });
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

function isVariantOrSubtitleToken(word) {
  const n = normalize(word);
  return !!(
    !n ||
    JUNK_CHARACTER_TOKENS[n] ||
    NON_CHARACTER_TAG_NAMES[n] ||
    CHARACTER_TITLE_STOP_WORDS[n] ||
    CHARACTER_TITLE_SUFFIX_WORDS[n] ||
    /^(?:v|ver|version)?\d+$/.test(n) ||
    /^(?:panel|part|pt)\d*$/.test(n) ||
    /^(?:alt|xray|censored|uncensored|remaster|default|extended|cut|fix)$/.test(n)
  );
}

function isEmbeddedCanonicalCharacterName(name) {
  const norm = normalize(name);
  if (!norm) return false;
  const chars = (normalizeAliasMap(EMBEDDED_ALIASES).characters || {});
  for (const key of Object.keys(chars)) {
    if (normalize(chars[key]) === norm) return true;
  }
  return false;
}

function looksLikeCombinedCharacterName(name) {
  const raw = String(name || "");
  const norm = normalize(raw);
  if (!norm) return false;
  if (/[,;]/.test(raw)) return true;
  if (/\b(?:x|vs|and)\b/i.test(raw)) return true;
  const words = norm.split(/\s+/).filter(Boolean);
  const knownSingles = {};
  const aliasCharacters = (normalizeAliasMap(EMBEDDED_ALIASES).characters || {});
  for (const key of Object.keys(aliasCharacters)) {
    const value = aliasCharacters[key];
    if (normalize(value) === key && key.indexOf(" ") < 0) knownSingles[key] = true;
    if (key.indexOf(" ") < 0) knownSingles[key] = true;
  }
  const knownCount = words.filter(w => knownSingles[w]).length;
  return knownCount >= 2 && words.length <= 5;
}

function looksLikeSubtitleOrVariantName(name) {
  const raw = String(name || "");
  const norm = normalize(raw);
  if (!norm) return true;
  if (isEmbeddedCanonicalCharacterName(raw)) return false;
  const words = norm.split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  if (words.length === 1 && COLOR_ONLY_TOKENS[words[0]]) return true;
  if (raw.length > 50 || words.length > 4) return true;
  if (looksLikeCombinedCharacterName(raw)) return true;
  if (words[0] === "a" || words[0] === "the") return true;
  if (words.some(isVariantOrSubtitleToken)) return true;
  if (/\b(?:long rest|lucky fan|taste of|against the wall|after hours|room|thighs|booty|footjob|facial|dp)\b/.test(norm)) {
    return true;
  }
  return false;
}

function isCleanCharacterCandidate(candidate, configInput) {
  const config = normalizeConfig(configInput);
  if (!candidate || !candidate.name) return false;
  if (!config.strictCharacterTagNames) return true;
  if (candidate.source === "title_franchise_fallback" && !config.allowTitleFallbackCharacterTags) return false;
  if (candidate.source === "title_franchise_fallback" && GENERIC_TITLE_CHARACTER_NAMES[normalize(candidate.name)]) return false;
  return !looksLikeSubtitleOrVariantName(candidate.name);
}

function safeCharacterAliasValuesForObject(obj) {
  const values = [];
  const seen = {};
  for (const alias of aliasValuesForObject(obj)) {
    const norm = normalize(alias);
    if (!norm || seen[norm]) continue;
    if (looksLikeSubtitleOrVariantName(alias)) continue;
    values.push(alias);
    seen[norm] = true;
  }
  return values;
}

function addCharacterObjectNameAndAliases(aliasMap, obj) {
  let added = 0;
  if (!obj || !obj.name || looksLikeSubtitleOrVariantName(obj.name)) return added;
  if (addAliasValue(aliasMap, "characters", obj.name, obj.name)) added++;
  const compactName = compactNormalize(obj.name);
  if (normalize(obj.name).indexOf(" ") >= 0 && compactName.length >= 5) {
    if (addAliasValue(aliasMap, "characters", compactName, obj.name)) added++;
  }
  for (const alias of safeCharacterAliasValuesForObject(obj)) {
    if (addAliasValue(aliasMap, "characters", alias, obj.name)) added++;
    const compactAlias = compactNormalize(alias);
    if (normalize(alias).indexOf(" ") >= 0 && compactAlias.length >= 5) {
      if (addAliasValue(aliasMap, "characters", compactAlias, obj.name)) added++;
    }
  }
  return added;
}

function scoreConfidence(candidate, context) {
  if (!candidate) return 0;
  const c = context || {};
  let score = 0.6;
  if (c.isExactAlias) score = 0.97;
  else if (c.isCharacterStudio) score = 0.93;
  else if (c.isFolderAlias) score = 0.92;
  else if (c.isFolderMatch) score = 0.82;
  else if (c.isCleanFallback) score = 0.91;
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

function parseCandidates(parsed, aliasMap, configInput) {
  const aliases = normalizeAliasMap(aliasMap || EMBEDDED_ALIASES);
  const config = normalizeConfig(configInput);
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
      aliasText: m.key,
      score: scoreConfidence(m.name, { isExactAlias: true })
    });
  }

  const folderStudio = studioCandidateFromFolders(parsed.foldersRaw, aliases);
  if (folderStudio) {
    studios.push({
      name: folderStudio.name,
      source: folderStudio.source,
      aliasText: folderStudio.aliasText,
      score: scoreConfidence(folderStudio.name, folderStudio.source === "folder_alias" ? { isFolderAlias: true } : { isCleanFallback: true })
    });
  }

  const groupNorm = normalize(baseSplit.artistRaw);
  let canonicalGroup = "";
  if (groupNorm) {
    canonicalGroup = aliases.groups[groupNorm] || "";
    groups.push({
      name: canonicalGroup || baseSplit.artistRaw.trim(),
      source: canonicalGroup ? "alias" : "fallback",
      aliasText: baseSplit.artistRaw.trim(),
      score: scoreConfidence(canonicalGroup || baseSplit.artistRaw.trim(), canonicalGroup ? { isExactAlias: true } : { isCleanFallback: true })
    });
  }

  const charMatches = findAliasMatches(titleText, aliases.characters, {
    skipShortFreeText: false,
    preferLongestOverlaps: true
  });
  for (const m of charMatches) {
    if (JUNK_CHARACTER_TOKENS[m.key] || aliases.ignoredCharacters[m.key]) continue;
    characters.push({
      name: m.name,
      source: "alias",
      aliasText: m.key,
      score: scoreConfidence(m.name, { isExactAlias: true })
    });
  }

  for (const candidate of inferTitleCharacterCandidates(
    baseSplit.titleRaw,
    aliases,
    parsed.foldersRaw,
    characters,
    config,
    { trustedCreator: !!canonicalGroup }
  )) {
    characters.push(candidate);
  }

  const disambiguatedCharacters = preferFolderStudioCharacters(characters, aliases, parsed.foldersRaw)
    .filter(candidate => {
      const aliasNorm = normalize(candidate && candidate.aliasText);
      const nameNorm = normalize(candidate && candidate.name);
      if (aliases.ignoredCharacters[aliasNorm] || aliases.ignoredCharacters[nameNorm]) return false;
      return isCleanCharacterCandidate(candidate, config);
    });
  const characterStudios = [];
  const forcedCharacterStudios = [];
  for (const ch of disambiguatedCharacters) {
    const charNorm = normalize(ch.name);
    const forcedStudioName = aliases.forcedCharacterStudios[charNorm];
    if (forcedStudioName) forcedCharacterStudios.push(forcedStudioName);
    const studioName = aliases.characterStudios[charNorm];
    if (studioName) characterStudios.push(studioName);
  }
  const uniqueForcedStudios = uniq(forcedCharacterStudios);
  if (forcedCharacterStudios.length) {
    studios.unshift({
      name: forcedCharacterStudios[0],
      source: uniqueForcedStudios.length === 1 ? "learned_character_studio" : "learned_first_character_studio",
      score: 1
    });
  }
  const uniqueCharacterStudios = uniq(characterStudios);
  if (!forcedCharacterStudios.length && !explicitStudioMatches.length && characterStudios.length) {
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
    characters: uniqByName(disambiguatedCharacters),
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

function countNewIds(currentIds, finalIds) {
  let count = 0;
  for (const id of finalIds || []) {
    if (!currentIds.has(String(id))) count++;
  }
  return count;
}

function applyMetadataAccounting(csvRow, preMeta, current, finalAssignments, matched, runtime) {
  const finalGroupIds = (finalAssignments && finalAssignments.groupIds) || Array.from(current.currentGroupIds || []);
  const finalTagIds = (finalAssignments && finalAssignments.tagIds) || Array.from(current.currentTagIds || []);
  const addedGroups = countNewIds(current.currentGroupIds, finalGroupIds);
  const addedTags = countNewIds(current.currentTagIds, finalTagIds);
  const matchedGroupCount = ((matched && matched.groupIds) || []).length;
  const matchedTagCount = ((matched && matched.tagIds) || []).length;
  const groupGap = Math.max(0, (preMeta.detectedGroups || []).length - matchedGroupCount);
  const tagGap = Math.max(0, (preMeta.detectedTags || []).length - matchedTagCount);
  const studioGap = preMeta.missingStudio && !(matched && matched.studioId) ? 1 : 0;
  const gaps = [];

  csvRow.pre_tag_state = preMeta.state;
  csvRow.detected_group_count = String((preMeta.detectedGroups || []).length);
  csvRow.detected_tag_count = String((preMeta.detectedTags || []).length);
  csvRow.missing_group_count = String((preMeta.missingGroups || []).length);
  csvRow.missing_tag_count = String((preMeta.missingTags || []).length);
  csvRow.added_group_count = String(addedGroups);
  csvRow.added_tag_count = String(addedTags);

  if (groupGap) gaps.push("groups_unresolved:" + groupGap);
  if (tagGap) gaps.push("tags_unresolved:" + tagGap);
  if (studioGap) gaps.push("studio_unresolved");
  if (matched && matched.wouldCreate && matched.wouldCreate.length) {
    gaps.push("would_create:" + matched.wouldCreate.join("|"));
  }

  csvRow.metadata_gap = gaps.join(";");
  if (csvRow.metadata_gap) {
    pluginLog(
      "METADATA_GAP run=" + logSafeValue(csvRow.run_id) +
      " scene=" + logSafeValue(csvRow.scene_id) +
      " state=" + logSafeValue(preMeta.state) +
      " detectedStudio=" + logSafeValue(preMeta.detectedStudio) +
      " missingStudio=" + preMeta.missingStudio +
      " detectedGroups=" + logSafeValue((preMeta.detectedGroups || []).join("|")) +
      " missingGroups=" + logSafeValue((preMeta.missingGroups || []).join("|")) +
      " matchedGroupIds=" + logSafeValue(((matched && matched.groupIds) || []).join("|")) +
      " detectedTags=" + logSafeValue((preMeta.detectedTags || []).join("|")) +
      " missingTags=" + logSafeValue((preMeta.missingTags || []).join("|")) +
      " matchedTagIds=" + logSafeValue(((matched && matched.tagIds) || []).join("|")) +
      " addedGroups=" + addedGroups +
      " addedTags=" + addedTags +
      " gap=" + logSafeValue(csvRow.metadata_gap),
      runtime
    );
  }
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
  return {
    studios: {},
    groups: {},
    characters: {},
    characterStudios: {},
    forcedCharacterStudios: {},
    ignoredCharacters: {}
  };
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

function looksLikeSafeTopLevelCharacterName(tag) {
  const name = String((tag && tag.name) || "").trim();
  const nameNorm = normalize(name);
  if (!nameNorm || NON_CHARACTER_TAG_NAMES[nameNorm] || JUNK_CHARACTER_TOKENS[nameNorm]) return false;
  if (((tag && tag.parents) || []).length) return false;
  if (tag && tag.ignore_auto_tag) return false;
  if (aliasValuesForObject(tag).length > 0) return true;
  const parts = nameNorm.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts.length <= 4) return true;
  return false;
}

function looksLikeSafeSingleTokenCharacterName(tag) {
  const name = String((tag && tag.name) || "").trim();
  const nameNorm = normalize(name);
  if (!nameNorm || NON_CHARACTER_TAG_NAMES[nameNorm] || JUNK_CHARACTER_TOKENS[nameNorm]) return false;
  if (((tag && tag.parents) || []).length) return false;
  if (tag && tag.ignore_auto_tag) return false;
  const parts = nameNorm.split(/\s+/).filter(Boolean);
  if (parts.length !== 1) return false;
  if (nameNorm.length < 3) return false;
  return true;
}

function firstNameAliasForCharacterTag(tag) {
  const name = String((tag && tag.name) || "").trim();
  const norm = normalize(name);
  const parts = norm.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return "";
  const first = parts[0];
  if (!first || first.length < 3) return "";
  if (COLOR_ONLY_TOKENS[first]) return "";
  if (JUNK_CHARACTER_TOKENS[first] || NON_CHARACTER_TAG_NAMES[first]) return "";
  return first;
}

function shortCharacterTagShadowedByFullName(tag, allTags, studioLookup) {
  const nameNorm = normalize(tag && tag.name);
  if (!nameNorm || !isSingleTokenName(nameNorm)) return false;
  for (const other of allTags || []) {
    if (!other || String(other.id || "") === String(tag && tag.id || "")) continue;
    const otherNorm = normalize(other.name);
    if (!otherNorm || !otherNorm.startsWith(nameNorm + " ")) continue;
    if (NON_CHARACTER_TAG_NAMES[otherNorm] || JUNK_CHARACTER_TOKENS[otherNorm]) continue;
    if (looksLikeSafeTopLevelCharacterName(other) || studioNameFromParents((other && other.parents) || [], studioLookup)) {
      return true;
    }
  }
  return false;
}

function addUniqueFirstNameCharacterAliases(aliasMap, characterTags) {
  const byFirst = {};
  const tagByFirst = {};
  for (const tag of characterTags || []) {
    const first = firstNameAliasForCharacterTag(tag);
    if (!first) continue;
    byFirst[first] = (byFirst[first] || 0) + 1;
    tagByFirst[first] = tag;
  }
  let added = 0;
  for (const first of Object.keys(byFirst)) {
    if (byFirst[first] !== 1) continue;
    const tag = tagByFirst[first];
    if (addAliasValue(aliasMap, "characters", first, tag && tag.name)) added++;
  }
  return added;
}

function isRuntimeCharacterTag(tag, config, studioLookup) {
  const nameNorm = normalize(tag && tag.name);
  if (tag && tag.ignore_auto_tag) return false;
  if (!nameNorm || NON_CHARACTER_TAG_NAMES[nameNorm] || JUNK_CHARACTER_TOKENS[nameNorm]) return false;
  if (normalizeConfig(config).strictCharacterTagNames && looksLikeSubtitleOrVariantName(tag && tag.name)) return false;
  if (tagHasParentNamed(tag, config.characterParentTag)) return true;
  if (studioNameFromParents((tag && tag.parents) || [], studioLookup)) return true;
  if (config.runtimeAliasIncludeTopLevelTagAliases && isSafeTopLevelAliasTag(tag)) return true;
  if (config.runtimeAliasIncludeTopLevelCharacterNames && looksLikeSafeTopLevelCharacterName(tag)) return true;
  if (config.runtimeAliasIncludeSingleTokenCharacterNames && looksLikeSafeSingleTokenCharacterName(tag)) return true;
  return false;
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
    const runtimeCharacterTags = [];
    for (const tag of tagResult.items) {
      stats.tags++;
      if (!isRuntimeCharacterTag(tag, config, studioLookup)) continue;
      if (shortCharacterTagShadowedByFullName(tag, tagResult.items, studioLookup)) continue;
      runtimeCharacterTags.push(tag);

      const before = Object.keys(dynamic.characters).length;
      addCharacterObjectNameAndAliases(dynamic, tag);
      stats.characterAliases += Object.keys(dynamic.characters).length - before;

      const studioName = studioNameFromParents((tag && tag.parents) || [], studioLookup);
      if (studioName) {
        const names = [tag.name].concat(safeCharacterAliasValuesForObject(tag));
        for (const name of names) {
          if (addAliasValue(dynamic, "characterStudios", name, studioName)) {
            stats.characterStudioLinks++;
          }
        }
      }
    }
    stats.characterAliases += addUniqueFirstNameCharacterAliases(dynamic, runtimeCharacterTags);
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
  const learned = buildLearnedAliasOverride(runtime, runId);
  return mergeAliasMaps(
    mergeAliasMaps(mergeAliasMaps(EMBEDDED_ALIASES, dynamic), learned),
    options.aliasOverride
  );
}

function splitConfigList(value) {
  return String(value || "")
    .split(/[|,;\r\n]+/)
    .map(v => v.trim())
    .filter(Boolean);
}

function sceneDiscoveryPathAllowed(scene, config) {
  const path = primaryScenePath(scene).toLowerCase();
  const includes = splitConfigList(config.sceneDiscoveryPathIncludes);
  const excludes = splitConfigList(config.sceneDiscoveryPathExcludes);

  for (const item of excludes) {
    if (item && path.indexOf(item.toLowerCase()) !== -1) return false;
  }
  if (!includes.length) return true;
  for (const item of includes) {
    if (item && path.indexOf(item.toLowerCase()) !== -1) return true;
  }
  return false;
}

function discoverSceneIds(configInput, runtime, runId, aliasMapInput) {
  const config = normalizeConfig(configInput);
  const aliasMap = normalizeAliasMap(aliasMapInput || EMBEDDED_ALIASES);
  const selected = [];
  let totalAvailable = 0;
  let pagesScanned = 0;
  const skipped = { needsReview: 0, noAction: 0, complete: 0, path: 0 };
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
    " repairNeedsReview=" + config.sceneDiscoveryRepairNeedsReview +
    " pathIncludes=" + logSafeValue(config.sceneDiscoveryPathIncludes || "") +
    " pathExcludes=" + logSafeValue(config.sceneDiscoveryPathExcludes || ""),
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
      if (!sceneDiscoveryPathAllowed(scene, config)) {
        skipped.path++;
        continue;
      }
      const need = sceneAutoTaggingNeed(scene, config, aliasMap);
      if (config.sceneDiscoveryOnlyIncomplete && !need.needed) {
        if (need.reason === "needs_review") skipped.needsReview++;
        else if (need.reason === "no_actionable_candidates") {
          skipped.noAction++;
          if (missReport.emitted < config.missReportLimit) {
            emitMissCandidate(scene, need.reason, aliasMap, runtime, runId, config);
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
    " skippedPath=" + skipped.path +
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

function stripCharacterTitleSuffix(raw) {
  const parts = normalize(raw).split(/\s+/).filter(Boolean);
  while (parts.length && (/^\d+$/.test(parts[parts.length - 1]) || CHARACTER_TITLE_SUFFIX_WORDS[parts[parts.length - 1]])) {
    parts.pop();
  }
  return parts.join(" ");
}

function stripCharacterTitleTrailingPhrases(raw) {
  let norm = normalize(raw);
  let changed = true;
  while (changed) {
    changed = false;
    for (const phrase of CHARACTER_TITLE_TRAILING_PHRASES) {
      const phraseNorm = normalize(phrase);
      if (norm === phraseNorm) return "";
      if (norm.endsWith(" " + phraseNorm)) {
        norm = norm.slice(0, norm.length - phraseNorm.length).trim();
        changed = true;
      }
    }
  }
  return norm;
}

function canonicalizeTitleName(raw) {
  const cleaned = String(raw || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const norm = stripCharacterTitleTrailingPhrases(stripCharacterTitleSuffix(stripCharacterTitleTrailingPhrases(cleaned)));
  if (!norm) return "";
  const words = norm.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 4) return "";
  if (words.length === 1 && COLOR_ONLY_TOKENS[words[0]]) return "";
  if (CHARACTER_TITLE_STOP_WORDS[words[0]]) return "";
  for (let i = 1; i < words.length; i++) {
    if (CHARACTER_TITLE_STOP_WORDS[words[i]]) {
      words.length = i;
      break;
    }
  }
  if (!words.length || words.length > 4) return "";
  if (words.length === 1 && COLOR_ONLY_TOKENS[words[0]]) return "";
  if (words.some(w => JUNK_CHARACTER_TOKENS[w] || NON_CHARACTER_TAG_NAMES[w])) return "";
  return titleCase(words.join(" "));
}

function rule34FranchiseFolder(foldersRaw) {
  const folders = foldersRaw || [];
  for (let i = 0; i < folders.length; i++) {
    if (normalize(folders[i]) !== "rule34") continue;
    const next = folders[i + 1];
    const nextNorm = normalize(next);
    if (nextNorm && !GENERIC_FOLDER_NAMES[nextNorm]) return next;
  }
  return "";
}

function studioCandidateFromFolders(foldersRaw, aliases) {
  const map = (aliases && aliases.studios) || {};
  for (let i = (foldersRaw || []).length - 1; i >= 0; i--) {
    const folderNorm = normalize(foldersRaw[i]);
    if (!folderNorm || GENERIC_FOLDER_NAMES[folderNorm]) continue;
    const canonical = map[folderNorm];
    if (canonical) return { name: canonical, aliasText: foldersRaw[i], source: "folder_alias" };
  }
  const franchiseFolder = rule34FranchiseFolder(foldersRaw);
  if (franchiseFolder) {
    return { name: String(franchiseFolder).trim(), aliasText: franchiseFolder, source: "rule34_folder_fallback" };
  }
  return null;
}

function knownStudioFromFolders(foldersRaw, aliases) {
  const candidate = studioCandidateFromFolders(foldersRaw, aliases);
  return candidate ? candidate.name : "";
}

function isRule34PicturesPath(foldersRaw) {
  return (foldersRaw || []).some(folder => normalize(folder) === "rule34 pictures");
}

function primaryCharacterTitleText(titleRaw) {
  const primary = String(titleRaw || "").split(/\s+[-\u2013\u2014]\s+/)[0].trim();
  if (!primary) return "";

  const possessive = primary.match(/^(.{2,}?)['\u2019]s\b/i);
  if (possessive && normalize(possessive[1]).length >= 3) return possessive[1].trim();
  return primary;
}

function splitCompactCharacterCrossover(segment) {
  const raw = String(segment || "").trim();
  const match = raw.match(/^([a-z][a-z0-9.'-]{2,})x([a-z][a-z0-9.'-]{2,})$/i);
  return match ? [match[1], match[2]] : [raw];
}

function segmentHasExistingCharacterMatch(segment, existingMatches) {
  const segmentNorm = normalize(segment);
  const segmentCompact = compactNormalize(segment);
  if (!segmentNorm) return false;
  for (const match of existingMatches || []) {
    if (containsPhrase(segmentNorm, normalize(match && match.name))) return true;
    if (containsPhrase(segmentNorm, normalize(match && match.aliasText))) return true;
    if (segmentCompact && segmentCompact === compactNormalize(match && match.aliasText)) return true;
    if (segmentCompact && segmentCompact === compactNormalize(match && match.name)) return true;
  }
  return false;
}

function aliasMapContainsTaxonomyName(map, name) {
  const target = normalize(name);
  if (!target) return false;
  for (const key of Object.keys(map || {})) {
    if (normalize(key) === target || normalize(map[key]) === target) return true;
  }
  return false;
}

function isSafeUnknownCharacterName(rawSegment, fallbackName, aliases) {
  const norm = normalize(fallbackName);
  const words = norm.split(/\s+/).filter(Boolean);
  if (!norm || !words.length || words.length > 3) return false;
  if (GENERIC_TITLE_CHARACTER_NAMES[norm] || NON_CHARACTER_TAG_NAMES[norm]) return false;
  if (aliasMapContainsTaxonomyName(aliases && aliases.studios, fallbackName)) return false;
  if (aliasMapContainsTaxonomyName(aliases && aliases.groups, fallbackName)) return false;
  if (words.some(word => JUNK_CHARACTER_TOKENS[word] || CHARACTER_TITLE_STOP_WORDS[word])) return false;
  if (words.some(word => /\d/.test(word) && !/^(?:[a-z]\d|\d[a-z])$/i.test(word))) return false;
  if (/[@\[\]{}<>]/.test(String(rawSegment || ""))) return false;
  return true;
}

function inferTitleCharacterCandidates(titleRaw, aliases, foldersRaw, existingMatches, configInput, contextInput) {
  const config = normalizeConfig(configInput);
  const context = contextInput || {};
  if (!config.allowTitleFallbackCharacterTags) return [];
  if (isRule34PicturesPath(foldersRaw)) return [];
  const knownStudio = knownStudioFromFolders(foldersRaw, aliases);
  if (!knownStudio && !context.trustedCreator) return [];
  const withoutBrackets = String(titleRaw || "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!withoutBrackets) return [];

  // Text after a spaced dash is normally a scene subtitle, action, or variant.
  // Cross-franchise and multi-character names remain supported inside the first segment.
  const primaryCharacterText = primaryCharacterTitleText(withoutBrackets);
  const initialSegments = primaryCharacterText
    .split(/\b(?:x|vs|v|and)\b|[,;+|/\\]+/i)
    .map(s => s.trim())
    .filter(Boolean);
  const segments = [];
  for (const initialSegment of initialSegments) {
    for (const splitSegment of splitCompactCharacterCrossover(initialSegment)) {
      if (splitSegment) segments.push(splitSegment);
    }
  }

  const candidates = [];
  const seen = {};
  for (const segment of segments) {
    if (segmentHasExistingCharacterMatch(segment, existingMatches)) continue;
    const fallbackName = canonicalizeTitleName(segment);
    const fallbackKey = normalize(fallbackName);
    if (!isSafeUnknownCharacterName(segment, fallbackName, aliases)) continue;
    const name = aliases.characters[fallbackKey] || fallbackName;
    const key = normalize(name);
    if (!fallbackKey || !key || seen[key] || GENERIC_TITLE_CHARACTER_NAMES[fallbackKey]) continue;
    seen[key] = true;
    candidates.push({
      name,
      source: "title_franchise_fallback",
      aliasText: segment,
      sourceText: titleRaw,
      score: scoreConfidence(name, aliases.characters[fallbackKey] ? { isExactAlias: true } : { isCleanFallback: true })
    });
  }
  return candidates;
}

function baseCharacterName(name) {
  return normalize(String(name || "").replace(/\([^)]*\)/g, " "));
}

function characterStudioMatches(name, studioName, aliases) {
  const targetStudio = normalize(studioName);
  if (!targetStudio) return false;
  const linkedStudio = (aliases && aliases.characterStudios && aliases.characterStudios[normalize(name)]) || "";
  if (linkedStudio && normalize(linkedStudio) === targetStudio) return true;
  const parenthetical = String(name || "").match(/\(([^)]+)\)/);
  return !!(parenthetical && normalize(parenthetical[1]) === targetStudio);
}

function preferFolderStudioCharacters(characters, aliases, foldersRaw) {
  const folderStudio = knownStudioFromFolders(foldersRaw, aliases);
  if (!folderStudio) return characters;

  const byBase = {};
  for (const ch of characters || []) {
    const base = baseCharacterName(ch && ch.name);
    if (!base) continue;
    if (!byBase[base]) byBase[base] = [];
    byBase[base].push(ch);
  }

  const keep = [];
  const seen = {};
  for (const base of Object.keys(byBase)) {
    const group = byBase[base];
    if (group.length <= 1) {
      keep.push(group[0]);
      continue;
    }
    const studioMatches = group.filter(ch => characterStudioMatches(ch && ch.name, folderStudio, aliases));
    for (const ch of (studioMatches.length ? studioMatches : group)) {
      const key = normalize(ch && ch.name);
      if (key && !seen[key]) {
        seen[key] = true;
        keep.push(ch);
      }
    }
  }
  return keep;
}

function emitMissCandidate(scene, reason, aliasMap, runtime, runId, configInput) {
  const config = normalizeConfig(configInput);
  const filePath = primaryScenePath(scene);
  const parsed = tokenizePathAndName(filePath, scene && scene.title, scene && scene.details);
  const split = splitArtistAndTitle(parsed.baseRaw);
  const candidates = parseCandidates(parsed, aliasMap || EMBEDDED_ALIASES, config);
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

function normalizedSceneTagNames(scene) {
  const names = {};
  for (const tag of (scene && scene.tags) || []) {
    const norm = normalize(tag && tag.name);
    if (norm) names[norm] = true;
    const compact = compactNormalize(tag && tag.name);
    if (compact) names[compact] = true;
  }
  return names;
}

function normalizedSceneGroupNames(scene) {
  const names = {};
  for (const item of (scene && scene.groups) || []) {
    const name = item && item.group && item.group.name;
    const norm = normalize(name);
    if (norm) names[norm] = true;
    const compact = compactNormalize(name);
    if (compact) names[compact] = true;
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
  const raw = parseCandidates(parsed, aliasMap || EMBEDDED_ALIASES, config);
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
    if (!namePresentInMap(groupNames, groupCandidate.name)) return true;
  }

  for (const characterCandidate of raw.characters || []) {
    if (candidateDecision(characterCandidate, threshold) !== "apply") continue;
    hasApplyCandidate = true;
    if (!namePresentInMap(tagNames, characterCandidate.name)) return true;
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

function applyLevelCandidates(candidates, threshold) {
  return (candidates || []).filter(c => candidateDecision(c, threshold) === "apply");
}

function namePresentInMap(nameMap, name) {
  return !!(nameMap && (nameMap[normalize(name)] || nameMap[compactNormalize(name)]));
}

function classifySceneMetadataState(scene, raw, configInput) {
  const config = normalizeConfig(configInput);
  const threshold = config.confidenceThreshold;
  const groupCandidates = applyLevelCandidates(raw && raw.groups, threshold);
  const tagCandidates = applyLevelCandidates(raw && raw.characters, threshold);
  const studioCandidate = (raw && raw.studios && raw.studios[0] && candidateDecision(raw.studios[0], threshold) === "apply")
    ? raw.studios[0]
    : null;
  const groupNames = normalizedSceneGroupNames(scene);
  const tagNames = normalizedSceneTagNames(scene);
  const missingGroups = groupCandidates
    .map(c => c && c.name)
    .filter(name => name && !namePresentInMap(groupNames, name));
  const missingTags = tagCandidates
    .map(c => c && c.name)
    .filter(name => name && !namePresentInMap(tagNames, name));
  const currentExpectedGroups = groupCandidates.length - missingGroups.length;
  const currentExpectedTags = tagCandidates.length - missingTags.length;
  const expectedCount = groupCandidates.length + tagCandidates.length;
  const presentCount = currentExpectedGroups + currentExpectedTags;
  const missingStudio = !!(studioCandidate && (!scene.studio || !scene.studio.id));
  let state = "no_action";

  if (expectedCount > 0 && presentCount === 0) state = "untagged";
  else if (missingGroups.length || missingTags.length || missingStudio) state = "partial";
  else if (expectedCount > 0) state = "complete";

  return {
    state,
    detectedGroups: groupCandidates.map(c => c.name),
    detectedTags: tagCandidates.map(c => c.name),
    detectedStudio: studioCandidate ? studioCandidate.name : "",
    missingGroups,
    missingTags,
    missingStudio,
    currentExpectedGroups,
    currentExpectedTags,
    expectedCount,
    presentCount
  };
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
    final_confidence: "", pre_tag_state: "",
    detected_group_count: "", detected_tag_count: "",
    missing_group_count: "", missing_tag_count: "",
    added_group_count: "0", added_tag_count: "0",
    metadata_gap: "",
    action_taken: "", result: "", error: ""
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
    const raw = parseCandidates(parsed, aliasMap, config);
    const preMeta = classifySceneMetadataState(scene, raw, config);

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
    csvRow.pre_tag_state = preMeta.state;
    csvRow.detected_group_count = String(preMeta.detectedGroups.length);
    csvRow.detected_tag_count = String(preMeta.detectedTags.length);
    csvRow.missing_group_count = String(preMeta.missingGroups.length);
    csvRow.missing_tag_count = String(preMeta.missingTags.length);
    csvRow._preMeta = preMeta;

    if (decision.overallDecision === "skip") {
      csvRow.result = "skipped_low_confidence";
      emitCSV(csvRow);
      pluginLog("SKIP low confidence scene=" + sceneId + " final=" + csvRow.final_confidence, runtime);
      emitMissCandidate(scene, "low_confidence", aliasMap, runtime, runId || "manual", config);
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
      applyMetadataAccounting(csvRow, preMeta, current, finalAssignments, matched, runtime);
      csvRow.result = matched.wouldCreate.length ? "dry_run_would_create" : "dry_run_proposed";
      emitCSV(csvRow);
      handleAutoAliasLearning(matched.aliasPlans, config, runtime, true, sceneId, runId || "manual");
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
      applyMetadataAccounting(csvRow, preMeta, current, finalAssignments, matched, runtime);
      csvRow.result = "already_compliant";
      emitCSV(csvRow);
      handleAutoAliasLearning(matched.aliasPlans, config, runtime, false, sceneId, runId || "manual");
      pluginLog("NO-OP scene=" + sceneId, runtime);
      return csvRow;
    }

    const updateInput = buildUpdateInput(sceneId, finalAssignments, current);
    doGraphQL(UPDATE_SCENE, { input: updateInput }, runtime, "UpdateScene");
    handleAutoAliasLearning(matched.aliasPlans, config, runtime, false, sceneId, runId || "manual");

    csvRow.matched_studio_id = finalAssignments.studioId || "";
    csvRow.matched_group_ids = finalAssignments.groupIds.join("|");
    csvRow.matched_tag_ids = finalAssignments.tagIds.join("|");
    applyMetadataAccounting(csvRow, preMeta, current, finalAssignments, matched, runtime);
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

function compactNormalize(value) {
  return normalize(value).replace(/\s+/g, "");
}

function closeMatchSuffixScore(candidateCompact, objectCompact) {
  if (!candidateCompact || !objectCompact) return 0;
  if (candidateCompact === objectCompact) return 1;

  for (const suffix of CLOSE_MATCH_SUFFIXES) {
    if (objectCompact === candidateCompact + suffix) return 0.98;
    if (candidateCompact === objectCompact + suffix) return 0.94;
    if (
      objectCompact.indexOf(candidateCompact) === 0 &&
      objectCompact.length > candidateCompact.length
    ) {
      const remainder = objectCompact.slice(candidateCompact.length);
      if (remainder === suffix) return 0.97;
    }
  }
  return 0;
}

function editDistance(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  const rows = s.length + 1;
  const cols = t.length + 1;
  const dp = [];
  for (let i = 0; i < rows; i++) {
    dp[i] = [];
    dp[i][0] = i;
  }
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[s.length][t.length];
}

function closeMatchScore(candidateName, object) {
  const candidateNorm = normalize(candidateName);
  const candidateCompact = compactNormalize(candidateName);
  if (!candidateNorm || !candidateCompact || !object) return 0;

  const values = [object.name].concat(aliasValuesForObject(object));
  let best = 0;
  for (const value of values) {
    const objectNorm = normalize(value);
    const objectCompact = compactNormalize(value);
    if (!objectNorm || !objectCompact) continue;
    if (candidateNorm === objectNorm || candidateCompact === objectCompact) return 1;

    best = Math.max(best, closeMatchSuffixScore(candidateCompact, objectCompact));

    const minLen = Math.min(candidateCompact.length, objectCompact.length);
    const maxLen = Math.max(candidateCompact.length, objectCompact.length);
    if (minLen >= 5 && Math.abs(candidateCompact.length - objectCompact.length) <= 2) {
      const similarity = 1 - (editDistance(candidateCompact, objectCompact) / maxLen);
      if (similarity >= 0.94) best = Math.max(best, similarity);
    }
  }
  return best;
}

function bestCloseObjectMatch(candidateName, objects, config) {
  if (!config.preferExistingCloseMatches) return null;
  let best = null;
  let bestScore = 0;
  for (const obj of objects || []) {
    const score = closeMatchScore(candidateName, obj);
    if (score > bestScore) {
      best = obj;
      bestScore = score;
    }
  }
  if (best && bestScore >= config.closeMatchMinConfidence) {
    best.__sceneAutoTaggerCloseMatchScore = bestScore;
    return best;
  }
  return null;
}

function searchStudiosByText(name, runtime) {
  try {
    const res = doGraphQL(
      FIND_STUDIOS_FOR_ALIAS_INDEX,
      { filter: { q: name, per_page: 25 } },
      runtime,
      "FindStudioCloseMatches"
    );
    return (res && res.findStudios && res.findStudios.studios) || [];
  } catch (err) {
    return [];
  }
}

function searchGroupsByText(name, runtime) {
  try {
    const res = doGraphQL(
      FIND_GROUPS_FOR_ALIAS_INDEX,
      { filter: { q: name, per_page: 25 } },
      runtime,
      "FindGroupCloseMatches"
    );
    return (res && res.findGroups && res.findGroups.groups) || [];
  } catch (err) {
    return [];
  }
}

function searchTagsByText(name, runtime, parentId) {
  try {
    const variables = { filter: { q: name, per_page: 25 } };
    if (parentId) {
      variables.tag_filter = { parents: { value: [parentId], modifier: "INCLUDES" } };
    }
    const res = doGraphQL(FIND_TAG, variables, runtime, "FindTagCloseMatches");
    return (res && res.findTags && res.findTags.tags) || [];
  } catch (err) {
    return [];
  }
}

function isSingleTokenName(name) {
  const parts = normalize(name).split(/\s+/).filter(Boolean);
  return parts.length === 1;
}

function hasAnyParent(tag) {
  return !!((tag && tag.parents) || []).length;
}

function betterDescriptiveTagMatch(candidate, exact, runtime, config, parentId) {
  if (!config.preferExistingCloseMatches || !candidate || !candidate.name) return null;
  const candidateNorm = normalize(candidate.name);
  if (!candidateNorm || !isSingleTokenName(candidate.name)) return null;
  if (exact && !hasAnyParent(exact)) return null;

  const searched = [];
  const searchTerms = uniq([candidate.aliasText, candidate.sourceText, candidate.name].filter(Boolean));
  for (const term of searchTerms) {
    for (const tag of searchTagsByText(term, runtime, parentId)) searched.push(tag);
  }

  let best = null;
  let bestScore = 0;
  for (const tag of searched) {
    if (!tag || !tag.id || String(tag.id) === String(exact && exact.id)) continue;
    const tagNorm = normalize(tag.name);
    if (!tagNorm || !tagNorm.startsWith(candidateNorm + " ")) continue;
    if (looksLikeSubtitleOrVariantName(tag.name)) continue;
    if (NON_CHARACTER_TAG_NAMES[tagNorm] || JUNK_CHARACTER_TOKENS[tagNorm]) continue;
    const score = hasAnyParent(tag) ? 0.965 : 0.985;
    if (score > bestScore) {
      best = tag;
      bestScore = score;
    }
  }
  if (best && bestScore >= config.closeMatchMinConfidence) {
    best.__sceneAutoTaggerCloseMatchScore = bestScore;
    return best;
  }
  return null;
}

function logCloseMatch(objectType, candidate, object, runtime) {
  if (!object || !object.__sceneAutoTaggerCloseMatchScore) return;
  pluginLog(
    "EXISTING_CLOSE_MATCH type=" + objectType +
    " requested=" + logSafeValue(candidate && candidate.name) +
    " matched=" + logSafeValue(object.name) +
    " score=" + object.__sceneAutoTaggerCloseMatchScore.toFixed(2),
    runtime
  );
}

function findExistingStudioForCandidate(candidate, runtime, config) {
  const exact = findStudio(candidate.name, runtime);
  if (exact) return exact;
  const close = bestCloseObjectMatch(candidate.name, searchStudiosByText(candidate.name, runtime), config);
  logCloseMatch("studio", candidate, close, runtime);
  return close;
}

function findExistingGroupForCandidate(candidate, runtime, config) {
  const exact = findGroup(candidate.name, runtime);
  if (exact) return exact;
  const close = bestCloseObjectMatch(candidate.name, searchGroupsByText(candidate.name, runtime), config);
  logCloseMatch("group", candidate, close, runtime);
  return close;
}

function findExistingTagForCandidate(candidate, runtime, config, parentId) {
  let exact = parentId ? findTagUnderParent(candidate.name, parentId, runtime) : findTagByName(candidate.name, runtime);
  if (exact && normalizeConfig(config).strictCharacterTagNames && looksLikeSubtitleOrVariantName(exact.name)) exact = null;
  const better = betterDescriptiveTagMatch(candidate, exact, runtime, config, parentId);
  if (better) {
    logCloseMatch("tag", candidate, better, runtime);
    return better;
  }
  if (exact) return exact;
  const closeCandidates = searchTagsByText(candidate.name, runtime, parentId)
    .filter(tag => !(normalizeConfig(config).strictCharacterTagNames && looksLikeSubtitleOrVariantName(tag && tag.name)));
  const close = bestCloseObjectMatch(candidate.name, closeCandidates, config);
  logCloseMatch("tag", candidate, close, runtime);
  return close;
}

function hasSuspiciousGroupFallbackName(name) {
  const raw = String(name || "");
  const norm = normalize(raw);
  if (!norm) return true;
  if (raw.length > 80) return true;
  if (/[,;]/.test(raw)) return true;
  if (/\b(?:x|vs|and)\b/i.test(raw)) return true;
  if (norm.split(/\s+/).length > 4) return true;
  if (JUNK_CHARACTER_TOKENS[norm] || NON_CHARACTER_TAG_NAMES[norm]) return true;
  return false;
}

function hasSuspiciousCharacterFallbackName(name) {
  const norm = normalize(name);
  if (!norm) return true;
  const words = norm.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 3) return true;
  if (words.length === 1 && COLOR_ONLY_TOKENS[words[0]]) return true;
  if (words.length === 1 && words[0].length < 3) return true;
  if (GENERIC_TITLE_CHARACTER_NAMES[norm]) return true;
  if (words.some(w => JUNK_CHARACTER_TOKENS[w] || NON_CHARACTER_TAG_NAMES[w] || CHARACTER_TITLE_STOP_WORDS[w])) return true;
  if (words.some(w => /\d/.test(w) && !/^(?:[a-z]\d|\d[a-z])$/i.test(w))) return true;
  return false;
}

function mayCreateMissingObject(objectType, candidate) {
  if (!candidate || !candidate.name) return false;
  if (objectType === "group" && candidate.source === "fallback") {
    return !hasSuspiciousGroupFallbackName(candidate.name);
  }
  if (objectType === "tag" && candidate.source === "title_franchise_fallback") {
    return !hasSuspiciousCharacterFallbackName(candidate.name);
  }
  return true;
}

function resolveApplyMatches(candidates, config, runtime, dryRun) {
  const result = { studioId: null, groupIds: [], tagIds: [], wouldCreate: [], aliasPlans: [] };

  if (candidates.studio) {
    const s = findExistingStudioForCandidate(candidates.studio, runtime, config);
    if (s && s.id) {
      result.studioId = String(s.id);
      addAutoAliasPlan(result, "studio", s, candidates.studio, config);
    }
    else if (!dryRun && config.createMissingStudios && mayCreateMissingObject("studio", candidates.studio)) {
      const created = createStudio(candidates.studio.name, runtime);
      if (created && created.id) {
        result.studioId = String(created.id);
        addAutoAliasPlan(result, "studio", created, candidates.studio, config);
      }
    } else if (config.createMissingStudios && mayCreateMissingObject("studio", candidates.studio)) {
      result.wouldCreate.push("studio:" + candidates.studio.name);
    }
  }

  for (const gCandidate of candidates.groups || []) {
    const g = findExistingGroupForCandidate(gCandidate, runtime, config);
    if (g && g.id) {
      result.groupIds.push(String(g.id));
      addAutoAliasPlan(result, "group", g, gCandidate, config);
    }
    else if (!dryRun && config.createMissingGroups && mayCreateMissingObject("group", gCandidate)) {
      const created = createGroup(gCandidate.name, runtime);
      if (created && created.id) {
        result.groupIds.push(String(created.id));
        addAutoAliasPlan(result, "group", created, gCandidate, config);
      }
    } else if (config.createMissingGroups && mayCreateMissingObject("group", gCandidate)) {
      result.wouldCreate.push("group:" + gCandidate.name);
    }
  }

  if ((candidates.characters || []).length) {
    let parentId = null;

    for (const cCandidate of candidates.characters) {
      const existingGlobal = findExistingTagForCandidate(cCandidate, runtime, config, null);
      if (existingGlobal && existingGlobal.id) {
        result.tagIds.push(String(existingGlobal.id));
        addAutoAliasPlan(result, "tag", existingGlobal, cCandidate, config);
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
        const t = findExistingTagForCandidate(cCandidate, runtime, config, parentId);
        if (t && t.id) {
          result.tagIds.push(String(t.id));
          addAutoAliasPlan(result, "tag", t, cCandidate, config);
        }
        else if (!dryRun && config.createMissingTags && mayCreateMissingObject("tag", cCandidate)) {
          const created = createTag(cCandidate.name, [parentId], runtime);
          if (created && created.id) {
            result.tagIds.push(String(created.id));
            addAutoAliasPlan(result, "tag", created, cCandidate, config);
          }
        } else if (config.createMissingTags && mayCreateMissingObject("tag", cCandidate)) {
          result.wouldCreate.push("tag:" + cCandidate.name);
        }
      } else if (dryRun && config.createMissingTags && mayCreateMissingObject("tag", cCandidate)) {
        result.wouldCreate.push("tag:" + cCandidate.name);
      }
    }
  }

  result.groupIds = uniq(result.groupIds);
  result.tagIds = uniq(result.tagIds);
  result.wouldCreate = uniq(result.wouldCreate);
  result.aliasPlans = dedupeAutoAliasPlans(result.aliasPlans);
  return result;
}

// ============================ AUTO-ALIAS LEARNING ============================

function safeAutoAliasValue(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSafeAutoAliasValue(value, canonicalName, config) {
  const alias = safeAutoAliasValue(value);
  const norm = normalize(alias);
  if (!norm) return false;
  if (norm === normalize(canonicalName)) return false;
  if (JUNK_CHARACTER_TOKENS[norm] || NON_CHARACTER_TAG_NAMES[norm]) return false;
  if (looksLikeSubtitleOrVariantName(alias)) return false;
  if (/[,\[\]()]/.test(alias) && norm.split(/\s+/).length > 2) return false;
  if (alias.length > config.autoAliasMaxLength) return false;
  if (norm.length < 2 && !/\d/.test(norm)) return false;
  return true;
}

function autoAliasValuesForCandidate(candidate, canonicalName, config) {
  const rawValues = [];
  if (candidate && candidate.aliasText) rawValues.push(candidate.aliasText);
  if (candidate && candidate.key) rawValues.push(candidate.key);
  if (candidate && candidate.sourceText) rawValues.push(candidate.sourceText);

  const values = [];
  const seen = {};
  for (const raw of rawValues) {
    const alias = safeAutoAliasValue(raw);
    const norm = normalize(alias);
    if (!isSafeAutoAliasValue(alias, canonicalName, config)) continue;
    if (!seen[norm]) {
      seen[norm] = true;
      values.push(alias);
    }
  }
  return values;
}

function addAutoAliasPlan(result, objectType, object, candidate, config) {
  if (!result || !object || !object.id || !candidate || !config) return;
  if (config.autoAliasMode === "off") return;
  if (((candidate && candidate.score) || 0) < config.minAutoAliasConfidence) return;
  if (
    !Object.prototype.hasOwnProperty.call(object, "aliases") &&
    !object.__sceneAutoTaggerCreated
  ) {
    return;
  }

  const canonicalName = object.name || candidate.name;
  const aliases = autoAliasValuesForCandidate(candidate, canonicalName, config);
  if (!aliases.length) return;

  const existingNorms = {};
  existingNorms[normalize(object.name)] = true;
  for (const alias of aliasValuesForObject(object)) existingNorms[normalize(alias)] = true;

  const additions = aliases.filter(alias => !existingNorms[normalize(alias)]);
  if (!additions.length) return;

  result.aliasPlans.push({
    objectType,
    object,
    objectId: String(object.id),
    objectName: canonicalName,
    aliases: additions
  });
}

function dedupeAutoAliasPlans(plans) {
  const byObject = {};
  for (const plan of plans || []) {
    if (!plan || !plan.objectType || !plan.objectId) continue;
    const key = plan.objectType + ":" + plan.objectId;
    if (!byObject[key]) {
      byObject[key] = {
        objectType: plan.objectType,
        object: plan.object,
        objectId: plan.objectId,
        objectName: plan.objectName,
        aliases: []
      };
    }
    byObject[key].aliases = uniq(byObject[key].aliases.concat(plan.aliases || []));
  }
  return Object.keys(byObject).map(k => byObject[k]).filter(p => p.aliases.length);
}

function updateAliasesForObject(plan, runtime) {
  const existingAliases = aliasValuesForObject(plan.object);
  const existingNorms = {};
  existingNorms[normalize(plan.objectName)] = true;
  for (const alias of existingAliases) existingNorms[normalize(alias)] = true;

  const additions = [];
  for (const alias of plan.aliases || []) {
    const norm = normalize(alias);
    if (norm && !existingNorms[norm]) {
      existingNorms[norm] = true;
      additions.push(alias);
    }
  }
  if (!additions.length) return { applied: 0, aliases: [] };

  const input = {
    id: plan.objectId,
    aliases: existingAliases.concat(additions)
  };

  if (plan.objectType === "studio") {
    doGraphQL(UPDATE_STUDIO_ALIASES, { input }, runtime, "UpdateStudioAliases");
  } else if (plan.objectType === "group") {
    doGraphQL(UPDATE_GROUP_ALIASES, { input }, runtime, "UpdateGroupAliases");
  } else if (plan.objectType === "tag") {
    doGraphQL(UPDATE_TAG_ALIASES, { input }, runtime, "UpdateTagAliases");
  }

  return { applied: additions.length, aliases: additions };
}

function handleAutoAliasLearning(aliasPlans, config, runtime, dryRun, sceneId, runId) {
  const plans = dedupeAutoAliasPlans(aliasPlans || []);
  if (!plans.length || config.autoAliasMode === "off") return { suggested: 0, applied: 0, errors: 0 };

  const stats = { suggested: 0, applied: 0, errors: 0 };
  for (const plan of plans) {
    const aliasList = (plan.aliases || []).join("|");
    if (dryRun || config.autoAliasMode === "suggest") {
      stats.suggested += (plan.aliases || []).length;
      pluginLog(
        "ALIAS_SUGGESTION run=" + runId +
        " scene=" + sceneId +
        " type=" + plan.objectType +
        " object=" + logSafeValue(plan.objectName) +
        " aliases=" + logSafeValue(aliasList),
        runtime
      );
      continue;
    }

    try {
      const result = updateAliasesForObject(plan, runtime);
      stats.applied += result.applied || 0;
      if (result.applied) {
        pluginLog(
          "ALIAS_UPDATED run=" + runId +
          " scene=" + sceneId +
          " type=" + plan.objectType +
          " object=" + logSafeValue(plan.objectName) +
          " aliases=" + logSafeValue((result.aliases || []).join("|")),
          runtime
        );
      }
    } catch (err) {
      stats.errors++;
      pluginLog(
        "ALIAS_UPDATE_FAILED run=" + runId +
        " scene=" + sceneId +
        " type=" + plan.objectType +
        " object=" + logSafeValue(plan.objectName) +
        " aliases=" + logSafeValue(aliasList) +
        " error=" + logSafeValue((err && err.message) || err),
        runtime
      );
    }
  }
  return stats;
}

// ============================ FIND / CREATE HELPERS ============================

function findStudio(name, runtime) {
  try {
    const res = doGraphQL(
      FIND_STUDIO,
      { studio_filter: { name: { value: name, modifier: "EQUALS" } }, filter: { per_page: 5 } },
      runtime,
      "FindStudio"
    );
    return (res && res.findStudios && res.findStudios.studios && res.findStudios.studios[0]) || null;
  } catch (err) {
    const fallback = doGraphQL(
      FIND_STUDIO_NO_ALIASES,
      { studio_filter: { name: { value: name, modifier: "EQUALS" } }, filter: { per_page: 5 } },
      runtime,
      "FindStudioNoAliases"
    );
    const studio = (fallback && fallback.findStudios && fallback.findStudios.studios && fallback.findStudios.studios[0]) || null;
    if (studio) studio.__sceneAutoTaggerAliasesUnavailable = true;
    return studio;
  }
}

function createStudio(name, runtime) {
  const res = doGraphQL(CREATE_STUDIO, { input: { name } }, runtime, "CreateStudio");
  const created = (res && res.studioCreate) || null;
  if (created) {
    created.__sceneAutoTaggerCreated = true;
    pluginLog("OBJECT_CREATED type=studio id=" + logSafeValue(created.id) + " name=" + logSafeValue(created.name || name), runtime);
  }
  return created;
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
  const created = (res && res.groupCreate) || null;
  if (created) {
    created.__sceneAutoTaggerCreated = true;
    pluginLog("OBJECT_CREATED type=group id=" + logSafeValue(created.id) + " name=" + logSafeValue(created.name || name), runtime);
  }
  return created;
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
  const created = (res && res.tagCreate) || null;
  if (created) {
    created.__sceneAutoTaggerCreated = true;
    pluginLog(
      "OBJECT_CREATED type=tag id=" + logSafeValue(created.id) +
      " name=" + logSafeValue(created.name || name) +
      " parentIds=" + logSafeValue((parentIds || []).join(",")),
      runtime
    );
  }
  return created;
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

function emitUserNotification(runtime, message) {
  if (!message) return;
  const safeMessage = String(message);
  try {
    if (runtime && typeof runtime.notify === "function") runtime.notify(safeMessage);
  } catch (e) {}
  try {
    if (runtime && runtime.notification && typeof runtime.notification.info === "function") {
      runtime.notification.info(safeMessage);
    }
  } catch (e) {}
  try {
    if (runtime && runtime.toast && typeof runtime.toast.success === "function") {
      runtime.toast.success(safeMessage);
    }
  } catch (e) {}
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
    successfullyTagged: 0,
    dryRun: 0,
    review: 0,
    noOp: 0,
    skipped: 0,
    errors: 0,
    preUntagged: 0,
    prePartial: 0,
    preComplete: 0,
    preNoAction: 0,
    detectedGroups: 0,
    detectedTags: 0,
    missingGroups: 0,
    missingTags: 0,
    addedGroups: 0,
    addedTags: 0,
    metadataGaps: 0
  };
}

function numericRowValue(row, key) {
  const n = parseInt(row && row[key], 10);
  return Number.isFinite(n) ? n : 0;
}

function recordSummary(summary, row) {
  summary.processed++;
  const result = row && row.result ? String(row.result) : "";
  const preState = row && row.pre_tag_state ? String(row.pre_tag_state) : "";
  if (preState === "untagged") summary.preUntagged++;
  else if (preState === "partial") summary.prePartial++;
  else if (preState === "complete") summary.preComplete++;
  else if (preState === "no_action") summary.preNoAction++;

  summary.detectedGroups += numericRowValue(row, "detected_group_count");
  summary.detectedTags += numericRowValue(row, "detected_tag_count");
  summary.missingGroups += numericRowValue(row, "missing_group_count");
  summary.missingTags += numericRowValue(row, "missing_tag_count");
  summary.addedGroups += numericRowValue(row, "added_group_count");
  summary.addedTags += numericRowValue(row, "added_tag_count");
  if (row && row.metadata_gap) summary.metadataGaps++;

  if (result === "updated" || result === "needs_review_tagged") summary.updated++;
  if (result === "updated") summary.successfullyTagged++;
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
    " successfullyTagged=" + summary.successfullyTagged +
    " dryRun=" + summary.dryRun +
    " review=" + summary.review +
    " noOp=" + summary.noOp +
    " skipped=" + summary.skipped +
    " errors=" + summary.errors +
    " preUntagged=" + summary.preUntagged +
    " prePartial=" + summary.prePartial +
    " preComplete=" + summary.preComplete +
    " preNoAction=" + summary.preNoAction +
    " detectedGroups=" + summary.detectedGroups +
    " detectedTags=" + summary.detectedTags +
    " missingGroups=" + summary.missingGroups +
    " missingTags=" + summary.missingTags +
    " addedGroups=" + summary.addedGroups +
    " addedTags=" + summary.addedTags +
    " metadataGaps=" + summary.metadataGaps
  );
}

function formatUserNotification(summary, libraryAudit) {
  const needing = summary.preUntagged + summary.prePartial;
  let message = (
    "Auto tagging complete. " +
    summary.preUntagged + " untagged scenes, " +
    summary.prePartial + " partially tagged scenes, " +
    summary.successfullyTagged + " scenes successfully tagged. " +
    "Processed " + summary.processed + " scenes; detected " + needing +
    " needing tagging; added " + summary.addedGroups + " groups and " +
    summary.addedTags + " tags."
  );
  if (summary.errors || summary.metadataGaps) {
    message += " Diagnostics: " + summary.errors + " errors, " + summary.metadataGaps + " metadata gaps logged.";
  }
  if (libraryAudit && libraryAudit.completed) {
    message += " Remaining in scanned library scope: " + libraryAudit.untagged +
      " untagged, " + libraryAudit.partial + " partially tagged.";
  } else if (libraryAudit && libraryAudit.error) {
    message += " Final library audit failed; see task log.";
  }
  return message;
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
    pre_tag_state: "",
    detected_group_count: "",
    detected_tag_count: "",
    missing_group_count: "",
    missing_tag_count: "",
    added_group_count: "",
    added_tag_count: "",
    metadata_gap: "",
    action_taken: "task_error",
    result: "error",
    error: errorMessage || "unknown task error"
  };
  emitCSV(row);
}

function emptyLibraryAudit() {
  return {
    completed: false,
    considered: 0,
    untagged: 0,
    partial: 0,
    complete: 0,
    noAction: 0,
    missingGroups: 0,
    missingTags: 0,
    missingStudio: 0,
    pathSkipped: 0,
    pagesScanned: 0,
    totalAvailable: 0,
    error: ""
  };
}

function runFinalLibraryAudit(configInput, aliasMapInput, runtime, runId) {
  const config = normalizeConfig(configInput);
  const aliasMap = normalizeAliasMap(aliasMapInput || EMBEDDED_ALIASES);
  const audit = emptyLibraryAudit();

  if (!config.finalLibraryAuditEnabled) {
    pluginLog("FINAL_LIBRARY_AUDIT run=" + runId + " disabled", runtime);
    return audit;
  }

  try {
    pluginLog(
      "FINAL_LIBRARY_AUDIT START run=" + runId +
      " pageSize=" + config.finalLibraryAuditPageSize +
      " maxPages=" + config.finalLibraryAuditMaxPages +
      " pathIncludes=" + logSafeValue(config.sceneDiscoveryPathIncludes || "") +
      " pathExcludes=" + logSafeValue(config.sceneDiscoveryPathExcludes || ""),
      runtime
    );

    for (let i = 0; i < config.finalLibraryAuditMaxPages; i++) {
      const filter = {
        page: i + 1,
        per_page: config.finalLibraryAuditPageSize,
        sort: config.sceneDiscoverySort || "id",
        direction: config.sceneDiscoveryDirection || "DESC"
      };
      if (config.sceneDiscoveryQuery) filter.q = config.sceneDiscoveryQuery;

      const res = doGraphQL(
        FIND_SCENES_FOR_BULK,
        { scene_filter: null, filter },
        runtime,
        "FinalLibraryAuditFindScenes"
      );
      const found = (res && res.findScenes) || {};
      const scenes = found.scenes || [];
      if (i === 0) audit.totalAvailable = found.count || 0;
      audit.pagesScanned++;

      for (const scene of scenes) {
        if (!scene || !scene.id) continue;
        if (!sceneDiscoveryPathAllowed(scene, config)) {
          audit.pathSkipped++;
          continue;
        }
        const filePath = primaryScenePath(scene);
        const parsed = tokenizePathAndName(filePath, scene.title, scene.details);
        const raw = parseCandidates(parsed, aliasMap, config);
        const state = classifySceneMetadataState(scene, raw, config);

        audit.considered++;
        audit.missingGroups += (state.missingGroups || []).length;
        audit.missingTags += (state.missingTags || []).length;
        if (state.missingStudio) audit.missingStudio++;
        if (state.state === "untagged") audit.untagged++;
        else if (state.state === "partial") audit.partial++;
        else if (state.state === "complete") audit.complete++;
        else audit.noAction++;
      }

      if (scenes.length < config.finalLibraryAuditPageSize) break;
    }

    audit.completed = true;
    pluginLog(
      "FINAL_LIBRARY_AUDIT run=" + runId +
      " completed=true considered=" + audit.considered +
      " untagged=" + audit.untagged +
      " partial=" + audit.partial +
      " complete=" + audit.complete +
      " noAction=" + audit.noAction +
      " missingGroups=" + audit.missingGroups +
      " missingTags=" + audit.missingTags +
      " missingStudio=" + audit.missingStudio +
      " pathSkipped=" + audit.pathSkipped +
      " pagesScanned=" + audit.pagesScanned +
      " totalAvailable=" + audit.totalAvailable,
      runtime
    );
  } catch (err) {
    audit.error = String((err && err.message) || err).replace(/[\r\n]/g, " ");
    pluginLog("FINAL_LIBRARY_AUDIT_FAILED run=" + runId + " error=" + audit.error, runtime);
  }

  return audit;
}

function primaryImagePath(image) {
  const file = image && image.visual_files && image.visual_files[0];
  return (file && (file.path || file.basename)) || "";
}

function imageFranchiseFromPath(imagePath, configInput) {
  const config = normalizeConfig(configInput);
  const parts = pathParts(imagePath);
  const includes = splitConfigList(config.imageTaggingPathIncludes);
  const excludes = splitConfigList(config.imageTaggingPathExcludes);
  const lowerPath = String(imagePath || "").toLowerCase();

  for (const item of excludes) {
    if (item && lowerPath.indexOf(item.toLowerCase()) !== -1) return "";
  }

  for (const include of includes) {
    const includeNorm = normalize(include);
    if (!includeNorm) continue;
    for (let i = 0; i < parts.length - 1; i++) {
      if (normalize(parts[i]) !== includeNorm) continue;
      const folder = parts[i + 1];
      const folderNorm = normalize(folder);
      if (!folderNorm || GENERIC_FOLDER_NAMES[folderNorm] || folderNorm.charAt(0) === "_") return "";
      return String(folder).trim();
    }
  }
  return "";
}

function imageHasTagNamed(image, tagName) {
  const target = normalize(tagName);
  for (const tag of (image && image.tags) || []) {
    if (normalize(tag && tag.name) === target) return true;
  }
  return false;
}

function imageCurrentTagIds(image) {
  return new Set(((image && image.tags) || []).map(t => t && String(t.id)).filter(Boolean));
}

function updateImageTags(imageId, tagIds, runtime) {
  return doGraphQL(UPDATE_IMAGE, { input: { id: imageId, tag_ids: tagIds } }, runtime, "UpdateImageTags");
}

function fetchImagePageForFolderTagging(page, config, runtime) {
  return doGraphQL(
    FIND_IMAGES_FOR_FOLDER_TAGGING,
    {
      filter: {
        page,
        per_page: config.imageTaggingPageSize,
        sort: "created_at",
        direction: "DESC"
      }
    },
    runtime,
    "FindImagesForFolderTagging"
  );
}

function runImageFolderTagTask(args, runtime) {
  const runId = "images-" + Date.now();
  const options = buildRuntimeOptions(args);
  const config = options.config;
  const summary = { scanned: 0, eligible: 0, updated: 0, alreadyTagged: 0, skipped: 0, errors: 0, wouldUpdate: 0 };
  let totalAvailable = 0;

  pluginLog(
    "IMAGE TAGGING START run=" + runId +
    " version=" + PLUGIN_VERSION +
    " dryRun=" + config.dryRun +
    " pathIncludes=" + logSafeValue(config.imageTaggingPathIncludes) +
    " pathExcludes=" + logSafeValue(config.imageTaggingPathExcludes) +
    " limit=" + config.imageTaggingLimit,
    runtime
  );

  try {
    for (let i = 0; i < config.imageTaggingScanPages && summary.scanned < config.imageTaggingLimit; i++) {
      const page = i + 1;
      const res = fetchImagePageForFolderTagging(page, config, runtime);
      const found = (res && res.findImages) || {};
      const images = found.images || [];
      if (i === 0) totalAvailable = found.count || 0;

      for (const image of images) {
        if (!image || !image.id || summary.scanned >= config.imageTaggingLimit) continue;
        summary.scanned++;
        const imagePath = primaryImagePath(image);
        const franchise = imageFranchiseFromPath(imagePath, config);
        if (!franchise) {
          summary.skipped++;
          continue;
        }

        summary.eligible++;
        if (imageHasTagNamed(image, franchise)) {
          summary.alreadyTagged++;
          continue;
        }

        const tag = findOrCreateTagByName(franchise, !config.dryRun && config.imageTaggingCreateMissingTags, runtime);
        if (!tag || !tag.id) {
          if (config.dryRun && config.imageTaggingCreateMissingTags) summary.wouldUpdate++;
          else summary.errors++;
          pluginLog(
            "IMAGE TAGGING GAP run=" + runId +
            " image=" + image.id +
            " franchise=" + logSafeValue(franchise) +
            " path=" + logSafeValue(imagePath) +
            " reason=tag_not_found",
            runtime
          );
          continue;
        }

        const finalTagIds = Array.from(setUnion(imageCurrentTagIds(image), [String(tag.id)])).sort();
        if (config.dryRun) {
          summary.wouldUpdate++;
          pluginLog("IMAGE DRY-RUN run=" + runId + " image=" + image.id + " addTag=" + logSafeValue(franchise), runtime);
        } else {
          updateImageTags(String(image.id), finalTagIds, runtime);
          summary.updated++;
          pluginLog("IMAGE UPDATED run=" + runId + " image=" + image.id + " addTag=" + logSafeValue(franchise), runtime);
        }
      }

      emitProgress(runtime, summary.scanned, Math.min(config.imageTaggingLimit, totalAvailable || config.imageTaggingLimit), "Image folder tagging");
      if (images.length < config.imageTaggingPageSize) break;
    }
  } catch (err) {
    summary.errors++;
    pluginLog("IMAGE TAGGING ERROR run=" + runId + " error=" + logSafeValue((err && err.message) || err), runtime);
  }

  const message = (
    "Image tagging complete. scanned=" + summary.scanned +
    " eligible=" + summary.eligible +
    " updated=" + summary.updated +
    " alreadyTagged=" + summary.alreadyTagged +
    " wouldUpdate=" + summary.wouldUpdate +
    " skipped=" + summary.skipped +
    " errors=" + summary.errors
  );
  emitUserNotification(runtime, message);
  pluginLog("===== SCENE AUTO-TAGGER IMAGE SUMMARY run=" + runId + " " + message + " totalAvailable=" + totalAvailable + " =====", runtime);
  return { Output: message + " run=" + runId, output: message + " run=" + runId };
}

// ============================ HUMAN-TAUGHT CORRECTIONS ============================

function emptyLearnedStore() {
  return { schemaVersion: LEARNED_SCHEMA_VERSION, revision: 0, rules: [], history: [] };
}

function normalizeLearnedStore(value) {
  const parsed = parseMaybeJSON(value);
  const store = emptyLearnedStore();
  if (!parsed || typeof parsed !== "object") return store;
  store.revision = Math.max(0, Number(parsed.revision) || 0);
  store.rules = Array.isArray(parsed.rules) ? parsed.rules.filter(rule => rule && rule.id && rule.type) : [];
  store.history = Array.isArray(parsed.history) ? parsed.history.slice(-LEARNED_HISTORY_LIMIT) : [];
  return store;
}

function operationArgsFromInput(rawInput) {
  const inputObject = rawInput || {};
  const raw = normalizePluginArgInput(inputObject.args || inputObject.Args || inputObject);
  const argsMap = normalizePluginArgInput(raw.args_map || raw.argsMap || {});
  return { ...raw, ...argsMap };
}

function learnedRuleKey(type, signal) {
  return normalize(type) + ":" + normalize(signal);
}

function activeLearnedRules(store) {
  return (store && store.rules || []).filter(rule => rule && rule.status === "active");
}

function learnedPluginState(runtime) {
  const data = doGraphQL(GET_LEARNED_PLUGIN_STATE, {}, runtime, "GetLearnedPluginState") || {};
  const configMap = (data.configuration && data.configuration.plugins) || {};
  const plugins = data.plugins || [];
  let pluginId = PLUGIN_ID;
  for (const plugin of plugins) {
    if (plugin && plugin.id === PLUGIN_ID) {
      pluginId = PLUGIN_ID;
      break;
    }
    if (plugin && plugin.name === "Scene Auto-Tagger") pluginId = String(plugin.id || pluginId);
  }
  const pluginConfig = configMap[pluginId] || configMap[PLUGIN_ID] || configMap[LEGACY_PLUGIN_ID] || {};
  return {
    pluginId,
    pluginConfig: pluginConfig && typeof pluginConfig === "object" ? pluginConfig : {},
    store: normalizeLearnedStore(pluginConfig && pluginConfig[LEARNED_CORRECTIONS_KEY])
  };
}

function saveLearnedPluginState(state, store, runtime) {
  const nextConfig = { ...(state.pluginConfig || {}) };
  nextConfig[LEARNED_CORRECTIONS_KEY] = JSON.stringify(store);
  const data = doGraphQL(
    CONFIGURE_LEARNED_PLUGIN,
    { plugin_id: state.pluginId || PLUGIN_ID, input: nextConfig },
    runtime,
    "ConfigureLearnedPluginState"
  );
  state.pluginConfig = (data && data.configurePlugin) || nextConfig;
  state.store = store;
  return state;
}

function collectLearnedTargetIds(rules) {
  const ids = { studio: [], group: [], tag: [] };
  for (const rule of rules || []) {
    if (rule.targetObjectType && ids[rule.targetObjectType] && rule.targetId) {
      ids[rule.targetObjectType].push(String(rule.targetId));
    }
    if (rule.subjectObjectType && ids[rule.subjectObjectType] && rule.subjectId) {
      ids[rule.subjectObjectType].push(String(rule.subjectId));
    }
  }
  ids.studio = uniq(ids.studio);
  ids.group = uniq(ids.group);
  ids.tag = uniq(ids.tag);
  return ids;
}

function validateLearnedTargets(rules, runtime) {
  const ids = collectLearnedTargetIds(rules);
  const data = doGraphQL(
    VALIDATE_LEARNED_TARGETS,
    { studio_ids: ids.studio, group_ids: ids.group, tag_ids: ids.tag },
    runtime,
    "ValidateLearnedTargets"
  ) || {};
  const objects = { studio: {}, group: {}, tag: {} };
  for (const studio of ((data.findStudios || {}).studios || [])) objects.studio[String(studio.id)] = studio;
  for (const group of ((data.findGroups || {}).groups || [])) objects.group[String(group.id)] = group;
  for (const tag of ((data.findTags || {}).tags || [])) objects.tag[String(tag.id)] = tag;
  return objects;
}

function validatedRuleTarget(rule, objects) {
  if (!rule || rule.type === "ignore_character") return { valid: true, target: null, subject: null };
  const targetType = rule.targetObjectType;
  const target = targetType && objects[targetType] && objects[targetType][String(rule.targetId)];
  const subjectType = rule.subjectObjectType;
  const subject = subjectType && objects[subjectType] && objects[subjectType][String(rule.subjectId)];
  return { valid: !!target && (!subjectType || !!subject), target, subject };
}

function learnedAliasOverrideFromStore(store, runtime, runId) {
  const aliases = emptyAliasMapObject();
  const rules = activeLearnedRules(store);
  if (!rules.length) return normalizeAliasMap(aliases);

  let objects;
  try {
    objects = validateLearnedTargets(rules, runtime);
  } catch (err) {
    pluginLog("LEARNED_RULES unavailable run=" + logSafeValue(runId) + " error=" + logSafeValue((err && err.message) || err), runtime);
    return normalizeAliasMap(aliases);
  }

  let applied = 0;
  let invalid = 0;
  for (const rule of rules) {
    const checked = validatedRuleTarget(rule, objects);
    if (!checked.valid) {
      invalid++;
      pluginLog(
        "LEARN_RULE_RUNTIME_DISABLED run=" + logSafeValue(runId) +
        " rule=" + logSafeValue(rule.id) +
        " reason=missing_target",
        runtime
      );
      continue;
    }
    if (rule.type === "character_alias") {
      aliases.characters[normalize(rule.signal)] = checked.target.name;
    } else if (rule.type === "group_alias") {
      aliases.groups[normalize(rule.signal)] = checked.target.name;
    } else if (rule.type === "character_studio") {
      aliases.forcedCharacterStudios[normalize(checked.subject.name)] = checked.target.name;
    } else if (rule.type === "ignore_character") {
      aliases.ignoredCharacters[normalize(rule.signal)] = true;
    }
    applied++;
  }
  pluginLog(
    "LEARNED_RULES run=" + logSafeValue(runId) +
    " revision=" + Number(store.revision || 0) +
    " active=" + rules.length +
    " applied=" + applied +
    " invalid=" + invalid,
    runtime
  );
  return normalizeAliasMap(aliases);
}

function buildLearnedAliasOverride(runtime, runId) {
  try {
    const state = learnedPluginState(runtime);
    return learnedAliasOverrideFromStore(state.store, runtime, runId);
  } catch (err) {
    pluginLog("LEARNED_RULES unavailable run=" + logSafeValue(runId) + " error=" + logSafeValue((err && err.message) || err), runtime);
    return normalizeAliasMap(emptyAliasMapObject());
  }
}

function isCurrentCharacterTag(tag, config, aliases) {
  if (!tag || tag.ignore_auto_tag) return false;
  if (tagHasParentNamed(tag, config.characterParentTag)) return true;
  const target = normalize(tag.name);
  for (const key of Object.keys((aliases && aliases.characters) || {})) {
    if (normalize(aliases.characters[key]) === target) return true;
  }
  return false;
}

function ruleConflictForProposal(store, type, signal, targetId, subjectId) {
  const key = learnedRuleKey(type, signal);
  for (const rule of activeLearnedRules(store)) {
    if (learnedRuleKey(rule.type, rule.signal) !== key) continue;
    const sameTarget = String(rule.targetId || "") === String(targetId || "");
    const sameSubject = String(rule.subjectId || "") === String(subjectId || "");
    return { rule, same: sameTarget && sameSubject };
  }
  return null;
}

function proposalId(type, signal, targetId, subjectId) {
  return [normalize(type), normalize(signal), String(targetId || ""), String(subjectId || "")].join("|");
}

function makeLearningProposal(store, data) {
  const proposal = { ...data };
  proposal.signal = String(proposal.signal || "").trim();
  proposal.id = proposalId(proposal.type, proposal.signal, proposal.targetId, proposal.subjectId);
  const conflict = ruleConflictForProposal(store, proposal.type, proposal.signal, proposal.targetId, proposal.subjectId);
  proposal.conflict = conflict && !conflict.same ? {
    ruleId: conflict.rule.id,
    targetName: conflict.rule.targetName || "",
    subjectName: conflict.rule.subjectName || ""
  } : null;
  proposal.alreadyLearned = !!(conflict && conflict.same);
  return proposal;
}

function buildLearningAliasContext(config, runtime, store, runId) {
  const dynamic = buildRuntimeStashAliasMap(runtime, config, EMBEDDED_ALIASES, runId);
  const baseline = mergeAliasMaps(EMBEDDED_ALIASES, dynamic);
  const learned = learnedAliasOverrideFromStore(store, runtime, runId);
  return { baseline, effective: mergeAliasMaps(baseline, learned) };
}

function sceneSnapshot(scene) {
  return {
    updatedAt: String((scene && scene.updated_at) || ""),
    studioId: String((scene && scene.studio && scene.studio.id) || ""),
    groupIds: (scene && scene.groups || []).map(item => String(item && item.group && item.group.id || "")).filter(Boolean).sort(),
    tagIds: (scene && scene.tags || []).map(tag => String(tag && tag.id || "")).filter(Boolean).sort()
  };
}

function previewLearnedCorrection(args, runtime) {
  const sceneId = String(args.sceneId || args.scene_id || "");
  if (!sceneId) throw new Error("sceneId is required");
  const state = learnedPluginState(runtime);
  const config = normalizeConfig({ allowTitleFallbackCharacterTags: true, strictCharacterTagNames: true });
  const context = buildLearningAliasContext(config, runtime, state.store, "learn-preview-" + sceneId);
  const sceneData = doGraphQL(GET_SCENE, { id: sceneId }, runtime, "GetSceneForLearning");
  const scene = sceneData && sceneData.findScene;
  if (!scene) throw new Error("Scene not found: " + sceneId);

  const filePath = primaryScenePath(scene);
  const parsed = tokenizePathAndName(filePath, scene.title, scene.details);
  const split = splitArtistAndTitle(parsed.baseRaw);
  const predicted = parseCandidates(parsed, context.effective, config);
  const currentCharacters = (scene.tags || []).filter(tag => isCurrentCharacterTag(tag, config, context.effective));
  const currentGroups = (scene.groups || []).map(item => item && item.group).filter(Boolean);
  const proposals = [];

  const predictedGroup = predicted.groups && predicted.groups[0];
  if (split.artistRaw && currentGroups.length) {
    if (currentGroups.length === 1 && (!predictedGroup || normalize(predictedGroup.name) !== normalize(currentGroups[0].name))) {
      proposals.push(makeLearningProposal(state.store, {
        type: "group_alias",
        signal: split.artistRaw,
        targetObjectType: "group",
        targetId: String(currentGroups[0].id),
        targetName: currentGroups[0].name,
        previousName: predictedGroup && predictedGroup.name || "",
        reason: "Correct the filename artist mapping",
        ambiguous: false
      }));
    } else if (currentGroups.length > 1 && (!predictedGroup || !currentGroups.some(group => normalize(group.name) === normalize(predictedGroup.name)))) {
      proposals.push(makeLearningProposal(state.store, {
        type: "group_alias",
        signal: split.artistRaw,
        targetObjectType: "group",
        targetId: "",
        targetName: "",
        previousName: predictedGroup && predictedGroup.name || "",
        reason: "Choose which current Group represents the filename artist",
        ambiguous: true,
        allowedTargets: currentGroups.map(group => ({ id: String(group.id), name: group.name }))
      }));
    }
  }

  const selectedByName = {};
  for (const tag of currentCharacters) selectedByName[normalize(tag.name)] = tag;
  const unmatchedCurrent = currentCharacters.slice();
  for (const candidate of predicted.characters || []) {
    const exact = selectedByName[normalize(candidate.name)];
    if (exact) {
      const index = unmatchedCurrent.indexOf(exact);
      if (index >= 0) unmatchedCurrent.splice(index, 1);
      continue;
    }
    const signal = candidate.aliasText || candidate.name;
    if (!signal) continue;
    if (unmatchedCurrent.length === 1) {
      const target = unmatchedCurrent.shift();
      proposals.push(makeLearningProposal(state.store, {
        type: "character_alias",
        signal,
        targetObjectType: "tag",
        targetId: String(target.id),
        targetName: target.name,
        previousName: candidate.name,
        reason: "Correct this filename character token",
        ambiguous: false
      }));
    } else if (unmatchedCurrent.length > 1) {
      proposals.push(makeLearningProposal(state.store, {
        type: "character_alias",
        signal,
        targetObjectType: "tag",
        targetId: "",
        targetName: "",
        previousName: candidate.name,
        reason: "Choose which current character Tag this token means",
        ambiguous: true,
        allowIgnore: true,
        allowedTargets: unmatchedCurrent.map(tag => ({ id: String(tag.id), name: tag.name }))
      }));
    } else {
      proposals.push(makeLearningProposal(state.store, {
        type: "ignore_character",
        signal,
        targetObjectType: "",
        targetId: "",
        targetName: "Ignore token",
        previousName: candidate.name,
        reason: "Stop treating this token as a character",
        ambiguous: true,
        allowIgnore: true
      }));
    }
  }

  if (unmatchedCurrent.length) {
    const hints = titleTokenHints(split.titleRaw).filter(hint => {
      const hintNorm = normalize(hint);
      return !(predicted.characters || []).some(candidate => containsPhrase(hintNorm, normalize(candidate.aliasText || candidate.name)));
    });
    for (const target of unmatchedCurrent) {
      if (!hints.length) continue;
      proposals.push(makeLearningProposal(state.store, {
        type: "character_alias",
        signal: hints[0],
        targetObjectType: "tag",
        targetId: String(target.id),
        targetName: target.name,
        previousName: "",
        reason: "Teach an unrecognized filename character token",
        ambiguous: hints.length > 1 || unmatchedCurrent.length > 1,
        allowedSignals: hints
      }));
    }
  }

  const predictedStudio = predicted.studios && predicted.studios[0];
  if (scene.studio && currentCharacters.length && (!predictedStudio || normalize(predictedStudio.name) !== normalize(scene.studio.name))) {
    if (currentCharacters.length === 1) {
      const subject = currentCharacters[0];
      proposals.push(makeLearningProposal(state.store, {
        type: "character_studio",
        signal: subject.name,
        subjectObjectType: "tag",
        subjectId: String(subject.id),
        subjectName: subject.name,
        targetObjectType: "studio",
        targetId: String(scene.studio.id),
        targetName: scene.studio.name,
        previousName: predictedStudio && predictedStudio.name || "",
        reason: "Use this franchise when the character is detected",
        ambiguous: false
      }));
    } else {
      proposals.push(makeLearningProposal(state.store, {
        type: "character_studio",
        signal: "",
        subjectObjectType: "tag",
        subjectId: "",
        subjectName: "",
        targetObjectType: "studio",
        targetId: String(scene.studio.id),
        targetName: scene.studio.name,
        previousName: predictedStudio && predictedStudio.name || "",
        reason: "Choose the first-listed character that determines this franchise",
        ambiguous: true,
        allowedSubjects: currentCharacters.map(tag => ({ id: String(tag.id), name: tag.name }))
      }));
    }
  }

  const filtered = proposals.filter(proposal => !proposal.alreadyLearned);
  pluginLog(
    "LEARN_PREVIEW scene=" + sceneId +
    " revision=" + state.store.revision +
    " proposals=" + filtered.length,
    runtime
  );
  return {
    ok: true,
    pluginId: state.pluginId,
    revision: state.store.revision,
    scene: {
      id: String(scene.id),
      path: filePath,
      title: scene.title || (scene.files && scene.files[0] && scene.files[0].basename) || "",
      studio: scene.studio || null,
      groups: currentGroups,
      characters: currentCharacters,
      snapshot: sceneSnapshot(scene)
    },
    predicted: {
      studio: predictedStudio && predictedStudio.name || "",
      groups: (predicted.groups || []).map(candidate => candidate.name),
      characters: (predicted.characters || []).map(candidate => candidate.name)
    },
    proposals: filtered
  };
}

function newLearnedRuleId() {
  return "lr-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
}

function addLearnedRule(store, selected, sceneId, replacedRule) {
  const now = new Date().toISOString();
  if (replacedRule) {
    replacedRule.status = "superseded";
    replacedRule.updatedAt = now;
  }
  const rule = {
    id: newLearnedRuleId(),
    type: selected.type,
    signal: String(selected.signal || selected.subjectName || "").trim(),
    signalNorm: normalize(selected.signal || selected.subjectName),
    subjectObjectType: selected.subjectObjectType || "",
    subjectId: String(selected.subjectId || ""),
    subjectName: selected.subjectName || "",
    targetObjectType: selected.targetObjectType || "",
    targetId: String(selected.targetId || ""),
    targetName: selected.targetName || "",
    sourceSceneId: String(sceneId),
    createdAt: now,
    updatedAt: now,
    status: "active",
    replacesRuleId: replacedRule && replacedRule.id || ""
  };
  store.rules.push(rule);
  return rule;
}

function applyLearnedCorrection(args, runtime) {
  const sceneId = String(args.sceneId || args.scene_id || "");
  const expectedRevision = Number(args.expectedRevision);
  const requested = parseMaybeJSON(args.rulesJson || args.rules || []);
  if (!sceneId) throw new Error("sceneId is required");
  if (!Array.isArray(requested) || !requested.length) throw new Error("At least one lesson must be selected");

  const fresh = previewLearnedCorrection({ sceneId }, runtime);
  const state = learnedPluginState(runtime);
  if (state.store.revision !== expectedRevision || fresh.revision !== expectedRevision) {
    throw new Error("Learned corrections changed. Reopen the preview and try again.");
  }
  const available = {};
  for (const proposal of fresh.proposals) available[proposal.id] = proposal;
  const selected = [];
  for (const request of requested) {
    const proposal = available[request.proposalId || request.id];
    if (!proposal) throw new Error("A selected lesson is stale or no longer valid");
    const item = { ...proposal };
    if (proposal.allowedTargets && proposal.allowedTargets.length) {
      const target = proposal.allowedTargets.find(value => String(value.id) === String(request.targetId));
      if (!target) throw new Error("Choose a valid target for " + proposal.signal);
      item.targetId = String(target.id);
      item.targetName = target.name;
    }
    if (proposal.allowedSubjects && proposal.allowedSubjects.length) {
      const subject = proposal.allowedSubjects.find(value => String(value.id) === String(request.subjectId));
      if (!subject) throw new Error("Choose which character controls the Studio mapping");
      item.subjectId = String(subject.id);
      item.subjectName = subject.name;
      item.signal = subject.name;
    }
    if (proposal.allowedSignals && proposal.allowedSignals.length) {
      const signal = proposal.allowedSignals.find(value => normalize(value) === normalize(request.signal));
      if (!signal) throw new Error("Choose a valid filename token for " + proposal.targetName);
      item.signal = signal;
    }
    if (request.asIgnore) {
      if (!proposal.allowIgnore) throw new Error("This lesson cannot be converted to an ignore rule");
      item.type = "ignore_character";
      item.targetObjectType = "";
      item.targetId = "";
      item.targetName = "Ignore token";
      item.subjectObjectType = "";
      item.subjectId = "";
      item.subjectName = "";
    }
    const conflict = ruleConflictForProposal(state.store, item.type, item.signal, item.targetId, item.subjectId);
    if (conflict && !conflict.same && !request.replace) {
      throw new Error("A conflicting learned rule already exists for " + item.signal);
    }
    item.replacedRule = conflict && !conflict.same ? conflict.rule : null;
    selected.push(item);
  }

  const created = [];
  const restored = [];
  for (const item of selected) {
    const rule = addLearnedRule(state.store, item, sceneId, item.replacedRule);
    created.push(rule);
    if (item.replacedRule) restored.push(item.replacedRule.id);
  }
  state.store.revision++;
  const event = {
    id: "le-" + Date.now() + "-" + Math.floor(Math.random() * 1000000),
    action: "learn",
    sceneId,
    createdRuleIds: created.map(rule => rule.id),
    supersededRuleIds: restored,
    timestamp: new Date().toISOString(),
    revision: state.store.revision
  };
  state.store.history.push(event);
  state.store.history = state.store.history.slice(-LEARNED_HISTORY_LIMIT);
  saveLearnedPluginState(state, state.store, runtime);
  pluginLog(
    "LEARN_APPLIED scene=" + sceneId +
    " revision=" + state.store.revision +
    " rules=" + created.map(rule => rule.id).join("|"),
    runtime
  );
  return { ok: true, revision: state.store.revision, event, rules: created };
}

function listLearnedCorrections(runtime) {
  const state = learnedPluginState(runtime);
  let objects = { studio: {}, group: {}, tag: {} };
  try {
    objects = validateLearnedTargets(activeLearnedRules(state.store), runtime);
  } catch (err) {
    pluginLog("LEARN_LIST target validation failed error=" + logSafeValue((err && err.message) || err), runtime);
  }
  const rules = state.store.rules.map(rule => {
    const checked = validatedRuleTarget(rule, objects);
    return { ...rule, runtimeValid: rule.status !== "active" || checked.valid };
  });
  return { ok: true, revision: state.store.revision, rules, history: state.store.history };
}

function disableLearnedCorrection(args, runtime) {
  const state = learnedPluginState(runtime);
  const expectedRevision = Number(args.expectedRevision);
  if (state.store.revision !== expectedRevision) throw new Error("Learned corrections changed. Refresh and try again.");
  const ruleId = String(args.ruleId || "");
  const rule = state.store.rules.find(item => item.id === ruleId && item.status === "active");
  if (!rule) throw new Error("Active learned rule not found: " + ruleId);
  rule.status = "disabled";
  rule.updatedAt = new Date().toISOString();
  state.store.revision++;
  state.store.history.push({
    id: "le-" + Date.now(), action: "disable", ruleIds: [ruleId],
    timestamp: new Date().toISOString(), revision: state.store.revision
  });
  state.store.history = state.store.history.slice(-LEARNED_HISTORY_LIMIT);
  saveLearnedPluginState(state, state.store, runtime);
  pluginLog("LEARN_RULE_DISABLED rule=" + ruleId + " revision=" + state.store.revision, runtime);
  return { ok: true, revision: state.store.revision, rule };
}

function undoLearnedCorrection(args, runtime) {
  const state = learnedPluginState(runtime);
  const expectedRevision = Number(args.expectedRevision);
  if (state.store.revision !== expectedRevision) throw new Error("Learned corrections changed. Refresh and try again.");
  const eventId = String(args.eventId || "");
  let event = null;
  for (let i = state.store.history.length - 1; i >= 0; i--) {
    const candidate = state.store.history[i];
    if (candidate.action === "learn" && (!eventId || candidate.id === eventId)) {
      event = candidate;
      break;
    }
  }
  if (!event) throw new Error("No learning event is available to undo");
  const now = new Date().toISOString();
  for (const rule of state.store.rules) {
    if ((event.createdRuleIds || []).includes(rule.id) && rule.status === "active") {
      rule.status = "disabled";
      rule.updatedAt = now;
    }
    if ((event.supersededRuleIds || []).includes(rule.id) && rule.status === "superseded") {
      rule.status = "active";
      rule.updatedAt = now;
    }
  }
  state.store.revision++;
  state.store.history.push({
    id: "le-" + Date.now(), action: "undo", undoneEventId: event.id,
    timestamp: now, revision: state.store.revision
  });
  state.store.history = state.store.history.slice(-LEARNED_HISTORY_LIMIT);
  saveLearnedPluginState(state, state.store, runtime);
  pluginLog("LEARN_UNDO event=" + event.id + " revision=" + state.store.revision, runtime);
  return { ok: true, revision: state.store.revision, undoneEventId: event.id };
}

function repairSearchTerms(rules, objects) {
  const out = [];
  for (const rule of rules || []) {
    const checked = validatedRuleTarget(rule, objects);
    if (!checked.valid) continue;
    if (rule.type === "character_studio" && checked.subject) out.push(checked.subject.name);
    else if (rule.signal) out.push(rule.signal);
  }
  return uniq(out).slice(0, 100);
}

function findScenesForRepairTerms(terms, runtime) {
  const byId = {};
  let truncated = false;
  for (const term of terms || []) {
    const data = doGraphQL(
      FIND_SCENES_FOR_LEARNED_REPAIR,
      { filter: { q: term, page: 1, per_page: REPAIR_PREVIEW_LIMIT } },
      runtime,
      "FindScenesForLearnedRepair"
    );
    const root = data && data.findScenes || {};
    if ((root.count || 0) > REPAIR_PREVIEW_LIMIT) truncated = true;
    for (const scene of root.scenes || []) {
      if (Object.keys(byId).length >= REPAIR_PREVIEW_LIMIT && !byId[String(scene.id)]) {
        truncated = true;
        continue;
      }
      byId[String(scene.id)] = scene;
    }
  }
  return { scenes: Object.keys(byId).map(id => byId[id]), truncated };
}

function repairChangeForRule(scene, rule, checked, baselineRaw) {
  const pathNorm = normalize(primaryScenePath(scene));
  const signal = rule.type === "character_studio" && checked.subject ? checked.subject.name : rule.signal;
  if (!containsPhrase(pathNorm, normalize(signal))) return null;

  if (rule.type === "character_studio") {
    const beforeStudio = baselineRaw.studios && baselineRaw.studios[0];
    const currentStudio = scene.studio;
    if (currentStudio && String(currentStudio.id) === String(checked.target.id)) return null;
    if (currentStudio && (!beforeStudio || normalize(currentStudio.name) !== normalize(beforeStudio.name))) return null;
    return {
      field: "studio",
      removeIds: currentStudio ? [String(currentStudio.id)] : [],
      addIds: [String(checked.target.id)],
      beforeNames: currentStudio ? [currentStudio.name] : [],
      afterNames: [checked.target.name],
      ruleId: rule.id
    };
  }

  if (rule.type === "group_alias") {
    const candidate = (baselineRaw.groups || []).find(item => normalize(item.aliasText || "") === normalize(rule.signal)) || baselineRaw.groups[0];
    const currentItems = (scene.groups || []).map(item => item && item.group).filter(Boolean);
    if (currentItems.some(item => String(item.id) === String(checked.target.id))) return null;
    const wrong = candidate ? currentItems.filter(item => normalize(item.name) === normalize(candidate.name)) : [];
    return {
      field: "groups", removeIds: wrong.map(item => String(item.id)), addIds: [String(checked.target.id)],
      beforeNames: wrong.map(item => item.name), afterNames: [checked.target.name], ruleId: rule.id
    };
  }

  const candidate = (baselineRaw.characters || []).find(item => (
    normalize(item.aliasText || item.name) === normalize(rule.signal)
  ));
  if (!candidate) return null;
  const currentTags = scene.tags || [];
  if (rule.type === "ignore_character") {
    const wrong = currentTags.filter(tag => normalize(tag.name) === normalize(candidate.name));
    if (!wrong.length) return null;
    return {
      field: "tags", removeIds: wrong.map(tag => String(tag.id)), addIds: [],
      beforeNames: wrong.map(tag => tag.name), afterNames: [], ruleId: rule.id
    };
  }
  if (rule.type === "character_alias") {
    if (currentTags.some(tag => String(tag.id) === String(checked.target.id))) return null;
    const wrong = currentTags.filter(tag => normalize(tag.name) === normalize(candidate.name));
    return {
      field: "tags", removeIds: wrong.map(tag => String(tag.id)), addIds: [String(checked.target.id)],
      beforeNames: wrong.map(tag => tag.name), afterNames: [checked.target.name], ruleId: rule.id
    };
  }
  return null;
}

function previewLearnedRepairs(args, runtime) {
  const state = learnedPluginState(runtime);
  const requestedRuleIds = parseMaybeJSON(args.ruleIdsJson || args.ruleIds || []);
  const rules = activeLearnedRules(state.store).filter(rule => (
    !Array.isArray(requestedRuleIds) || !requestedRuleIds.length || requestedRuleIds.includes(rule.id)
  ));
  const objects = validateLearnedTargets(rules, runtime);
  const terms = repairSearchTerms(rules, objects);
  const found = findScenesForRepairTerms(terms, runtime);
  const config = normalizeConfig({ allowTitleFallbackCharacterTags: true, strictCharacterTagNames: true });
  const dynamic = buildRuntimeStashAliasMap(runtime, config, EMBEDDED_ALIASES, "repair-preview");
  const baseline = mergeAliasMaps(EMBEDDED_ALIASES, dynamic);
  const rows = [];

  for (const scene of found.scenes) {
    const parsed = tokenizePathAndName(primaryScenePath(scene), scene.title, scene.details);
    const baselineRaw = parseCandidates(parsed, baseline, config);
    const changes = [];
    for (const rule of rules) {
      const checked = validatedRuleTarget(rule, objects);
      if (!checked.valid) continue;
      const change = repairChangeForRule(scene, rule, checked, baselineRaw);
      if (change) changes.push(change);
    }
    if (!changes.length) continue;
    rows.push({
      sceneId: String(scene.id),
      title: scene.title || (scene.files && scene.files[0] && scene.files[0].basename) || "Scene " + scene.id,
      path: primaryScenePath(scene),
      snapshot: sceneSnapshot(scene),
      changes
    });
  }
  pluginLog("LEARN_REPAIR_PREVIEW rules=" + rules.length + " matches=" + rows.length + " truncated=" + found.truncated, runtime);
  return { ok: true, revision: state.store.revision, rows, truncated: found.truncated, limit: REPAIR_PREVIEW_LIMIT };
}

function applyLearnedRepairs(args, runtime) {
  const expectedRevision = Number(args.expectedRevision);
  const selectedIds = parseMaybeJSON(args.sceneIdsJson || args.sceneIds || []);
  const requestedRuleIds = parseMaybeJSON(args.ruleIdsJson || args.ruleIds || []);
  if (!Array.isArray(selectedIds) || !selectedIds.length) throw new Error("Select at least one repair");
  const fresh = previewLearnedRepairs({ ruleIds: requestedRuleIds }, runtime);
  if (fresh.revision !== expectedRevision) throw new Error("Learned corrections changed. Refresh the repair preview.");
  const approved = {};
  for (const id of selectedIds) approved[String(id)] = true;
  let updated = 0;
  let skipped = 0;
  const results = [];

  for (const row of fresh.rows) {
    if (!approved[row.sceneId]) continue;
    const data = doGraphQL(GET_SCENE, { id: row.sceneId }, runtime, "RecheckSceneForLearnedRepair");
    const scene = data && data.findScene;
    if (!scene || JSON.stringify(sceneSnapshot(scene)) !== JSON.stringify(row.snapshot)) {
      skipped++;
      results.push({ sceneId: row.sceneId, status: "skipped_changed" });
      continue;
    }
    let studioId = scene.studio && String(scene.studio.id) || null;
    let groupIds = (scene.groups || []).map(item => String(item && item.group && item.group.id || "")).filter(Boolean);
    let tagIds = (scene.tags || []).map(tag => String(tag && tag.id || "")).filter(Boolean);
    for (const change of row.changes) {
      if (change.field === "studio") studioId = change.addIds[0] || null;
      if (change.field === "groups") groupIds = uniq(groupIds.filter(id => !change.removeIds.includes(id)).concat(change.addIds));
      if (change.field === "tags") tagIds = uniq(tagIds.filter(id => !change.removeIds.includes(id)).concat(change.addIds));
    }
    const current = {
      currentStudioId: scene.studio && String(scene.studio.id) || null,
      currentGroupIds: new Set((scene.groups || []).map(item => String(item && item.group && item.group.id || "")).filter(Boolean)),
      currentTagIds: new Set((scene.tags || []).map(tag => String(tag && tag.id || "")).filter(Boolean))
    };
    const finalAssignments = { studioId, groupIds, tagIds };
    if (compareBeforeWrite(finalAssignments, current)) {
      skipped++;
      results.push({ sceneId: row.sceneId, status: "no_change" });
      continue;
    }
    doGraphQL(UPDATE_SCENE, { input: buildUpdateInput(row.sceneId, finalAssignments, current) }, runtime, "ApplyLearnedRepair");
    updated++;
    results.push({ sceneId: row.sceneId, status: "updated", changes: row.changes });
    pluginLog("LEARN_REPAIR_APPLIED scene=" + row.sceneId + " changes=" + row.changes.length, runtime);
  }
  return { ok: true, revision: fresh.revision, updated, skipped, results };
}

function runLearningOperation(mode, rawInput, runtime) {
  const args = operationArgsFromInput(rawInput);
  if (mode === "learn preview") return previewLearnedCorrection(args, runtime);
  if (mode === "learn apply") return applyLearnedCorrection(args, runtime);
  if (mode === "learn list") return listLearnedCorrections(runtime);
  if (mode === "learn disable") return disableLearnedCorrection(args, runtime);
  if (mode === "learn undo") return undoLearnedCorrection(args, runtime);
  if (mode === "repair preview") return previewLearnedRepairs(args, runtime);
  if (mode === "repair apply") return applyLearnedRepairs(args, runtime);
  throw new Error("Unknown learning operation: " + mode);
}

// ============================ GRAPHQL STRINGS (VERIFIED v0.30.1+) ============================

const GET_SCENE = `query GetSceneForTagging($id: ID!) {
  findScene(id: $id) {
    id title details date organized updated_at
    studio { id name }
    groups { group { id name } scene_index }
    files { id path basename duration }
    tags { id name aliases ignore_auto_tag parents { id name } }
  }
}`;

const GET_LEARNED_PLUGIN_STATE = `query GetSceneAutoTaggerLearnedState {
  configuration { plugins }
  plugins { id name version enabled }
}`;

const CONFIGURE_LEARNED_PLUGIN = `mutation ConfigureSceneAutoTaggerLearnedState($plugin_id: ID!, $input: Map!) {
  configurePlugin(plugin_id: $plugin_id, input: $input)
}`;

const VALIDATE_LEARNED_TARGETS = `query ValidateSceneAutoTaggerLearnedTargets(
  $studio_ids: [ID!], $group_ids: [ID!], $tag_ids: [ID!]
) {
  findStudios(ids: $studio_ids, filter: { per_page: -1 }) { studios { id name aliases } }
  findGroups(ids: $group_ids, filter: { per_page: -1 }) { groups { id name aliases } }
  findTags(ids: $tag_ids, filter: { per_page: -1 }) {
    tags { id name aliases ignore_auto_tag parents { id name } }
  }
}`;

const FIND_SCENES_FOR_LEARNED_REPAIR = `query FindScenesForSceneAutoTaggerRepair($filter: FindFilterType) {
  findScenes(filter: $filter) {
    count
    scenes {
      id title details updated_at
      studio { id name }
      groups { group { id name } scene_index }
      tags { id name aliases ignore_auto_tag parents { id name } }
      files { id path basename }
    }
  }
}`;

const FIND_STUDIO = `query FindStudioCandidates($studio_filter: StudioFilterType, $filter: FindFilterType) {
  findStudios(studio_filter: $studio_filter, filter: $filter) {
    count studios { id name aliases }
  }
}`;

const FIND_STUDIO_NO_ALIASES = `query FindStudioCandidatesNoAliases($studio_filter: StudioFilterType, $filter: FindFilterType) {
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

const UPDATE_STUDIO_ALIASES = `mutation UpdateStudioAliases($input: StudioUpdateInput!) {
  studioUpdate(input: $input) { id name aliases }
}`;

const UPDATE_GROUP_ALIASES = `mutation UpdateGroupAliases($input: GroupUpdateInput!) {
  groupUpdate(input: $input) { id name aliases }
}`;

const UPDATE_TAG_ALIASES = `mutation UpdateTagAliases($input: TagUpdateInput!) {
  tagUpdate(input: $input) { id name aliases }
}`;

const UPDATE_SCENE = `mutation UpdateScene($input: SceneUpdateInput!) {
  sceneUpdate(input: $input) {
    id updated_at
    studio { id name }
    groups { group { id name } scene_index }
    tags { id name }
  }
}`;

const UPDATE_IMAGE = `mutation UpdateImageTags($input: ImageUpdateInput!) {
  imageUpdate(input: $input) {
    id updated_at
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

const FIND_IMAGES_FOR_FOLDER_TAGGING = `query FindImagesForFolderTagging($filter: FindFilterType) {
  findImages(filter: $filter) {
    count
    images {
      id title organized updated_at
      tags { id name }
      visual_files {
        ... on ImageFile { id path basename }
      }
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
  let optionsForAudit = null;
  let libraryAudit = null;
  let notificationMessage = "";

  try {
    const options = buildRuntimeOptions(args);
    options.aliasMap = buildEffectiveAliasMap(options, runtime, runId);
    optionsForAudit = options;
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
      " autoAliasMode=" + options.config.autoAliasMode +
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
    if (optionsForAudit && optionsForAudit.config && optionsForAudit.aliasMap) {
      libraryAudit = runFinalLibraryAudit(optionsForAudit.config, optionsForAudit.aliasMap, runtime, runId);
    }
    notificationMessage = formatUserNotification(summary, libraryAudit);
    emitUserNotification(runtime, notificationMessage);
    pluginLog("USER_NOTIFICATION run=" + runId + " message=" + logSafeValue(notificationMessage), runtime);
    const finalMessage = (
      "===== SCENE AUTO-TAGGER FINAL SUMMARY run=" + runId +
      " version=" + PLUGIN_VERSION +
      " total=" + total +
      " " + formatSummary(summary) +
      " notification=\"" + logSafeValue(notificationMessage) + "\"" +
      " ====="
    );
    pluginLog(finalMessage, runtime);
    emitProgress(runtime, total ? Math.min(summary.processed, total) : 0, total, finalMessage);
  }

  return {
    Output: notificationMessage + " run=" + runId + " " + formatSummary(summary),
    output: notificationMessage + " run=" + runId + " " + formatSummary(summary)
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

function taskModeFromInput(rawInput) {
  const raw = normalizePluginArgInput((rawInput && (rawInput.args || rawInput.Args)) || rawInput || {});
  const argsMap = normalizePluginArgInput(raw.args_map || raw.argsMap || {});
  return normalize(raw.mode || argsMap.mode || "");
}

(function main() {
  const embeddedInput = getEmbeddedInput();
  const mode = taskModeFromInput(embeddedInput);
  if ([
    "learn preview", "learn apply", "learn list", "learn disable", "learn undo",
    "repair preview", "repair apply"
  ].includes(mode)) {
    return { Output: runLearningOperation(mode, embeddedInput, getEmbeddedRuntime()) };
  }
  if (mode === "images" || mode === "image" || mode === "image folder" || mode === "image folder tagging") {
    return runImageFolderTagTask(embeddedInput, getEmbeddedRuntime());
  }
  return runBulkTask(embeddedInput, getEmbeddedRuntime());
})();
