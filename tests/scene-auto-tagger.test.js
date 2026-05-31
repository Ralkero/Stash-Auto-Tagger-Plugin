const assert = require("assert");
const plugin = require("../scene-auto-tagger.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function sceneFixture(options) {
  const opts = options || {};
  return {
    id: opts.id || "scene1",
    title: opts.title || "",
    details: opts.details || "",
    studio: opts.studio || null,
    groups: (opts.groups || []).map(g => ({ group: { id: g.id, name: g.name || g.id }, scene_index: 0 })),
    tags: (opts.tags || []).map(t => ({ id: t.id, name: t.name || t.id, aliases: [], ignore_auto_tag: false, parents: [] })),
    files: [{ id: "file1", path: opts.path || "", basename: "", duration: 60 }]
  };
}

function makeRuntime(options) {
  const opts = options || {};
  const db = {
    scene: opts.scene || sceneFixture(),
    studios: opts.studios || {},
    groups: opts.groups || {},
    tags: opts.tags || {},
    childTags: opts.childTags || {},
    nextId: 1000
  };
  const calls = [];

  function classify(query) {
    if (query.includes("findScene")) return "GetScene";
    if (query.includes("findStudios")) return "FindStudio";
    if (query.includes("findGroups")) return "FindGroup";
    if (query.includes("findTags")) return "FindTag";
    if (query.includes("studioCreate")) return "CreateStudio";
    if (query.includes("groupCreate")) return "CreateGroup";
    if (query.includes("tagCreate")) return "CreateTag";
    if (query.includes("sceneUpdate")) return "UpdateScene";
    return "Unknown";
  }

  const runtime = {
    calls,
    gql: {
      Do: async (query, variables) => {
        const type = classify(query);
        calls.push({ type, variables });

        if (type === "GetScene") return { findScene: db.scene };

        if (type === "FindStudio") {
          const name = variables.studio_filter.name.value;
          return { findStudios: { count: db.studios[name] ? 1 : 0, studios: db.studios[name] ? [db.studios[name]] : [] } };
        }

        if (type === "FindGroup") {
          const name = variables.group_filter.name.value;
          return { findGroups: { count: db.groups[name] ? 1 : 0, groups: db.groups[name] ? [db.groups[name]] : [] } };
        }

        if (type === "FindTag") {
          const name = variables.tag_filter.name.value;
          const parents = variables.tag_filter.parents && variables.tag_filter.parents.value;
          if (parents && parents.length) {
            const key = parents[0] + "::" + name;
            return { findTags: { count: db.childTags[key] ? 1 : 0, tags: db.childTags[key] ? [db.childTags[key]] : [] } };
          }
          return { findTags: { count: db.tags[name] ? 1 : 0, tags: db.tags[name] ? [db.tags[name]] : [] } };
        }

        if (type === "CreateStudio") return { studioCreate: { id: "new-s" + db.nextId++, name: variables.input.name } };
        if (type === "CreateGroup") return { groupCreate: { id: "new-g" + db.nextId++, name: variables.input.name } };
        if (type === "CreateTag") return { tagCreate: { id: "new-t" + db.nextId++, name: variables.input.name, parents: [] } };
        if (type === "UpdateScene") return { sceneUpdate: { id: variables.input.id } };

        throw new Error("Unhandled query");
      }
    }
  };

  return runtime;
}

function mutationCalls(runtime) {
  return runtime.calls.filter(c => c.type.startsWith("Create") || c.type === "UpdateScene");
}

test("config: threshold 90 and 0.9 normalize identically; args_map is accepted", () => {
  const direct = plugin.buildRuntimeOptions({ config: { confidenceThreshold: 90, dryRun: "false" } });
  const mapped = plugin.buildRuntimeOptions({ args_map: { config: { confidenceThreshold: 0.9, dryRun: false }, scene_ids: [1, 2] } });
  assert.strictEqual(direct.config.confidenceThreshold, 0.9);
  assert.strictEqual(mapped.config.confidenceThreshold, 0.9);
  assert.strictEqual(direct.config.dryRun, false);
  assert.deepStrictEqual(mapped.sceneIds, [1, 2]);
});

