(function () {
  "use strict";

  var BADGE_CLASS = "sat-descriptor-card-badge";
  var FIELD_ACTS = "r34_sex_acts_positions";
  var FIELD_ENDINGS = "r34_ending_descriptors";
  var cache = Object.create(null);
  var loading = Object.create(null);
  var refreshTimer = null;
  var activePopover = null;
  var baseURL = (document.querySelector("base") && document.querySelector("base").getAttribute("href")) || "/";

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

  function uniq(values) {
    var seen = Object.create(null);
    return (values || []).map(function (value) { return String(value || "").trim(); }).filter(function (value) {
      var key = value.toLowerCase();
      if (!value || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function readList(value) {
    if (Array.isArray(value)) return uniq(value);
    if (typeof value !== "string" || !value.trim()) return [];
    try {
      var parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return uniq(parsed);
    } catch (_) {}
    return uniq(value.split(/[|,]/));
  }

  function summarize(customFields) {
    var fields = customFields && typeof customFields === "object" ? customFields : {};
    var acts = readList(fields[FIELD_ACTS]);
    var endings = readList(fields[FIELD_ENDINGS]);
    return {
      acts: acts,
      endings: endings,
      count: uniq(acts.concat(endings)).length
    };
  }

  function tooltip(summary) {
    var lines = [summary.count + (summary.count === 1 ? " scene descriptor" : " scene descriptors")];
    if (summary.acts.length) lines.push("Sex Acts & Positions: " + summary.acts.join(", "));
    if (summary.endings.length) lines.push("Endings: " + summary.endings.join(", "));
    return lines.join("\n");
  }

  function sceneIdFromHref(href) {
    var match = String(href || "").match(/\/scenes?\/(\d+)/);
    return match ? match[1] : null;
  }

  function cardForAnchor(anchor) {
    return anchor && (anchor.closest(".scene-card") ||
      anchor.closest(".scene-card-container") ||
      anchor.closest("[class*='scene-card']"));
  }

  function metadataRowScore(node, card) {
    if (!node || node === card || node.querySelector("." + BADGE_CLASS)) return 0;
    var text = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > 80) return 0;
    var iconCount = node.querySelectorAll("svg, i, .fa, .svg-inline--fa, [data-icon]").length;
    var digitCount = (text.match(/\d+/g) || []).length;
    var className = String(node.className || "");
    var score = 0;
    if (iconCount >= 2) score += 8;
    else if (iconCount === 1) score += 4;
    if (digitCount >= 2) score += 8;
    else if (digitCount === 1) score += 4;
    if (/tag|group|studio|performer|marker|meta|indicator|count|footer/i.test(className)) score += 5;
    if (/title|image|thumbnail|preview|caption|description/i.test(className)) score -= 8;
    if (node.querySelector("a[href*='/scenes/']")) score -= 6;
    return score;
  }

  function metadataRow(card) {
    var variantBadge = card && card.querySelector(".smv-card-variant-menu");
    if (variantBadge && variantBadge.parentElement) return variantBadge.parentElement;
    var best = null;
    var bestScore = 0;
    Array.prototype.forEach.call(card.querySelectorAll("div, span, footer, section"), function (node) {
      var score = metadataRowScore(node, card);
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    });
    return bestScore >= 8 ? best : null;
  }

  function descriptorIcon() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "sat-descriptor-card-icon");
    [
      "M11 6h10",
      "M11 12h10",
      "M11 18h10",
      "m3 6 1 1 2-2",
      "m3 12 1 1 2-2",
      "m3 18 1 1 2-2"
    ].forEach(function (pathData) {
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    });
    return svg;
  }

  function closePopover() {
    if (!activePopover) return;
    var owner = activePopover._descriptorOwner;
    if (owner) owner.setAttribute("aria-expanded", "false");
    activePopover.remove();
    activePopover = null;
  }

  function appendDescriptorSection(popover, heading, values) {
    if (!values.length) return;
    var section = document.createElement("section");
    section.className = "sat-descriptor-card-popover-section";
    var title = document.createElement("h4");
    title.textContent = heading;
    section.appendChild(title);
    var list = document.createElement("ul");
    values.forEach(function (value) {
      var item = document.createElement("li");
      item.textContent = value;
      list.appendChild(item);
    });
    section.appendChild(list);
    popover.appendChild(section);
  }

  function positionPopover(popover, badge) {
    var rect = badge.getBoundingClientRect();
    var margin = 8;
    var width = Math.max(230, Math.min(320, window.innerWidth - (margin * 2)));
    var left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    popover.style.width = width + "px";
    popover.style.left = left + "px";
    popover.style.top = Math.max(margin, rect.bottom + 6) + "px";
    window.setTimeout(function () {
      if (activePopover !== popover) return;
      var popoverRect = popover.getBoundingClientRect();
      if (popoverRect.bottom > window.innerHeight - margin && rect.top > popoverRect.height + margin) {
        popover.style.top = Math.max(margin, rect.top - popoverRect.height - 6) + "px";
      }
    }, 0);
  }

  function openPopover(badge) {
    if (activePopover && activePopover._descriptorOwner === badge) {
      closePopover();
      return;
    }
    closePopover();
    var summary = badge._descriptorSummary;
    if (!summary || !summary.count) return;
    var popover = document.createElement("div");
    popover.className = "sat-descriptor-card-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Scene descriptors");
    popover._descriptorOwner = badge;
    var heading = document.createElement("h3");
    heading.textContent = "Scene Descriptors";
    popover.appendChild(heading);
    appendDescriptorSection(popover, "Sex Acts & Positions", summary.acts);
    appendDescriptorSection(popover, "Endings", summary.endings);
    document.body.appendChild(popover);
    activePopover = popover;
    badge.setAttribute("aria-expanded", "true");
    positionPopover(popover, badge);
  }

  function renderBadge(card, sceneId, customFields) {
    if (!card) return;
    var existing = card.querySelector("." + BADGE_CLASS);
    if (existing && existing.getAttribute("data-scene-id") !== String(sceneId)) {
      existing.remove();
      existing = null;
    }
    if (existing && existing.tagName !== "BUTTON") {
      existing.remove();
      existing = null;
    }
    var summary = summarize(customFields);
    if (!summary.count) {
      if (existing) existing.remove();
      return;
    }
    var row = metadataRow(card);
    if (!row) return;
    var label = tooltip(summary);
    var badge = existing || document.createElement("button");
    badge.className = BADGE_CLASS;
    badge.type = "button";
    badge.setAttribute("data-scene-id", String(sceneId));
    badge.setAttribute("aria-haspopup", "dialog");
    badge.setAttribute("aria-expanded", activePopover && activePopover._descriptorOwner === badge ? "true" : "false");
    badge.setAttribute("aria-label", label.replace(/\n/g, ". "));
    badge.title = label;
    badge._descriptorSummary = summary;
    if (!existing) {
      badge.appendChild(descriptorIcon());
      var count = document.createElement("span");
      count.className = "sat-descriptor-card-count";
      badge.appendChild(count);
      badge.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        openPopover(badge);
      });
      row.appendChild(badge);
    }
    badge.querySelector(".sat-descriptor-card-count").textContent = String(summary.count);
  }

  function visibleCards() {
    var result = Object.create(null);
    Array.prototype.forEach.call(document.querySelectorAll("a[href*='/scene']"), function (anchor) {
      var id = sceneIdFromHref(anchor.getAttribute("href"));
      var card = id && cardForAnchor(anchor);
      if (id && card && !result[id]) result[id] = card;
    });
    return result;
  }

  function refresh() {
    if (!/(?:^|\/)scenes\/?$/.test(window.location.pathname) && window.location.pathname !== "/plugins/scene-descriptors") return;
    if (activePopover && (!activePopover._descriptorOwner || !activePopover._descriptorOwner.isConnected)) closePopover();
    var cards = visibleCards();
    var missing = [];
    Object.keys(cards).forEach(function (id) {
      var existing = cards[id].querySelector("." + BADGE_CLASS);
      if (existing && existing.getAttribute("data-scene-id") !== id) existing.remove();
      if (Object.prototype.hasOwnProperty.call(cache, id)) renderBadge(cards[id], id, cache[id]);
      else if (!loading[id]) {
        loading[id] = true;
        missing.push(id);
      }
    });
    if (!missing.length) return;
    var query = "query DescriptorCardScenes($ids: [ID!]) { findScenes(ids: $ids, filter: { per_page: -1 }) { scenes { id custom_fields } } }";
    gql(query, { ids: missing }).then(function (data) {
      var found = Object.create(null);
      ((data && data.findScenes && data.findScenes.scenes) || []).forEach(function (scene) {
        var id = String(scene.id);
        found[id] = true;
        cache[id] = scene.custom_fields || {};
        if (cards[id]) renderBadge(cards[id], id, cache[id]);
      });
      missing.forEach(function (id) {
        if (!found[id]) cache[id] = {};
      });
    }).catch(function (error) {
      console.warn("[scene-auto-tagger] descriptor card badges failed", error);
    }).then(function () {
      missing.forEach(function (id) { delete loading[id]; });
    });
  }

  function scheduleRefresh(delay) {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(function () {
      refreshTimer = null;
      refresh();
    }, typeof delay === "number" ? delay : 100);
  }

  function descriptorChanged(event) {
    var detail = event && event.detail || {};
    var id = detail.sceneId && String(detail.sceneId);
    if (!id) return;
    cache[id] = detail.customFields || {};
    var cards = visibleCards();
    if (cards[id]) renderBadge(cards[id], id, cache[id]);
    scheduleRefresh(0);
  }

  function start() {
    scheduleRefresh(0);
    window.addEventListener("scene-auto-tagger:descriptors-changed", descriptorChanged);
    document.addEventListener("click", function (event) {
      if (!activePopover) return;
      if (activePopover.contains(event.target) || activePopover._descriptorOwner.contains(event.target)) return;
      closePopover();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closePopover();
    });
    window.addEventListener("resize", closePopover);
    window.addEventListener("scroll", closePopover, true);
    if (window.PluginApi && PluginApi.Event && PluginApi.Event.addEventListener) {
      PluginApi.Event.addEventListener("stash:location", function () { closePopover(); scheduleRefresh(100); });
    }
    new MutationObserver(function () { scheduleRefresh(120); }).observe(document.body, { childList: true, subtree: true });
  }

  window.SceneDescriptorCardBadges = {
    refresh: refresh,
    readList: readList,
    summarize: summarize,
    tooltip: tooltip,
    closePopover: closePopover
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
