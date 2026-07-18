(function () {
  "use strict";

  var PLUGIN_NAME = "Scene Auto-Tagger";
  var STABLE_PLUGIN_ID = "scene-auto-tagger";
  var PANEL_CLASS = "sat-teach-panel";
  var baseURL = (document.querySelector("base") && document.querySelector("base").getAttribute("href")) || "/";
  var pluginIdPromise = null;
  var setupTimer = null;
  var requestToken = 0;

  function gql(query, variables) {
    return fetch(baseURL + "graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function (response) {
      return response.json();
    }).then(function (payload) {
      if (payload.errors && payload.errors.length) {
        throw new Error(payload.errors.map(function (item) { return item.message; }).join("; "));
      }
      return payload.data;
    });
  }

  function sceneIdFromLocation() {
    var match = window.location.pathname.match(/(?:^|\/)scenes\/(\d+)(?:\/|$)/);
    return match ? match[1] : null;
  }

  function resolvePluginId() {
    if (pluginIdPromise) return pluginIdPromise;
    var query = "query SceneAutoTaggerUiPlugins { plugins { id name version enabled } }";
    pluginIdPromise = gql(query, {}).then(function (data) {
      var plugins = data && data.plugins || [];
      var stable = plugins.filter(function (plugin) { return plugin.id === STABLE_PLUGIN_ID; })[0];
      var named = plugins.filter(function (plugin) { return plugin.name === PLUGIN_NAME; })[0];
      var found = stable || named;
      if (!found) throw new Error("Scene Auto-Tagger is not loaded. Reload plugins and refresh the page.");
      return String(found.id);
    }).catch(function (error) {
      pluginIdPromise = null;
      throw error;
    });
    return pluginIdPromise;
  }

  function runOperation(mode, args) {
    var query = "mutation SceneAutoTaggerUiOperation($plugin_id: ID!, $args: Map) { runPluginOperation(plugin_id: $plugin_id, args: $args) }";
    return resolvePluginId().then(function (pluginId) {
      var input = {};
      Object.keys(args || {}).forEach(function (key) { input[key] = args[key]; });
      input.mode = mode;
      return gql(query, { plugin_id: pluginId, args: input });
    }).then(function (data) {
      var result = data && data.runPluginOperation;
      if (typeof result === "string") {
        try { result = JSON.parse(result); } catch (ignore) {}
      }
      if (!result || result.ok === false) throw new Error(result && result.error || "The plugin operation did not return a result.");
      return result;
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, className, handler) {
    var node = el("button", "sat-button " + (className || ""), label);
    node.type = "button";
    node.addEventListener("click", handler);
    return node;
  }

  function closeModal() {
    var existing = document.querySelector(".sat-modal-backdrop");
    if (existing) existing.remove();
  }

  function modalShell(title) {
    closeModal();
    var backdrop = el("div", "sat-modal-backdrop");
    var dialog = el("section", "sat-modal");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", title);

    var header = el("header", "sat-modal-header");
    header.appendChild(el("h3", "sat-modal-title", title));
    var close = button("Close", "sat-button-icon", closeModal);
    close.setAttribute("aria-label", "Close");
    close.title = "Close";
    close.textContent = "\u00d7";
    header.appendChild(close);
    dialog.appendChild(header);

    var body = el("div", "sat-modal-body");
    dialog.appendChild(body);
    backdrop.appendChild(dialog);
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) closeModal();
    });
    document.body.appendChild(backdrop);
    return { backdrop: backdrop, dialog: dialog, body: body };
  }

  function setBusy(shell, message) {
    shell.body.innerHTML = "";
    var busy = el("div", "sat-busy");
    busy.appendChild(el("span", "sat-spinner"));
    busy.appendChild(el("span", "", message));
    shell.body.appendChild(busy);
  }

  function showError(shell, error) {
    shell.body.innerHTML = "";
    shell.body.appendChild(el("div", "sat-status sat-status-error", String(error && error.message || error)));
  }

  function names(values) {
    return (values || []).map(function (value) { return value && value.name || value; }).filter(Boolean).join(", ") || "None";
  }

  function summaryRow(label, current, predicted) {
    var row = el("div", "sat-summary-row");
    row.appendChild(el("strong", "", label));
    row.appendChild(el("span", "", "Current: " + current));
    row.appendChild(el("span", "", "Tagger: " + predicted));
    return row;
  }

  function makeSelect(options, currentValue) {
    var select = el("select", "sat-select");
    select.appendChild(new Option("Choose...", ""));
    (options || []).forEach(function (option) {
      var value = option && option.id !== undefined ? String(option.id) : String(option);
      var label = option && option.name !== undefined ? option.name : String(option);
      select.appendChild(new Option(label, value));
    });
    if (currentValue) select.value = String(currentValue);
    return select;
  }

  function typeLabel(type) {
    if (type === "character_studio") return "Character franchise";
    if (type === "character_alias") return "Character alias";
    if (type === "group_alias") return "Artist alias";
    if (type === "ignore_character") return "Ignore token";
    return type;
  }

  function proposalRow(proposal) {
    var row = el("div", "sat-rule-row");
    row.setAttribute("data-proposal-id", proposal.id);
    var selectRule = document.createElement("input");
    selectRule.type = "checkbox";
    selectRule.className = "sat-rule-check";
    selectRule.checked = !proposal.ambiguous && !proposal.conflict;
    row.appendChild(selectRule);

    var content = el("div", "sat-rule-content");
    var heading = el("div", "sat-rule-heading");
    heading.appendChild(el("strong", "", typeLabel(proposal.type)));
    heading.appendChild(el("span", "sat-rule-signal", proposal.signal || "Selection required"));
    content.appendChild(heading);
    content.appendChild(el("div", "sat-rule-reason", proposal.reason || ""));

    var controls = el("div", "sat-rule-controls");
    var targetSelect = null;
    var subjectSelect = null;
    var signalSelect = null;
    var ignoreCheck = null;
    var replaceCheck = null;

    if (proposal.allowedTargets && proposal.allowedTargets.length) {
      targetSelect = makeSelect(proposal.allowedTargets, proposal.targetId);
      controls.appendChild(targetSelect);
    } else if (proposal.targetName) {
      controls.appendChild(el("span", "sat-rule-target", "\u2192 " + proposal.targetName));
    }
    if (proposal.allowedSubjects && proposal.allowedSubjects.length) {
      subjectSelect = makeSelect(proposal.allowedSubjects, proposal.subjectId);
      controls.appendChild(subjectSelect);
      controls.appendChild(el("span", "sat-rule-target", "\u2192 " + proposal.targetName));
    }
    if (proposal.allowedSignals && proposal.allowedSignals.length) {
      signalSelect = makeSelect(proposal.allowedSignals, proposal.signal);
      controls.appendChild(signalSelect);
      controls.appendChild(el("span", "sat-rule-target", "\u2192 " + proposal.targetName));
    }
    if (proposal.allowIgnore && proposal.type !== "ignore_character") {
      var ignoreLabel = el("label", "sat-inline-check");
      ignoreCheck = document.createElement("input");
      ignoreCheck.type = "checkbox";
      ignoreLabel.appendChild(ignoreCheck);
      ignoreLabel.appendChild(document.createTextNode(" Ignore instead"));
      controls.appendChild(ignoreLabel);
    }
    if (proposal.conflict) {
      var conflict = el("div", "sat-conflict", "Existing rule points to " + (proposal.conflict.targetName || proposal.conflict.subjectName || "another value") + ".");
      var replaceLabel = el("label", "sat-inline-check");
      replaceCheck = document.createElement("input");
      replaceCheck.type = "checkbox";
      replaceLabel.appendChild(replaceCheck);
      replaceLabel.appendChild(document.createTextNode(" Replace existing rule"));
      conflict.appendChild(replaceLabel);
      content.appendChild(conflict);
    }
    content.appendChild(controls);
    row.appendChild(content);

    return {
      node: row,
      value: function () {
        if (!selectRule.checked) return null;
        return {
          proposalId: proposal.id,
          targetId: targetSelect ? targetSelect.value : proposal.targetId,
          subjectId: subjectSelect ? subjectSelect.value : proposal.subjectId,
          signal: signalSelect ? signalSelect.value : proposal.signal,
          asIgnore: !!(ignoreCheck && ignoreCheck.checked),
          replace: !!(replaceCheck && replaceCheck.checked)
        };
      }
    };
  }

  function openRepairPreview(ruleIds) {
    var shell = modalShell("Matching Scene Repairs");
    setBusy(shell, "Finding exact matches...");
    runOperation("repair_preview", { ruleIdsJson: JSON.stringify(ruleIds || []) }).then(function (result) {
      shell.body.innerHTML = "";
      if (result.truncated) shell.body.appendChild(el("div", "sat-status sat-status-warning", "Preview reached the 500-scene safety limit."));
      if (!result.rows || !result.rows.length) {
        shell.body.appendChild(el("div", "sat-empty", "No existing scenes require a repair for these lessons."));
        return;
      }
      var list = el("div", "sat-repair-list");
      var checks = [];
      result.rows.forEach(function (row) {
        var item = el("label", "sat-repair-row");
        var check = document.createElement("input");
        check.type = "checkbox";
        check.checked = true;
        checks.push({ id: row.sceneId, check: check });
        item.appendChild(check);
        var copy = el("div", "sat-repair-copy");
        copy.appendChild(el("strong", "", row.title));
        row.changes.forEach(function (change) {
          copy.appendChild(el("span", "", typeLabel(change.field) + ": " + (change.beforeNames.join(", ") || "None") + " \u2192 " + (change.afterNames.join(", ") || "None")));
        });
        item.appendChild(copy);
        list.appendChild(item);
      });
      shell.body.appendChild(list);
      var footer = el("div", "sat-modal-actions");
      footer.appendChild(button("Cancel", "sat-button-secondary", closeModal));
      footer.appendChild(button("Apply selected repairs", "sat-button-primary", function (event) {
        var selected = checks.filter(function (item) { return item.check.checked; }).map(function (item) { return item.id; });
        if (!selected.length) return;
        event.currentTarget.disabled = true;
        runOperation("repair_apply", {
          expectedRevision: result.revision,
          ruleIdsJson: JSON.stringify(ruleIds || []),
          sceneIdsJson: JSON.stringify(selected)
        }).then(function (applied) {
          shell.body.innerHTML = "";
          shell.body.appendChild(el("div", "sat-status sat-status-success", "Repaired " + applied.updated + " scenes; skipped " + applied.skipped + "."));
        }).catch(function (error) { showError(shell, error); });
      }));
      shell.body.appendChild(footer);
    }).catch(function (error) { showError(shell, error); });
  }

  function renderLearningPreview(shell, result) {
    shell.body.innerHTML = "";
    var summary = el("div", "sat-summary");
    summary.appendChild(summaryRow("Studio", result.scene.studio && result.scene.studio.name || "None", result.predicted.studio || "None"));
    summary.appendChild(summaryRow("Groups", names(result.scene.groups), (result.predicted.groups || []).join(", ") || "None"));
    summary.appendChild(summaryRow("Characters", names(result.scene.characters), (result.predicted.characters || []).join(", ") || "None"));
    shell.body.appendChild(summary);

    if (!result.proposals || !result.proposals.length) {
      shell.body.appendChild(el("div", "sat-empty", "The corrected metadata does not differ from the tagger's current behavior, so there is nothing new to learn."));
      var noRulesActions = el("div", "sat-modal-actions");
      noRulesActions.appendChild(button("Manage learned corrections", "sat-button-secondary", openRuleManager));
      shell.body.appendChild(noRulesActions);
      return;
    }

    var rows = [];
    var ruleList = el("div", "sat-rule-list");
    result.proposals.forEach(function (proposal) {
      var built = proposalRow(proposal);
      rows.push(built);
      ruleList.appendChild(built.node);
    });
    shell.body.appendChild(ruleList);

    var status = el("div", "sat-status");
    status.hidden = true;
    shell.body.appendChild(status);
    var footer = el("div", "sat-modal-actions");
    footer.appendChild(button("Manage learned corrections", "sat-button-secondary", openRuleManager));
    footer.appendChild(button("Save selected lessons", "sat-button-primary", function (event) {
      var selected = rows.map(function (row) { return row.value(); }).filter(Boolean);
      if (!selected.length) {
        status.className = "sat-status sat-status-warning";
        status.textContent = "Select at least one complete lesson.";
        status.hidden = false;
        return;
      }
      event.currentTarget.disabled = true;
      status.className = "sat-status";
      status.textContent = "Saving lessons...";
      status.hidden = false;
      runOperation("learn_apply", {
        sceneId: result.scene.id,
        expectedRevision: result.revision,
        rulesJson: JSON.stringify(selected)
      }).then(function (saved) {
        shell.body.innerHTML = "";
        shell.body.appendChild(el("div", "sat-status sat-status-success", "Saved " + saved.rules.length + " learned correction" + (saved.rules.length === 1 ? "" : "s") + "."));
        var actions = el("div", "sat-modal-actions");
        actions.appendChild(button("Close", "sat-button-secondary", closeModal));
        actions.appendChild(button("Preview matching repairs", "sat-button-primary", function () {
          openRepairPreview(saved.rules.map(function (rule) { return rule.id; }));
        }));
        shell.body.appendChild(actions);
      }).catch(function (error) { showError(shell, error); });
    }));
    shell.body.appendChild(footer);
  }

  function openTeachModal() {
    var sceneId = sceneIdFromLocation();
    if (!sceneId) return;
    var shell = modalShell("Teach Auto-Tagger");
    setBusy(shell, "Comparing the corrected scene with current tagger behavior...");
    runOperation("learn_preview", { sceneId: sceneId }).then(function (result) {
      if (sceneIdFromLocation() !== String(sceneId)) return closeModal();
      renderLearningPreview(shell, result);
    }).catch(function (error) { showError(shell, error); });
  }

  function openRuleManager() {
    var shell = modalShell("Learned Corrections");
    setBusy(shell, "Loading learned corrections...");
    runOperation("learn_list", {}).then(function (result) {
      function refresh() { closeModal(); openRuleManager(); }
      shell.body.innerHTML = "";
      var active = (result.rules || []).filter(function (rule) { return rule.status === "active"; });
      if (!active.length) shell.body.appendChild(el("div", "sat-empty", "No active learned corrections."));
      var list = el("div", "sat-manager-list");
      active.forEach(function (rule) {
        var item = el("div", "sat-manager-row");
        var copy = el("div", "sat-manager-copy");
        copy.appendChild(el("strong", "", typeLabel(rule.type) + ": " + (rule.signal || rule.subjectName)));
        copy.appendChild(el("span", "", "\u2192 " + (rule.targetName || "Ignore token") + " | scene " + rule.sourceSceneId));
        if (!rule.runtimeValid) copy.appendChild(el("span", "sat-invalid", "Target is missing; this rule is inactive at runtime."));
        item.appendChild(copy);
        item.appendChild(button("Disable", "sat-button-danger", function (event) {
          event.currentTarget.disabled = true;
          runOperation("learn_disable", { ruleId: rule.id, expectedRevision: result.revision }).then(refresh).catch(function (error) { showError(shell, error); });
        }));
        list.appendChild(item);
      });
      shell.body.appendChild(list);
      var actions = el("div", "sat-modal-actions");
      actions.appendChild(button("Close", "sat-button-secondary", closeModal));
      var lastLearn = (result.history || []).slice().reverse().filter(function (event) { return event.action === "learn"; })[0];
      if (lastLearn) {
        actions.appendChild(button("Undo last lesson", "sat-button-secondary", function (event) {
          event.currentTarget.disabled = true;
          runOperation("learn_undo", { eventId: lastLearn.id, expectedRevision: result.revision }).then(refresh).catch(function (error) { showError(shell, error); });
        }));
      }
      shell.body.appendChild(actions);
    }).catch(function (error) { showError(shell, error); });
  }

  function panelTarget() {
    return document.querySelector(".scene-tabs") || document.querySelector("#scene-details-container") || document.querySelector(".details-tab");
  }

  function removePanel() {
    Array.prototype.forEach.call(document.querySelectorAll("." + PANEL_CLASS), function (panel) { panel.remove(); });
  }

  function setupPanel() {
    var sceneId = sceneIdFromLocation();
    if (!sceneId) {
      requestToken++;
      removePanel();
      closeModal();
      return;
    }
    var target = panelTarget();
    if (!target) return;
    var existing = document.querySelector("." + PANEL_CLASS);
    if (existing && existing.getAttribute("data-scene-id") === String(sceneId) && existing.parentNode === target) return;
    removePanel();
    var token = ++requestToken;
    var panel = el("div", PANEL_CLASS);
    panel.setAttribute("data-scene-id", String(sceneId));
    var teach = button("Teach Auto-Tagger", "sat-button-primary", openTeachModal);
    teach.title = "Learn from this scene's corrected metadata";
    panel.appendChild(teach);
    panel.appendChild(button("Learned Corrections", "sat-button-secondary", openRuleManager));
    if (token !== requestToken || sceneIdFromLocation() !== String(sceneId)) return;
    target.insertBefore(panel, target.firstChild);
  }

  function scheduleSetup(delay) {
    window.clearTimeout(setupTimer);
    setupTimer = window.setTimeout(setupPanel, delay === undefined ? 100 : delay);
  }

  function start() {
    scheduleSetup(0);
    if (window.PluginApi && PluginApi.Event && PluginApi.Event.addEventListener) {
      PluginApi.Event.addEventListener("stash:location", function () { scheduleSetup(100); });
    }
    var observer = new MutationObserver(function () {
      var sceneId = sceneIdFromLocation();
      var panel = document.querySelector("." + PANEL_CLASS);
      if (!sceneId && panel) {
        removePanel();
        closeModal();
      } else if (sceneId && (!panel || panel.getAttribute("data-scene-id") !== String(sceneId))) {
        scheduleSetup(100);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setInterval(function () {
      var sceneId = sceneIdFromLocation();
      var panel = document.querySelector("." + PANEL_CLASS);
      if (!sceneId && panel) {
        removePanel();
        closeModal();
      } else if (sceneId && (!panel || panel.getAttribute("data-scene-id") !== String(sceneId))) {
        scheduleSetup(0);
      }
    }, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
