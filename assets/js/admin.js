(function () {
  "use strict";

  function ovsUtils() {
    return window.OVSUtils || {};
  }

  function toBackend(target) {
    if (typeof ovsUtils().toBackendPath === "function") {
      return ovsUtils().toBackendPath(target);
    }
    return "../backend/" + String(target || "").replace(/^\/+/, "");
  }

  function toPath(target) {
    if (typeof ovsUtils().toFrontendPath === "function") {
      return ovsUtils().toFrontendPath(target);
    }
    return target;
  }

  function pageInfo() {
    if (typeof ovsUtils().pageInfo === "function") {
      return ovsUtils().pageInfo();
    }
    var path = String(window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
    return { section: "public", file: path.split("/").pop() || "" };
  }

  function getMain() {
    return document.querySelector("main");
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    if (!value) return "-";
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatNumber(value) {
    var n = Number(value || 0);
    if (!Number.isFinite(n)) n = 0;
    return n.toLocaleString();
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function combineDateAndTime(dateValue, timeValue) {
    var d = String(dateValue || "").trim();
    var t = String(timeValue || "").trim();
    if (!d) return "";
    if (!t) t = "00:00";
    return d + " " + t + ":00";
  }

  function findLabelControl(root, labelText, selector) {
    var target = String(labelText || "").toLowerCase();
    var labels = (root || document).querySelectorAll("label");
    for (var i = 0; i < labels.length; i += 1) {
      var label = labels[i];
      var text = String(label.textContent || "").toLowerCase();
      if (text.indexOf(target) === -1) continue;
      var parent = label.parentElement;
      if (!parent) continue;
      var control = parent.querySelector(selector || "input,select,textarea");
      if (control) return control;
    }
    return null;
  }

  function findButtonByText(root, textNeedle) {
    var target = String(textNeedle || "").toLowerCase();
    var buttons = (root || document).querySelectorAll("button");
    for (var i = 0; i < buttons.length; i += 1) {
      var text = String(buttons[i].textContent || "").toLowerCase();
      if (text.indexOf(target) !== -1) {
        return buttons[i];
      }
    }
    return null;
  }

  function ensurePageMessage(root, key) {
    var hostId = "ovs-admin-msg-" + String(key || "page");
    var host = (root || document).querySelector("#" + hostId);
    if (host) return host;
    host = document.createElement("div");
    host.id = hostId;
    host.style.marginBottom = "12px";
    host.style.display = "none";
    if (root && root.firstChild) {
      root.insertBefore(host, root.firstChild);
    } else if (root) {
      root.appendChild(host);
    }
    return host;
  }

  function setPageMessage(root, key, message, type) {
    var host = ensurePageMessage(root, key);
    if (!message) {
      host.style.display = "none";
      host.textContent = "";
      host.className = "";
      return;
    }
    var classes = "border rounded px-3 py-2 text-sm ";
    if (type === "success") {
      classes += "bg-emerald-50 border-emerald-200 text-emerald-700";
    } else if (type === "error") {
      classes += "bg-red-50 border-red-200 text-red-700";
    } else {
      classes += "bg-slate-50 border-slate-200 text-slate-700";
    }
    host.className = classes;
    host.textContent = message;
    host.style.display = "block";
  }

  async function apiRequest(method, endpoint, payload, query) {
    var url = new URL(toBackend(endpoint), window.location.href);
    if (query) {
      Object.keys(query).forEach(function (key) {
        var value = query[key];
        if (value === null || value === undefined || value === "") return;
        url.searchParams.set(key, String(value));
      });
    }

    var options = {
      method: String(method || "GET").toUpperCase(),
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    };

    if (options.method !== "GET" && options.method !== "HEAD") {
      if (payload instanceof FormData) {
        options.body = payload;
      } else {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload || {});
      }
    }

    try {
      var response = await fetch(url.toString(), options);
      var json = null;
      try {
        json = await response.json();
      } catch (e) {
        json = null;
      }
      return { ok: response.ok, status: response.status, json: json };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        json: { success: false, message: "Network error." }
      };
    }
  }

  function apiGet(endpoint, query) {
    return apiRequest("GET", endpoint, null, query);
  }

  function apiPost(endpoint, payload) {
    return apiRequest("POST", endpoint, payload, null);
  }

  function showLoading(main, label) {
    if (!main) return;
    main.innerHTML =
      '<div class="max-w-6xl mx-auto p-6">' +
      '<div class="bg-white border border-slate-200 rounded p-4 text-slate-600">' +
      escapeHtml(label || "Loading...") +
      "</div></div>";
  }

  function showError(main, message) {
    if (!main) return;
    main.innerHTML =
      '<div class="max-w-6xl mx-auto p-6">' +
      '<div class="bg-red-50 border border-red-200 rounded p-4 text-red-700">' +
      escapeHtml(message || "Unable to load data.") +
      "</div></div>";
  }

  function statusBadge(status) {
    var s = String(status || "").toLowerCase();
    if (s === "published" || s === "active") return "bg-emerald-100 text-emerald-700";
    if (s === "closed" || s === "suspended") return "bg-red-100 text-red-700";
    if (s === "inactive") return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-700";
  }

  function normalizePositionItem(row) {
    if (!row) return null;
    return {
      id: parseInt(row.id || "0", 10),
      parent_position_id: row.parent_position_id === null || row.parent_position_id === undefined || row.parent_position_id === ""
        ? null
        : parseInt(row.parent_position_id, 10),
      election_id: parseInt(row.election_id || "0", 10),
      election_title: row.election_title || "",
      title: row.title || "",
      description: row.description || "",
      seat_count: parseInt(row.seat_count || "1", 10),
      sort_order: parseInt(row.sort_order || "0", 10),
      candidates_count: parseInt(row.candidates_count || "0", 10)
    };
  }

  function buildPositionTree(items) {
    var nodes = (Array.isArray(items) ? items : [])
      .map(normalizePositionItem)
      .filter(function (row) { return !!row && row.id > 0; });

    var map = {};
    nodes.forEach(function (row) {
      row.children = [];
      map[row.id] = row;
    });

    var roots = [];
    nodes.forEach(function (row) {
      var parentId = row.parent_position_id;
      if (parentId && map[parentId] && parentId !== row.id) {
        map[parentId].children.push(row);
      } else {
        roots.push(row);
      }
    });

    function sortNodes(list) {
      list.sort(function (a, b) {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        if (a.title !== b.title) return String(a.title).localeCompare(String(b.title));
        return a.id - b.id;
      });
      list.forEach(function (node) { sortNodes(node.children); });
    }
    sortNodes(roots);

    return { roots: roots, map: map, nodes: nodes };
  }

  function flattenPositionTree(roots) {
    var out = [];
    function walk(node, depth) {
      out.push({ node: node, depth: depth });
      (node.children || []).forEach(function (child) {
        walk(child, depth + 1);
      });
    }
    (roots || []).forEach(function (root) { walk(root, 0); });
    return out;
  }

  function treeIndentPrefix(depth) {
    var level = parseInt(depth || "0", 10);
    if (!Number.isFinite(level) || level <= 0) return "";
    return new Array(level + 1).join("|-- ");
  }

  async function loadPositionItems(electionId) {
    var query = {};
    if (electionId) {
      query.election_id = electionId;
    }
    var res = await apiGet("admin/list-positions.php", query);
    if (!res.ok || !res.json || !res.json.success) {
      throw new Error((res.json && res.json.message) || "Unable to load positions.");
    }
    return res.json.data && Array.isArray(res.json.data.items) ? res.json.data.items : [];
  }

  function electionActionLinks(row, compact) {
    var id = parseInt(row && row.id ? row.id : 0, 10);
    if (!id) return "-";
    var cls = compact ? "text-xs" : "text-sm";
    return (
      '<div class="flex flex-wrap items-center gap-2">' +
      '<a class="' + cls + ' font-semibold text-blue-700 hover:underline" href="' + toPath("admin/edit-election.html") + "?election_id=" + id + '">Edit</a>' +
      '<a class="' + cls + ' font-semibold text-slate-700 hover:underline" href="' + toPath("admin/results.html") + "?election_id=" + id + '">Results</a>' +
      '<button type="button" class="' + cls + ' font-semibold text-red-700 hover:underline" data-ovs-election-delete="' + id + '">Delete/Close</button>' +
      "</div>"
    );
  }

  function bindElectionActionButtons(main, messageKey, refreshFn) {
    if (!main) return;
    var buttons = main.querySelectorAll("[data-ovs-election-delete]");
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener("click", async function (event) {
        event.preventDefault();
        var electionId = parseInt(btn.getAttribute("data-ovs-election-delete") || "0", 10);
        if (!electionId) return;
        if (!window.confirm("Delete this election? If ballots exist, it will be closed instead.")) {
          return;
        }
        btn.disabled = true;
        var oldText = btn.textContent;
        btn.textContent = "Processing...";

        var res = await apiPost("admin/delete-election.php", { election_id: electionId });
        if (!res.ok || !res.json || !res.json.success) {
          btn.disabled = false;
          btn.textContent = oldText;
          setPageMessage(main, messageKey || "elections", (res.json && res.json.message) || "Unable to delete/close election.", "error");
          return;
        }

        var action = res.json.data && res.json.data.action ? String(res.json.data.action) : "updated";
        setPageMessage(main, messageKey || "elections", action === "closed" ? "Election closed successfully." : "Election deleted successfully.", "success");

        if (typeof refreshFn === "function") {
          refreshFn();
          return;
        }
        window.location.reload();
      });
    });
  }

  async function renderDashboard() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading admin dashboard...");

    var res = await apiGet("admin/dashboard-stats.php");
    if (!res.ok || !res.json || !res.json.success) {
      showError(main, (res.json && res.json.message) || "Unable to load dashboard stats.");
      return;
    }

    var data = res.json.data || {};
    var stats = data.stats || {};
    var recentElections = data.recent_elections || [];
    var activity = data.recent_activity || [];

    main.innerHTML =
      '<div class="max-w-7xl mx-auto p-6 space-y-6">' +
      "<header>" +
      '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Admin Overview</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold">System Dashboard</h1>' +
      '<p class="text-slate-600 mt-2">Live data from the same election database used by voter pages.</p>' +
      "</header>" +
      '<section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">' +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Total Voters</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(stats.total_voters || 0) + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Active Voters</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(stats.active_voters || 0) + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Active Elections</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(stats.active_elections || 0) + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Total Ballots</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(stats.total_ballots || 0) + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Security Flags</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(stats.security_flags || 0) + "</p></div>" +
      "</section>" +
      '<section class="bg-white border border-slate-200 rounded p-4">' +
      '<h2 class="text-lg font-bold mb-3">Recent Elections</h2>' +
      '<div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="text-left border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500"><th class="py-2 pr-4">Title</th><th class="py-2 pr-4">Status</th><th class="py-2 pr-4">Ballots</th><th class="py-2 pr-4">Window</th><th class="py-2">Actions</th></tr></thead><tbody>' +
      (recentElections.length
        ? recentElections
            .map(function (row) {
              return (
                '<tr class="border-b border-slate-100">' +
                '<td class="py-3 pr-4 font-semibold">' + escapeHtml(row.title || "-") + "</td>" +
                '<td class="py-3 pr-4"><span class="inline-flex px-2 py-0.5 rounded text-xs font-bold ' + statusBadge(row.status) + '">' + escapeHtml(String(row.status || "").toUpperCase()) + "</span></td>" +
                '<td class="py-3 pr-4">' + escapeHtml(row.ballots_cast || 0) + "</td>" +
                '<td class="py-3 pr-4">' + escapeHtml(formatDate(row.start_at) + " - " + formatDate(row.end_at)) + "</td>" +
                '<td class="py-3">' + electionActionLinks(row, true) + "</td>" +
                "</tr>"
              );
            })
            .join("")
        : '<tr><td colspan="5" class="py-3 text-slate-500">No election records available.</td></tr>') +
      "</tbody></table></div>" +
      "</section>" +
      '<section class="bg-white border border-slate-200 rounded p-4">' +
      '<h2 class="text-lg font-bold mb-3">Recent Activity</h2>' +
      '<div class="space-y-2">' +
      (activity.length
        ? activity
            .map(function (row) {
              return (
                '<div class="border border-slate-100 rounded px-3 py-2 text-sm">' +
                '<div class="font-semibold">' + escapeHtml(row.action || "event") + "</div>" +
                '<div class="text-xs text-slate-500 mt-1">User: ' + escapeHtml(row.user_id || "-") + " | " + escapeHtml(formatDate(row.created_at)) + "</div>" +
                "</div>"
              );
            })
            .join("")
        : '<p class="text-sm text-slate-500">No recent logs found.</p>') +
      "</div>" +
      "</section>" +
      "</div>";

    bindElectionActionButtons(main, "dashboard", function () {
      renderDashboard();
    });
  }

  async function renderSimpleTablePage(config) {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading " + config.title.toLowerCase() + "...");

    var res = await apiGet(config.endpoint, config.query || {});
    if (!res.ok || !res.json || !res.json.success) {
      showError(main, (res.json && res.json.message) || "Unable to load " + config.title.toLowerCase() + ".");
      return;
    }

    var rows = res.json.data && Array.isArray(res.json.data.items) ? res.json.data.items : [];

    main.innerHTML =
      '<div class="max-w-7xl mx-auto p-6 space-y-6">' +
      "<header>" +
      '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Admin Data</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold">' + escapeHtml(config.title) + "</h1>" +
      '<p class="text-slate-600 mt-2">Records loaded from backend APIs.</p>' +
      "</header>" +
      '<section class="bg-white border border-slate-200 rounded p-4">' +
      '<div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="text-left border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">' +
      config.columns
        .map(function (col) {
          return '<th class="py-2 pr-4">' + escapeHtml(col.label) + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>" +
      (rows.length
        ? rows
            .map(function (row) {
              return (
                '<tr class="border-b border-slate-100">' +
                config.columns
                  .map(function (col) {
                    var value = typeof col.render === "function" ? col.render(row) : row[col.key];
                    return '<td class="py-3 pr-4">' + value + "</td>";
                  })
                  .join("") +
                "</tr>"
              );
            })
            .join("")
        : '<tr><td colspan="' + config.columns.length + '" class="py-3 text-slate-500">No records found.</td></tr>') +
      "</tbody></table></div>" +
      "</section>" +
      "</div>";

    if (typeof config.afterRender === "function") {
      config.afterRender(main, rows);
    }
  }

  async function renderElectionsPage() {
    await renderSimpleTablePage({
      title: "Elections",
      endpoint: "admin/list-elections.php",
      query: { limit: 200 },
      columns: [
        { label: "Title", render: function (row) { return '<span class="font-semibold">' + escapeHtml(row.title || "-") + "</span>"; } },
        {
          label: "Status",
          render: function (row) {
            return '<span class="inline-flex px-2 py-0.5 rounded text-xs font-bold ' + statusBadge(row.status) + '">' + escapeHtml(String(row.status || "").toUpperCase()) + "</span>";
          }
        },
        { label: "Positions", render: function (row) { return escapeHtml(row.positions_count || 0); } },
        { label: "Candidates", render: function (row) { return escapeHtml(row.candidates_count || 0); } },
        { label: "Ballots", render: function (row) { return escapeHtml(row.ballots_cast || 0); } },
        { label: "Actions", render: function (row) { return electionActionLinks(row, false); } }
      ],
      afterRender: function (main) {
        bindElectionActionButtons(main, "elections", function () {
          renderElectionsPage();
        });
      }
    });
  }

  async function renderPositionsTreePage() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading positions...");

    var elections;
    try {
      elections = await loadElectionItems();
    } catch (errLoad) {
      showError(main, errLoad.message || "Unable to load elections.");
      return;
    }

    var params = new URLSearchParams(window.location.search || "");
    var selectedElectionId = parseInt(params.get("election_id") || "0", 10);
    if (!Number.isFinite(selectedElectionId)) selectedElectionId = 0;
    if (!selectedElectionId && elections.length) {
      selectedElectionId = parseInt(elections[0].id || "0", 10);
    }

    main.innerHTML =
      '<div class="max-w-7xl mx-auto p-6 space-y-6">' +
      "<header>" +
      '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Election Structure</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold">Positions Tree</h1>' +
      '<p class="text-slate-600 mt-2">Create top-down position hierarchies for each election cycle. Parent offices can contain child offices.</p>' +
      "</header>" +
      '<section class="bg-white border border-slate-200 rounded p-4 grid grid-cols-1 md:grid-cols-3 gap-4 md:items-end">' +
      '<div class="md:col-span-2">' +
      '<label class="text-xs uppercase tracking-widest font-bold text-slate-500 mb-1 block">Election</label>' +
      '<select id="ovs-positions-election" class="w-full border border-slate-300 rounded px-3 py-2 text-sm"></select>' +
      "</div>" +
      '<div class="flex md:justify-end">' +
      '<a id="ovs-pos-create-link" class="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors" href="' + toPath("admin/create-position.html") + '">Create Position</a>' +
      "</div>" +
      "</section>" +
      '<section id="ovs-positions-summary" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4"></section>' +
      '<section id="ovs-positions-tree" class="space-y-3"></section>' +
      "</div>";

    var select = document.getElementById("ovs-positions-election");
    var summaryHost = document.getElementById("ovs-positions-summary");
    var treeHost = document.getElementById("ovs-positions-tree");
    var createLink = document.getElementById("ovs-pos-create-link");
    if (!select || !summaryHost || !treeHost) return;

    if (!elections.length) {
      select.innerHTML = '<option value="">No elections available</option>';
      treeHost.innerHTML =
        '<div class="bg-white border border-slate-200 rounded p-4 text-slate-600">No elections found. Create an election first, then define positions.</div>';
      return;
    }

    select.innerHTML = elections
      .map(function (row) {
        var id = parseInt(row.id || "0", 10);
        var selected = id === selectedElectionId ? " selected" : "";
        return '<option value="' + escapeHtml(id) + '"' + selected + ">" + escapeHtml(row.title || ("Election #" + id)) + "</option>";
      })
      .join("");

    function renderSummary(items, electionTitle) {
      var tree = buildPositionTree(items);
      var flat = flattenPositionTree(tree.roots);
      var totalSeats = 0;
      var maxDepth = 0;
      var leafCount = 0;

      flat.forEach(function (entry) {
        var node = entry.node || {};
        totalSeats += parseInt(node.seat_count || "0", 10) || 0;
        if ((entry.depth || 0) > maxDepth) maxDepth = entry.depth || 0;
        if (!(node.children || []).length) leafCount += 1;
      });

      summaryHost.innerHTML =
        '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Election</p><p class="text-sm font-semibold mt-2">' + escapeHtml(electionTitle || "-") + "</p></div>" +
        '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Positions</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(flat.length) + "</p></div>" +
        '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Leaf Offices</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(leafCount) + "</p></div>" +
        '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Total Seats</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(totalSeats) + "</p></div>" +
        '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Depth</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(maxDepth + 1) + "</p></div>";
      return flat;
    }

    function renderTree(items, electionId) {
      var electionTitle = select.options[select.selectedIndex] ? select.options[select.selectedIndex].textContent : "";
      var flat = renderSummary(items, electionTitle);
      if (!flat.length) {
        treeHost.innerHTML =
          '<div class="bg-white border border-slate-200 rounded p-5">' +
          '<p class="text-slate-600 mb-3">No positions configured yet for this election.</p>' +
          '<a class="inline-flex items-center px-4 py-2 bg-primary text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors" href="' + toPath("admin/create-position.html") + "?election_id=" + electionId + '">Add First Position</a>' +
          "</div>";
        return;
      }

      treeHost.innerHTML = flat
        .map(function (entry) {
          var node = entry.node || {};
          var depth = entry.depth || 0;
          var hasChildren = (node.children || []).length > 0;
          var indent = treeIndentPrefix(depth);
          return (
            '<article class="bg-white border border-slate-200 rounded p-4" style="margin-left:' + (depth * 24) + 'px">' +
            '<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">' +
            "<div>" +
            '<p class="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Level ' + escapeHtml(depth + 1) + (hasChildren ? " Parent Office" : " End Office") + "</p>" +
            '<h3 class="text-lg font-bold">' + escapeHtml(indent + (node.title || "Position")) + "</h3>" +
            '<p class="text-sm text-slate-600 mt-1">' + escapeHtml(node.description || "No description provided.") + "</p>" +
            "</div>" +
            '<div class="grid grid-cols-3 gap-2 text-xs min-w-[220px]">' +
            '<div class="border border-slate-200 rounded p-2 text-center"><div class="text-slate-500 uppercase">Seats</div><div class="font-bold mt-1">' + escapeHtml(node.seat_count || 1) + "</div></div>" +
            '<div class="border border-slate-200 rounded p-2 text-center"><div class="text-slate-500 uppercase">Candidates</div><div class="font-bold mt-1">' + escapeHtml(node.candidates_count || 0) + "</div></div>" +
            '<div class="border border-slate-200 rounded p-2 text-center"><div class="text-slate-500 uppercase">Order</div><div class="font-bold mt-1">' + escapeHtml(node.sort_order || 0) + "</div></div>" +
            "</div>" +
            "</div>" +
            '<div class="mt-3 flex flex-wrap gap-2">' +
            '<a class="inline-flex items-center px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold" href="' + toPath("admin/create-position.html") + "?election_id=" + electionId + "&parent_position_id=" + node.id + '">Add Child Position</a>' +
            '<a class="inline-flex items-center px-3 py-1.5 rounded bg-slate-100 text-slate-800 text-xs font-semibold" href="' + toPath("admin/add-candidate.html") + "?election_id=" + electionId + "&position_id=" + node.id + '">Add Candidate</a>' +
            '<a class="inline-flex items-center px-3 py-1.5 rounded bg-slate-100 text-slate-800 text-xs font-semibold" href="' + toPath("admin/edit-election.html") + "?election_id=" + electionId + '">Review Election</a>' +
            "</div>" +
            "</article>"
          );
        })
        .join("");
    }

    async function loadAndRender(electionId) {
      if (!electionId) {
        summaryHost.innerHTML = "";
        treeHost.innerHTML = '<div class="bg-white border border-slate-200 rounded p-4 text-slate-600">Select an election to view positions.</div>';
        return;
      }
      if (createLink) {
        createLink.setAttribute("href", toPath("admin/create-position.html") + "?election_id=" + electionId);
      }
      var res = await apiGet("admin/list-positions.php", { election_id: electionId });
      if (!res.ok || !res.json || !res.json.success) {
        showError(main, (res.json && res.json.message) || "Unable to load positions.");
        return;
      }
      var items = res.json.data && Array.isArray(res.json.data.items) ? res.json.data.items : [];
      renderTree(items, electionId);
    }

    select.addEventListener("change", function () {
      var electionId = parseInt(select.value || "0", 10);
      var url = new URL(window.location.href);
      if (electionId > 0) {
        url.searchParams.set("election_id", String(electionId));
      } else {
        url.searchParams.delete("election_id");
      }
      window.history.replaceState({}, "", url.toString());
      loadAndRender(electionId);
    });

    await loadAndRender(parseInt(select.value || "0", 10));
  }

  async function renderVoters() {
    await renderSimpleTablePage({
      title: "Voters",
      endpoint: "admin/list-voters.php",
      query: { limit: 200 },
      columns: [
        { label: "Name", render: function (row) { return '<span class="font-semibold">' + escapeHtml(row.full_name || "-") + "</span>"; } },
        { label: "Email", render: function (row) { return escapeHtml(row.email || "-"); } },
        { label: "Voter ID", render: function (row) { return '<span class="font-mono text-xs">' + escapeHtml(row.voter_id || "-") + "</span>"; } },
        {
          label: "Status",
          render: function (row) {
            return '<span class="inline-flex px-2 py-0.5 rounded text-xs font-bold ' + statusBadge(row.status) + '">' + escapeHtml(String(row.status || "").toUpperCase()) + "</span>";
          }
        },
        { label: "Ballots", render: function (row) { return escapeHtml(row.ballots_submitted || 0); } }
      ]
    });
  }

  async function loadElectionItems() {
    var res = await apiGet("admin/list-elections.php", { limit: 300 });
    if (!res.ok || !res.json || !res.json.success) {
      throw new Error((res.json && res.json.message) || "Unable to load elections.");
    }
    return res.json.data && Array.isArray(res.json.data.items) ? res.json.data.items : [];
  }

  async function bindCreateElectionPage() {
    var main = getMain();
    if (!main) return;
    var form = main.querySelector("form");
    if (!form) return;

    var titleInput = form.querySelector('input[type="text"]');
    var descriptionInput = form.querySelector("textarea");
    var dateInputs = form.querySelectorAll('input[type="date"]');
    var timeInputs = form.querySelectorAll('input[type="time"]');
    var publishBtn = form.querySelector('button[type="submit"]');
    var saveDraftBtn = findButtonByText(form, "save as draft");
    var cancelBtn = findButtonByText(form, "cancel operation");
    var inFlight = false;

    function setButtonLoading(button, loading, loadingLabel) {
      if (!button) return;
      if (!button.dataset.ovsDefaultText) {
        button.dataset.ovsDefaultText = String(button.textContent || "").trim() || "Submit";
      }
      button.disabled = !!loading;
      button.textContent = loading ? loadingLabel : button.dataset.ovsDefaultText;
    }

    function clearNextSteps() {
      var old = main.querySelector("[data-ovs-create-election-next]");
      if (old) old.remove();
    }

    function showNextSteps(electionId) {
      clearNextSteps();
      if (!electionId) return;

      var box = document.createElement("div");
      box.setAttribute("data-ovs-create-election-next", "1");
      box.className = "border rounded p-4 mt-3 bg-white";
      box.innerHTML =
        '<p class="text-sm font-semibold mb-3">Next step: finish election setup</p>' +
        '<div class="flex flex-wrap gap-2">' +
        '<a class="inline-flex items-center px-3 py-2 rounded bg-blue-600 text-white text-sm font-semibold" href="' + toPath("admin/create-position.html") + "?election_id=" + electionId + '">1. Add Positions</a>' +
        '<a class="inline-flex items-center px-3 py-2 rounded bg-slate-100 text-slate-800 text-sm font-semibold" href="' + toPath("admin/add-candidate.html") + "?election_id=" + electionId + '">2. Add Candidates</a>' +
        '<a class="inline-flex items-center px-3 py-2 rounded bg-slate-100 text-slate-800 text-sm font-semibold" href="' + toPath("admin/edit-election.html") + "?election_id=" + electionId + '">3. Review Election</a>' +
        '<a class="inline-flex items-center px-3 py-2 rounded bg-slate-100 text-slate-800 text-sm font-semibold" href="' + toPath("admin/elections.html") + '">Go to Elections List</a>' +
        "</div>";

      var host = ensurePageMessage(main, "create-election");
      if (host && host.parentNode) {
        host.insertAdjacentElement("afterend", box);
      } else {
        main.insertBefore(box, main.firstChild);
      }
    }

    var submitWithStatus = async function (status) {
      if (inFlight) return;
      inFlight = true;

      var title = titleInput ? String(titleInput.value || "").trim() : "";
      var description = descriptionInput ? String(descriptionInput.value || "").trim() : "";
      var startAt = combineDateAndTime(dateInputs[0] && dateInputs[0].value, timeInputs[0] && timeInputs[0].value);
      var endAt = combineDateAndTime(dateInputs[1] && dateInputs[1].value, timeInputs[1] && timeInputs[1].value);

      if (!title || !startAt || !endAt) {
        setPageMessage(main, "create-election", "Title, start date/time, and end date/time are required.", "error");
        inFlight = false;
        return;
      }

      clearNextSteps();
      setButtonLoading(publishBtn, true, "Publishing...");
      setButtonLoading(saveDraftBtn, true, "Saving...");
      setPageMessage(main, "create-election", "Saving election...", "info");

      var res = await apiPost("admin/create-election.php", {
        title: title,
        description: description,
        start_at: startAt,
        end_at: endAt,
        status: status || "draft",
        visibility: "public"
      });

      if (!res.ok || !res.json || !res.json.success) {
        var msg = (res.json && res.json.message) || "Unable to create election.";
        if (/cannot publish during creation/i.test(msg) && status === "published") {
          var draftRes = await apiPost("admin/create-election.php", {
            title: title,
            description: description,
            start_at: startAt,
            end_at: endAt,
            status: "draft",
            visibility: "public"
          });

          if (draftRes.ok && draftRes.json && draftRes.json.success) {
            var draftId = draftRes.json.data ? parseInt(draftRes.json.data.election_id, 10) : 0;
            setPageMessage(main, "create-election", "Election saved as draft. Add positions and candidates, then publish from Review Election.", "success");
            showNextSteps(draftId);
            if (draftId) {
              try {
                localStorage.setItem("ovs_last_created_election_id", String(draftId));
              } catch (e) {
                /* ignore storage failures */
              }
            }
            setButtonLoading(publishBtn, false, "");
            setButtonLoading(saveDraftBtn, false, "");
            inFlight = false;
            return;
          }
        }

        if (/overlap/i.test(msg) || /published election/i.test(msg)) {
          msg += " Adjust start/end time or save as draft first.";
        }
        setPageMessage(main, "create-election", msg, "error");
        setButtonLoading(publishBtn, false, "");
        setButtonLoading(saveDraftBtn, false, "");
        inFlight = false;
        return;
      }

      var id = res.json.data ? parseInt(res.json.data.election_id, 10) : 0;
      var mode = status === "draft" ? "draft" : "published";
      setPageMessage(main, "create-election", "Election " + mode + " successfully.", "success");
      showNextSteps(id);
      if (id) {
        try {
          localStorage.setItem("ovs_last_created_election_id", String(id));
        } catch (e) {
          /* ignore storage failures */
        }
      }
      setButtonLoading(publishBtn, false, "");
      setButtonLoading(saveDraftBtn, false, "");
      inFlight = false;
    };

    try {
      var lastCreatedId = parseInt(localStorage.getItem("ovs_last_created_election_id") || "0", 10);
      if (Number.isFinite(lastCreatedId) && lastCreatedId > 0) {
        showNextSteps(lastCreatedId);
      }
    } catch (e) {
      /* ignore storage failures */
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitWithStatus("published");
    });

    if (saveDraftBtn) {
      saveDraftBtn.addEventListener("click", function (event) {
        event.preventDefault();
        submitWithStatus("draft");
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function (event) {
        event.preventDefault();
        window.location.href = toPath("admin/elections.html");
      });
    }
  }

  async function bindEditElectionPage() {
    var main = getMain();
    if (!main) return;

    var elections;
    try {
      elections = await loadElectionItems();
    } catch (err) {
      setPageMessage(main, "edit-election", err.message, "error");
      return;
    }
    if (!elections.length) return;

    var query = new URLSearchParams(window.location.search || "");
    var queryId = parseInt(query.get("election_id"), 10);
    if (!Number.isFinite(queryId)) queryId = 0;

    var selected = elections.find(function (row) {
      return parseInt(row.id, 10) === queryId;
    }) || elections[0];
    var electionId = parseInt(selected.id, 10);

    function checklistLine(label, ok, detail) {
      return (
        '<div class="flex items-start gap-2 text-sm">' +
        '<span class="material-symbols-outlined text-base ' + (ok ? "text-emerald-600" : "text-amber-600") + '">' + (ok ? "check_circle" : "warning") + "</span>" +
        '<div><div class="font-semibold ' + (ok ? "text-emerald-700" : "text-amber-700") + '">' + escapeHtml(label) + "</div>" +
        (detail ? '<div class="text-xs text-slate-500 mt-0.5">' + escapeHtml(detail) + "</div>" : "") +
        "</div></div>"
      );
    }

    async function renderNextStepsBox() {
      var oldNext = main.querySelector("[data-ovs-edit-election-next]");
      if (oldNext) oldNext.remove();

      var positionsRes = await apiGet("admin/list-positions.php", { election_id: electionId });
      var positions = positionsRes.ok && positionsRes.json && positionsRes.json.success && positionsRes.json.data
        ? (positionsRes.json.data.items || [])
        : [];
      var hasPositions = positions.length > 0;
      var missingPositionCandidates = positions.filter(function (row) {
        return parseInt(row.candidates_count || "0", 10) < 1;
      });
      var candidatesReady = hasPositions && missingPositionCandidates.length === 0;
      var isPublished = String(selected.status || "").toLowerCase() === "published";

      var nextBox = document.createElement("div");
      nextBox.setAttribute("data-ovs-edit-election-next", "1");
      nextBox.className = "border rounded p-4 mb-4 bg-white";
      nextBox.innerHTML =
        '<p class="text-sm font-semibold mb-3">Next step: finish election setup</p>' +
        '<div class="flex flex-wrap gap-2 mb-4">' +
        '<a class="inline-flex items-center px-3 py-2 rounded bg-blue-600 text-white text-sm font-semibold" href="' + toPath("admin/create-position.html") + "?election_id=" + electionId + '">1. Add Positions</a>' +
        '<a class="inline-flex items-center px-3 py-2 rounded bg-slate-100 text-slate-800 text-sm font-semibold" href="' + toPath("admin/add-candidate.html") + "?election_id=" + electionId + '">2. Add Candidates</a>' +
        '<a class="inline-flex items-center px-3 py-2 rounded bg-slate-100 text-slate-800 text-sm font-semibold" href="' + toPath("admin/elections.html") + '">Go to Elections List</a>' +
        "</div>" +
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">' +
        checklistLine(
          "Step 1 complete: positions added",
          hasPositions,
          hasPositions ? (positions.length + " position(s) configured") : "Add at least one position"
        ) +
        checklistLine(
          "Step 2 complete: candidates assigned",
          candidatesReady,
          candidatesReady
            ? "Each position has at least one active candidate"
            : (missingPositionCandidates.length
                ? ("Missing candidates for: " + missingPositionCandidates.map(function (row) { return row.title || ("Position #" + row.id); }).join(", "))
                : "Add candidates for configured positions")
        ) +
        "</div>" +
        '<label class="flex items-center gap-2 text-sm mb-3">' +
        '<input type="checkbox" id="ovs-review-confirm" class="rounded border-slate-300" ' + (isPublished ? "checked disabled" : "") + "/>" +
        '<span>I confirm I reviewed election setup before publishing.</span>' +
        "</label>" +
        '<button type="button" id="ovs-publish-election" class="inline-flex items-center px-4 py-2 rounded font-semibold text-sm ' + (isPublished ? "bg-emerald-100 text-emerald-800" : "bg-primary text-white") + '" ' + (isPublished ? "disabled" : "") + ">" +
        (isPublished ? "Election already published" : "Publish Election") +
        "</button>";

      main.insertBefore(nextBox, main.firstChild);

      var publishButton = nextBox.querySelector("#ovs-publish-election");
      var reviewCheck = nextBox.querySelector("#ovs-review-confirm");
      if (!publishButton || isPublished) {
        return;
      }

      function syncPublishButtonState() {
        var allowPublish = hasPositions && candidatesReady && reviewCheck && reviewCheck.checked;
        publishButton.disabled = !allowPublish;
        publishButton.className =
          "inline-flex items-center px-4 py-2 rounded font-semibold text-sm " +
          (allowPublish ? "bg-primary text-white" : "bg-slate-300 text-slate-600 cursor-not-allowed");
      }

      if (reviewCheck) {
        reviewCheck.addEventListener("change", syncPublishButtonState);
      }
      syncPublishButtonState();

      publishButton.addEventListener("click", async function (event) {
        event.preventDefault();
        if (publishButton.disabled) return;

        publishButton.disabled = true;
        var oldLabel = publishButton.textContent;
        publishButton.textContent = "Publishing...";

        var publishRes = await apiPost("admin/update-election.php", {
          election_id: electionId,
          status: "published",
          review_confirmed: true
        });

        if (!publishRes.ok || !publishRes.json || !publishRes.json.success) {
          setPageMessage(main, "edit-election", (publishRes.json && publishRes.json.message) || "Unable to publish election.", "error");
          publishButton.textContent = oldLabel;
          syncPublishButtonState();
          return;
        }

        selected.status = "published";
        setPageMessage(main, "edit-election", "Election published successfully.", "success");
        await renderNextStepsBox();
      });
    }

    await renderNextStepsBox();

    var titleInput = findLabelControl(main, "election title", "input");
    var descriptionInput = findLabelControl(main, "public description", "textarea");

    if (titleInput) titleInput.value = selected.title || "";
    if (descriptionInput) descriptionInput.value = selected.description || "";

    var heading = main.querySelector("h1");
    if (heading) heading.textContent = selected.title || heading.textContent;

    var saveBtn = findButtonByText(main, "save changes");
    var discardBtn = findButtonByText(main, "discard changes");
    var deleteBtn = findButtonByText(main, "delete election");
    var pauseBtn = findButtonByText(main, "pause voting");
    var terminateBtn = findButtonByText(main, "terminate");
    var extendBtn = findButtonByText(main, "extend deadline");

    if (saveBtn) {
      saveBtn.addEventListener("click", async function (event) {
        event.preventDefault();
        var res = await apiPost("admin/update-election.php", {
          election_id: electionId,
          title: titleInput ? String(titleInput.value || "").trim() : selected.title,
          description: descriptionInput ? String(descriptionInput.value || "").trim() : selected.description
        });

        if (!res.ok || !res.json || !res.json.success) {
          setPageMessage(main, "edit-election", (res.json && res.json.message) || "Unable to save changes.", "error");
          return;
        }
        setPageMessage(main, "edit-election", "Election changes saved.", "success");
      });
    }

    if (discardBtn) {
      discardBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (titleInput) titleInput.value = selected.title || "";
        if (descriptionInput) descriptionInput.value = selected.description || "";
        setPageMessage(main, "edit-election", "Local changes discarded.", "info");
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener("click", async function (event) {
        event.preventDefault();
        var res = await apiPost("admin/update-election.php", {
          election_id: electionId,
          status: "closed"
        });
        if (!res.ok || !res.json || !res.json.success) {
          setPageMessage(main, "edit-election", (res.json && res.json.message) || "Unable to pause election.", "error");
          return;
        }
        setPageMessage(main, "edit-election", "Election paused (closed).", "success");
      });
    }

    if (extendBtn) {
      extendBtn.addEventListener("click", async function (event) {
        event.preventDefault();
        var endDate = new Date(selected.end_at || "");
        if (Number.isNaN(endDate.getTime())) {
          setPageMessage(main, "edit-election", "Unable to compute current end date.", "error");
          return;
        }
        endDate.setDate(endDate.getDate() + 1);
        var endAt = endDate.getFullYear() + "-" + pad2(endDate.getMonth() + 1) + "-" + pad2(endDate.getDate()) + " " + pad2(endDate.getHours()) + ":" + pad2(endDate.getMinutes()) + ":00";
        var res = await apiPost("admin/update-election.php", {
          election_id: electionId,
          end_at: endAt
        });
        if (!res.ok || !res.json || !res.json.success) {
          setPageMessage(main, "edit-election", (res.json && res.json.message) || "Unable to extend deadline.", "error");
          return;
        }
        selected.end_at = endAt;
        setPageMessage(main, "edit-election", "Deadline extended by 24 hours.", "success");
      });
    }

    var deleteAction = async function (event) {
      event.preventDefault();
      if (!window.confirm("Close/delete this election now?")) return;
      var res = await apiPost("admin/delete-election.php", { election_id: electionId });
      if (!res.ok || !res.json || !res.json.success) {
        setPageMessage(main, "edit-election", (res.json && res.json.message) || "Unable to remove election.", "error");
        return;
      }
      setPageMessage(main, "edit-election", "Election removed/closed successfully.", "success");
      setTimeout(function () {
        window.location.href = toPath("admin/elections.html");
      }, 500);
    };

    if (deleteBtn) deleteBtn.addEventListener("click", deleteAction);
    if (terminateBtn) terminateBtn.addEventListener("click", deleteAction);
  }

  async function bindCreatePositionPage() {
    var main = getMain();
    if (!main) return;

    var titleInput = findLabelControl(main, "position title", "input");
    var electionSelect = findLabelControl(main, "active election cycle", "select");
    var descriptionInput = findLabelControl(main, "ballot rules", "textarea");
    var seatInput = main.querySelector('input[type="number"]');
    var finalizeBtn = findButtonByText(main, "finalize position");
    var cancelBtn = findButtonByText(main, "cancel");
    if (!titleInput || !electionSelect || !finalizeBtn) return;

    var parentWrap = document.createElement("div");
    parentWrap.className = "space-y-2";
    parentWrap.innerHTML =
      '<label class="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-sm">account_tree</span>' +
      "Reports To (Parent Position)" +
      "</label>" +
      '<div class="relative">' +
      '<select id="ovs-parent-position-select" class="w-full bg-surface-container-low border-none h-14 px-4 font-headline text-lg focus:bg-white focus:ring-[3px] focus:ring-primary-container focus:ring-offset-2 transition-all appearance-none cursor-pointer outline-none">' +
      '<option value="">Top-Level Office (No Parent)</option>' +
      "</select>" +
      '<span class="material-symbols-outlined absolute right-4 top-4 pointer-events-none text-slate-400">unfold_more</span>' +
      "</div>" +
      '<p class="text-[11px] text-slate-400 italic">Create hierarchical structures (for example: National > Regional > District).</p>';

    if (descriptionInput && descriptionInput.parentElement) {
      descriptionInput.parentElement.insertAdjacentElement("beforebegin", parentWrap);
    }
    var parentSelect = document.getElementById("ovs-parent-position-select");

    var fillParentOptions = async function (selectedId) {
      if (!parentSelect) return;
      var electionId = parseInt(electionSelect.value || "0", 10);
      if (!electionId) {
        parentSelect.innerHTML = '<option value="">Top-Level Office (No Parent)</option>';
        return;
      }

      var items = await loadPositionItems(electionId);
      var tree = buildPositionTree(items);
      var flat = flattenPositionTree(tree.roots);
      parentSelect.innerHTML =
        '<option value="">Top-Level Office (No Parent)</option>' +
        flat
          .map(function (entry) {
            var depth = entry.depth || 0;
            var node = entry.node || {};
            var indent = treeIndentPrefix(depth);
            var selected = selectedId && parseInt(selectedId, 10) === node.id ? " selected" : "";
            return '<option value="' + escapeHtml(node.id) + '"' + selected + ">" + escapeHtml(indent + node.title) + "</option>";
          })
          .join("");
    };

    try {
      var elections = await loadElectionItems();
      var queryId = parseInt(new URLSearchParams(window.location.search || "").get("election_id"), 10);
      var queryParentId = parseInt(new URLSearchParams(window.location.search || "").get("parent_position_id"), 10);
      if (!Number.isFinite(queryId)) queryId = 0;
      if (!Number.isFinite(queryParentId)) queryParentId = 0;
      electionSelect.innerHTML = elections
        .map(function (row, idx) {
          var id = parseInt(row.id, 10);
          var selected = (queryId && id === queryId) || (!queryId && idx === 0);
          return '<option value="' + escapeHtml(id) + '"' + (selected ? " selected" : "") + ">" + escapeHtml(row.title || ("Election #" + id)) + "</option>";
        })
        .join("");
      await fillParentOptions(queryParentId || 0);
    } catch (errLoad) {
      setPageMessage(main, "create-position", errLoad.message, "error");
    }

    electionSelect.addEventListener("change", function () {
      fillParentOptions(0).catch(function (errPos) {
        setPageMessage(main, "create-position", errPos.message, "error");
      });
    });

    var minusBtn = seatInput ? seatInput.previousElementSibling : null;
    var plusBtn = seatInput ? seatInput.nextElementSibling : null;
    if (minusBtn && minusBtn.tagName === "BUTTON") {
      minusBtn.addEventListener("click", function (event) {
        event.preventDefault();
        seatInput.value = String(Math.max(1, parseInt(seatInput.value || "1", 10) - 1));
      });
    }
    if (plusBtn && plusBtn.tagName === "BUTTON") {
      plusBtn.addEventListener("click", function (event) {
        event.preventDefault();
        seatInput.value = String(Math.max(1, parseInt(seatInput.value || "1", 10) + 1));
      });
    }

    finalizeBtn.addEventListener("click", async function (event) {
      event.preventDefault();
      var payload = {
        election_id: parseInt(electionSelect.value || "0", 10),
        parent_position_id: parentSelect && parentSelect.value ? parseInt(parentSelect.value, 10) : null,
        title: String(titleInput.value || "").trim(),
        seat_count: Math.max(1, parseInt(seatInput && seatInput.value ? seatInput.value : "1", 10)),
        sort_order: 0,
        description: descriptionInput ? String(descriptionInput.value || "").trim() : ""
      };
      if (!payload.election_id || !payload.title) {
        setPageMessage(main, "create-position", "Election and position title are required.", "error");
        return;
      }
      var res = await apiPost("admin/create-position.php", payload);
      if (!res.ok || !res.json || !res.json.success) {
        setPageMessage(main, "create-position", (res.json && res.json.message) || "Unable to create position.", "error");
        return;
      }
      var positionId = res.json.data ? parseInt(res.json.data.position_id, 10) : 0;
      setPageMessage(main, "create-position", "Position created successfully.", "success");
      if (positionId) {
        setTimeout(function () {
          window.location.href = toPath("admin/add-candidate.html") + "?election_id=" + payload.election_id + "&position_id=" + positionId;
        }, 500);
      }
    });

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function (event) {
        event.preventDefault();
        window.location.href = toPath("admin/positions.html");
      });
    }
  }

  async function bindAddCandidatePage() {
    var main = getMain();
    if (!main) return;

    var fullNameInput = findLabelControl(main, "full legal name", "input");
    var idInput = findLabelControl(main, "identification number", "input");
    var emailInput = findLabelControl(main, "primary email", 'input[type="email"]');
    var partySelect = findLabelControl(main, "party affiliation", "select");
    var electionSelect = findLabelControl(main, "active election cycle", "select");
    var positionSelect = findLabelControl(main, "contested position", "select");
    var manifestoInputs = main.querySelectorAll("textarea");
    var manifestoInput = manifestoInputs.length ? manifestoInputs[manifestoInputs.length - 1] : null;
    var commitBtn = findButtonByText(main, "commit to ledger");
    var discardBtn = findButtonByText(main, "discard draft");
    if (!fullNameInput || !electionSelect || !positionSelect || !commitBtn) return;

    var positionCache = {};
    var fillPositionOptions = async function (electionId, selectedId) {
      if (!electionId) {
        positionSelect.innerHTML = '<option value="">Select Position</option>';
        return;
      }
      if (!positionCache[electionId]) {
        positionCache[electionId] = await loadPositionItems(electionId);
      }
      var items = positionCache[electionId];
      var tree = buildPositionTree(items);
      var flat = flattenPositionTree(tree.roots);
      if (!flat.length) {
        positionSelect.innerHTML = '<option value="">No positions available</option>';
        return;
      }
      var selectedExists = !!flat.find(function (entry) {
        return parseInt(entry.node && entry.node.id ? entry.node.id : "0", 10) === selectedId;
      });
      positionSelect.innerHTML =
        '<option value="">Select Position</option>' +
        flat
          .map(function (entry, idx) {
            var node = entry.node || {};
            var id = parseInt(node.id, 10);
            var selected = (selectedId && id === selectedId) || (!selectedId && idx === 0) || (!selectedExists && idx === 0);
            var indent = treeIndentPrefix(entry.depth || 0);
            return '<option value="' + escapeHtml(id) + '"' + (selected ? " selected" : "") + ">" + escapeHtml(indent + (node.title || ("Position #" + id))) + "</option>";
          })
          .join("");
    };

    try {
      var elections = await loadElectionItems();
      var qs = new URLSearchParams(window.location.search || "");
      var qElectionId = parseInt(qs.get("election_id"), 10);
      var qPositionId = parseInt(qs.get("position_id"), 10);
      if (!Number.isFinite(qElectionId)) qElectionId = 0;
      if (!Number.isFinite(qPositionId)) qPositionId = 0;

      electionSelect.innerHTML = elections
        .map(function (row, idx) {
          var id = parseInt(row.id, 10);
          var selected = (qElectionId && id === qElectionId) || (!qElectionId && idx === 0);
          return '<option value="' + escapeHtml(id) + '"' + (selected ? " selected" : "") + ">" + escapeHtml(row.title || ("Election #" + id)) + "</option>";
        })
        .join("");
      await fillPositionOptions(parseInt(electionSelect.value || "0", 10), qPositionId);
    } catch (errLoad) {
      setPageMessage(main, "add-candidate", errLoad.message, "error");
    }

    electionSelect.addEventListener("change", function () {
      fillPositionOptions(parseInt(electionSelect.value || "0", 10), 0).catch(function (errPos) {
        setPageMessage(main, "add-candidate", errPos.message, "error");
      });
    });

    commitBtn.addEventListener("click", async function (event) {
      event.preventDefault();
      var payload = {
        election_id: parseInt(electionSelect.value || "0", 10),
        position_id: parseInt(positionSelect.value || "0", 10),
        full_name: String(fullNameInput.value || "").trim(),
        party: partySelect ? String(partySelect.value || "").replace(/^Select.+$/, "").trim() : "",
        bio: "VUID: " + (idInput ? String(idInput.value || "").trim() : "") + "; Email: " + (emailInput ? String(emailInput.value || "").trim() : ""),
        manifesto: manifestoInput ? String(manifestoInput.value || "").trim() : "",
        status: "active"
      };

      if (!payload.election_id || !payload.position_id || !payload.full_name) {
        setPageMessage(main, "add-candidate", "Election, position, and candidate full name are required.", "error");
        return;
      }

      var res = await apiPost("admin/add-candidate.php", payload);
      if (!res.ok || !res.json || !res.json.success) {
        setPageMessage(main, "add-candidate", (res.json && res.json.message) || "Unable to add candidate.", "error");
        return;
      }
      setPageMessage(main, "add-candidate", "Candidate committed successfully.", "success");
    });

    if (discardBtn) {
      discardBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (fullNameInput) fullNameInput.value = "";
        if (idInput) idInput.value = "";
        if (emailInput) emailInput.value = "";
        if (manifestoInput) manifestoInput.value = "";
        setPageMessage(main, "add-candidate", "", "info");
      });
    }
  }

  function generateTempPassword() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    var out = "Tmp!";
    for (var i = 0; i < 8; i += 1) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out + "9@";
  }

  async function bindAddVoterPage() {
    var main = getMain();
    if (!main) return;
    var form = main.querySelector("form");
    if (!form) return;

    var firstName = findLabelControl(form, "legal first name", "input");
    var lastName = findLabelControl(form, "legal last name", "input");
    var email = findLabelControl(form, "official email address", 'input[type="email"]');
    var citizenId = findLabelControl(form, "citizen id", "input");
    var precinct = findLabelControl(form, "district precinct", "select");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var fullName = String((firstName && firstName.value) || "").trim() + " " + String((lastName && lastName.value) || "").trim();
      fullName = fullName.trim().replace(/\s+/g, " ");
      var emailValue = String((email && email.value) || "").trim();
      var tempPassword = generateTempPassword();

      if (!fullName || !emailValue) {
        setPageMessage(main, "add-voter", "First name, last name, and email are required.", "error");
        return;
      }

      var res = await apiPost("admin/add-voter.php", {
        full_name: fullName,
        email: emailValue,
        phone: citizenId ? String(citizenId.value || "").trim() : "",
        password: tempPassword
      });

      if (!res.ok || !res.json || !res.json.success) {
        setPageMessage(main, "add-voter", (res.json && res.json.message) || "Unable to add voter.", "error");
        return;
      }

      var voterId = res.json.data && res.json.data.voter_id ? String(res.json.data.voter_id) : "N/A";
      var msg = "Voter added successfully. Registration ID: " + voterId + ". Temporary password: " + tempPassword + ".";
      if (precinct) {
        msg += " Precinct: " + String(precinct.value || "").trim() + ".";
      }
      setPageMessage(main, "add-voter", msg, "success");
      form.reset();
    });
  }

  async function bindResultsPage() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading election results...");

    var electionId = parseInt(new URLSearchParams(window.location.search || "").get("election_id"), 10);
    if (!Number.isFinite(electionId)) electionId = 0;

    var elections;
    try {
      elections = await loadElectionItems();
    } catch (errLoad) {
      showError(main, errLoad.message || "Unable to load elections.");
      return;
    }

    if (!elections.length) {
      showError(main, "No elections found.");
      return;
    }

    if (!electionId) {
      electionId = parseInt(elections[0].id || "0", 10);
    }

    function electionPhase(row) {
      var status = String(row && row.status ? row.status : "").toLowerCase();
      var now = Date.now();
      var start = row && row.start_at ? new Date(row.start_at).getTime() : NaN;
      var end = row && row.end_at ? new Date(row.end_at).getTime() : NaN;
      if (status === "closed") return "closed";
      if (status !== "published") return "draft";
      if (Number.isFinite(start) && now < start) return "upcoming";
      if (Number.isFinite(end) && now > end) return "closed";
      return "active";
    }

    function phaseBadge(phase) {
      if (phase === "closed") return "bg-slate-100 text-slate-700";
      if (phase === "active") return "bg-emerald-100 text-emerald-700";
      if (phase === "upcoming") return "bg-amber-100 text-amber-700";
      return "bg-blue-100 text-blue-700";
    }

    function renderSkeleton() {
      main.innerHTML =
        '<div class="max-w-7xl mx-auto p-6 space-y-6">' +
        "<header>" +
        '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Real-Time Data Stream</p>' +
        '<h1 class="text-3xl md:text-4xl font-extrabold">Election Results Ledger</h1>' +
        '<p class="text-slate-600 mt-2">Live tallies generated from ballots and votes in the database.</p>' +
        "</header>" +
        '<section class="bg-white border border-slate-200 rounded p-4 grid grid-cols-1 md:grid-cols-4 gap-3 md:items-end">' +
        '<div class="md:col-span-2">' +
        '<label class="text-xs uppercase tracking-widest font-bold text-slate-500 mb-1 block">Election Context</label>' +
        '<select id="ovs-admin-results-election" class="w-full border border-slate-300 rounded px-3 py-2 text-sm"></select>' +
        "</div>" +
        '<div class="flex gap-2 md:justify-end md:col-span-2">' +
        '<button id="ovs-admin-results-refresh" class="px-4 py-2 border border-slate-300 rounded text-sm font-semibold hover:bg-slate-50 transition-colors">Refresh</button>' +
        '<button id="ovs-admin-results-export" class="px-4 py-2 bg-primary text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors">Export</button>' +
        "</div>" +
        "</section>" +
        '<section id="ovs-admin-results-kpi" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"></section>' +
        '<section class="grid grid-cols-1 xl:grid-cols-12 gap-6">' +
        '<div id="ovs-admin-results-positions" class="xl:col-span-8 space-y-4"></div>' +
        '<aside id="ovs-admin-results-audit" class="xl:col-span-4 space-y-4"></aside>' +
        "</section>" +
        "</div>";
    }

    renderSkeleton();

    var contextSelect = document.getElementById("ovs-admin-results-election");
    var refreshBtn = document.getElementById("ovs-admin-results-refresh");
    var exportBtn = document.getElementById("ovs-admin-results-export");
    var kpiHost = document.getElementById("ovs-admin-results-kpi");
    var positionsHost = document.getElementById("ovs-admin-results-positions");
    var auditHost = document.getElementById("ovs-admin-results-audit");
    if (!contextSelect || !refreshBtn || !exportBtn || !kpiHost || !positionsHost || !auditHost) return;

    contextSelect.innerHTML = elections
      .map(function (row) {
        var id = parseInt(row.id, 10);
        var selected = id === electionId ? " selected" : "";
        var phase = electionPhase(row);
        return '<option value="' + escapeHtml(id) + '"' + selected + ">" + escapeHtml((row.title || ("Election #" + id)) + " [" + phase.toUpperCase() + "]") + "</option>";
      })
      .join("");

    if (!parseInt(contextSelect.value || "0", 10)) {
      contextSelect.value = String(elections[0].id || "");
    }
    electionId = parseInt(contextSelect.value || "0", 10);

    function renderResults(data) {
      var election = data && data.election ? data.election : {};
      var summary = data && data.summary ? data.summary : {};
      var positions = data && Array.isArray(data.positions) ? data.positions : [];
      var generatedAt = data && data.generated_at ? data.generated_at : "";
      var phase = electionPhase(election);
      var closed = phase === "closed";

      var reportedPositions = positions.filter(function (pos) {
        return Array.isArray(pos.candidates) && pos.candidates.length > 0;
      }).length;
      var leaders = positions
        .map(function (pos) {
          var candidates = Array.isArray(pos.candidates) ? pos.candidates : [];
          if (!candidates.length) return null;
          var sorted = candidates.slice().sort(function (a, b) {
            return parseInt(b.vote_count || "0", 10) - parseInt(a.vote_count || "0", 10);
          });
          return {
            position_title: pos.position_title || "Position",
            candidate_name: sorted[0].candidate_name || "Candidate",
            vote_count: parseInt(sorted[0].vote_count || "0", 10)
          };
        })
        .filter(function (x) { return !!x; })
        .sort(function (a, b) { return b.vote_count - a.vote_count; });

      var lead = leaders.length ? leaders[0] : null;

      kpiHost.innerHTML =
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Total Turnout</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(summary.turnout_percent || 0) + '%</p></article>' +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Validated Ballots</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(summary.ballots_cast || 0) + "</p></article>" +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Eligible Voters</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(summary.eligible_voters || 0) + "</p></article>" +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Reporting Positions</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(reportedPositions) + "/" + escapeHtml(positions.length) + "</p></article>";

      if (!positions.length) {
        positionsHost.innerHTML =
          '<div class="bg-white border border-slate-200 rounded p-4 text-slate-500">No position results found for this election yet.</div>';
      } else {
        positionsHost.innerHTML = positions
          .map(function (position) {
            var candidates = Array.isArray(position.candidates) ? position.candidates.slice() : [];
            candidates.sort(function (a, b) {
              return parseInt(b.vote_count || "0", 10) - parseInt(a.vote_count || "0", 10);
            });
            var totalVotes = candidates.reduce(function (sum, c) {
              return sum + parseInt(c.vote_count || "0", 10);
            }, 0);

            var rows = candidates.length
              ? candidates.map(function (candidate, idx) {
                  var votes = parseInt(candidate.vote_count || "0", 10);
                  var pct = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : "0.0";
                  var leader = idx === 0;
                  return (
                    '<div class="space-y-2 ' + (leader ? "" : "opacity-90") + '">' +
                    '<div class="flex items-center justify-between text-sm">' +
                    '<div><span class="font-semibold">' + escapeHtml(candidate.candidate_name || "Candidate") + '</span><span class="text-slate-500 text-xs ml-2">' + escapeHtml(candidate.party || "Independent") + "</span></div>" +
                    '<div class="font-bold">' + escapeHtml(votes) + ' <span class="text-slate-500 text-xs">(' + escapeHtml(pct) + '%)</span></div>' +
                    "</div>" +
                    '<div class="w-full h-2 bg-slate-200 rounded"><div class="h-2 rounded ' + (leader ? "bg-primary" : "bg-slate-400") + '" style="width:' + escapeHtml(pct) + '%"></div></div>' +
                    "</div>"
                  );
                }).join("")
              : '<div class="text-sm text-slate-500">No candidates configured for this position.</div>';

            return (
              '<article class="bg-white border border-slate-200 rounded p-5">' +
              '<div class="flex items-center justify-between gap-3 mb-4">' +
              '<div><h3 class="text-lg font-bold">' + escapeHtml(position.position_title || "Position") + '</h3><p class="text-xs uppercase tracking-wider text-slate-500 mt-1">Total Votes: ' + escapeHtml(totalVotes) + "</p></div>" +
              (candidates.length
                ? '<span class="text-[10px] font-bold px-2 py-1 rounded border border-primary text-primary uppercase tracking-widest">' + (closed ? "Winner" : "Projected Leader") + "</span>"
                : "") +
              "</div>" +
              '<div class="space-y-4">' + rows + "</div>" +
              "</article>"
            );
          })
          .join("");
      }

      auditHost.innerHTML =
        '<article class="bg-white border border-slate-200 rounded p-4">' +
        '<p class="text-xs uppercase tracking-widest font-bold text-slate-500 mb-2">Ledger Integrity</p>' +
        '<p class="inline-flex px-2 py-0.5 rounded text-xs font-bold ' + phaseBadge(phase) + '">' + escapeHtml(phase.toUpperCase()) + "</p>" +
        '<p class="text-sm text-slate-600 mt-3">Generated at: ' + escapeHtml(formatDate(generatedAt || new Date().toISOString())) + "</p>" +
        '<p class="text-sm text-slate-600 mt-1">Status: ' + escapeHtml(String(election.status || "-").toUpperCase()) + "</p>" +
        '<p class="text-sm text-slate-600 mt-1">Window: ' + escapeHtml(formatDate(election.start_at) + " - " + formatDate(election.end_at)) + "</p>" +
        "</article>" +
        '<article class="bg-white border border-slate-200 rounded p-4">' +
        '<p class="text-xs uppercase tracking-widest font-bold text-slate-500 mb-2">Top Leader Snapshot</p>' +
        (lead
          ? ('<p class="text-sm font-semibold">' + escapeHtml(lead.candidate_name) + '</p><p class="text-xs text-slate-500 mt-1">' + escapeHtml(lead.position_title) + " | " + escapeHtml(lead.vote_count) + " votes</p>")
          : '<p class="text-sm text-slate-500">No candidate votes available yet.</p>') +
        "</article>" +
        '<article class="bg-white border border-slate-200 rounded p-4">' +
        '<p class="text-xs uppercase tracking-widest font-bold text-slate-500 mb-2">Export</p>' +
        '<p class="text-sm text-slate-600">Use export to download CSV for this election context.</p>' +
        "</article>";
    }

    async function loadAndRender() {
      setPageMessage(main, "results", "", "info");
      var res = await apiGet("admin/get-results.php", { election_id: electionId });
      if (!res.ok || !res.json || !res.json.success) {
        setPageMessage(main, "results", (res.json && res.json.message) || "Unable to load results data.", "error");
        positionsHost.innerHTML = '<div class="bg-white border border-red-200 rounded p-4 text-red-700">Unable to load results for selected election.</div>';
        kpiHost.innerHTML = "";
        auditHost.innerHTML = "";
        return;
      }
      renderResults(res.json.data || {});
    }

    contextSelect.addEventListener("change", function () {
      electionId = parseInt(contextSelect.value || "0", 10);
      var url = new URL(window.location.href);
      url.searchParams.set("election_id", String(electionId));
      window.history.replaceState({}, "", url.toString());
      loadAndRender();
    });

    refreshBtn.addEventListener("click", function (event) {
      event.preventDefault();
      loadAndRender();
    });

    exportBtn.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.href = toBackend("admin/export-results.php") + "?election_id=" + electionId;
    });

    await loadAndRender();
  }

  async function bindReportsPage() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading reports...");

    var electionId = parseInt(new URLSearchParams(window.location.search || "").get("election_id"), 10);
    if (!Number.isFinite(electionId)) electionId = 0;

    var elections;
    try {
      elections = await loadElectionItems();
    } catch (errLoad) {
      showError(main, errLoad.message || "Unable to load elections.");
      return;
    }

    if (!elections.length) {
      showError(main, "No elections found for reporting.");
      return;
    }

    if (!electionId) {
      electionId = parseInt(elections[0].id || "0", 10);
    }

    main.innerHTML =
      '<div class="max-w-7xl mx-auto p-6 space-y-6">' +
      "<header>" +
      '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Systems Intelligence</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold">Election Reports</h1>' +
      '<p class="text-slate-600 mt-2">Live reporting panel powered by election, ballot, and audit APIs.</p>' +
      "</header>" +
      '<section class="bg-white border border-slate-200 rounded p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:items-end">' +
      '<div class="lg:col-span-5">' +
      '<label class="text-xs uppercase tracking-widest font-bold text-slate-500 mb-1 block">Election Context</label>' +
      '<select id="ovs-admin-reports-election" class="w-full border border-slate-300 rounded px-3 py-2 text-sm"></select>' +
      "</div>" +
      '<div class="lg:col-span-7 flex flex-wrap gap-2 lg:justify-end">' +
      '<button id="ovs-admin-reports-refresh" type="button" class="px-4 py-2 border border-slate-300 rounded text-sm font-semibold hover:bg-slate-50 transition-colors">Refresh</button>' +
      '<button id="ovs-admin-reports-open-results" type="button" class="px-4 py-2 border border-slate-300 rounded text-sm font-semibold hover:bg-slate-50 transition-colors">Open Results Page</button>' +
      '<button id="ovs-admin-reports-export" type="button" class="px-4 py-2 bg-primary text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors">Export CSV</button>' +
      "</div>" +
      "</section>" +
      '<section id="ovs-admin-reports-kpi" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4"></section>' +
      '<section class="grid grid-cols-1 xl:grid-cols-12 gap-6">' +
      '<div class="xl:col-span-7 bg-white border border-slate-200 rounded p-5">' +
      '<div class="flex items-center justify-between gap-3 mb-4">' +
      '<h2 class="text-xl font-bold">Per-Position Summary</h2>' +
      '<span id="ovs-admin-reports-position-count" class="text-xs uppercase tracking-wider font-bold text-slate-500">0 positions</span>' +
      "</div>" +
      '<div id="ovs-admin-reports-positions" class="space-y-3"></div>' +
      "</div>" +
      '<aside class="xl:col-span-5 bg-white border border-slate-200 rounded p-5">' +
      '<h2 class="text-xl font-bold mb-4">Recent Activity Ledger</h2>' +
      '<div class="overflow-x-auto">' +
      '<table class="min-w-full text-sm">' +
      '<thead><tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500"><th class="py-2 pr-3">When</th><th class="py-2 pr-3">Action</th><th class="py-2 pr-3">User</th><th class="py-2">Details</th></tr></thead>' +
      '<tbody id="ovs-admin-reports-activity"></tbody>' +
      "</table>" +
      "</div>" +
      "</aside>" +
      "</section>" +
      '<section class="bg-white border border-slate-200 rounded p-5">' +
      '<h2 class="text-xl font-bold mb-4">Election Registry Snapshot</h2>' +
      '<div class="overflow-x-auto">' +
      '<table class="min-w-full text-sm">' +
      '<thead><tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500"><th class="py-2 pr-3">Election</th><th class="py-2 pr-3">Status</th><th class="py-2 pr-3">Positions</th><th class="py-2 pr-3">Candidates</th><th class="py-2 pr-3">Ballots</th><th class="py-2">Actions</th></tr></thead>' +
      '<tbody id="ovs-admin-reports-elections"></tbody>' +
      "</table>" +
      "</div>" +
      "</section>" +
      "</div>";

    var contextSelect = document.getElementById("ovs-admin-reports-election");
    var refreshBtn = document.getElementById("ovs-admin-reports-refresh");
    var openResultsBtn = document.getElementById("ovs-admin-reports-open-results");
    var exportBtn = document.getElementById("ovs-admin-reports-export");
    var kpiHost = document.getElementById("ovs-admin-reports-kpi");
    var positionsHost = document.getElementById("ovs-admin-reports-positions");
    var positionCount = document.getElementById("ovs-admin-reports-position-count");
    var activityHost = document.getElementById("ovs-admin-reports-activity");
    var electionsHost = document.getElementById("ovs-admin-reports-elections");
    if (!contextSelect || !refreshBtn || !openResultsBtn || !exportBtn || !kpiHost || !positionsHost || !positionCount || !activityHost || !electionsHost) return;

    contextSelect.innerHTML = elections
      .map(function (row) {
        var id = parseInt(row.id || "0", 10);
        var selected = id === electionId ? " selected" : "";
        return '<option value="' + escapeHtml(id) + '"' + selected + ">" + escapeHtml(row.title || ("Election #" + id)) + "</option>";
      })
      .join("");

    if (!parseInt(contextSelect.value || "0", 10)) {
      contextSelect.value = String(elections[0].id || "");
    }
    electionId = parseInt(contextSelect.value || "0", 10);

    function renderActivity(rows) {
      var list = Array.isArray(rows) ? rows : [];
      if (!list.length) {
        activityHost.innerHTML = '<tr><td colspan="4" class="py-3 text-slate-500">No audit activity found.</td></tr>';
        return;
      }
      activityHost.innerHTML = list
        .map(function (row) {
          var detail = "";
          if (row && row.meta_json) {
            try {
              var metaObj = JSON.parse(String(row.meta_json));
              var flat = Object.keys(metaObj || {}).slice(0, 2).map(function (key) {
                return key + ": " + metaObj[key];
              });
              detail = flat.join(", ");
            } catch (metaErr) {
              detail = String(row.meta_json || "");
            }
          }
          if (!detail) {
            detail = row && row.ip_address ? ("ip: " + row.ip_address) : "-";
          }
          return (
            '<tr class="border-b border-slate-100 align-top">' +
            '<td class="py-2 pr-3 text-xs text-slate-600">' + escapeHtml(formatDate(row.created_at)) + "</td>" +
            '<td class="py-2 pr-3 text-xs font-semibold">' + escapeHtml(row.action || "event") + "</td>" +
            '<td class="py-2 pr-3 text-xs">' + escapeHtml(row.user_id || "-") + "</td>" +
            '<td class="py-2 text-xs text-slate-600">' + escapeHtml(detail) + "</td>" +
            "</tr>"
          );
        })
        .join("");
    }

    function renderElectionRegistry(rows) {
      var list = Array.isArray(rows) ? rows : [];
      if (!list.length) {
        electionsHost.innerHTML = '<tr><td colspan="6" class="py-3 text-slate-500">No elections found.</td></tr>';
        return;
      }
      electionsHost.innerHTML = list
        .map(function (row) {
          var rowId = parseInt(row.id || "0", 10);
          return (
            '<tr class="border-b border-slate-100">' +
            '<td class="py-3 pr-3 font-semibold">' + escapeHtml(row.title || "-") + "</td>" +
            '<td class="py-3 pr-3"><span class="inline-flex px-2 py-0.5 rounded text-xs font-bold ' + statusBadge(row.status) + '">' + escapeHtml(String(row.status || "").toUpperCase()) + "</span></td>" +
            '<td class="py-3 pr-3">' + escapeHtml(formatNumber(row.positions_count || 0)) + "</td>" +
            '<td class="py-3 pr-3">' + escapeHtml(formatNumber(row.candidates_count || 0)) + "</td>" +
            '<td class="py-3 pr-3">' + escapeHtml(formatNumber(row.ballots_cast || 0)) + "</td>" +
            '<td class="py-3 text-xs"><div class="flex flex-wrap gap-2">' +
            '<a class="font-semibold text-primary hover:underline" href="' + toPath("admin/results.html") + "?election_id=" + rowId + '">Results</a>' +
            '<a class="font-semibold text-slate-700 hover:underline" href="' + toPath("admin/edit-election.html") + "?election_id=" + rowId + '">Edit</a>' +
            "</div></td>" +
            "</tr>"
          );
        })
        .join("");
    }

    function renderElectionPositions(items) {
      var positions = Array.isArray(items) ? items : [];
      positionCount.textContent = positions.length + " position" + (positions.length === 1 ? "" : "s");
      if (!positions.length) {
        positionsHost.innerHTML = '<div class="border border-slate-200 rounded p-4 text-slate-500">No position data available for this election.</div>';
        return;
      }

      positionsHost.innerHTML = positions
        .map(function (position) {
          var candidates = Array.isArray(position.candidates) ? position.candidates.slice() : [];
          candidates.sort(function (a, b) {
            return parseInt(b.vote_count || "0", 10) - parseInt(a.vote_count || "0", 10);
          });
          var totalVotes = candidates.reduce(function (sum, candidate) {
            return sum + parseInt(candidate.vote_count || "0", 10);
          }, 0);
          var leader = candidates.length ? candidates[0] : null;
          return (
            '<article class="border border-slate-200 rounded p-4">' +
            '<div class="flex flex-wrap items-center justify-between gap-2 mb-2">' +
            '<h3 class="font-bold">' + escapeHtml(position.position_title || "Position") + "</h3>" +
            '<span class="text-xs text-slate-500">Total votes: ' + escapeHtml(formatNumber(totalVotes)) + "</span>" +
            "</div>" +
            (leader
              ? ('<p class="text-sm text-slate-700"><span class="font-semibold">' + escapeHtml(leader.candidate_name || "Candidate") + "</span> leading with " + escapeHtml(formatNumber(leader.vote_count || 0)) + " votes.</p>")
              : '<p class="text-sm text-slate-500">No candidates linked to this position yet.</p>') +
            "</article>"
          );
        })
        .join("");
    }

    function renderKpis(summary, stats) {
      kpiHost.innerHTML =
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Turnout</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(summary.turnout_percent || 0) + '%</p></article>' +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Ballots Cast</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(formatNumber(summary.ballots_cast || 0)) + "</p></article>" +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Eligible Voters</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(formatNumber(summary.eligible_voters || 0)) + "</p></article>" +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">System Total Voters</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(formatNumber(stats.total_voters || 0)) + "</p></article>" +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Active Elections</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(formatNumber(stats.active_elections || 0)) + "</p></article>" +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Security Flags</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(formatNumber(stats.security_flags || 0)) + "</p></article>";
    }

    async function loadAndRender() {
      setPageMessage(main, "reports", "", "info");

      var responses = await Promise.all([
        apiGet("admin/get-results.php", { election_id: electionId }),
        apiGet("admin/dashboard-stats.php"),
        apiGet("admin/list-elections.php", { limit: 200 })
      ]);

      var resultsRes = responses[0];
      var dashboardRes = responses[1];
      var electionsRes = responses[2];

      if (!resultsRes.ok || !resultsRes.json || !resultsRes.json.success) {
        setPageMessage(main, "reports", (resultsRes.json && resultsRes.json.message) || "Unable to load reporting data.", "error");
        renderKpis({}, {});
        renderElectionPositions([]);
        renderActivity([]);
        renderElectionRegistry([]);
        return;
      }

      var resultsData = resultsRes.json.data || {};
      var summary = resultsData.summary || {};
      var positions = Array.isArray(resultsData.positions) ? resultsData.positions : [];
      var stats = dashboardRes.ok && dashboardRes.json && dashboardRes.json.success && dashboardRes.json.data
        ? (dashboardRes.json.data.stats || {})
        : {};
      var activity = dashboardRes.ok && dashboardRes.json && dashboardRes.json.success && dashboardRes.json.data
        ? (dashboardRes.json.data.recent_activity || [])
        : [];
      var electionRows = electionsRes.ok && electionsRes.json && electionsRes.json.success && electionsRes.json.data
        ? (electionsRes.json.data.items || [])
        : [];

      renderKpis(summary, stats);
      renderElectionPositions(positions);
      renderActivity(activity);
      renderElectionRegistry(electionRows);
    }

    contextSelect.addEventListener("change", function () {
      electionId = parseInt(contextSelect.value || "0", 10);
      var url = new URL(window.location.href);
      url.searchParams.set("election_id", String(electionId));
      window.history.replaceState({}, "", url.toString());
      loadAndRender();
    });

    refreshBtn.addEventListener("click", function (event) {
      event.preventDefault();
      loadAndRender();
    });

    openResultsBtn.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.href = toPath("admin/results.html") + "?election_id=" + electionId;
    });

    exportBtn.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.href = toBackend("admin/export-results.php") + "?election_id=" + electionId;
    });

    await loadAndRender();
  }

  async function bindSettingsPage() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading settings...");

    function readAsBool(value, fallback) {
      if (value === null || value === undefined || value === "") return !!fallback;
      var text = String(value).trim().toLowerCase();
      if (text === "1" || text === "true" || text === "yes" || text === "on") return true;
      if (text === "0" || text === "false" || text === "no" || text === "off") return false;
      return !!fallback;
    }

    var settingDefs = [
      { key: "organization_name", namespace: "general", type: "text", defaultValue: "National Election Commission" },
      { key: "official_domain", namespace: "general", type: "text", defaultValue: "localhost" },
      { key: "compliance_footer_text", namespace: "general", type: "textarea", defaultValue: "All actions are logged for audit and compliance." },
      { key: "support_email", namespace: "general", type: "email", defaultValue: "support@civicledger.local" },
      { key: "eligibility_profile", namespace: "general", type: "textarea", defaultValue: "Tanzania baseline: citizen by birth/naturalization, 18+ years, valid NIDA or Zanzibar resident ID, and registered within the eligible constituency." },
      { key: "allow_auto_publish_results", namespace: "general", type: "checkbox", defaultValue: "1" },
      { key: "minimum_hours_before_vote", namespace: "general", type: "number", defaultValue: "24" },
      { key: "enforce_admin_mfa", namespace: "security", type: "checkbox", defaultValue: "1" },
      { key: "hash_algorithm", namespace: "security", type: "select", defaultValue: "SHA-256" },
      { key: "session_timeout_minutes", namespace: "security", type: "number", defaultValue: "30" },
      { key: "ip_allowlist", namespace: "security", type: "textarea", defaultValue: "" },
      { key: "require_https", namespace: "security", type: "checkbox", defaultValue: "1" }
    ];

    function getStoredMap(rows) {
      var map = {};
      (Array.isArray(rows) ? rows : []).forEach(function (row) {
        if (!row || !row.key) return;
        map[String(row.key)] = row;
      });
      return map;
    }

    function settingValue(map, key, fallback) {
      if (map[key] && map[key].value !== null && map[key].value !== undefined) {
        return String(map[key].value);
      }
      return String(fallback === null || fallback === undefined ? "" : fallback);
    }

    function latestUpdatedAt(rows) {
      var list = Array.isArray(rows) ? rows : [];
      var latest = "";
      list.forEach(function (row) {
        var ts = row && row.updated_at ? String(row.updated_at) : "";
        if (!ts) return;
        if (!latest || new Date(ts).getTime() > new Date(latest).getTime()) {
          latest = ts;
        }
      });
      return latest;
    }

    async function renderFromData(settingsRows, snapshot) {
      var map = getStoredMap(settingsRows);
      var updatedAt = latestUpdatedAt(settingsRows);
      var stats = snapshot && snapshot.stats ? snapshot.stats : {};

      main.innerHTML =
        '<div class="max-w-6xl mx-auto p-6 space-y-6">' +
        "<header>" +
        '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">System Configuration</p>' +
        '<h1 class="text-3xl md:text-4xl font-extrabold">Core Platform Settings</h1>' +
        '<p class="text-slate-600 mt-2">Persisted in database via <code>backend/admin/settings.php</code>.</p>' +
        "</header>" +
        '<section class="bg-white border border-slate-200 rounded p-4 flex flex-wrap items-center gap-2 justify-between">' +
        '<p class="text-sm text-slate-600">Last saved: <span class="font-semibold">' + escapeHtml(updatedAt ? formatDate(updatedAt) : "Not yet saved") + "</span></p>" +
        '<div class="flex flex-wrap gap-2">' +
        '<button id="ovs-admin-settings-reload" type="button" class="px-4 py-2 border border-slate-300 rounded text-sm font-semibold hover:bg-slate-50 transition-colors">Reload</button>' +
        '<button id="ovs-admin-settings-reset" type="button" class="px-4 py-2 border border-slate-300 rounded text-sm font-semibold hover:bg-slate-50 transition-colors">Reset Defaults</button>' +
        '<button id="ovs-admin-settings-save" type="button" class="px-4 py-2 bg-primary text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors">Save Settings</button>' +
        "</div>" +
        "</section>" +
        '<section class="grid grid-cols-1 md:grid-cols-4 gap-4">' +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Total Voters</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(formatNumber(stats.total_voters || 0)) + "</p></article>" +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Active Voters</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(formatNumber(stats.active_voters || 0)) + "</p></article>" +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Active Elections</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(formatNumber(stats.active_elections || 0)) + "</p></article>" +
        '<article class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase text-slate-500 font-bold">Security Flags</p><p class="text-2xl font-extrabold mt-2">' + escapeHtml(formatNumber(stats.security_flags || 0)) + "</p></article>" +
        "</section>" +
        '<section class="bg-white border border-slate-200 rounded p-5 space-y-4">' +
        '<h2 class="text-xl font-bold">Organization & Election Rules</h2>' +
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
        '<label class="text-sm font-semibold">Organization Name<input data-ovs-setting-key="organization_name" data-ovs-setting-ns="general" data-ovs-setting-default="' + escapeHtml(settingDefs[0].defaultValue) + '" class="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" type="text" value="' + escapeHtml(settingValue(map, "organization_name", settingDefs[0].defaultValue)) + '"></label>' +
        '<label class="text-sm font-semibold">Official Domain<input data-ovs-setting-key="official_domain" data-ovs-setting-ns="general" data-ovs-setting-default="' + escapeHtml(settingDefs[1].defaultValue) + '" class="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" type="text" value="' + escapeHtml(settingValue(map, "official_domain", settingDefs[1].defaultValue)) + '"></label>' +
        '<label class="text-sm font-semibold md:col-span-2">Compliance Footer Text<textarea data-ovs-setting-key="compliance_footer_text" data-ovs-setting-ns="general" data-ovs-setting-default="' + escapeHtml(settingDefs[2].defaultValue) + '" class="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" rows="2">' + escapeHtml(settingValue(map, "compliance_footer_text", settingDefs[2].defaultValue)) + '</textarea></label>' +
        '<label class="text-sm font-semibold">Support Email<input data-ovs-setting-key="support_email" data-ovs-setting-ns="general" data-ovs-setting-default="' + escapeHtml(settingDefs[3].defaultValue) + '" class="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" type="email" value="' + escapeHtml(settingValue(map, "support_email", settingDefs[3].defaultValue)) + '"></label>' +
        '<label class="text-sm font-semibold">Minimum Hours Before Vote<input data-ovs-setting-key="minimum_hours_before_vote" data-ovs-setting-ns="general" data-ovs-setting-default="' + escapeHtml(settingDefs[6].defaultValue) + '" class="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" type="number" min="0" value="' + escapeHtml(settingValue(map, "minimum_hours_before_vote", settingDefs[6].defaultValue)) + '"></label>' +
        '<label class="text-sm font-semibold md:col-span-2">Eligibility Profile<textarea data-ovs-setting-key="eligibility_profile" data-ovs-setting-ns="general" data-ovs-setting-default="' + escapeHtml(settingDefs[4].defaultValue) + '" class="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" rows="3">' + escapeHtml(settingValue(map, "eligibility_profile", settingDefs[4].defaultValue)) + '</textarea></label>' +
        '<label class="inline-flex items-center gap-2 text-sm font-semibold"><input data-ovs-setting-key="allow_auto_publish_results" data-ovs-setting-ns="general" data-ovs-setting-default="' + escapeHtml(settingDefs[5].defaultValue) + '" type="checkbox" class="rounded border-slate-300" ' + (readAsBool(settingValue(map, "allow_auto_publish_results", settingDefs[5].defaultValue), true) ? "checked" : "") + '> Auto publish results when election closes</label>' +
        "</div>" +
        "</section>" +
        '<section class="bg-white border border-slate-200 rounded p-5 space-y-4">' +
        '<h2 class="text-xl font-bold">Security Controls</h2>' +
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
        '<label class="inline-flex items-center gap-2 text-sm font-semibold md:col-span-2"><input data-ovs-setting-key="enforce_admin_mfa" data-ovs-setting-ns="security" data-ovs-setting-default="' + escapeHtml(settingDefs[7].defaultValue) + '" type="checkbox" class="rounded border-slate-300" ' + (readAsBool(settingValue(map, "enforce_admin_mfa", settingDefs[7].defaultValue), true) ? "checked" : "") + '> Require MFA for admin users</label>' +
        '<label class="text-sm font-semibold">Hash Algorithm<select data-ovs-setting-key="hash_algorithm" data-ovs-setting-ns="security" data-ovs-setting-default="' + escapeHtml(settingDefs[8].defaultValue) + '" class="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"><option value="SHA-256">SHA-256</option><option value="SHA-512">SHA-512</option><option value="BLAKE3">BLAKE3</option></select></label>' +
        '<label class="text-sm font-semibold">Session Timeout (minutes)<input data-ovs-setting-key="session_timeout_minutes" data-ovs-setting-ns="security" data-ovs-setting-default="' + escapeHtml(settingDefs[9].defaultValue) + '" class="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" type="number" min="5" value="' + escapeHtml(settingValue(map, "session_timeout_minutes", settingDefs[9].defaultValue)) + '"></label>' +
        '<label class="text-sm font-semibold md:col-span-2">IP Allowlist<textarea data-ovs-setting-key="ip_allowlist" data-ovs-setting-ns="security" data-ovs-setting-default="' + escapeHtml(settingDefs[10].defaultValue) + '" class="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" rows="3" placeholder="192.168.1.0/24, 10.0.0.1/32">' + escapeHtml(settingValue(map, "ip_allowlist", settingDefs[10].defaultValue)) + '</textarea></label>' +
        '<label class="inline-flex items-center gap-2 text-sm font-semibold md:col-span-2"><input data-ovs-setting-key="require_https" data-ovs-setting-ns="security" data-ovs-setting-default="' + escapeHtml(settingDefs[11].defaultValue) + '" type="checkbox" class="rounded border-slate-300" ' + (readAsBool(settingValue(map, "require_https", settingDefs[11].defaultValue), true) ? "checked" : "") + '> Require HTTPS-only access to admin APIs</label>' +
        "</div>" +
        "</section>" +
        "</div>";

      var hashSelect = main.querySelector('[data-ovs-setting-key="hash_algorithm"]');
      if (hashSelect) {
        hashSelect.value = settingValue(map, "hash_algorithm", settingDefs[8].defaultValue);
      }

      var saveBtn = document.getElementById("ovs-admin-settings-save");
      var resetBtn = document.getElementById("ovs-admin-settings-reset");
      var reloadBtn = document.getElementById("ovs-admin-settings-reload");

      function collectPayload() {
        var fields = main.querySelectorAll("[data-ovs-setting-key]");
        var payload = [];
        Array.prototype.forEach.call(fields, function (field) {
          var key = field.getAttribute("data-ovs-setting-key");
          var namespace = field.getAttribute("data-ovs-setting-ns") || "general";
          var value = "";
          if (field.type === "checkbox") {
            value = field.checked ? "1" : "0";
          } else {
            value = String(field.value || "").trim();
          }
          payload.push({
            key: key,
            namespace: namespace,
            value: value
          });
        });
        return payload;
      }

      function resetToDefaults() {
        var fields = main.querySelectorAll("[data-ovs-setting-key]");
        Array.prototype.forEach.call(fields, function (field) {
          var def = field.getAttribute("data-ovs-setting-default") || "";
          if (field.type === "checkbox") {
            field.checked = readAsBool(def, false);
          } else {
            field.value = def;
          }
        });
      }

      if (saveBtn) {
        saveBtn.addEventListener("click", async function (event) {
          event.preventDefault();
          setPageMessage(main, "settings", "Saving settings...", "info");
          saveBtn.disabled = true;

          var saveRes = await apiPost("admin/settings.php", { settings: collectPayload() });
          if (!saveRes.ok || !saveRes.json || !saveRes.json.success) {
            saveBtn.disabled = false;
            setPageMessage(main, "settings", (saveRes.json && saveRes.json.message) || "Unable to save settings.", "error");
            return;
          }

          setPageMessage(main, "settings", "Settings saved successfully.", "success");
          saveBtn.disabled = false;
          bindSettingsPage();
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener("click", function (event) {
          event.preventDefault();
          resetToDefaults();
          setPageMessage(main, "settings", "Defaults restored on screen. Click Save Settings to persist.", "info");
        });
      }

      if (reloadBtn) {
        reloadBtn.addEventListener("click", function (event) {
          event.preventDefault();
          bindSettingsPage();
        });
      }
    }

    var responses = await Promise.all([
      apiGet("admin/settings.php"),
      apiGet("admin/dashboard-stats.php")
    ]);

    var settingsRes = responses[0];
    var statsRes = responses[1];

    if (!settingsRes.ok || !settingsRes.json || !settingsRes.json.success) {
      showError(main, (settingsRes.json && settingsRes.json.message) || "Unable to load admin settings.");
      return;
    }

    var settingsRows = settingsRes.json.data && Array.isArray(settingsRes.json.data.items)
      ? settingsRes.json.data.items
      : [];
    var snapshot = statsRes.ok && statsRes.json && statsRes.json.success
      ? (statsRes.json.data || {})
      : { stats: {} };

    await renderFromData(settingsRows, snapshot);
  }

  async function initAdminPages() {
    var info = pageInfo();
    if (String(info.section || "").toLowerCase() !== "admin") return;

    var file = String(info.file || "").toLowerCase();
    if (file === "dashboard.html") {
      await renderDashboard();
      return;
    }
    if (file === "create-election.html") {
      await bindCreateElectionPage();
      return;
    }
    if (file === "edit-election.html") {
      await bindEditElectionPage();
      return;
    }
    if (file === "elections.html") {
      await renderElectionsPage();
      return;
    }
    if (file === "positions.html") {
      await renderPositionsTreePage();
      return;
    }
    if (file === "create-position.html") {
      await bindCreatePositionPage();
      return;
    }
    if (file === "candidates.html") {
      await renderSimpleTablePage({
        title: "Candidates",
        endpoint: "admin/list-candidates.php",
        query: { limit: 200 },
        columns: [
          { label: "Name", render: function (row) { return '<span class="font-semibold">' + escapeHtml(row.full_name || "-") + "</span>"; } },
          { label: "Election", render: function (row) { return escapeHtml(row.election_title || "-"); } },
          { label: "Position", render: function (row) { return escapeHtml(row.position_title || "-"); } },
          { label: "Party", render: function (row) { return escapeHtml(row.party || "Independent"); } },
          {
            label: "Status",
            render: function (row) {
              return '<span class="inline-flex px-2 py-0.5 rounded text-xs font-bold ' + statusBadge(row.status) + '">' + escapeHtml(String(row.status || "").toUpperCase()) + "</span>";
            }
          }
        ]
      });
      return;
    }
    if (file === "add-candidate.html") {
      await bindAddCandidatePage();
      return;
    }
    if (file === "voters.html") {
      await renderVoters();
      return;
    }
    if (file === "add-voter.html") {
      await bindAddVoterPage();
      return;
    }
    if (file === "results.html") {
      await bindResultsPage();
      return;
    }
    if (file === "reports.html") {
      await bindReportsPage();
      return;
    }
    if (file === "settings.html") {
      await bindSettingsPage();
      return;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initAdminPages().catch(function (err) {
      var main = getMain();
      if (!main) return;
      showError(main, "Admin page initialization failed: " + (err && err.message ? err.message : "Unknown error"));
    });
  });
})();