test("aliases: punctuation and number aliases resolve through normalized keys", () => {
  const aliases = plugin.normalizeAliasMap(plugin.EMBEDDED_ALIASES);
  assert.strictEqual(aliases.characters[plugin.normalize("D.Va")], "D.Va");
  assert.strictEqual(aliases.characters[plugin.normalize("dva")], "D.Va");
  assert.strictEqual(aliases.characters[plugin.normalize("2B")], "2B");
  assert.strictEqual(aliases.characters[plugin.normalize("A2")], "A2");
  assert.strictEqual(aliases.groups[plugin.normalize("HydraFXX")], "HydraFXX");
});

test("parser: HydraFXX Animations infers studio from characterStudios, not folder", () => {
  const parsed = plugin.tokenizePathAndName(
    "C:\\Users\\jmswo\\Downloads\\HydraFXX\\Animations\\HydraFXX - Ashley X Leon [1080P].mp4",
    "",
    ""
  );
  const raw = plugin.parseCandidates(parsed, plugin.normalizeAliasMap(plugin.EMBEDDED_ALIASES));
  assert.strictEqual(raw.studios[0].name, "Resident Evil");
  assert.strictEqual(raw.groups[0].name, "HydraFXX");
  assert.deepStrictEqual(raw.characters.map(c => c.name).sort(), ["Ashley Graham", "Leon Kennedy"]);
  assert.ok(!raw.studios.some(s => plugin.normalize(s.name) === "animations"));
});

test("parser: generic Rule34 folder is not treated as a Studio", () => {
  const parsed = plugin.tokenizePathAndName(
    "E:\\James Stuff\\Rule34\\Unknown\\Idemi - Mystery Title [1080P].mp4",
    "",
    ""
  );
  const raw = plugin.parseCandidates(parsed, plugin.normalizeAliasMap(plugin.EMBEDDED_ALIASES));
  assert.ok(!raw.studios.some(s => s.name === "Rule34"));
  assert.strictEqual(raw.groups[0].name, "Idemi");
});

test("dry-run: no create or update mutations are called", async () => {
  const runtime = makeRuntime({
    scene: sceneFixture({
      path: "C:\\Users\\jmswo\\Downloads\\HydraFXX\\Animations\\HydraFXX - Ashley X Leon [1080P].mp4"
    })
  });

  const row = await plugin.processScene(
    "scene1",
    "bulk",
    { dryRun: true, confidenceThreshold: 90 },
    plugin.normalizeAliasMap(plugin.EMBEDDED_ALIASES),
    runtime,
    "test",
    ""
  );

  assert.ok(row.result.startsWith("dry_run"));
  assert.deepStrictEqual(mutationCalls(runtime), []);
});

test("review: inferred metadata is not applied when addNeedsReviewTag is false", async () => {
  const runtime = makeRuntime({
    scene: sceneFixture({ path: "E:\\Rule34\\Unknown\\MysteryArtist - No Alias Match [1080P].mp4" })
  });

  const row = await plugin.processScene(
    "scene1",
    "bulk",
    { dryRun: false, addNeedsReviewTag: false, confidenceThreshold: 0.9 },
    plugin.normalizeAliasMap(plugin.EMBEDDED_ALIASES),
    runtime,
    "test",
    ""
  );

  assert.strictEqual(row.result, "skipped_needs_review");
  assert.deepStrictEqual(mutationCalls(runtime), []);
});

test("review: Needs Review tag update is additive and preserves current tags", async () => {
  const runtime = makeRuntime({
    scene: sceneFixture({
      path: "E:\\Rule34\\Unknown\\MysteryArtist - No Alias Match [1080P].mp4",
      tags: [{ id: "t-existing", name: "Manual Tag" }]
    }),
    tags: {
      "Needs Review": { id: "t-review", name: "Needs Review", parents: [] }
    }
  });

  const row = await plugin.processScene(
    "scene1",
    "bulk",
    { dryRun: false, addNeedsReviewTag: true, confidenceThreshold: 0.9 },
    plugin.normalizeAliasMap(plugin.EMBEDDED_ALIASES),
    runtime,
    "test",
    ""
  );

  const update = runtime.calls.find(c => c.type === "UpdateScene");
  assert.strictEqual(row.result, "needs_review_tagged");
  assert.deepStrictEqual(update.variables.input.tag_ids.sort(), ["t-existing", "t-review"]);
  assert.ok(!Object.prototype.hasOwnProperty.call(update.variables.input, "groups"));
  assert.ok(!Object.prototype.hasOwnProperty.call(update.variables.input, "studio_id"));
});

