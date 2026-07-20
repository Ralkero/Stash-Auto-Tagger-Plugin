(function () {
  "use strict";

  var ROUTE = "/plugins/scene-descriptors";
  var FIELD_ACTS = "r34_sex_acts_positions";
  var FIELD_ENDINGS = "r34_ending_descriptors";
  var NAV_CLASS = "sat-descriptor-nav-item";
  var baseURL = (document.querySelector("base") && document.querySelector("base").getAttribute("href")) || "/";
  var navTimer = null;

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

  function addCounts(target, values) {
    uniq(values).forEach(function (value) {
      var key = value.toLowerCase();
      if (!target[key]) target[key] = { name: value, count: 0 };
      target[key].count += 1;
    });
  }

  function sortedCounts(counts) {
    return Object.keys(counts).map(function (key) { return counts[key]; }).sort(function (left, right) {
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
  }

  function aggregateScenes(scenes) {
    var acts = Object.create(null);
    var endings = Object.create(null);
    var taggedScenes = 0;
    (scenes || []).forEach(function (scene) {
      var fields = scene && scene.custom_fields || {};
      var sceneActs = readList(fields[FIELD_ACTS]);
      var sceneEndings = readList(fields[FIELD_ENDINGS]);
      if (sceneActs.length || sceneEndings.length) taggedScenes += 1;
      addCounts(acts, sceneActs);
      addCounts(endings, sceneEndings);
    });
    return {
      acts: sortedCounts(acts),
      endings: sortedCounts(endings),
      taggedScenes: taggedScenes,
      totalScenes: (scenes || []).length
    };
  }

  function navigate(path) {
    try {
      window.history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    } catch (_) {
      window.location.assign(path);
    }
  }

  function selectionFromLocation() {
    var params = new URLSearchParams(window.location.search || "");
    var field = params.get("field");
    var name = params.get("value");
    if ((field !== FIELD_ACTS && field !== FIELD_ENDINGS) || !name) return null;
    return {
      field: field,
      name: name,
      count: 0,
      category: field === FIELD_ACTS ? "Sex Acts & Positions" : "Endings"
    };
  }

  function selectionPath(selection) {
    if (!selection) return ROUTE;
    var params = new URLSearchParams();
    params.set("field", selection.field);
    params.set("value", selection.name);
    return ROUTE + "?" + params.toString();
  }

  function loadDescriptorIndex(onProgress) {
    var query = "query DescriptorBrowserScenes($filter: FindFilterType) { findScenes(filter: $filter) { count scenes { id custom_fields } } }";
    var page = 1;
    var perPage = 250;
    var all = [];
    function next() {
      return gql(query, { filter: { page: page, per_page: perPage, sort: "id", direction: "ASC" } }).then(function (data) {
        var result = data && data.findScenes || { count: 0, scenes: [] };
        all = all.concat(result.scenes || []);
        if (onProgress) onProgress(all.length, result.count || all.length);
        if (all.length < result.count && result.scenes && result.scenes.length) {
          page += 1;
          return next();
        }
        return aggregateScenes(all);
      });
    }
    return next();
  }

  function normalizeScene(scene) {
    scene = scene || {};
    ["files", "groups", "tags", "performers", "scene_markers", "galleries"].forEach(function (field) {
      if (!Array.isArray(scene[field])) scene[field] = [];
    });
    if (!scene.paths) scene.paths = {};
    if (!scene.custom_fields) scene.custom_fields = {};
    return scene;
  }

  function matchingSceneFilter(field, value) {
    return {
      custom_fields: [{ field: String(field), value: [String(value)], modifier: "INCLUDES" }]
    };
  }

  function loadMatchingScenes(field, value, page, perPage) {
    var query = "query DescriptorFilteredScenes($sceneFilter: SceneFilterType, $filter: FindFilterType) { findScenes(scene_filter: $sceneFilter, filter: $filter) { count scenes { id title date details rating100 o_counter organized interactive_speed resume_time files { id path basename size width height duration fingerprints { type value } } paths { screenshot preview vtt interactive_heatmap } studio { id name image_path } groups { group { id name front_image_path } scene_index } tags { id name } performers { id name image_path favorite } scene_markers { id title seconds primary_tag { id name } } galleries { id title } custom_fields } } }";
    var sceneFilter = matchingSceneFilter(field, value);
    var filter = { page: page, per_page: perPage, sort: "title", direction: "ASC" };
    return gql(query, { sceneFilter: sceneFilter, filter: filter }).then(function (data) {
      var result = data && data.findScenes || { count: 0, scenes: [] };
      return { count: result.count || 0, scenes: (result.scenes || []).map(normalizeScene) };
    });
  }

  function registerDescriptorPage() {
    var api = window.PluginApi;
    if (!api || !api.React || !api.register || !api.register.route || window.__satDescriptorBrowserRegistered) return;
    window.__satDescriptorBrowserRegistered = true;
    var React = api.React;
    var h = React.createElement;
    var perPage = 40;
    var sceneCardPromise;
    try {
      sceneCardPromise = api.components && api.components.SceneCard
        ? Promise.resolve(api.components.SceneCard()).then(function (module) { return module && (module.SceneCard || module.default || module); })
        : Promise.resolve(null);
    } catch (_) {
      sceneCardPromise = Promise.resolve(null);
    }

    function sceneTitle(scene) {
      var file = scene && scene.files && scene.files[0];
      return String(scene && scene.title || file && file.basename || "Untitled scene");
    }

    function resolutionLabel(file) {
      if (!file || !file.width || !file.height) return "";
      var shortSide = Math.min(file.width, file.height);
      if (shortSide >= 2160) return "4K";
      if (shortSide >= 1440) return "1440P";
      if (shortSide >= 1080) return "1080P";
      if (shortSide >= 720) return "720P";
      return shortSide + "P";
    }

    function durationLabel(seconds) {
      var total = Math.max(0, Math.round(Number(seconds) || 0));
      var hours = Math.floor(total / 3600);
      var minutes = Math.floor((total % 3600) / 60);
      var remainder = total % 60;
      return (hours ? hours + ":" + String(minutes).padStart(2, "0") : minutes) + ":" + String(remainder).padStart(2, "0");
    }

    function FallbackSceneCard(props) {
      var scene = props.scene;
      var file = scene.files[0] || {};
      var videoRef = React.useRef(null);
      function startPreview() {
        var video = videoRef.current;
        if (!video || !scene.paths.preview) return;
        video.play().catch(function () {});
      }
      function stopPreview() {
        var video = videoRef.current;
        if (!video) return;
        video.pause();
        try { video.currentTime = 0; } catch (_) {}
      }
      return h("article", { className: "scene-card sat-descriptor-result-card", onMouseEnter: startPreview, onMouseLeave: stopPreview },
        h("a", { className: "sat-descriptor-result-card-link", href: "/scenes/" + scene.id },
          h("div", { className: "video-section sat-descriptor-result-media" },
            h("img", { src: scene.paths.screenshot, alt: "", loading: "lazy" }),
            scene.paths.preview && h("video", { ref: videoRef, src: scene.paths.preview, muted: true, loop: true, playsInline: true, preload: "none" }),
            h("span", { className: "sat-descriptor-result-specs" }, [resolutionLabel(file), durationLabel(file.duration)].filter(Boolean).join(" "))
          ),
          h("h3", null, sceneTitle(scene))
        ),
        h("div", { className: "sat-descriptor-result-meta" },
          scene.tags.length > 0 && h("span", { title: scene.tags.map(function (tag) { return tag.name; }).join(", ") }, scene.tags.length + (scene.tags.length === 1 ? " Character" : " Characters")),
          scene.groups.length > 0 && h("span", { title: scene.groups.map(function (entry) { return entry.group && entry.group.name; }).filter(Boolean).join(", ") }, scene.groups.length + (scene.groups.length === 1 ? " Author" : " Authors"))
        )
      );
    }

    function DescriptorGroup(props) {
      var lowerSearch = props.search.trim().toLowerCase();
      var visible = props.items.filter(function (item) {
        return !lowerSearch || item.name.toLowerCase().indexOf(lowerSearch) >= 0;
      });
      return h("section", { className: "sat-descriptor-browser-group" },
        h("div", { className: "sat-descriptor-browser-group-heading" },
          h("h2", null, props.title),
          h("span", null, visible.length + (visible.length === 1 ? " value" : " values"))
        ),
        visible.length ? h("div", { className: "sat-descriptor-browser-values" },
          visible.map(function (item) {
            return h("button", {
              key: props.field + ":" + item.name,
              type: "button",
              className: "sat-descriptor-browser-value" + (props.selected && props.selected.field === props.field && props.selected.name === item.name ? " is-selected" : ""),
              title: "Show scenes tagged " + item.name,
              onClick: function () { props.onSelect({ field: props.field, name: item.name, count: item.count, category: props.title }); }
            },
              h("span", null, item.name),
              h("small", null, String(item.count))
            );
          })
        ) : h("div", { className: "sat-descriptor-browser-empty" }, "No matching values")
      );
    }

    function DescriptorBrowserPage() {
      var indexState = React.useState(null);
      var index = indexState[0];
      var setIndex = indexState[1];
      var loadingState = React.useState("Loading scene descriptors...");
      var loading = loadingState[0];
      var setLoading = loadingState[1];
      var errorState = React.useState("");
      var error = errorState[0];
      var setError = errorState[1];
      var searchState = React.useState("");
      var search = searchState[0];
      var setSearch = searchState[1];
      var selectedState = React.useState(selectionFromLocation);
      var selected = selectedState[0];
      var setSelected = selectedState[1];
      var pageState = React.useState(1);
      var page = pageState[0];
      var setPage = pageState[1];
      var resultState = React.useState(null);
      var result = resultState[0];
      var setResult = resultState[1];
      var resultLoadingState = React.useState(false);
      var resultLoading = resultLoadingState[0];
      var setResultLoading = resultLoadingState[1];
      var resultErrorState = React.useState("");
      var resultError = resultErrorState[0];
      var setResultError = resultErrorState[1];
      var sceneCardState = React.useState(null);
      var SceneCard = sceneCardState[0];
      var setSceneCard = sceneCardState[1];
      var sceneCardErrorState = React.useState("");
      var sceneCardError = sceneCardErrorState[0];
      var setSceneCardError = sceneCardErrorState[1];

      React.useEffect(function () {
        var cancelled = false;
        loadDescriptorIndex(function (loaded, total) {
          if (!cancelled) setLoading("Loading scene descriptors: " + loaded + " / " + total);
        }).then(function (result) {
          if (cancelled) return;
          setIndex(result);
          setLoading("");
        }).catch(function (reason) {
          if (!cancelled) setError(String(reason && reason.message || reason));
        });
        return function () { cancelled = true; };
      }, []);

      React.useEffect(function () {
        function locationChanged() {
          setSelected(selectionFromLocation());
          setPage(1);
        }
        window.addEventListener("popstate", locationChanged);
        return function () { window.removeEventListener("popstate", locationChanged); };
      }, []);

      React.useEffect(function () {
        var cancelled = false;
        sceneCardPromise.then(function (component) {
          if (!cancelled && component) setSceneCard(function () { return component; });
        }).catch(function (reason) {
          if (!cancelled) setSceneCardError(String(reason && reason.message || reason));
        });
        return function () { cancelled = true; };
      }, []);

      React.useEffect(function () {
        if (!selected) {
          setResult(null);
          return undefined;
        }
        var cancelled = false;
        setResultLoading(true);
        setResultError("");
        loadMatchingScenes(selected.field, selected.name, page, perPage).then(function (nextResult) {
          if (!cancelled) setResult(nextResult);
        }).catch(function (reason) {
          if (!cancelled) setResultError(String(reason && reason.message || reason));
        }).then(function () {
          if (!cancelled) setResultLoading(false);
        });
        return function () { cancelled = true; };
      }, [selected && selected.field, selected && selected.name, page]);

      function selectDescriptor(next) {
        window.history.pushState({}, "", selectionPath(next));
        setSelected(next);
        setPage(1);
      }

      function clearSelection() {
        window.history.pushState({}, "", ROUTE);
        setSelected(null);
        setPage(1);
      }

      function Pagination() {
        if (!result || result.count <= perPage) return null;
        var pages = Math.max(1, Math.ceil(result.count / perPage));
        return h("div", { className: "sat-descriptor-browser-pagination" },
          h("button", { type: "button", disabled: page <= 1 || resultLoading, onClick: function () { setPage(Math.max(1, page - 1)); } }, "Previous"),
          h("span", null, "Page " + page + " of " + pages),
          h("button", { type: "button", disabled: page >= pages || resultLoading, onClick: function () { setPage(Math.min(pages, page + 1)); } }, "Next")
        );
      }

      return h("main", { className: "sat-descriptor-browser" },
        h("header", { className: "sat-descriptor-browser-header" },
          h("div", null,
            h("h1", null, "Scene Descriptors"),
            h("p", null, "Choose a descriptor to browse its scenes without leaving this page.")
          ),
          index && h("div", { className: "sat-descriptor-browser-summary" },
            h("strong", null, String(index.taggedScenes)),
            h("span", null, "tagged scenes")
          )
        ),
        error && h("div", { className: "sat-descriptor-browser-error" }, error),
        !index && !error && h("div", { className: "sat-descriptor-browser-loading" }, loading),
        index && h("div", { className: "sat-descriptor-browser-workspace" },
          h("aside", { className: "sat-descriptor-browser-sidebar" },
            h("div", { className: "sat-descriptor-browser-search-wrap" },
              h("input", {
                type: "search",
                value: search,
                placeholder: "Search scene descriptors",
                autoFocus: true,
                onChange: function (event) { setSearch(event.target.value); }
              }),
              search && h("button", { type: "button", onClick: function () { setSearch(""); } }, "Clear")
            ),
            h("div", { className: "sat-descriptor-browser-groups" },
              h(DescriptorGroup, { title: "Sex Acts & Positions", field: FIELD_ACTS, items: index.acts, search: search, selected: selected, onSelect: selectDescriptor }),
              h(DescriptorGroup, { title: "Endings", field: FIELD_ENDINGS, items: index.endings, search: search, selected: selected, onSelect: selectDescriptor })
            )
          ),
          h("section", { className: "sat-descriptor-browser-results" },
            !selected && h("div", { className: "sat-descriptor-browser-results-empty" },
              h("h2", null, "Select a descriptor"),
              h("p", null, "Matching scenes will appear here with their normal Stash cards and hover previews.")
            ),
            selected && h("div", { className: "sat-descriptor-browser-results-heading" },
              h("div", null,
                h("small", null, selected.category),
                h("h2", null, selected.name),
                h("span", null, (result ? result.count : selected.count) + ((result ? result.count : selected.count) === 1 ? " scene" : " scenes"))
              ),
              h("button", { type: "button", onClick: clearSelection }, "Clear selection")
            ),
            selected && h(Pagination),
            resultError && h("div", { className: "sat-descriptor-browser-error" }, resultError),
            selected && resultLoading && h("div", { className: "sat-descriptor-browser-loading" }, "Loading matching scenes..."),
            selected && !resultLoading && result && !result.scenes.length && h("div", { className: "sat-descriptor-browser-results-empty" }, "No matching scenes found."),
            selected && !resultLoading && result && result.scenes.length && h("div", { className: "sat-descriptor-browser-scene-grid" },
              result.scenes.map(function (scene, indexInPage) {
                return SceneCard
                  ? h(SceneCard, { key: scene.id, scene: scene, index: ((page - 1) * perPage) + indexInPage, selecting: false, selected: false, zoomIndex: 1 })
                  : h(FallbackSceneCard, { key: scene.id, scene: scene });
              })
            ),
            selected && h(Pagination)
          )
        )
      );
    }

    api.register.route(ROUTE, DescriptorBrowserPage);
  }

  function listCheckIcon(className) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", className || "sat-descriptor-nav-icon");
    ["M11 6h10", "M11 12h10", "M11 18h10", "m3 6 1 1 2-2", "m3 12 1 1 2-2", "m3 18 1 1 2-2"].forEach(function (data) {
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", data);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    });
    return svg;
  }

  function replaceNavText(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (/^(Characters|Tags)$/i.test(node.nodeValue.trim())) node.nodeValue = node.nodeValue.replace(/Characters|Tags/i, "Descriptors");
    });
  }

  function ensureNavigationEntry() {
    var existing = document.querySelector("." + NAV_CLASS);
    if (existing) return;
    var links = Array.prototype.slice.call(document.querySelectorAll("nav a[href], .navbar a[href]"));
    var characters = links.filter(function (link) {
      try { return new URL(link.href, window.location.href).pathname === "/tags"; } catch (_) { return false; }
    })[0];
    if (!characters || !characters.parentNode) return;
    var wrapper = characters.parentElement && characters.parentElement.children.length === 1 ? characters.parentElement : characters;
    var clone = wrapper.cloneNode(true);
    clone.classList.add(NAV_CLASS);
    var link = clone.matches && clone.matches("a[href]") ? clone : clone.querySelector("a[href]");
    if (!link) return;
    link.href = ROUTE;
    link.removeAttribute("aria-current");
    link.classList.remove("active");
    link.title = "Browse scene descriptors";
    replaceNavText(link);
    var oldIcon = link.querySelector("svg, i");
    var icon = listCheckIcon(oldIcon && oldIcon.getAttribute("class"));
    if (oldIcon) oldIcon.replaceWith(icon);
    link.addEventListener("click", function (event) {
      event.preventDefault();
      navigate(ROUTE);
    });
    wrapper.parentNode.insertBefore(clone, wrapper.nextSibling);
  }

  function scheduleNavigationEntry() {
    if (navTimer) window.clearTimeout(navTimer);
    navTimer = window.setTimeout(function () {
      navTimer = null;
      ensureNavigationEntry();
    }, 100);
  }

  function start() {
    registerDescriptorPage();
    scheduleNavigationEntry();
    if (window.PluginApi && PluginApi.Event && PluginApi.Event.addEventListener) {
      PluginApi.Event.addEventListener("stash:location", scheduleNavigationEntry);
    }
    new MutationObserver(scheduleNavigationEntry).observe(document.body, { childList: true, subtree: true });
  }

  window.SceneDescriptorBrowser = {
    route: ROUTE,
    readList: readList,
    aggregateScenes: aggregateScenes,
    matchingSceneFilter: matchingSceneFilter,
    selectionPath: selectionPath,
    loadMatchingScenes: loadMatchingScenes,
    refreshNavigation: ensureNavigationEntry
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
