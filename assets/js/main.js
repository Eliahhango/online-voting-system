(function () {
  function textOf(el) {
    return (el && el.textContent ? el.textContent : "").trim().toLowerCase();
  }

  function utils() {
    return window.OVSUtils || {};
  }

  function pageInfo() {
    if (typeof utils().pageInfo === "function") {
      return utils().pageInfo();
    }
    return { section: "public", file: "", isAuthPage: false };
  }

  function toPath(target) {
    if (typeof utils().toFrontendPath === "function") {
      return utils().toFrontendPath(target);
    }
    return target;
  }

  function toBackend(target) {
    if (typeof utils().toBackendPath === "function") {
      return utils().toBackendPath(target);
    }
    return "../backend/" + String(target || "").replace(/^\/+/, "");
  }

  async function fetchJson(endpoint, query, includeCredentials) {
    var absolute = new URL(toBackend(endpoint), window.location.href);
    if (query) {
      Object.keys(query).forEach(function (key) {
        var value = query[key];
        if (value === null || value === undefined || value === "") {
          return;
        }
        absolute.searchParams.set(key, String(value));
      });
    }

    try {
      var res = await fetch(absolute.toString(), {
        method: "GET",
        credentials: includeCredentials ? "include" : "same-origin",
        headers: { Accept: "application/json" }
      });
      var json = null;
      try {
        json = await res.json();
      } catch (e) {
        json = null;
      }
      return { ok: res.ok, status: res.status, json: json };
    } catch (err) {
      return { ok: false, status: 0, json: null };
    }
  }

  async function fetchSession() {
    try {
      var res = await fetch(toBackend("auth/get-session.php"), {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });

      if (!res.ok) {
        return null;
      }

      var json = await res.json();
      return json && json.data ? json.data : null;
    } catch (err) {
      return null;
    }
  }

  function nextTarget() {
    var params = new URLSearchParams(window.location.search || "");
    var next = params.get("next");
    if (!next) {
      return null;
    }
    if (next.indexOf("/frontend/") === -1) {
      return null;
    }
    return next;
  }

  function roleDashboard(role) {
    return role === "admin" ? toPath("admin/dashboard.html") : toPath("voter/dashboard.html");
  }

  function redirectToLoginWithNext(info) {
    var loginUrl = new URL(toPath("login.html"), window.location.href);
    loginUrl.searchParams.set("next", window.location.pathname + window.location.search);
    if (info && (info.section === "admin" || info.section === "voter")) {
      loginUrl.searchParams.set("portal", info.section);
    }
    window.location.replace(loginUrl.toString());
  }

  function redirectToRoleDashboard(role) {
    window.location.replace(roleDashboard(role || "voter"));
  }

  function authState(session) {
    if (!session || !session.authenticated || !session.user) {
      return { authenticated: false, role: null, user: null };
    }

    return {
      authenticated: true,
      role: session.user.role || null,
      user: session.user
    };
  }

  async function enforceAccess(info) {
    var state = authState(await fetchSession());
    window.__OVS_SESSION__ = state;

    var protectedSection = info.section === "voter" || info.section === "admin";

    if (protectedSection && !state.authenticated) {
      redirectToLoginWithNext(info);
      return { stop: true, state: state };
    }

    if (protectedSection && state.authenticated && state.role !== info.section) {
      redirectToRoleDashboard(state.role || "voter");
      return { stop: true, state: state };
    }

    if (info.isAuthPage && state.authenticated) {
      var next = nextTarget();
      if (next) {
        window.location.replace(next);
      } else {
        redirectToRoleDashboard(state.role || "voter");
      }
      return { stop: true, state: state };
    }

    return { stop: false, state: state };
  }

  function link(label, href) {
    return '<a class="ovs-nav-link" href="' + href + '">' + label + "</a>";
  }

  function firstTopLevelTag(tagName) {
    if (!document.body) {
      return null;
    }

    var target = String(tagName || "").toUpperCase();
    var children = document.body.children || [];
    for (var i = 0; i < children.length; i += 1) {
      if ((children[i].tagName || "").toUpperCase() === target) {
        return children[i];
      }
    }

    return document.querySelector(tagName);
  }

  function firstTopLevelAny(tags) {
    if (!document.body || !tags || !tags.length) {
      return null;
    }

    var children = document.body.children || [];
    var normalized = tags.map(function (tag) {
      return String(tag || "").toUpperCase();
    });

    for (var i = 0; i < children.length; i += 1) {
      var childTag = String(children[i].tagName || "").toUpperCase();
      if (normalized.indexOf(childTag) !== -1) {
        return children[i];
      }
    }

    for (var j = 0; j < tags.length; j += 1) {
      var hit = document.querySelector(tags[j]);
      if (hit) {
        return hit;
      }
    }

    return null;
  }

  function looksLikeLegacyTopBar(node) {
    if (!node) {
      return false;
    }

    var tag = String(node.tagName || "").toLowerCase();
    if (tag !== "header" && tag !== "nav") {
      return false;
    }

    var cls = String(node.className || "").toLowerCase();
    if (cls.indexOf("ovs-header") !== -1) {
      return false;
    }

    var markers = ["fixed", "sticky", "top-0", "h-16", "backdrop-blur"];
    for (var i = 0; i < markers.length; i += 1) {
      if (cls.indexOf(markers[i]) !== -1) {
        return true;
      }
    }

    try {
      var computed = window.getComputedStyle ? window.getComputedStyle(node) : null;
      if (computed && (computed.position === "fixed" || computed.position === "sticky")) {
        return true;
      }
    } catch (e) {
      /* ignore style lookup errors */
    }

    return false;
  }

  function removeLegacyTopBars(activeHeader) {
    if (!document.body) {
      return;
    }

    var children = Array.prototype.slice.call(document.body.children || []);
    children.forEach(function (node) {
      if (node === activeHeader) {
        return;
      }
      if (looksLikeLegacyTopBar(node)) {
        node.remove();
      }
    });
  }

  function createElement(html) {
    var wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    return wrap.firstElementChild;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function headerTemplate(info, state) {
    var section = info.section;
    var nav = "";
    var right = "";

    if (section === "voter") {
      nav = [
        link("Dashboard", toPath("voter/dashboard.html")),
        link("Elections", toPath("voter/elections.html")),
        link("Ballot", toPath("voter/ballot.html")),
        link("Results", toPath("voter/results.html")),
        link("Profile", toPath("voter/profile.html")),
        link("Settings", toPath("voter/settings.html"))
      ].join("");
      right = '<button type="button" class="ovs-btn-link" data-ovs-logout>Logout</button>';
    } else if (section === "admin") {
      nav = [
        link("Dashboard", toPath("admin/dashboard.html")),
        link("Elections", toPath("admin/elections.html")),
        link("Positions", toPath("admin/positions.html")),
        link("Candidates", toPath("admin/candidates.html")),
        link("Voters", toPath("admin/voters.html")),
        link("Results", toPath("admin/results.html")),
        link("Reports", toPath("admin/reports.html")),
        link("Settings", toPath("admin/settings.html"))
      ].join("");
      right = '<button type="button" class="ovs-btn-link" data-ovs-logout>Logout</button>';
    } else {
      nav = [
        link("Home", toPath("index.html")),
        link("About", toPath("about.html")),
        link("How It Works", toPath("how-it-works.html")),
        link("Contact", toPath("contact.html"))
      ].join("");

      if (state.authenticated) {
        right =
          link("Dashboard", roleDashboard(state.role || "voter")) +
          '<button type="button" class="ovs-btn-link" data-ovs-logout>Logout</button>';
      } else {
        right = link("Login", toPath("login.html")) + link("Sign Up", toPath("signup.html"));
      }
    }

    var badge = "";
    if (state.authenticated && state.user) {
      badge = '<span class="ovs-user-badge">' + (state.user.full_name || state.user.email || "User") + "</span>";
    }

    return (
      '<header class="ovs-header">' +
      '<div class="ovs-header-inner">' +
      '<a class="ovs-brand" href="' + toPath("index.html") + '">Civic Ledger</a>' +
      '<nav class="ovs-nav">' + nav + "</nav>" +
      '<div class="ovs-header-right">' + badge + right + "</div>" +
      "</div>" +
      "</header>"
    );
  }

  function footerTemplate() {
    return (
      '<footer class="ovs-footer">' +
      '<div class="ovs-footer-inner">' +
      '<div class="ovs-footer-left">&copy; ' + new Date().getFullYear() + " Civic Ledger. National Election Authority.</div>" +
      '<div class="ovs-footer-links">' +
      '<a href="' + toPath("about.html") + '">About</a>' +
      '<a href="' + toPath("contact.html") + '">Support</a>' +
      '<a href="' + toPath("how-it-works.html") + '">Security</a>' +
      "</div>" +
      "</div>" +
      "</footer>"
    );
  }

  function adminActiveTab(file) {
    var f = String(file || "").toLowerCase();
    if (f === "dashboard.html") return "dashboard";
    if (f === "elections.html" || f === "create-election.html" || f === "edit-election.html") return "elections";
    if (f === "positions.html" || f === "create-position.html") return "positions";
    if (f === "candidates.html" || f === "add-candidate.html") return "candidates";
    if (f === "voters.html" || f === "add-voter.html") return "voters";
    if (f === "results.html") return "results";
    if (f === "reports.html") return "reports";
    if (f === "settings.html" || f === "profile.html") return "settings";
    return "";
  }

  function adminTopLink(label, href, active) {
    return '<a class="ovs-admin-top-link' + (active ? " is-active" : "") + '" href="' + href + '">' + label + "</a>";
  }

  function adminSideLink(icon, label, href, active) {
    return (
      '<a class="ovs-admin-side-link' + (active ? " is-active" : "") + '" href="' + href + '">' +
      '<span class="material-symbols-outlined">' + icon + "</span>" +
      '<span>' + label + "</span>" +
      "</a>"
    );
  }

  function adminTopTemplate(info, state) {
    var active = adminActiveTab(info.file);
    var userName = state && state.user ? state.user.full_name || state.user.email || "System Admin" : "System Admin";

    return (
      '<header class="ovs-admin-top">' +
      '<div class="ovs-admin-top-inner">' +
      '<a class="ovs-admin-brand" href="' + toPath("admin/dashboard.html") + '">Civic Ledger</a>' +
      '<nav class="ovs-admin-top-nav">' +
      adminTopLink("Dashboard", toPath("admin/dashboard.html"), active === "dashboard") +
      adminTopLink("Elections", toPath("admin/elections.html"), active === "elections") +
      adminTopLink("Positions", toPath("admin/positions.html"), active === "positions") +
      adminTopLink("Candidates", toPath("admin/candidates.html"), active === "candidates") +
      adminTopLink("Voters", toPath("admin/voters.html"), active === "voters") +
      adminTopLink("Results", toPath("admin/results.html"), active === "results") +
      adminTopLink("Reports", toPath("admin/reports.html"), active === "reports") +
      adminTopLink("Settings", toPath("admin/settings.html"), active === "settings") +
      "</nav>" +
      '<div class="ovs-admin-top-right">' +
      '<span class="ovs-admin-user-pill">' + escapeHtml(userName) + "</span>" +
      '<button type="button" class="ovs-admin-logout-btn" data-ovs-logout>Logout</button>' +
      "</div>" +
      "</div>" +
      "</header>"
    );
  }

  function adminSideTemplate(info) {
    var active = adminActiveTab(info.file);
    var dashboardActive = active === "dashboard";
    var electionsActive = active === "elections";
    var positionsActive = active === "positions";
    var candidatesActive = active === "candidates";
    var voterActive = active === "voters";
    var candidateMgmtActive = active === "candidates";
    var electionReportsActive = active === "results";
    var systemAuditActive = active === "reports";
    var settingsActive = active === "settings";
    var activeBallotsActive = active === "elections";
    var historyActive = active === "reports";
    var securityCenterActive = active === "settings";

    return (
      '<aside class="ovs-admin-side">' +
      '<div class="ovs-admin-side-head">' +
      '<div class="ovs-admin-side-title">ELECTION COMMAND</div>' +
      '<div class="ovs-admin-side-subtitle">OFFICIAL LEDGER NODE</div>' +
      "</div>" +
      '<nav class="ovs-admin-side-nav">' +
      adminSideLink("dashboard", "Dashboard", toPath("admin/dashboard.html"), dashboardActive) +
      adminSideLink("ballot", "Elections", toPath("admin/elections.html"), electionsActive) +
      adminSideLink("assignment_ind", "Positions", toPath("admin/positions.html"), positionsActive) +
      adminSideLink("person_search", "Candidates", toPath("admin/candidates.html"), candidatesActive) +
      adminSideLink("group", "Voter Registry", toPath("admin/voters.html"), voterActive) +
      adminSideLink("person_check", "Candidate Management", toPath("admin/candidates.html"), candidateMgmtActive) +
      adminSideLink("query_stats", "Election Reports", toPath("admin/results.html"), electionReportsActive) +
      adminSideLink("verified_user", "System Audit", toPath("admin/reports.html"), systemAuditActive) +
      adminSideLink("settings", "Settings", toPath("admin/settings.html"), settingsActive) +
      adminSideLink("how_to_vote", "Active Ballots", toPath("admin/elections.html"), activeBallotsActive) +
      adminSideLink("history", "History", toPath("admin/reports.html"), historyActive) +
      adminSideLink("shield", "Security Center", toPath("admin/settings.html"), securityCenterActive) +
      adminSideLink("support_agent", "Support", toPath("contact.html"), false) +
      "</nav>" +
      '<div class="ovs-admin-side-foot">' +
      '<div class="ovs-admin-cycle-card">' +
      '<div class="ovs-admin-cycle-label">ACTIVE CYCLE</div>' +
      '<div class="ovs-admin-cycle-title">2024 General Municipal Election</div>' +
      '<a class="ovs-admin-cycle-btn" href="' + toPath("admin/create-election.html") + '">New Election Cycle</a>' +
      "</div>" +
      "</div>" +
      "</aside>"
    );
  }

  function applyAdminLayout(info, state) {
    var children = Array.prototype.slice.call(document.body.children || []);
    children.forEach(function (node) {
      var tag = String(node.tagName || "").toUpperCase();
      if (tag !== "HEADER" && tag !== "NAV" && tag !== "ASIDE") {
        return;
      }
      if (node.classList.contains("ovs-admin-top") || node.classList.contains("ovs-admin-side")) {
        return;
      }
      node.remove();
    });

    var oldAdminTop = document.querySelector(".ovs-admin-top");
    var oldAdminSide = document.querySelector(".ovs-admin-side");
    if (oldAdminTop) oldAdminTop.remove();
    if (oldAdminSide) oldAdminSide.remove();

    var top = createElement(adminTopTemplate(info, state));
    var side = createElement(adminSideTemplate(info));

    if (document.body.firstChild) {
      document.body.insertBefore(side, document.body.firstChild);
      document.body.insertBefore(top, document.body.firstChild);
    } else {
      document.body.appendChild(top);
      document.body.appendChild(side);
    }

    var main = document.querySelector("main");
    if (main) {
      main.classList.add("ovs-admin-main");
    }

    document.body.classList.add("ovs-admin-shell");
  }

  function applySharedLayout(info, state) {
    if (info.section === "admin") {
      applyAdminLayout(info, state);
      return;
    }
    var oldHeader = firstTopLevelAny(["header", "nav"]);
    var oldFooter = firstTopLevelTag("footer");

    var newHeader = createElement(headerTemplate(info, state));
    var newFooter = createElement(footerTemplate());

    if (oldHeader) {
      oldHeader.replaceWith(newHeader);
    } else if (document.body.firstChild) {
      document.body.insertBefore(newHeader, document.body.firstChild);
    } else {
      document.body.appendChild(newHeader);
    }

    // Keep page-specific Stitch footer when present.
    if (!oldFooter) {
      document.body.appendChild(newFooter);
    }

    removeLegacyTopBars(newHeader);
  }

  function resolvePlaceholderLink(label, section) {
    if (!label) {
      return null;
    }

    var isAdmin = section === "admin";

    if (/home|landing/.test(label)) return "index.html";
    if (/about/.test(label)) return "about.html";
    if (/how.*work|security/.test(label)) return "how-it-works.html";
    if (/contact|help|support/.test(label)) return "contact.html";
    if (/privacy|terms|legal|accessibility/.test(label)) return "about.html";
    if (/security logs?|security audit|audit trail|audit protocols|review queue|access logs?|view statistics|system override/.test(label)) {
      return isAdmin ? "admin/reports.html" : "how-it-works.html";
    }
    if (/registry/.test(label) && isAdmin) return "admin/voters.html";
    if (/full calendar/.test(label)) return isAdmin ? "admin/elections.html" : "voter/elections.html";
    if (/full voter guide|how to find your voter id/.test(label)) return "how-it-works.html";
    if (/contact system administrator|contact registry support/.test(label)) return "contact.html";

    if (/voter login|\blogin\b|sign in/.test(label)) return "login.html";
    if (/sign up|signup|register/.test(label)) return "signup.html";
    if (/forgot password/.test(label)) return "forgot-password.html";
    if (/reset password/.test(label)) return "reset-password.html";

    if (/dashboard/.test(label)) return section === "admin" ? "admin/dashboard.html" : "voter/dashboard.html";
    if (/\belections?\b|calendar/.test(label)) return section === "admin" ? "admin/elections.html" : "voter/elections.html";
    if (/active ballots?/.test(label)) return "voter/elections.html";
    if (/\bballot\b|begin voting|open ballot|start ballot/.test(label)) return "voter/ballot.html";
    if (/\bhistory\b/.test(label)) return "voter/results.html";
    if (/security center/.test(label)) return section === "admin" ? "admin/settings.html" : "voter/settings.html";
    if (/\bresults?\b/.test(label)) return section === "admin" ? "admin/results.html" : "voter/results.html";
    if (/\bprofile\b/.test(label)) return section === "admin" ? "admin/profile.html" : "voter/profile.html";
    if (/\bsettings\b/.test(label)) return section === "admin" ? "admin/settings.html" : "voter/settings.html";
    if (/\breports?\b/.test(label)) return "admin/reports.html";
    if (/\bcandidates?\b/.test(label)) return "admin/candidates.html";
    if (/\bvoters?\b|voter registry/.test(label)) return "admin/voters.html";
    if (/\bpositions?\b/.test(label)) return "admin/positions.html";
    if (/create election/.test(label)) return "admin/create-election.html";
    if (/edit election/.test(label)) return "admin/edit-election.html";
    if (/create position/.test(label)) return "admin/create-position.html";
    if (/add candidate/.test(label)) return "admin/add-candidate.html";
    if (/add voter/.test(label)) return "admin/add-voter.html";

    return null;
  }

  function wirePlaceholderAnchors(info) {
    var section = info.section;
    var anchors = document.querySelectorAll('a[href="#"], a[href=""], a[href="javascript:void(0)"]');
    anchors.forEach(function (a) {
      var target = resolvePlaceholderLink(textOf(a), section);
      if (target) {
        a.setAttribute("href", toPath(target));
      }
    });
  }

  function resolveSafeButtonTarget(label, section) {
    if (!label) {
      return null;
    }

    if (/register to vote|register now|create account|sign up|signup/.test(label)) return "signup.html";
    if (/login|sign in/.test(label)) return "login.html";
    if (/view elections|active ballots/.test(label)) return "voter/elections.html";
    if (/open ballot|begin voting|start ballot/.test(label)) return "voter/ballot.html";
    if (/history/.test(label)) return "voter/results.html";
    if (/security center|security protocol|view security/.test(label)) return section === "admin" ? "admin/settings.html" : "voter/settings.html";
    if (/contact support|support/.test(label)) return "contact.html";
    if (/download all receipts|download receipts/.test(label)) return null;
    if (/view results/.test(label)) return section === "admin" ? "admin/results.html" : "voter/results.html";
    if (/open dashboard|go to dashboard/.test(label)) return section === "admin" ? "admin/dashboard.html" : "voter/dashboard.html";
    if (/manage elections/.test(label)) return "admin/elections.html";
    if (/create new election|initiate new election|new registry/.test(label)) return "admin/create-election.html";
    if (/onboard candidate|candidate onboard|add candidate/.test(label)) return "admin/add-candidate.html";
    if (/voter registry|manage voters|add voter/.test(label)) return "admin/voters.html";
    if (/download sample template/.test(label)) return "admin/add-voter.html";
    if (/view full calendar/.test(label)) return section === "admin" ? "admin/elections.html" : "voter/elections.html";
    if (/view full voter guide|how to find your voter id/.test(label)) return "how-it-works.html";
    if (/positions/.test(label)) return "admin/positions.html";
    if (/candidates/.test(label)) return "admin/candidates.html";
    if (/system settings|settings/.test(label)) return section === "admin" ? "admin/settings.html" : "voter/settings.html";
    if (/export records|export audit|export csv/.test(label)) return "admin/reports.html";

    return null;
  }

  function wireSafeButtons(info) {
    var section = info.section;
    var buttons = document.querySelectorAll("button:not([disabled])");

    buttons.forEach(function (btn) {
      if (btn.closest("form")) {
        return;
      }
      if (String(btn.getAttribute("type") || "").toLowerCase() === "submit") {
        return;
      }
      if (btn.hasAttribute("data-ovs-logout")) {
        return;
      }

      var target = resolveSafeButtonTarget(textOf(btn), section);
      if (!target) {
        return;
      }

      btn.addEventListener("click", function (event) {
        event.preventDefault();
        window.location.href = toPath(target);
      });
    });
  }

  function bindLogout() {
    var logoutButtons = document.querySelectorAll("[data-ovs-logout]");
    logoutButtons.forEach(function (btn) {
      btn.addEventListener("click", async function () {
        try {
          await fetch(toBackend("auth/logout.php"), {
            method: "POST",
            credentials: "include",
            headers: { Accept: "application/json" }
          });
        } catch (e) {
          /* ignore */
        }
        window.location.href = toPath("login.html");
      });
    });
  }

  function formatDateLabel(value) {
    if (!value) return "-";
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric"
    });
  }

  function electionStatusMeta(phase) {
    var p = String(phase || "").toLowerCase();
    if (p === "active") {
      return {
        icon: "verified",
        text: "Voting Open",
        css: "text-tertiary"
      };
    }
    if (p === "closed") {
      return {
        icon: "lock_clock",
        text: "Closed",
        css: "text-on-surface-variant"
      };
    }
    return {
      icon: "schedule",
      text: "Coming Soon",
      css: "text-on-surface-variant"
    };
  }

  function fallbackElectionDescription(item) {
    var positions = Number(item && item.positions_count ? item.positions_count : 0);
    var candidates = Number(item && item.candidates_count ? item.candidates_count : 0);
    if (positions > 0 || candidates > 0) {
      return positions + " position(s), " + candidates + " candidate(s) currently configured.";
    }
    return "Election details are being finalized by the election authority.";
  }

  async function hydrateIndexUpcomingElections(info) {
    if (String(info.section || "").toLowerCase() !== "public" || String(info.file || "").toLowerCase() !== "index.html") {
      return;
    }

    var headings = document.querySelectorAll("h2");
    var title = Array.prototype.find.call(headings, function (h) {
      return /upcoming elections/i.test(String(h.textContent || ""));
    });
    if (!title) {
      return;
    }

    var section = title.closest("section");
    if (!section) {
      return;
    }

    var fullCalendarLink = Array.prototype.find.call(section.querySelectorAll("a"), function (a) {
      return /view full calendar/i.test(String(a.textContent || ""));
    });
    if (fullCalendarLink) {
      fullCalendarLink.setAttribute("href", toPath("voter/elections.html"));
    }

    var grid = section.querySelector(".grid.grid-cols-1.md\\:grid-cols-3.gap-6") || section.querySelector(".grid");
    if (!grid) {
      return;
    }

    var responses = await Promise.all([
      fetchJson("voters/get-public-elections.php", { status: "upcoming", limit: 6 }, false),
      fetchJson("voters/get-public-elections.php", { status: "active", limit: 6 }, false)
    ]);

    function extractItems(res) {
      return res && res.ok && res.json && res.json.success && res.json.data && Array.isArray(res.json.data.items)
        ? res.json.data.items
        : [];
    }

    var upcomingItems = extractItems(responses[0]).filter(function (row) {
      return String(row && row.phase ? row.phase : "").toLowerCase() === "upcoming";
    });
    var activeItems = extractItems(responses[1]).filter(function (row) {
      return String(row && row.phase ? row.phase : "").toLowerCase() === "active";
    });

    var seenIds = {};
    var items = upcomingItems
      .concat(activeItems)
      .filter(function (row) {
        var id = String(row && row.id ? row.id : "");
        if (!id || seenIds[id]) return false;
        seenIds[id] = true;
        return true;
      })
      .slice(0, 3);

    if (!items.length) {
      grid.innerHTML =
        '<div class="col-span-full bg-white p-8 border border-outline-variant/15 paper-on-paper">' +
        '<h3 class="text-xl font-bold mb-2">No upcoming or live elections scheduled</h3>' +
        '<p class="text-on-surface-variant text-sm leading-relaxed">Please check back later for official election announcements.</p>' +
        "</div>";
      return;
    }

    var cardClass = "bg-white p-8 border border-outline-variant/15 flex flex-col justify-between hover:translate-y-[-4px] transition-transform paper-on-paper";
    grid.innerHTML = items
      .slice(0, 3)
      .map(function (item, idx) {
        var status = electionStatusMeta(item.phase);
        var desc = String(item.description || "").trim() || fallbackElectionDescription(item);
        var classes = cardClass + (idx === 0 ? " border-l-4 border-primary" : "");
        return (
          '<div class="' + classes + '">' +
          "<div>" +
          '<span class="text-2xl font-bold font-headline text-[#1d4ed8] block mb-4">' + escapeHtml(formatDateLabel(item.start_at)) + "</span>" +
          '<h3 class="text-xl font-bold mb-2">' + escapeHtml(item.title || "Election") + "</h3>" +
          '<p class="text-on-surface-variant text-sm leading-relaxed mb-6">' + escapeHtml(desc) + "</p>" +
          "</div>" +
          '<div class="flex items-center gap-2 ' + status.css + ' font-bold text-xs uppercase tracking-wider">' +
          '<span class="material-symbols-outlined text-sm">' + escapeHtml(status.icon) + "</span>" +
          escapeHtml(status.text) +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function applyDynamicCopyrightYear() {
    if (!document.body || !window.NodeFilter) {
      return;
    }
    var currentYear = String(new Date().getFullYear());
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node = walker.nextNode();
    while (node) {
      var value = String(node.nodeValue || "");
      var updated = value.replace(/(Â©|©|&copy;|\(c\)|\(C\))\s*20\d{2}/g, function (_, symbol) {
        var normalized = symbol;
        if (normalized === "Â©" || normalized === "&copy;" || normalized === "(c)" || normalized === "(C)") {
          normalized = "©";
        }
        return normalized + " " + currentYear;
      });
      if (updated !== value) {
        node.nodeValue = updated;
      }
      node = walker.nextNode();
    }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var info = pageInfo();
    document.body.classList.add("ovs-pending-auth");
    document.body.classList.add("ovs-section-" + info.section);

    var guarded = await enforceAccess(info);
    if (guarded.stop) {
      return;
    }

    applySharedLayout(info, guarded.state);
    wirePlaceholderAnchors(info);
    wireSafeButtons(info);
    await hydrateIndexUpcomingElections(info);
    applyDynamicCopyrightYear();
    bindLogout();

    document.body.classList.remove("ovs-pending-auth");
    document.body.classList.add("ovs-auth-ready");
  });
})();