test("apply: existing groups and tags are preserved during updates", async () => {
  const runtime = makeRuntime({
    scene: sceneFixture({
      path: "C:\\Users\\jmswo\\Downloads\\HydraFXX\\Animations\\HydraFXX - Ashley X Leon [1080P].mp4",
      groups: [{ id: "g-existing", name: "Manual Group" }],
      tags: [{ id: "t-existing", name: "Manual Tag" }]
    }),
    studios: {
      "Resident Evil": { id: "s-re", name: "Resident Evil" }
    },
    groups: {
      "HydraFXX": { id: "g-hydra", name: "HydraFXX" }
    },
    tags: {
      "Characters": { id: "t-parent", name: "Characters", parents: [] }
    },
    childTags: {
      "t-parent::Ashley Graham": { id: "t-ashley", name: "Ashley Graham", parents: [{ id: "t-parent" }] },
      "t-parent::Leon Kennedy": { id: "t-leon", name: "Leon Kennedy", parents: [{ id: "t-parent" }] }
    }
  });

  const row = await plugin.processScene(
    "scene1",
    "bulk",
    { dryRun: false, confidenceThreshold: 0.9 },
    plugin.normalizeAliasMap(plugin.EMBEDDED_ALIASES),
    runtime,
    "test",
    ""
  );

  const update = runtime.calls.find(c => c.type === "UpdateScene");
  assert.strictEqual(row.result, "updated");
  assert.strictEqual(update.variables.input.studio_id, "s-re");
  assert.deepStrictEqual(update.variables.input.groups.map(g => g.group_id).sort(), ["g-existing", "g-hydra"]);
  assert.deepStrictEqual(update.variables.input.tag_ids.sort(), ["t-ashley", "t-existing", "t-leon"]);
});

test("studio guard: existing studio is not replaced unless overwrite is true", async () => {
  const baseScene = {
    path: "C:\\Users\\jmswo\\Downloads\\HydraFXX\\Animations\\HydraFXX - D.Va [1080P].mp4",
    studio: { id: "s-existing", name: "Manual Studio" }
  };
  const common = {
    studios: { "Overwatch": { id: "s-overwatch", name: "Overwatch" } },
    groups: { "HydraFXX": { id: "g-hydra", name: "HydraFXX" } },
    tags: { "Characters": { id: "t-parent", name: "Characters", parents: [] } },
    childTags: { "t-parent::D.Va": { id: "t-dva", name: "D.Va", parents: [{ id: "t-parent" }] } }
  };

  const guarded = makeRuntime({ ...common, scene: sceneFixture(baseScene) });
  await plugin.processScene(
    "scene1",
    "bulk",
    { dryRun: false, allowOverwriteExistingMetadata: false },
    plugin.normalizeAliasMap(plugin.EMBEDDED_ALIASES),
    guarded,
    "test",
    ""
  );
  const guardedUpdate = guarded.calls.find(c => c.type === "UpdateScene");
  assert.ok(!Object.prototype.hasOwnProperty.call(guardedUpdate.variables.input, "studio_id"));

  const overwrite = makeRuntime({ ...common, scene: sceneFixture(baseScene) });
  await plugin.processScene(
    "scene1",
    "bulk",
    { dryRun: false, allowOverwriteExistingMetadata: true },
    plugin.normalizeAliasMap(plugin.EMBEDDED_ALIASES),
    overwrite,
    "test",
    ""
  );
  const overwriteUpdate = overwrite.calls.find(c => c.type === "UpdateScene");
  assert.strictEqual(overwriteUpdate.variables.input.studio_id, "s-overwatch");
});

(async () => {
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log("PASS:", t.name);
      passed++;
    } catch (err) {
      console.error("FAIL:", t.name, err && err.stack ? err.stack : err);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
