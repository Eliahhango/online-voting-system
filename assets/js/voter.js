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
    var file = path.split("/").pop() || "";
    return { section: "public", file: file };
  }

  function getMain() {
    return document.querySelector("main");
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function boolish(value) {
    return value === true || value === 1 || value === "1";
  }

  function parseNumber(value, fallback) {
    var out = Number(value);
    return Number.isFinite(out) ? out : (fallback || 0);
  }

  function queryParam(name) {
    var params = new URLSearchParams(window.location.search || "");
    return params.get(name);
  }

  function toDate(value) {
    if (!value) return null;
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDate(value) {
    var d = toDate(value);
    if (!d) return String(value || "-");
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function formatDateTime(value) {
    var d = toDate(value);
    if (!d) return String(value || "-");
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function phaseLabel(phase) {
    var p = String(phase || "").toLowerCase();
    if (p === "active") return "Active";
    if (p === "upcoming") return "Upcoming";
    if (p === "closed") return "Closed";
    return "Unknown";
  }

  function phaseBadge(phase) {
    var p = String(phase || "").toLowerCase();
    if (p === "active") return "bg-emerald-100 text-emerald-700";
    if (p === "upcoming") return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-700";
  }

  function asInt(value) {
    var out = parseInt(value || "0", 10);
    return Number.isFinite(out) ? out : 0;
  }

  function pluralize(count, singular, plural) {
    var n = asInt(count);
    return n + " " + (n === 1 ? singular : (plural || (singular + "s")));
  }

  function electionWindowText(row) {
    var start = formatDate(row && row.start_at ? row.start_at : "");
    var end = formatDate(row && row.end_at ? row.end_at : "");
    return start + " - " + end;
  }

  function fallbackElectionDescription(row) {
    var phase = phaseLabel(row && row.phase ? row.phase : "");
    var positions = asInt(row && row.positions_count);
    var candidates = asInt(row && row.candidates_count);
    var seats = asInt(row && row.seats_total);
    var ballots = asInt(row && row.ballots_cast);
    return (
      phase +
      " election window " + electionWindowText(row) +
      ". Includes " + pluralize(positions, "position") +
      ", " + pluralize(candidates, "candidate") +
      ", " + pluralize(seats, "seat") +
      ", and " + ballots + " ballot(s) cast so far."
    );
  }

  function electionDescription(row) {
    var text = String(row && row.description ? row.description : "").trim();
    return text || fallbackElectionDescription(row || {});
  }

  function buildUrl(endpoint, query) {
    var raw = toBackend(endpoint);
    if (!query || Object.keys(query).length === 0) {
      return raw;
    }

    var absolute = new URL(raw, window.location.href);
    Object.keys(query).forEach(function (key) {
      var value = query[key];
      if (value === null || value === undefined || value === "") {
        return;
      }
      absolute.searchParams.set(key, String(value));
    });
    return absolute.toString();
  }

  async function apiRequest(method, endpoint, payload, query) {
    var url = buildUrl(endpoint, query);
    var options = {
      method: String(method || "GET").toUpperCase(),
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    };

    if (options.method !== "GET" && options.method !== "HEAD") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload || {});
    }

    try {
      var response = await fetch(url, options);
      var json = null;
      try {
        json = await response.json();
      } catch (jsonErr) {
        json = null;
      }
      return { ok: response.ok, status: response.status, json: json };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        json: {
          success: false,
          message: "Network error. Check your connection and server."
        }
      };
    }
  }

  function apiGet(endpoint, query) {
    return apiRequest("GET", endpoint, null, query);
  }

  function apiPost(endpoint, payload) {
    return apiRequest("POST", endpoint, payload, null);
  }

  function showError(main, message) {
    if (!main) return;
    main.innerHTML =
      '<div class="max-w-4xl mx-auto p-6">' +
      '<div class="border border-red-200 bg-red-50 text-red-800 p-4 rounded">' +
      escapeHtml(message || "Something went wrong.") +
      "</div></div>";
  }

  function showLoading(main, label) {
    if (!main) return;
    main.innerHTML =
      '<div class="max-w-4xl mx-auto p-6">' +
      '<div class="border border-slate-200 bg-white p-4 rounded text-slate-600">' +
      escapeHtml(label || "Loading...") +
      "</div></div>";
  }

  function setMessage(container, message, type) {
    if (!container) return;
    var css = "bg-slate-100 text-slate-700 border-slate-200";
    if (type === "error") css = "bg-red-50 text-red-700 border-red-200";
    if (type === "success") css = "bg-emerald-50 text-emerald-700 border-emerald-200";
    container.className = "border rounded px-3 py-2 text-sm " + css;
    container.textContent = message;
    container.hidden = false;
  }

  function hideMessage(container) {
    if (!container) return;
    container.hidden = true;
    container.textContent = "";
  }

  function electionAction(election) {
    if (!election) {
      return {
        label: "View Elections",
        href: toPath("voter/elections.html"),
        disabled: false
      };
    }

    var id = parseNumber(election.id, 0);
    var phase = String(election.phase || "").toLowerCase();
    var hasVoted = boolish(election.has_voted);

    if (phase === "active" && !hasVoted) {
      return {
        label: "Open Ballot",
        href: toPath("voter/ballot.html") + "?election_id=" + id,
        disabled: false
      };
    }

    if (phase === "active" && hasVoted) {
      return {
        label: "Results After Close",
        href: toPath("voter/election-details.html") + "?election_id=" + id,
        disabled: false
      };
    }

    if (phase === "upcoming") {
      return {
        label: "View Details",
        href: toPath("voter/election-details.html") + "?election_id=" + id,
        disabled: false
      };
    }

    return {
      label: "View Results",
      href: toPath("voter/results.html") + "?election_id=" + id,
      disabled: false
    };
  }

  function pickFeaturedElection(items) {
    var list = Array.isArray(items) ? items : [];
    var open = list.find(function (row) {
      return String(row.phase || "").toLowerCase() === "active" && !boolish(row.has_voted);
    });
    if (open) return open;
    var active = list.find(function (row) {
      return String(row.phase || "").toLowerCase() === "active";
    });
    if (active) return active;
    var upcoming = list.find(function (row) {
      return String(row.phase || "").toLowerCase() === "upcoming";
    });
    if (upcoming) return upcoming;
    return list[0] || null;
  }

  function dashboardBannerText(featured) {
    if (!featured) {
      return "No active elections at the moment. Check upcoming elections.";
    }

    var phase = String(featured.phase || "").toLowerCase();
    var title = String(featured.title || "this election");

    if (phase === "active" && !boolish(featured.has_voted)) {
      return "Action Required: Complete your ballot for " + title + " by " + formatDate(featured.end_at) + ".";
    }
    if (phase === "active" && boolish(featured.has_voted)) {
      return "Ballot submitted for " + title + ". Results will be visible after the election window closes.";
    }
    if (phase === "upcoming") {
      return "Upcoming election: " + title + " starts on " + formatDate(featured.start_at) + ".";
    }
    if (phase === "closed") {
      return title + " is closed. Final results are available.";
    }

    return "No active elections at the moment. Check upcoming elections.";
  }

  function dashboardBannerTone(featured) {
    if (!featured) return "neutral";
    var phase = String(featured.phase || "").toLowerCase();
    if (phase === "active" && !boolish(featured.has_voted)) return "warning";
    if (phase === "active" && boolish(featured.has_voted)) return "success";
    if (phase === "upcoming") return "info";
    if (phase === "closed") return "neutral";
    return "neutral";
  }

  function stitchBannerClassByTone(tone) {
    if (tone === "warning") return "bg-[#F59E0B]";
    if (tone === "success") return "bg-[#10B981]";
    if (tone === "info") return "bg-[#1D4ED8]";
    return "bg-slate-600";
  }

  function fallbackBannerClassByTone(tone) {
    if (tone === "warning") return "bg-amber-500";
    if (tone === "success") return "bg-emerald-500";
    if (tone === "info") return "bg-blue-600";
    return "bg-slate-600";
  }

  function downloadCsv(filename, rows) {
    var csv = rows
      .map(function (row) {
        return row
          .map(function (cell) {
            var value = String(cell === null || cell === undefined ? "" : cell);
            if (value.indexOf('"') !== -1 || value.indexOf(",") !== -1 || value.indexOf("\n") !== -1) {
              value = '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
          })
          .join(",");
      })
      .join("\n");

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  async function resolveElectionId(candidate, preferOpen) {
    var id = parseNumber(candidate, 0);
    if (id > 0) return id;

    var electionsRes = await apiGet("voters/get-elections.php", { status: "all", limit: 100 });
    if (!electionsRes.ok || !electionsRes.json || !electionsRes.json.data) {
      return null;
    }

    var list = electionsRes.json.data.items || [];
    if (preferOpen) {
      var open = list.find(function (row) {
        return String(row.phase || "").toLowerCase() === "active" && !boolish(row.has_voted);
      });
      if (open) return parseNumber(open.id, 0);
    }

    var featured = pickFeaturedElection(list);
    return featured ? parseNumber(featured.id, 0) : null;
  }

  function isStitchDashboard(main) {
    if (!main) return false;
    var heading = main.querySelector("h1");
    var openBallotBtn = Array.prototype.find.call(main.querySelectorAll("button"), function (btn) {
      return String(btn.textContent || "").toLowerCase().indexOf("open ballot") !== -1;
    });
    var historyTable = main.querySelector("table tbody");
    return !!(heading && openBallotBtn && historyTable);
  }

  function attachDownloadTextFile(filename, content) {
    var blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  async function hydrateStitchDashboard() {
    var main = getMain();
    if (!main) return;
    if (!isStitchDashboard(main)) {
      await renderDashboard();
      return;
    }

    var responses = await Promise.all([
      apiGet("voters/get-profile.php"),
      apiGet("voters/get-elections.php", { status: "all", limit: 100 }),
      apiGet("voters/get-voting-history.php", { limit: 100 })
    ]);
    var profileRes = responses[0];
    var electionsRes = responses[1];
    var historyRes = responses[2];

    var profile = profileRes.ok && profileRes.json && profileRes.json.success
      ? ((profileRes.json.data && profileRes.json.data.profile) || {})
      : {};
    var elections = electionsRes.ok && electionsRes.json && electionsRes.json.data ? electionsRes.json.data.items || [] : [];
    var history = historyRes.ok && historyRes.json && historyRes.json.data ? historyRes.json.data.items || [] : [];
    var featured = pickFeaturedElection(elections);
    var action = electionAction(featured);
    var bannerTone = dashboardBannerTone(featured);

    var banner = main.querySelector("#ovs-dashboard-alert-text") || main.querySelector("div.bg\\[\\#F59E0B\\] p");
    if (banner) {
      banner.textContent = dashboardBannerText(featured);
    }
    var bannerShell = main.querySelector("#ovs-dashboard-alert") || (banner ? banner.parentElement : null);
    if (bannerShell) {
      bannerShell.classList.remove("bg-[#F59E0B]", "bg-[#10B981]", "bg-[#1D4ED8]", "bg-slate-600");
      bannerShell.classList.add(stitchBannerClassByTone(bannerTone));
    }

    var heading = main.querySelector("header h1");
    if (heading) {
      heading.innerHTML = "Welcome back, <br/>" + escapeHtml(profile.full_name || "Citizen");
    }

    var electionTitle = main.querySelector("section h2");
    if (electionTitle) {
      electionTitle.textContent = featured ? String(featured.title || "Current Election") : "No Active Election";
    }
    var electionDesc = electionTitle && electionTitle.parentElement ? electionTitle.parentElement.querySelector("p") : null;
    if (electionDesc) {
      electionDesc.textContent = featured
        ? String(featured.description || (phaseLabel(featured.phase) + " election window: " + formatDate(featured.start_at) + " - " + formatDate(featured.end_at)))
        : "No election is currently available for your account.";
    }

    var openBallotButton = Array.prototype.find.call(main.querySelectorAll("button"), function (btn) {
      return String(btn.textContent || "").toLowerCase().indexOf("open ballot") !== -1;
    });
    if (openBallotButton) {
      openBallotButton.firstChild.nodeValue = action.label + " ";
      openBallotButton.addEventListener("click", function () {
        window.location.href = action.href;
      });
    }

    var statsCards = main.querySelectorAll(".grid.grid-cols-1.md\\:grid-cols-2.gap-6.mb-12 > div");
    if (statsCards.length > 0) {
      var identityValue = statsCards[0].querySelector("p.font-headline");
      if (identityValue) {
        identityValue.textContent = boolish(profile.is_verified) ? "Blockchain Verified" : "Verification Pending";
      }
    }
    if (statsCards.length > 1) {
      var renewalValue = statsCards[1].querySelector("p.font-headline");
      if (renewalValue) {
        var renewal = new Date();
        renewal.setFullYear(renewal.getFullYear() + 2);
        renewalValue.textContent = renewal.toLocaleString(undefined, { month: "long", year: "numeric" });
      }
    }

    var tableBody = main.querySelector("table tbody");
    if (tableBody) {
      if (!history.length) {
        tableBody.innerHTML = '<tr><td class="p-4 text-sm text-slate-500" colspan="4">No ballots submitted yet.</td></tr>';
      } else {
        tableBody.innerHTML = history
          .slice(0, 8)
          .map(function (row) {
            return (
              '<tr class="hover:bg-surface-container-low transition-colors group">' +
              '<td class="p-4 text-sm font-medium">' + escapeHtml(formatDate(row.submitted_at)) + "</td>" +
              '<td class="p-4 text-sm font-bold text-[#0B1F3B]">' + escapeHtml(row.election_title || "-") + "</td>" +
              '<td class="p-4"><div class="flex items-center gap-2 text-[#10B981]"><span class="material-symbols-outlined text-lg">check_circle</span><span class="text-xs font-bold uppercase tracking-tighter">Verified</span></div></td>' +
              '<td class="p-4 text-right"><button class="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors ovs-receipt-btn" data-receipt="' + escapeHtml(row.receipt_code || "") + '" data-election="' + escapeHtml(row.election_title || "") + '" data-date="' + escapeHtml(formatDateTime(row.submitted_at)) + '">description</button></td>' +
              "</tr>"
            );
          })
          .join("");
      }
    }

    var downloadAllBtn = Array.prototype.find.call(main.querySelectorAll("button"), function (btn) {
      return String(btn.textContent || "").toLowerCase().indexOf("download all receipts") !== -1;
    });
    if (downloadAllBtn) {
      downloadAllBtn.addEventListener("click", function () {
        var rows = [["Date", "Election", "Receipt Code", "Status", "Vote Items"]];
        if (!history.length) {
          rows.push(["", "No receipts available yet", "", "", 0]);
        } else {
          history.forEach(function (row) {
            rows.push([
              formatDateTime(row.submitted_at),
              row.election_title || "",
              row.receipt_code || "",
              row.election_status || "",
              row.vote_items || 0
            ]);
          });
        }
        downloadCsv("voting-history.csv", rows);
      });
    }

    main.addEventListener("click", function (event) {
      var receiptBtn = event.target.closest(".ovs-receipt-btn");
      if (!receiptBtn) return;
      var content =
        "Civic Ledger Receipt\n" +
        "Election: " + (receiptBtn.getAttribute("data-election") || "") + "\n" +
        "Receipt Code: " + (receiptBtn.getAttribute("data-receipt") || "") + "\n" +
        "Submitted At: " + (receiptBtn.getAttribute("data-date") || "") + "\n";
      attachDownloadTextFile("vote-receipt.txt", content);
    });
  }

  async function renderDashboard() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading voter dashboard...");

    var profileRes = await apiGet("voters/get-profile.php");
    if (!profileRes.ok || !profileRes.json || !profileRes.json.success) {
      showError(main, (profileRes.json && profileRes.json.message) || "Unable to load voter profile.");
      return;
    }

    var electionsRes = await apiGet("voters/get-elections.php", { status: "all", limit: 100 });
    var historyRes = await apiGet("voters/get-voting-history.php", { limit: 100 });

    var profile = (profileRes.json.data && profileRes.json.data.profile) || {};
    var elections = electionsRes.ok && electionsRes.json && electionsRes.json.data ? electionsRes.json.data.items || [] : [];
    var history = historyRes.ok && historyRes.json && historyRes.json.data ? historyRes.json.data.items || [] : [];
    var featured = pickFeaturedElection(elections);
    var action = electionAction(featured);

    var bannerText = dashboardBannerText(featured);
    var bannerTone = dashboardBannerTone(featured);

    main.innerHTML =
      '<div class="max-w-6xl mx-auto p-6 space-y-6">' +
      '<section>' +
      '<p class="text-xs font-bold uppercase tracking-widest text-primary mb-1">Citizen Overview</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold text-on-surface">Welcome, ' + escapeHtml(profile.full_name || "Voter") + "</h1>" +
      "</section>" +
      '<section class="' + fallbackBannerClassByTone(bannerTone) + ' text-white rounded p-4 text-sm font-semibold">' + escapeHtml(bannerText) + "</section>" +
      '<section class="bg-white border border-slate-200 rounded p-6">' +
      '<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">' +
      '<div>' +
      '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-2">Featured Election</p>' +
      '<h2 class="text-2xl font-bold">' + escapeHtml(featured ? featured.title : "No election available") + "</h2>" +
      '<p class="text-slate-600 mt-2">' +
      (featured
        ? escapeHtml(phaseLabel(featured.phase) + " - " + formatDate(featured.start_at) + " to " + formatDate(featured.end_at))
        : "Please check again later.") +
      "</p>" +
      "</div>" +
      '<a class="inline-flex items-center justify-center px-5 py-3 bg-primary text-white font-bold rounded hover:bg-blue-700 transition-colors" href="' + escapeHtml(action.href) + '">' + escapeHtml(action.label) + "</a>" +
      "</div>" +
      "</section>" +
      '<section class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-widest text-slate-500 font-bold">Voter ID</p><p class="mt-2 text-lg font-bold">' + escapeHtml(profile.voter_id || "-") + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-widest text-slate-500 font-bold">Verification</p><p class="mt-2 text-lg font-bold">' + (boolish(profile.is_verified) ? "Verified" : "Pending") + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-widest text-slate-500 font-bold">Ballots Submitted</p><p class="mt-2 text-lg font-bold">' + escapeHtml(history.length) + "</p></div>" +
      "</section>" +
      '<section class="bg-white border border-slate-200 rounded p-6">' +
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">' +
      '<h3 class="text-xl font-bold">Voting History</h3>' +
      '<button id="ovs-dash-download" class="px-4 py-2 border border-slate-300 rounded text-sm font-semibold hover:bg-slate-50 transition-colors">Download Receipts</button>' +
      "</div>" +
      '<div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-slate-200 text-left text-slate-500 uppercase tracking-wider text-xs"><th class="py-2 pr-4">Date</th><th class="py-2 pr-4">Election</th><th class="py-2 pr-4">Status</th><th class="py-2">Receipt</th></tr></thead><tbody id="ovs-dash-history-body"></tbody></table></div>' +
      "</section>" +
      "</div>";

    var historyBody = document.getElementById("ovs-dash-history-body");
    if (!historyBody) return;

    if (!history.length) {
      historyBody.innerHTML = '<tr><td colspan="4" class="py-4 text-slate-500">No ballots submitted yet.</td></tr>';
    } else {
      historyBody.innerHTML = history
        .map(function (row) {
          return (
            '<tr class="border-b border-slate-100">' +
            '<td class="py-3 pr-4">' + escapeHtml(formatDate(row.submitted_at)) + "</td>" +
            '<td class="py-3 pr-4 font-semibold">' + escapeHtml(row.election_title || "-") + "</td>" +
            '<td class="py-3 pr-4"><span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">Verified</span></td>' +
            '<td class="py-3 font-mono text-xs">' + escapeHtml(row.receipt_code || "-") + "</td>" +
            "</tr>"
          );
        })
        .join("");
    }

    var downloadBtn = document.getElementById("ovs-dash-download");
    if (downloadBtn) {
      if (!history.length) {
        downloadBtn.disabled = true;
        downloadBtn.classList.add("opacity-50", "cursor-not-allowed");
      } else {
        downloadBtn.addEventListener("click", function () {
          var rows = [["Date", "Election", "Receipt Code", "Election Status", "Vote Items"]];
          history.forEach(function (row) {
            rows.push([
              formatDateTime(row.submitted_at),
              row.election_title || "",
              row.receipt_code || "",
              row.election_status || "",
              row.vote_items || 0
            ]);
          });
          downloadCsv("voting-history.csv", rows);
        });
      }
    }
  }

  async function renderElections() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading elections...");

    var response = await apiGet("voters/get-elections.php", { status: "all", limit: 200 });
    if (!response.ok || !response.json || !response.json.success) {
      showError(main, (response.json && response.json.message) || "Unable to load elections.");
      return;
    }

    var items = (response.json.data && response.json.data.items) || [];
    var state = { filter: "all", query: "" };

    main.innerHTML =
      '<div class="max-w-7xl mx-auto p-6 space-y-6">' +
      '<header>' +
      '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Civic Duty</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold">Election Ledger</h1>' +
      '<p class="text-slate-600 mt-2">All elections in your jurisdiction, managed from the shared system database.</p>' +
      "</header>" +
      '<section class="bg-white border border-slate-200 rounded p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">' +
      '<div class="flex flex-wrap gap-2" id="ovs-elections-filters">' +
      '<button data-filter="all" class="px-4 py-2 rounded border border-slate-300 text-sm font-semibold">All</button>' +
      '<button data-filter="active" class="px-4 py-2 rounded border border-slate-300 text-sm font-semibold">Active</button>' +
      '<button data-filter="upcoming" class="px-4 py-2 rounded border border-slate-300 text-sm font-semibold">Upcoming</button>' +
      '<button data-filter="closed" class="px-4 py-2 rounded border border-slate-300 text-sm font-semibold">Closed</button>' +
      "</div>" +
      '<input id="ovs-elections-search" class="w-full lg:w-80 border border-slate-300 rounded px-3 py-2 text-sm" placeholder="Search elections..." />' +
      "</section>" +
      '<section id="ovs-elections-cards" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></section>' +
      '<section class="bg-white border border-slate-200 rounded p-4">' +
      '<h2 class="text-lg font-bold mb-3">Archive</h2>' +
      '<div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="text-left border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500"><th class="py-2 pr-4">Title</th><th class="py-2 pr-4">Window</th><th class="py-2 pr-4">Status</th><th class="py-2">Action</th></tr></thead><tbody id="ovs-elections-table-body"></tbody></table></div>' +
      "</section>" +
      "</div>";

    function applyState() {
      var query = String(state.query || "").trim().toLowerCase();
      var filtered = items.filter(function (row) {
        var phase = String(row.phase || "").toLowerCase();
        if (state.filter !== "all" && phase !== state.filter) return false;
        if (!query) return true;
        var text = (String(row.title || "") + " " + String(row.description || "")).toLowerCase();
        return text.indexOf(query) !== -1;
      });

      var cards = document.getElementById("ovs-elections-cards");
      var table = document.getElementById("ovs-elections-table-body");
      if (!cards || !table) return;

      if (!filtered.length) {
        cards.innerHTML = '<div class="col-span-full border border-slate-200 rounded p-4 bg-white text-slate-500">No elections match your filter.</div>';
        table.innerHTML = '<tr><td colspan="4" class="py-3 text-slate-500">No rows found.</td></tr>';
      } else {
        cards.innerHTML = filtered
          .map(function (row) {
            var action = electionAction(row);
            var details = electionDescription(row);
            return (
              '<article class="bg-white border border-slate-200 rounded p-4">' +
              '<div class="flex items-center justify-between mb-3"><span class="inline-flex px-2 py-0.5 rounded text-xs font-bold ' + phaseBadge(row.phase) + '">' + escapeHtml(phaseLabel(row.phase)) + "</span>" +
              (boolish(row.has_voted) ? '<span class="text-xs text-emerald-700 font-semibold">Submitted</span>' : "") +
              "</div>" +
              '<h3 class="text-lg font-bold mb-1">' + escapeHtml(row.title || "Untitled Election") + "</h3>" +
              '<p class="text-sm text-slate-600 mb-3 min-h-[56px]">' + escapeHtml(details) + "</p>" +
              '<div class="grid grid-cols-2 gap-2 text-xs mb-3">' +
              '<div class="rounded border border-slate-200 px-2 py-1"><span class="text-slate-500">Window:</span> <span class="font-semibold">' + escapeHtml(electionWindowText(row)) + "</span></div>" +
              '<div class="rounded border border-slate-200 px-2 py-1"><span class="text-slate-500">Visibility:</span> <span class="font-semibold">' + escapeHtml(String(row.visibility || "public").toUpperCase()) + "</span></div>" +
              '<div class="rounded border border-slate-200 px-2 py-1"><span class="text-slate-500">Positions:</span> <span class="font-semibold">' + escapeHtml(asInt(row.positions_count)) + "</span></div>" +
              '<div class="rounded border border-slate-200 px-2 py-1"><span class="text-slate-500">Candidates:</span> <span class="font-semibold">' + escapeHtml(asInt(row.candidates_count)) + "</span></div>" +
              '<div class="rounded border border-slate-200 px-2 py-1"><span class="text-slate-500">Seats:</span> <span class="font-semibold">' + escapeHtml(asInt(row.seats_total)) + "</span></div>" +
              '<div class="rounded border border-slate-200 px-2 py-1"><span class="text-slate-500">Ballots:</span> <span class="font-semibold">' + escapeHtml(asInt(row.ballots_cast)) + "</span></div>" +
              "</div>" +
              '<a class="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors" href="' + escapeHtml(action.href) + '">' + escapeHtml(action.label) + "</a>" +
              "</article>"
            );
          })
          .join("");

        table.innerHTML = filtered
          .map(function (row) {
            var action = electionAction(row);
              return (
                '<tr class="border-b border-slate-100">' +
                '<td class="py-3 pr-4 font-semibold">' + escapeHtml(row.title || "-") +
                '<div class="text-xs text-slate-500 mt-1">' + escapeHtml(electionDescription(row)) + "</div>" +
                '<div class="text-xs text-slate-500 mt-1">Positions: ' + escapeHtml(asInt(row.positions_count)) + " | Candidates: " + escapeHtml(asInt(row.candidates_count)) + " | Seats: " + escapeHtml(asInt(row.seats_total)) + " | Ballots: " + escapeHtml(asInt(row.ballots_cast)) + "</div>" +
                "</td>" +
                '<td class="py-3 pr-4 text-slate-600">' + escapeHtml(electionWindowText(row)) + "</td>" +
                '<td class="py-3 pr-4"><span class="inline-flex px-2 py-0.5 rounded text-xs font-bold ' + phaseBadge(row.phase) + '">' + escapeHtml(phaseLabel(row.phase)) + "</span></td>" +
                '<td class="py-3"><a class="text-primary font-semibold hover:underline" href="' + escapeHtml(action.href) + '">' + escapeHtml(action.label) + "</a></td>" +
                "</tr>"
              );
            })
          .join("");
      }

      var buttons = document.querySelectorAll("[data-filter]");
      buttons.forEach(function (btn) {
        var active = btn.getAttribute("data-filter") === state.filter;
        btn.classList.toggle("bg-primary", active);
        btn.classList.toggle("text-white", active);
        btn.classList.toggle("border-primary", active);
      });
    }

    var filters = document.getElementById("ovs-elections-filters");
    if (filters) {
      filters.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-filter]");
        if (!btn) return;
        state.filter = String(btn.getAttribute("data-filter") || "all");
        applyState();
      });
    }

    var search = document.getElementById("ovs-elections-search");
    if (search) {
      search.addEventListener("input", function () {
        state.query = search.value || "";
        applyState();
      });
    }

    applyState();
  }

  async function renderElectionDetails() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading election details...");

    var electionId = await resolveElectionId(queryParam("election_id"), false);
    if (!electionId) {
      showError(main, "No election data available.");
      return;
    }

    var response = await apiGet("voters/get-election-details.php", { election_id: electionId });
    if (!response.ok || !response.json || !response.json.success) {
      showError(main, (response.json && response.json.message) || "Unable to load election details.");
      return;
    }

    var payload = response.json.data || {};
    var election = payload.election || {};
    var positions = Array.isArray(payload.positions) ? payload.positions : [];
    var preview = Array.isArray(payload.candidate_preview) ? payload.candidate_preview : [];
    var summary = payload.summary || {};
    var grouped = {};
    preview.forEach(function (row) {
      var key = String(row.position_id || "");
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    });

    function buildPositionTree(list) {
      var map = {};
      var nodes = (list || []).map(function (row) {
        var node = {
          id: asInt(row.id),
          parent_position_id: row.parent_position_id === null || row.parent_position_id === undefined || row.parent_position_id === ""
            ? null
            : asInt(row.parent_position_id),
          title: row.title || "",
          description: row.description || "",
          seat_count: asInt(row.seat_count) || 1,
          sort_order: asInt(row.sort_order),
          candidates_count: asInt(row.candidates_count),
          children: []
        };
        map[node.id] = node;
        return node;
      });

      var roots = [];
      nodes.forEach(function (node) {
        if (node.parent_position_id && map[node.parent_position_id] && node.parent_position_id !== node.id) {
          map[node.parent_position_id].children.push(node);
        } else {
          roots.push(node);
        }
      });

      function sortNodes(items) {
        items.sort(function (a, b) {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
          return String(a.title || "").localeCompare(String(b.title || ""));
        });
        items.forEach(function (item) {
          sortNodes(item.children || []);
        });
      }
      sortNodes(roots);
      return { roots: roots, map: map };
    }

    function flattenTree(roots) {
      var out = [];
      function walk(node, depth) {
        out.push({ node: node, depth: depth });
        (node.children || []).forEach(function (child) {
          walk(child, depth + 1);
        });
      }
      (roots || []).forEach(function (root) {
        walk(root, 0);
      });
      return out;
    }

    var counts = {
      positions: asInt(summary.positions_count) || positions.length,
      candidates: asInt(summary.candidates_count),
      seats: asInt(summary.seats_total),
      ballots: asInt(summary.ballots_cast)
    };
    if (!counts.candidates) {
      counts.candidates = preview.length;
    }
    if (!counts.seats) {
      counts.seats = positions.reduce(function (acc, row) {
        return acc + asInt(row.seat_count);
      }, 0);
    }

    var desc = electionDescription({
      description: election.description,
      phase: election.phase,
      start_at: election.start_at,
      end_at: election.end_at,
      positions_count: counts.positions,
      candidates_count: counts.candidates,
      seats_total: counts.seats,
      ballots_cast: counts.ballots
    });

    var phase = String(election.phase || "").toLowerCase();
    var hasVoted = boolish(election.has_voted);
    var canVote = phase === "active" && !hasVoted;
    var actionHref = "#";
    var actionLabel = "View Elections";
    var actionDisabled = true;

    if (canVote) {
      actionHref = toPath("voter/ballot.html") + "?election_id=" + encodeURIComponent(election.id);
      actionLabel = "Start Ballot";
      actionDisabled = false;
    } else if (phase === "closed") {
      actionHref = toPath("voter/results.html") + "?election_id=" + encodeURIComponent(election.id);
      actionLabel = "View Results";
      actionDisabled = false;
    } else if (phase === "upcoming") {
      actionHref = toPath("voter/elections.html");
      actionLabel = "Voting Not Open Yet";
      actionDisabled = true;
    } else if (phase === "active" && hasVoted) {
      actionHref = toPath("voter/elections.html");
      actionLabel = "Results After Close";
      actionDisabled = true;
    }

    main.innerHTML =
      '<div class="max-w-6xl mx-auto p-6 space-y-6">' +
      '<header class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">' +
      "<div>" +
      '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Election Details</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold">' + escapeHtml(election.title || "Election") + "</h1>" +
      '<p class="text-slate-600 mt-2 max-w-4xl">' + escapeHtml(desc) + "</p>" +
      '<div class="mt-3 flex flex-wrap gap-2 text-xs">' +
      '<span class="inline-flex px-2 py-1 rounded border border-slate-200 bg-white">Window: ' + escapeHtml(electionWindowText(election)) + "</span>" +
      '<span class="inline-flex px-2 py-1 rounded border border-slate-200 bg-white">Status: ' + escapeHtml(phaseLabel(election.phase)) + "</span>" +
      '<span class="inline-flex px-2 py-1 rounded border border-slate-200 bg-white">Visibility: ' + escapeHtml(String(election.visibility || "public").toUpperCase()) + "</span>" +
      (boolish(election.has_voted)
        ? '<span class="inline-flex px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">You already submitted your ballot</span>'
        : "") +
      "</div>" +
      "</div>" +
      '<a class="inline-flex items-center justify-center px-5 py-3 rounded font-semibold transition-colors ' +
      (actionDisabled ? "bg-slate-300 text-slate-600 cursor-not-allowed pointer-events-none" : "bg-primary text-white hover:bg-blue-700") +
      '" href="' + escapeHtml(actionHref) + '">' + escapeHtml(actionLabel) + "</a>" +
      "</header>" +
      '<section class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-wider text-slate-500 font-bold">Positions</p><p class="text-2xl font-extrabold mt-1">' + escapeHtml(counts.positions) + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-wider text-slate-500 font-bold">Candidates</p><p class="text-2xl font-extrabold mt-1">' + escapeHtml(counts.candidates) + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-wider text-slate-500 font-bold">Seats</p><p class="text-2xl font-extrabold mt-1">' + escapeHtml(counts.seats) + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-wider text-slate-500 font-bold">Ballots Cast</p><p class="text-2xl font-extrabold mt-1">' + escapeHtml(counts.ballots) + "</p></div>" +
      "</section>" +
      '<section>' +
      '<h2 class="text-xl font-bold mb-3">Position Hierarchy and Candidate Preview</h2>' +
      '<div id="ovs-details-positions" class="space-y-3"></div>' +
      "</section>" +
      "</div>";

    var host = document.getElementById("ovs-details-positions");
    if (!host) return;

    if (!positions.length) {
      host.innerHTML = '<div class="bg-white border border-slate-200 rounded p-4 text-slate-500">No positions are configured for this election yet.</div>';
      return;
    }

    var tree = buildPositionTree(positions);
    var flat = flattenTree(tree.roots);

    host.innerHTML = flat
      .map(function (entry) {
        var position = entry.node || {};
        var list = grouped[String(position.id || "")] || [];
        var parentName = position.parent_position_id && tree.map[position.parent_position_id]
          ? tree.map[position.parent_position_id].title
          : "";
        var candidatesHtml = list.length
          ? list
              .map(function (candidate) {
                return (
                  '<li class="py-2 border-b border-slate-100 last:border-b-0">' +
                  '<div class="font-semibold">' + escapeHtml(candidate.full_name || "Unnamed candidate") + "</div>" +
                  '<div class="text-xs text-slate-500">' + escapeHtml(candidate.party || "Independent") + "</div>" +
                  "</li>"
                );
              })
              .join("")
          : '<li class="py-2 text-slate-500">No active candidates yet for this position.</li>';

        return (
          '<article class="bg-white border border-slate-200 rounded p-5" style="margin-left:' + ((entry.depth || 0) * 18) + 'px">' +
          '<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">' +
          '<h3 class="text-xl font-bold">' + escapeHtml(position.title || "Position") + "</h3>" +
          '<span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Seats: ' + escapeHtml(position.seat_count || 1) + " | Candidates: " + escapeHtml(list.length || 0) + "</span>" +
          "</div>" +
          (parentName ? '<p class="text-xs text-slate-500 mb-2">Reports to: ' + escapeHtml(parentName) + "</p>" : "") +
          '<p class="text-sm text-slate-600 mb-3">' + escapeHtml(position.description || ("This office is part of the " + (election.title || "election") + " structure.")) + "</p>" +
          '<ul class="text-sm">' + candidatesHtml + "</ul>" +
          "</article>"
        );
      })
      .join("");
  }

  async function renderBallot() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading ballot...");

    var electionId = await resolveElectionId(queryParam("election_id"), true);
    if (!electionId) {
      showError(main, "No active ballot is available right now.");
      return;
    }

    var response = await apiGet("voters/get-ballot.php", { election_id: electionId });
    if (!response.ok || !response.json || !response.json.success) {
      showError(main, (response.json && response.json.message) || "Unable to load ballot.");
      return;
    }

    var payload = response.json.data || {};
    var election = payload.election || {};
    var positions = payload.positions || [];
    var existing = payload.existing_ballot || null;

    if (payload.already_submitted && existing) {
      var redirectUrl =
        toPath("voter/vote-success.html") +
        "?election_id=" + encodeURIComponent(electionId) +
        "&receipt=" + encodeURIComponent(existing.receipt_code || "") +
        "&submitted_at=" + encodeURIComponent(existing.submitted_at || "") +
        "&election_title=" + encodeURIComponent(election.title || "");
      window.location.replace(redirectUrl);
      return;
    }

    if (!positions.length) {
      showError(main, "This election has no ballot positions configured yet.");
      return;
    }

    var state = {
      index: 0,
      selections: {}
    };

    main.innerHTML =
      '<div class="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">' +
      '<section class="lg:col-span-8 bg-white border border-slate-200 rounded p-6">' +
      '<div id="ovs-ballot-main"></div>' +
      '<div id="ovs-ballot-message" class="hidden mt-4"></div>' +
      "</section>" +
      '<aside class="lg:col-span-4 bg-white border border-slate-200 rounded p-6" id="ovs-ballot-side"></aside>' +
      "</div>";

    var mainHost = document.getElementById("ovs-ballot-main");
    var sideHost = document.getElementById("ovs-ballot-side");
    var messageBox = document.getElementById("ovs-ballot-message");

    function selectedCandidate(position) {
      var candidateId = parseNumber(state.selections[position.id], 0);
      return (position.candidates || []).find(function (candidate) {
        return parseNumber(candidate.id, 0) === candidateId;
      }) || null;
    }

    function renderStep() {
      if (!mainHost || !sideHost) return;
      var position = positions[state.index];
      var total = positions.length;
      var selectedId = parseNumber(state.selections[position.id], 0);

      mainHost.innerHTML =
        '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Secure Ballot</p>' +
        '<h1 class="text-2xl md:text-3xl font-extrabold mb-2">' + escapeHtml(election.title || "Election") + "</h1>" +
        '<p class="text-slate-600 mb-6">Position ' + (state.index + 1) + " of " + total + " - " + escapeHtml(position.title || "Position") + "</p>" +
        '<div class="space-y-3" id="ovs-ballot-candidates">' +
        (position.candidates || [])
          .map(function (candidate) {
            var cid = parseNumber(candidate.id, 0);
            var checked = cid === selectedId;
            return (
              '<button data-candidate-id="' + cid + '" class="w-full text-left border rounded p-4 transition-colors ' +
              (checked ? "border-primary bg-blue-50" : "border-slate-200 hover:border-blue-400") +
              '">' +
              '<div class="font-semibold">' + escapeHtml(candidate.full_name || "Candidate") + "</div>" +
              '<div class="text-xs text-slate-500 mt-1">' + escapeHtml(candidate.party || "Independent") + "</div>" +
              "</button>"
            );
          })
          .join("") +
        "</div>" +
        '<div class="mt-6 flex items-center justify-between gap-3">' +
        '<button id="ovs-ballot-prev" class="px-4 py-2 border border-slate-300 rounded font-semibold hover:bg-slate-50 transition-colors"' + (state.index === 0 ? " disabled" : "") + ">Previous</button>" +
        '<button id="ovs-ballot-next" class="px-5 py-2 bg-primary text-white rounded font-semibold hover:bg-blue-700 transition-colors">' + (state.index === total - 1 ? "Submit Ballot" : "Next") + "</button>" +
        "</div>";

      var doneCount = positions.filter(function (row) {
        return parseNumber(state.selections[row.id], 0) > 0;
      }).length;

      sideHost.innerHTML =
        '<h2 class="text-lg font-bold mb-3">Ballot Progress</h2>' +
        '<p class="text-sm text-slate-600 mb-4">' + doneCount + " of " + total + " positions selected</p>" +
        '<ul class="space-y-2">' +
        positions
          .map(function (row, idx) {
            var selected = selectedCandidate(row);
            var active = idx === state.index;
            return (
              '<li class="border rounded p-3 ' + (active ? "border-primary bg-blue-50" : "border-slate-200") + '">' +
              '<div class="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Position ' + (idx + 1) + "</div>" +
              '<div class="font-semibold">' + escapeHtml(row.title || "Position") + "</div>" +
              '<div class="text-xs text-slate-600 mt-1">' + escapeHtml(selected ? selected.full_name : "Not selected") + "</div>" +
              "</li>"
            );
          })
          .join("") +
        "</ul>";

      var candidateButtons = document.querySelectorAll("[data-candidate-id]");
      candidateButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          var cid = parseNumber(button.getAttribute("data-candidate-id"), 0);
          if (cid > 0) {
            state.selections[position.id] = cid;
            hideMessage(messageBox);
            renderStep();
          }
        });
      });

      var prevButton = document.getElementById("ovs-ballot-prev");
      if (prevButton) {
        prevButton.addEventListener("click", function () {
          if (state.index > 0) {
            state.index -= 1;
            hideMessage(messageBox);
            renderStep();
          }
        });
      }

      var nextButton = document.getElementById("ovs-ballot-next");
      if (nextButton) {
        nextButton.addEventListener("click", async function () {
          var selected = parseNumber(state.selections[position.id], 0);
          if (selected <= 0) {
            setMessage(messageBox, "Select a candidate before continuing.", "error");
            return;
          }

          if (state.index < positions.length - 1) {
            state.index += 1;
            hideMessage(messageBox);
            renderStep();
            return;
          }

          var votes = positions.map(function (row) {
            return {
              position_id: parseNumber(row.id, 0),
              candidate_id: parseNumber(state.selections[row.id], 0)
            };
          });

          var incomplete = votes.some(function (vote) {
            return vote.position_id <= 0 || vote.candidate_id <= 0;
          });
          if (incomplete) {
            setMessage(messageBox, "Please complete all positions before submitting.", "error");
            return;
          }

          nextButton.disabled = true;
          nextButton.textContent = "Submitting...";
          var submitRes = await apiPost("voters/submit-vote.php", {
            election_id: parseNumber(electionId, 0),
            votes: votes
          });
          nextButton.disabled = false;
          nextButton.textContent = "Submit Ballot";

          if (!submitRes.ok || !submitRes.json || !submitRes.json.success) {
            setMessage(messageBox, (submitRes.json && submitRes.json.message) || "Unable to submit vote.", "error");
            return;
          }

          var submitted = submitRes.json.data || {};
          try {
            window.localStorage.setItem(
              "ovs_last_vote",
              JSON.stringify({
                election_id: parseNumber(electionId, 0),
                receipt_code: submitted.receipt_code || "",
                submitted_at: submitted.submitted_at || new Date().toISOString(),
                election_title: election.title || ""
              })
            );
          } catch (storageErr) {
            /* ignore storage errors */
          }

          var target =
            toPath("voter/vote-success.html") +
            "?election_id=" + encodeURIComponent(electionId) +
            "&receipt=" + encodeURIComponent(submitted.receipt_code || "") +
            "&submitted_at=" + encodeURIComponent(submitted.submitted_at || "") +
            "&election_title=" + encodeURIComponent(election.title || "");
          window.location.href = target;
        });
      }
    }

    renderStep();
  }

  async function renderResults() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading election results...");

    var electionId = parseNumber(queryParam("election_id"), 0);
    var query = electionId > 0 ? { election_id: electionId } : {};
    var response = await apiGet("voters/get-results.php", query);
    if (!response.ok || !response.json || !response.json.success) {
      if (response.status === 403 && response.json) {
        var pendingMsg = (response.json && response.json.message) || "Results are not available yet.";
        var availableAt = response.json && response.json.meta ? response.json.meta.available_at : "";
        main.innerHTML =
          '<div class="max-w-4xl mx-auto p-6">' +
          '<section class="bg-amber-50 border border-amber-200 rounded p-6">' +
          '<p class="text-xs uppercase tracking-widest text-amber-700 font-bold mb-2">Results Pending</p>' +
          '<h1 class="text-2xl md:text-3xl font-extrabold mb-2">Election Results Are Not Published Yet</h1>' +
          '<p class="text-amber-900 mb-3">' + escapeHtml(pendingMsg) + "</p>" +
          (availableAt
            ? '<p class="text-sm text-amber-800 mb-4">Available after: ' + escapeHtml(formatDateTime(availableAt)) + "</p>"
            : "") +
          '<a class="inline-flex items-center px-4 py-2 bg-primary text-white rounded font-semibold hover:bg-blue-700 transition-colors" href="' + escapeHtml(toPath("voter/elections.html")) + '">Back to Elections</a>' +
          "</section>" +
          "</div>";
        return;
      }
      showError(main, (response.json && response.json.message) || "Unable to load election results.");
      return;
    }

    var payload = response.json.data || {};
    var election = payload.election || {};
    var summary = payload.summary || {};
    var positions = payload.positions || [];

    main.innerHTML =
      '<div class="max-w-6xl mx-auto p-6 space-y-6">' +
      '<header>' +
      '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Official Results</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold">' + escapeHtml(election.title || "Election Results") + "</h1>" +
      '<p class="text-slate-600 mt-2">Generated: ' + escapeHtml(formatDateTime(payload.generated_at)) + "</p>" +
      "</header>" +
      '<section class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-wider text-slate-500 font-bold">Eligible Voters</p><p class="mt-2 text-2xl font-extrabold">' + escapeHtml(summary.eligible_voters || 0) + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-wider text-slate-500 font-bold">Ballots Cast</p><p class="mt-2 text-2xl font-extrabold">' + escapeHtml(summary.ballots_cast || 0) + "</p></div>" +
      '<div class="bg-white border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-wider text-slate-500 font-bold">Turnout</p><p class="mt-2 text-2xl font-extrabold">' + escapeHtml(summary.turnout_percent || 0) + "%</p></div>" +
      "</section>" +
      '<section id="ovs-results-positions" class="space-y-4"></section>' +
      "</div>";

    var host = document.getElementById("ovs-results-positions");
    if (!host) return;

    if (!positions.length) {
      host.innerHTML = '<div class="bg-white border border-slate-200 rounded p-4 text-slate-500">No result rows available yet.</div>';
      return;
    }

    host.innerHTML = positions
      .map(function (position) {
        var candidates = (position.candidates || []).slice().sort(function (a, b) {
          return parseNumber(b.vote_count, 0) - parseNumber(a.vote_count, 0);
        });

        var totalVotes = candidates.reduce(function (sum, candidate) {
          return sum + parseNumber(candidate.vote_count, 0);
        }, 0);

        var rows = candidates.length
          ? candidates
              .map(function (candidate) {
                var votes = parseNumber(candidate.vote_count, 0);
                var pct = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : "0.0";
                var winner = parseNumber(candidate.candidate_id, 0) === parseNumber(position.winner_candidate_id, 0);
                return (
                  '<div class="border rounded p-3 ' + (winner ? "border-emerald-300 bg-emerald-50" : "border-slate-200") + '">' +
                  '<div class="flex items-center justify-between gap-3 mb-2">' +
                  '<div><div class="font-semibold">' + escapeHtml(candidate.candidate_name || "Candidate") + "</div><div class=\"text-xs text-slate-500\">" + escapeHtml(candidate.party || "Independent") + "</div></div>" +
                  '<div class="text-right"><div class="font-bold">' + escapeHtml(votes) + '</div><div class="text-xs text-slate-500">' + escapeHtml(pct) + "%</div></div>" +
                  "</div>" +
                  '<div class="w-full h-2 bg-slate-200 rounded"><div class="h-2 rounded bg-primary" style="width:' + escapeHtml(pct) + '%"></div></div>' +
                  (winner ? '<div class="text-xs font-bold text-emerald-700 mt-2">Winner</div>' : "") +
                  "</div>"
                );
              })
              .join("")
          : '<div class="text-sm text-slate-500">No candidates for this position.</div>';

        return (
          '<article class="bg-white border border-slate-200 rounded p-4">' +
          '<h2 class="text-xl font-bold mb-3">' + escapeHtml(position.position_title || "Position") + "</h2>" +
          rows +
          "</article>"
        );
      })
      .join("");
  }

  async function renderProfile() {
    var main = getMain();
    if (!main) return;
    showLoading(main, "Loading profile...");

    var profileRes = await apiGet("voters/get-profile.php");
    if (!profileRes.ok || !profileRes.json || !profileRes.json.success) {
      showError(main, (profileRes.json && profileRes.json.message) || "Unable to load profile.");
      return;
    }

    var historyRes = await apiGet("voters/get-voting-history.php", { limit: 5 });
    var profile = (profileRes.json.data && profileRes.json.data.profile) || {};
    var history = historyRes.ok && historyRes.json && historyRes.json.data ? historyRes.json.data.items || [] : [];
    var lastActivity = history.length ? history[0].submitted_at : null;

    main.innerHTML =
      '<div class="max-w-5xl mx-auto p-6 space-y-6">' +
      "<header>" +
      '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Identity Ledger</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold">Citizen Profile</h1>' +
      '<p class="text-slate-600 mt-2">Manage your voter information used by the secure voting system.</p>' +
      "</header>" +
      '<section class="grid grid-cols-1 lg:grid-cols-3 gap-4">' +
      '<article class="bg-white border border-slate-200 rounded p-4 lg:col-span-1">' +
      '<h2 class="font-bold text-lg">' + escapeHtml(profile.full_name || "Voter") + "</h2>" +
      '<p class="text-sm text-slate-600 mt-1">Voter ID: ' + escapeHtml(profile.voter_id || "-") + "</p>" +
      '<p class="text-sm text-slate-600 mt-1">Status: ' + escapeHtml(String(profile.status || "").toUpperCase()) + "</p>" +
      '<p class="text-sm text-slate-600 mt-1">Verified: ' + (boolish(profile.is_verified) ? "Yes" : "No") + "</p>" +
      '<p class="text-sm text-slate-600 mt-1">Registered: ' + escapeHtml(formatDate(profile.created_at)) + "</p>" +
      '<p class="text-sm text-slate-600 mt-1">Last vote: ' + escapeHtml(lastActivity ? formatDate(lastActivity) : "No record yet") + "</p>" +
      "</article>" +
      '<article class="bg-white border border-slate-200 rounded p-4 lg:col-span-2">' +
      '<h2 class="font-bold text-lg mb-4">Edit Profile</h2>' +
      '<form id="ovs-profile-form" class="space-y-4">' +
      '<div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Full Name</label><input id="ovs-profile-name" class="w-full border border-slate-300 rounded px-3 py-2" /></div>' +
      '<div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Email</label><input id="ovs-profile-email" type="email" class="w-full border border-slate-300 rounded px-3 py-2" /></div>' +
      '<div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Phone</label><input id="ovs-profile-phone" class="w-full border border-slate-300 rounded px-3 py-2" /></div>' +
      '<div><label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Voter ID</label><input id="ovs-profile-voter-id" class="w-full border border-slate-200 bg-slate-100 rounded px-3 py-2" readonly /></div>' +
      '<div id="ovs-profile-msg" class="hidden"></div>' +
      '<div class="flex justify-end"><button id="ovs-profile-save" class="px-5 py-2 bg-primary text-white rounded font-semibold hover:bg-blue-700 transition-colors" type="submit">Save Changes</button></div>' +
      "</form>" +
      "</article>" +
      "</section>" +
      "</div>";

    var nameInput = document.getElementById("ovs-profile-name");
    var emailInput = document.getElementById("ovs-profile-email");
    var phoneInput = document.getElementById("ovs-profile-phone");
    var voterInput = document.getElementById("ovs-profile-voter-id");
    var form = document.getElementById("ovs-profile-form");
    var msg = document.getElementById("ovs-profile-msg");
    var saveButton = document.getElementById("ovs-profile-save");

    if (!nameInput || !emailInput || !phoneInput || !voterInput || !form || !msg || !saveButton) {
      return;
    }

    nameInput.value = profile.full_name || "";
    emailInput.value = profile.email || "";
    phoneInput.value = profile.phone || "";
    voterInput.value = profile.voter_id || "";

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      hideMessage(msg);

      var payload = {
        full_name: String(nameInput.value || "").trim(),
        email: String(emailInput.value || "").trim(),
        phone: String(phoneInput.value || "").trim()
      };

      if (!payload.full_name || !payload.email) {
        setMessage(msg, "Full name and email are required.", "error");
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
      var updateRes = await apiPost("voters/update-profile.php", payload);
      saveButton.disabled = false;
      saveButton.textContent = "Save Changes";

      if (!updateRes.ok || !updateRes.json || !updateRes.json.success) {
        setMessage(msg, (updateRes.json && updateRes.json.message) || "Unable to update profile.", "error");
        return;
      }

      var updated = updateRes.json.data && updateRes.json.data.profile ? updateRes.json.data.profile : null;
      if (updated) {
        nameInput.value = updated.full_name || "";
        emailInput.value = updated.email || "";
        phoneInput.value = updated.phone || "";
        voterInput.value = updated.voter_id || "";
      }

      setMessage(msg, "Profile updated successfully.", "success");
    });
  }

  async function renderSettings() {
    var main = getMain();
    if (!main) return;

    var profileRes = await apiGet("voters/get-profile.php");
    var profile = profileRes.ok && profileRes.json && profileRes.json.data ? profileRes.json.data.profile || {} : {};

    var defaults = {
      email_notifications: true,
      sms_alerts: false,
      app_announcements: true,
      strict_verification: true
    };

    try {
      var saved = JSON.parse(window.localStorage.getItem("ovs_voter_settings") || "{}");
      defaults = Object.assign(defaults, saved || {});
    } catch (err) {
      /* ignore */
    }

    main.innerHTML =
      '<div class="max-w-4xl mx-auto p-6 space-y-6">' +
      "<header>" +
      '<p class="text-xs uppercase tracking-widest text-primary font-bold mb-1">Account Security</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold">Voter Settings</h1>' +
      '<p class="text-slate-600 mt-2">Settings are tied to your voter account session.</p>' +
      "</header>" +
      '<section class="bg-white border border-slate-200 rounded p-4">' +
      '<h2 class="font-bold text-lg mb-3">Notification Preferences</h2>' +
      '<div class="space-y-3">' +
      '<label class="flex items-center justify-between gap-3"><span>Email notifications</span><input id="ovs-set-email" type="checkbox"></label>' +
      '<label class="flex items-center justify-between gap-3"><span>SMS alerts</span><input id="ovs-set-sms" type="checkbox"></label>' +
      '<label class="flex items-center justify-between gap-3"><span>Platform announcements</span><input id="ovs-set-app" type="checkbox"></label>' +
      '<label class="flex items-center justify-between gap-3"><span>Strict verification</span><input id="ovs-set-strict" type="checkbox"></label>' +
      "</div>" +
      '<div id="ovs-set-msg" class="hidden mt-3"></div>' +
      '<div class="mt-4 flex flex-wrap gap-3">' +
      '<button id="ovs-set-save" class="px-4 py-2 bg-primary text-white rounded font-semibold hover:bg-blue-700 transition-colors">Save Preferences</button>' +
      '<a class="px-4 py-2 border border-slate-300 rounded font-semibold hover:bg-slate-50 transition-colors" href="' + escapeHtml(toPath("forgot-password.html")) + '">Change Password</a>' +
      "</div>" +
      "</section>" +
      '<section class="bg-white border border-slate-200 rounded p-4">' +
      '<h2 class="font-bold text-lg mb-2">Current Session</h2>' +
      '<p class="text-sm text-slate-600">User: ' + escapeHtml(profile.full_name || "Voter") + " (" + escapeHtml(profile.email || "-") + ")</p>" +
      '<p class="text-sm text-slate-600">Voter ID: ' + escapeHtml(profile.voter_id || "-") + "</p>" +
      "</section>" +
      "</div>";

    var emailToggle = document.getElementById("ovs-set-email");
    var smsToggle = document.getElementById("ovs-set-sms");
    var appToggle = document.getElementById("ovs-set-app");
    var strictToggle = document.getElementById("ovs-set-strict");
    var saveBtn = document.getElementById("ovs-set-save");
    var msg = document.getElementById("ovs-set-msg");

    if (!emailToggle || !smsToggle || !appToggle || !strictToggle || !saveBtn || !msg) return;

    emailToggle.checked = !!defaults.email_notifications;
    smsToggle.checked = !!defaults.sms_alerts;
    appToggle.checked = !!defaults.app_announcements;
    strictToggle.checked = !!defaults.strict_verification;

    saveBtn.addEventListener("click", function () {
      var payload = {
        email_notifications: !!emailToggle.checked,
        sms_alerts: !!smsToggle.checked,
        app_announcements: !!appToggle.checked,
        strict_verification: !!strictToggle.checked
      };
      try {
        window.localStorage.setItem("ovs_voter_settings", JSON.stringify(payload));
      } catch (err) {
        setMessage(msg, "Unable to save settings in this browser.", "error");
        return;
      }
      setMessage(msg, "Preferences saved successfully.", "success");
    });
  }

  async function renderVoteSuccess() {
    var main = getMain();
    if (!main) return;

    var electionId = parseNumber(queryParam("election_id"), 0);
    var receipt = queryParam("receipt") || "";
    var submittedAt = queryParam("submitted_at") || "";
    var title = queryParam("election_title") || "";

    if ((!receipt || !submittedAt) && electionId > 0) {
      var historyRes = await apiGet("voters/get-voting-history.php", { limit: 200 });
      if (historyRes.ok && historyRes.json && historyRes.json.success) {
        var history = (historyRes.json.data && historyRes.json.data.items) || [];
        var found = history.find(function (row) {
          return parseNumber(row.election_id, 0) === electionId;
        });
        if (found) {
          receipt = receipt || String(found.receipt_code || "");
          submittedAt = submittedAt || String(found.submitted_at || "");
          title = title || String(found.election_title || "");
        }
      }
    }

    if (!receipt) {
      try {
        var cached = JSON.parse(window.localStorage.getItem("ovs_last_vote") || "{}");
        receipt = receipt || String(cached.receipt_code || "");
        submittedAt = submittedAt || String(cached.submitted_at || "");
        title = title || String(cached.election_title || "");
      } catch (err) {
        /* ignore */
      }
    }

    if (!submittedAt) {
      submittedAt = new Date().toISOString();
    }

    main.innerHTML =
      '<div class="max-w-4xl mx-auto p-6 space-y-6">' +
      '<section class="bg-white border border-slate-200 rounded p-6">' +
      '<p class="text-xs uppercase tracking-widest text-emerald-700 font-bold mb-2">Transaction Finalized</p>' +
      '<h1 class="text-3xl md:text-4xl font-extrabold mb-3">Ballot Successfully Cast</h1>' +
      '<p class="text-slate-600">Your vote was recorded in the secure ledger.</p>' +
      '<div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">' +
      '<div class="border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-wider text-slate-500 font-bold">Election</p><p class="mt-2 font-semibold">' + escapeHtml(title || "Election") + "</p></div>" +
      '<div class="border border-slate-200 rounded p-4"><p class="text-xs uppercase tracking-wider text-slate-500 font-bold">Submitted At</p><p class="mt-2 font-semibold">' + escapeHtml(formatDateTime(submittedAt)) + "</p></div>" +
      '<div class="border border-slate-200 rounded p-4 md:col-span-2"><p class="text-xs uppercase tracking-wider text-slate-500 font-bold">Receipt Code</p><p class="mt-2 font-mono text-lg">' + escapeHtml(receipt || "Not available") + "</p></div>" +
      "</div>" +
      '<div class="mt-6 flex flex-wrap gap-3">' +
      '<button id="ovs-success-download" class="px-4 py-2 bg-primary text-white rounded font-semibold hover:bg-blue-700 transition-colors">Download Receipt</button>' +
      '<a class="px-4 py-2 border border-slate-300 rounded font-semibold hover:bg-slate-50 transition-colors" href="' + escapeHtml(toPath("voter/dashboard.html")) + '">Back to Dashboard</a>' +
      (electionId > 0
        ? '<a class="px-4 py-2 border border-slate-300 rounded font-semibold hover:bg-slate-50 transition-colors" href="' + escapeHtml(toPath("voter/election-details.html") + "?election_id=" + electionId) + '">Election Details</a>'
        : "") +
      "</div>" +
      "</section>" +
      "</div>";

    var downloadBtn = document.getElementById("ovs-success-download");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", function () {
        var content =
          "Civic Ledger Receipt\n" +
          "Election: " + (title || "Election") + "\n" +
          "Receipt Code: " + (receipt || "N/A") + "\n" +
          "Submitted At: " + formatDateTime(submittedAt) + "\n";
        var blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "vote-receipt.txt";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      });
    }
  }

  async function initVoterPages() {
    var info = pageInfo();
    if (String(info.section || "").toLowerCase() !== "voter") {
      return;
    }

    var file = String(info.file || "").toLowerCase();
    if (file === "dashboard.html") {
      await hydrateStitchDashboard();
      return;
    }
    if (file === "elections.html") {
      await renderElections();
      return;
    }
    if (file === "election-details.html") {
      await renderElectionDetails();
      return;
    }
    if (file === "ballot.html") {
      await renderBallot();
      return;
    }
    if (file === "results.html") {
      await renderResults();
      return;
    }
    if (file === "profile.html") {
      await renderProfile();
      return;
    }
    if (file === "settings.html") {
      await renderSettings();
      return;
    }
    if (file === "vote-success.html") {
      await renderVoteSuccess();
      return;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initVoterPages().catch(function (err) {
      var main = getMain();
      if (!main) return;
      showError(main, "Voter page initialization failed: " + (err && err.message ? err.message : "Unknown error"));
    });
  });
})();
