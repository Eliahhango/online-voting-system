(function () {
  if (document.body) {
    document.body.classList.add("ovs-pending-auth");
  }

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
    var path = String(window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
    var file = path.split("/").pop() || "";
    var section = path.indexOf("/admin/") !== -1 ? "admin" : path.indexOf("/voter/") !== -1 ? "voter" : "public";
    return { section: section, file: file, isAuthPage: false };
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

  async function postJson(endpoint, payload, includeCredentials) {
    var absolute = new URL(toBackend(endpoint), window.location.href);
    try {
      var res = await fetch(absolute.toString(), {
        method: "POST",
        credentials: includeCredentials ? "include" : "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload || {})
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
    var loginTarget = info && info.section === "admin" ? "admin-login.html" : "voter-login.html";
    var loginUrl = new URL(toPath(loginTarget), window.location.href);
    loginUrl.searchParams.set("next", window.location.pathname + window.location.search);
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

  function removeLegacyFooters(activeFooter) {
    if (!document.body) {
      return;
    }

    var children = Array.prototype.slice.call(document.body.children || []);
    children.forEach(function (node) {
      if (node === activeFooter) {
        return;
      }
      var tag = String(node.tagName || "").toUpperCase();
      if (tag === "FOOTER") {
        node.remove();
      }
    });
  }

  function pruneInitialLegacyShell() {
    if (!document.body) {
      return;
    }
    removeLegacyTopBars(null);
    removeLegacyFooters(null);
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
        link("Active Ballots", toPath("voter/elections.html")),
        link("Ballot", toPath("voter/ballot.html")),
        link("Results", toPath("voter/results.html")),
        link("History", toPath("voter/results.html")),
        link("Profile", toPath("voter/profile.html")),
        link("Settings", toPath("voter/settings.html")),
        link("Security Center", toPath("voter/settings.html")),
        link("Support", toPath("contact.html"))
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
        right = link("Voter Login", toPath("voter-login.html")) + link("Admin Login", toPath("admin-login.html"));
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
      '<button type="button" class="ovs-nav-toggle" data-ovs-nav-toggle aria-expanded="false" aria-label="Toggle navigation">Menu</button>' +
      '<div class="ovs-header-menu" data-ovs-header-menu>' +
      '<nav class="ovs-nav">' + nav + "</nav>" +
      '<div class="ovs-header-right">' + badge + right + "</div>" +
      "</div>" +
      "</div>" +
      "</header>"
    );
  }

  function footerTemplate() {
    return (
      '<footer class="ovs-footer">' +
      '<div class="ovs-footer-inner">' +
      '<div class="ovs-footer-left">&copy; ' + new Date().getFullYear() + " Civic Ledger. Trusted Elections for Institutions and Communities.</div>" +
      '<div class="ovs-footer-links">' +
      '<a href="' + toPath("about.html") + '">About</a>' +
      '<a href="' + toPath("contact.html") + '">Support</a>' +
      '<a href="' + toPath("voter-login.html") + '">Voter Sign In</a>' +
      '<a href="' + toPath("admin-login.html") + '">Admin Sign In</a>' +
      '<a href="' + toPath("how-it-works.html") + '">Security</a>' +
      '<a href="' + toPath("about.html") + '">Privacy</a>' +
      '<a href="' + toPath("about.html") + '">Terms</a>' +
      '<a href="' + toPath("contact.html") + '">Accessibility</a>' +
      '<a href="' + toPath("contact.html") + '">Help Center</a>' +
      "</div>" +
      "</div>" +
      "</footer>"
    );
  }

  function voterActiveTab(file) {
    var f = String(file || "").toLowerCase();
    if (f === "dashboard.html") return "dashboard";
    if (f === "elections.html" || f === "election-details.html") return "elections";
    if (f === "ballot.html" || f === "vote-success.html") return "ballot";
    if (f === "results.html") return "results";
    if (f === "profile.html") return "profile";
    if (f === "settings.html") return "settings";
    return "dashboard";
  }

  function voterSideLink(label, href, active) {
    return '<a class="ovs-voter-side-link' + (active ? " is-active" : "") + '" href="' + href + '">' + label + "</a>";
  }

  function voterSideTemplate(info, state) {
    var active = voterActiveTab(info.file);
    var userName = state && state.user ? state.user.full_name || state.user.email || "Voter" : "Voter";
    var voterId = state && state.user && state.user.voter_id ? String(state.user.voter_id) : "";

    return (
      '<aside class="ovs-voter-side">' +
      '<div class="ovs-voter-side-head">' +
      '<div class="ovs-voter-side-title">Voter Portal</div>' +
      '<div class="ovs-voter-side-subtitle">' + escapeHtml(voterId ? ("ID: " + voterId) : "Verified Citizen") + "</div>" +
      '<div class="ovs-voter-side-user">' + escapeHtml(userName) + "</div>" +
      '<button type="button" class="ovs-side-toggle" data-ovs-side-toggle aria-expanded="true" aria-label="Toggle voter sidebar">Hide Panel</button>' +
      "</div>" +
      '<nav class="ovs-voter-side-nav">' +
      voterSideLink("Dashboard", toPath("voter/dashboard.html"), active === "dashboard") +
      voterSideLink("Active Ballots", toPath("voter/elections.html"), active === "elections") +
      voterSideLink("Ballot", toPath("voter/ballot.html"), active === "ballot") +
      voterSideLink("Results", toPath("voter/results.html"), active === "results") +
      voterSideLink("History", toPath("voter/results.html"), active === "results") +
      voterSideLink("Profile", toPath("voter/profile.html"), active === "profile") +
      voterSideLink("Settings", toPath("voter/settings.html"), active === "settings") +
      voterSideLink("Security Center", toPath("voter/settings.html"), active === "security") +
      voterSideLink("Support", toPath("contact.html"), false) +
      "</nav>" +
      '<div class="ovs-voter-side-foot">' +
      '<button type="button" class="ovs-voter-logout-btn" data-ovs-logout>Log Out</button>' +
      "</div>" +
      "</aside>"
    );
  }

  function applyVoterLayout(info, state) {
    var children = Array.prototype.slice.call(document.body.children || []);
    children.forEach(function (node) {
      var tag = String(node.tagName || "").toUpperCase();
      if (tag !== "ASIDE") {
        return;
      }
      if (node.classList.contains("ovs-voter-side") || node.classList.contains("ovs-admin-side")) {
        return;
      }
      node.remove();
    });

    var oldSide = document.querySelector(".ovs-voter-side");
    if (oldSide) {
      oldSide.remove();
    }

    var side = createElement(voterSideTemplate(info, state));
    var header = document.querySelector(".ovs-header");
    if (header && header.nextSibling) {
      document.body.insertBefore(side, header.nextSibling);
    } else if (header) {
      document.body.appendChild(side);
    } else if (document.body.firstChild) {
      document.body.insertBefore(side, document.body.firstChild);
    } else {
      document.body.appendChild(side);
    }

    var main = document.querySelector("main");
    if (main) {
      main.classList.add("ovs-voter-main");
    }

    document.body.classList.add("ovs-voter-shell");
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
      '<button type="button" class="ovs-admin-menu-toggle" data-ovs-admin-menu-toggle aria-expanded="false" aria-label="Toggle admin navigation">Menu</button>' +
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
      '<button type="button" class="ovs-admin-side-toggle" data-ovs-admin-side-toggle aria-expanded="true" aria-label="Toggle admin sidebar">Hide Panel</button>' +
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

  function bindDesktopSidebarToggle(info) {
    function persistedFlag(key) {
      try {
        return window.localStorage && window.localStorage.getItem(key) === "1";
      } catch (e) {
        return false;
      }
    }

    function saveFlag(key, value) {
      try {
        if (!window.localStorage) return;
        window.localStorage.setItem(key, value ? "1" : "0");
      } catch (e) {
        /* ignore storage write errors */
      }
    }

    function isDesktop() {
      return window.innerWidth > 1024;
    }

    var section = String(info.section || "").toLowerCase();

    if (section === "voter") {
      return;
    }

    if (section === "admin") {
      var adminBtn = document.querySelector(".ovs-admin-side [data-ovs-admin-side-toggle]");
      var adminSide = document.querySelector(".ovs-admin-side");
      if (!adminBtn || !adminSide) {
        return;
      }

      var adminKey = "ovs_admin_side_collapsed";
      var adminBodyClass = "ovs-admin-side-collapsed";

      var applyAdmin = function (collapsed) {
        if (!isDesktop()) {
          document.body.classList.remove(adminBodyClass);
          adminBtn.textContent = "Hide Panel";
          adminBtn.setAttribute("aria-expanded", "true");
          return;
        }
        document.body.classList.toggle(adminBodyClass, !!collapsed);
        adminBtn.textContent = collapsed ? "Show Panel" : "Hide Panel";
        adminBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      };

      applyAdmin(persistedFlag(adminKey));

      adminBtn.addEventListener("click", function () {
        if (!isDesktop()) return;
        var nextCollapsed = !document.body.classList.contains(adminBodyClass);
        applyAdmin(nextCollapsed);
        saveFlag(adminKey, nextCollapsed);
      });

      window.addEventListener("resize", function () {
        if (isDesktop()) {
          applyAdmin(persistedFlag(adminKey));
        } else {
          applyAdmin(false);
        }
      });
    }
  }

  function applyAdminLayout(info, state) {
    var children = Array.prototype.slice.call(document.body.children || []);
    children.forEach(function (node) {
      var tag = String(node.tagName || "").toUpperCase();
      if (tag !== "HEADER" && tag !== "NAV" && tag !== "ASIDE" && tag !== "FOOTER") {
        return;
      }
      if (node.classList.contains("ovs-admin-top") || node.classList.contains("ovs-admin-side") || node.classList.contains("ovs-footer")) {
        return;
      }
      node.remove();
    });

    var oldAdminTop = document.querySelector(".ovs-admin-top");
    var oldAdminSide = document.querySelector(".ovs-admin-side");
    var oldFooter = document.querySelector("footer");
    if (oldAdminTop) oldAdminTop.remove();
    if (oldAdminSide) oldAdminSide.remove();
    if (oldFooter && !oldFooter.classList.contains("ovs-footer")) oldFooter.remove();

    var top = createElement(adminTopTemplate(info, state));
    var side = createElement(adminSideTemplate(info));
    var footer = document.querySelector(".ovs-footer");
    if (!footer) {
      footer = createElement(footerTemplate());
      document.body.appendChild(footer);
    }

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

    removeLegacyFooters(footer);
    document.body.classList.add("ovs-admin-shell");
  }

  function stripVoterLeftPanels() {
    if (!document.body) {
      return;
    }

    var children = Array.prototype.slice.call(document.body.children || []);
    children.forEach(function (node) {
      if (String(node.tagName || "").toUpperCase() === "ASIDE") {
        node.remove();
      }
    });

    var reopenButton = document.querySelector("[data-ovs-side-reopen]");
    if (reopenButton) {
      reopenButton.remove();
    }

    var main = document.querySelector("main");
    if (main) {
      main.classList.remove("ovs-voter-main");
    }

    document.body.classList.add("ovs-voter-no-side");
    document.body.classList.remove("ovs-voter-shell");
    document.body.classList.remove("ovs-voter-side-collapsed");
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

    if (oldFooter) {
      oldFooter.replaceWith(newFooter);
    } else {
      document.body.appendChild(newFooter);
    }

    removeLegacyTopBars(newHeader);
    removeLegacyFooters(newFooter);

    if (info.section === "voter") {
      stripVoterLeftPanels();
    }
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

    if (/admin login|administrator sign in|admin sign in/.test(label)) return "admin-login.html";
    if (/voter login|\blogin\b|sign in/.test(label)) return "voter-login.html";
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
    if (/admin login|administrator sign in|admin sign in/.test(label)) return "admin-login.html";
    if (/login|sign in/.test(label)) return "voter-login.html";
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

  function bindContactForm(info) {
    if (String(info.section || "").toLowerCase() !== "public" || String(info.file || "").toLowerCase() !== "contact.html") {
      return;
    }

    var form = document.querySelector("[data-ovs-contact-form]") || document.querySelector("form");
    if (!form) {
      return;
    }

    var nameInput = form.querySelector('[name="full_name"]');
    var emailInput = form.querySelector('[name="email"]');
    var topicInput = form.querySelector('[name="topic"]');
    var messageInput = form.querySelector('[name="message"]');
    var submitBtn = form.querySelector('button[type="submit"]');
    var notice = document.getElementById("ovs-contact-notice");

    function setNotice(message, type) {
      if (!notice) {
        return;
      }
      notice.textContent = String(message || "");
      notice.className = "text-sm rounded p-3";
      if (!message) {
        notice.classList.add("hidden");
        return;
      }
      notice.classList.remove("hidden");
      if (type === "success") {
        notice.classList.add("bg-emerald-50", "text-emerald-700", "border", "border-emerald-200");
      } else if (type === "error") {
        notice.classList.add("bg-red-50", "text-red-700", "border", "border-red-200");
      } else {
        notice.classList.add("bg-slate-50", "text-slate-700", "border", "border-slate-200");
      }
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      var payload = {
        full_name: (nameInput && nameInput.value ? nameInput.value : "").trim(),
        email: (emailInput && emailInput.value ? emailInput.value : "").trim(),
        topic: (topicInput && topicInput.value ? topicInput.value : "").trim(),
        message: (messageInput && messageInput.value ? messageInput.value : "").trim()
      };

      if (!payload.full_name || !payload.email || !payload.topic || !payload.message) {
        setNotice("Please complete all fields before submitting.", "error");
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
      }
      setNotice("Submitting your inquiry...", "info");

      var res = await postJson("public/contact-support.php", payload, false);
      if (!res.ok || !res.json || !res.json.success) {
        if (submitBtn) {
          submitBtn.disabled = false;
        }
        setNotice((res.json && res.json.message) || "Unable to submit inquiry right now.", "error");
        return;
      }

      if (typeof form.reset === "function") {
        form.reset();
      }
      if (submitBtn) {
        submitBtn.disabled = false;
      }
      setNotice((res.json && res.json.message) || "Inquiry submitted successfully.", "success");
    });
  }

  function pruneLegacyVoterSidebarActions(info) {
    if (String(info.section || "").toLowerCase() !== "voter") {
      return;
    }

    var aside = document.querySelector("aside");
    if (!aside) {
      return;
    }

    var controls = aside.querySelectorAll("button, a");
    controls.forEach(function (node) {
      var label = textOf(node).replace(/\s+/g, " ").trim();
      if (label === "cast ballot") {
        var parent = node.parentElement;
        node.remove();
        if (parent && !parent.children.length) {
          parent.remove();
        }
      }
    });
  }

  function bindResponsiveMenus(info) {
    var publicToggle = document.querySelector("[data-ovs-nav-toggle]");
    var publicHeader = document.querySelector(".ovs-header");
    if (publicToggle && publicHeader) {
      var closePublicMenu = function () {
        publicHeader.classList.remove("is-menu-open");
        document.body.classList.remove("ovs-public-menu-open");
        publicToggle.setAttribute("aria-expanded", "false");
      };

      var openPublicMenu = function () {
        publicHeader.classList.add("is-menu-open");
        document.body.classList.add("ovs-public-menu-open");
        publicToggle.setAttribute("aria-expanded", "true");
      };

      publicToggle.addEventListener("click", function () {
        if (publicHeader.classList.contains("is-menu-open")) {
          closePublicMenu();
        } else {
          openPublicMenu();
        }
      });

      publicHeader.addEventListener("click", function (event) {
        var target = event.target;
        if (target && target.closest && target.closest("a")) {
          closePublicMenu();
        }
      });

      document.addEventListener("click", function (event) {
        if (!publicHeader.classList.contains("is-menu-open")) {
          return;
        }
        var menu = publicHeader.querySelector("[data-ovs-header-menu]");
        if (menu && menu.contains(event.target)) {
          return;
        }
        if (publicToggle && publicToggle.contains(event.target)) {
          return;
        }
        closePublicMenu();
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          closePublicMenu();
        }
      });

      window.addEventListener("resize", function () {
        if (window.innerWidth > 900) {
          closePublicMenu();
        }
      });
    }

    if (String(info.section || "").toLowerCase() !== "admin") {
      return;
    }

    var adminToggle = document.querySelector("[data-ovs-admin-menu-toggle]");
    var closeAdminMenu = function () {
      document.body.classList.remove("ovs-admin-menu-open");
      if (adminToggle) adminToggle.setAttribute("aria-expanded", "false");
    };
    var openAdminMenu = function () {
      document.body.classList.add("ovs-admin-menu-open");
      if (adminToggle) adminToggle.setAttribute("aria-expanded", "true");
    };

    if (adminToggle) {
      adminToggle.addEventListener("click", function () {
        if (document.body.classList.contains("ovs-admin-menu-open")) {
          closeAdminMenu();
        } else {
          openAdminMenu();
        }
      });
    }

    document.addEventListener("click", function (event) {
      var side = document.querySelector(".ovs-admin-side");
      if (!side || !document.body.classList.contains("ovs-admin-menu-open")) {
        return;
      }
      if (event.target && event.target.closest && event.target.closest(".ovs-admin-side-link")) {
        closeAdminMenu();
        return;
      }
      if (adminToggle && event.target && event.target.closest && event.target.closest("[data-ovs-admin-menu-toggle]")) {
        return;
      }
      if (!side.contains(event.target)) {
        closeAdminMenu();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1024) {
        closeAdminMenu();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAdminMenu();
      }
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
        var info = pageInfo();
        window.location.href = toPath(info.section === "admin" ? "admin-login.html" : "voter-login.html");
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
      fullCalendarLink.setAttribute("href", toPath("how-it-works.html"));
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
    pruneInitialLegacyShell();
    var info = pageInfo();
    document.body.classList.add("ovs-pending-auth");
    document.body.classList.add("ovs-section-" + info.section);

    var guarded = await enforceAccess(info);
    if (guarded.stop) {
      return;
    }

    var isDashboard = String(info.file || "").toLowerCase() === "dashboard.html";
    if (!isDashboard) {
      applySharedLayout(info, guarded.state);
    }
    
    bindResponsiveMenus(info);
    bindDesktopSidebarToggle(info);
    wirePlaceholderAnchors(info);
    wireSafeButtons(info);
    bindContactForm(info);
    pruneLegacyVoterSidebarActions(info);
    await hydrateIndexUpcomingElections(info);
    applyDynamicCopyrightYear();
    bindLogout();

    document.body.classList.remove("ovs-pending-auth");
    document.body.classList.add("ovs-auth-ready");
  });
})();

