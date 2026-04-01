(function () {
  function configuredApiBase() {
    var candidates = [];
    try {
      if (typeof window !== "undefined" && window.location && window.location.search) {
        var params = new URLSearchParams(window.location.search);
        var queryValue = String(params.get("api_base") || "").trim();
        if (queryValue) {
          candidates.push(queryValue);
          if (window.localStorage) {
            window.localStorage.setItem("ovs_api_base", queryValue);
          }
        }
      }
    } catch (e) {
      /* ignore URL/storage errors */
    }

    if (typeof window !== "undefined" && typeof window.OVS_API_BASE === "string") {
      candidates.push(window.OVS_API_BASE);
    }
    if (typeof document !== "undefined") {
      var meta = document.querySelector('meta[name="ovs-api-base"]');
      if (meta && meta.getAttribute("content")) {
        candidates.push(meta.getAttribute("content"));
      }
    }
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        var stored = window.localStorage.getItem("ovs_api_base");
        if (stored) candidates.push(stored);
      }
    } catch (e) {
      /* ignore storage access errors */
    }

    for (var i = 0; i < candidates.length; i += 1) {
      var value = String(candidates[i] || "").trim();
      if (value) return value;
    }
    return "";
  }

  function normalizeApiBase(base) {
    var trimmed = String(base || "").trim();
    if (!trimmed) return "";
    var clean = trimmed.replace(/\/+$/, "");
    if (!/\/backend$/i.test(clean)) {
      clean += "/backend";
    }
    return clean + "/";
  }

  function frontendPrefix() {
    var path = String(window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
    var marker = "/frontend/";
    var idx = path.lastIndexOf(marker);
    if (idx === -1) return "";
    var after = path.slice(idx + marker.length);
    var parts = after.split("/").filter(Boolean);
    var depth = Math.max(parts.length - 1, 0);
    return "../".repeat(depth);
  }

  function toFrontendPath(target) {
    var normalized = String(target || "").replace(/^\/+/, "");
    return frontendPrefix() + normalized;
  }

  function toBackendPath(target) {
    var normalized = String(target || "").replace(/^\/+/, "");
    var configured = normalizeApiBase(configuredApiBase());
    if (configured) {
      return configured + normalized;
    }
    return frontendPrefix() + "../backend/" + normalized;
  }

  function pageInfo() {
    var path = String(window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
    var marker = "/frontend/";
    var idx = path.lastIndexOf(marker);
    var after = idx === -1 ? "" : path.slice(idx + marker.length);
    var parts = after.split("/").filter(Boolean);
    var section = "public";

    if (parts.length > 0 && (parts[0] === "voter" || parts[0] === "admin")) {
      section = parts[0];
    }

    return {
      pathname: path,
      afterFrontend: after,
      parts: parts,
      section: section,
      file: parts.length ? parts[parts.length - 1] : "",
      isAuthPage: ["login.html", "signup.html", "forgot-password.html", "reset-password.html"].indexOf(parts[parts.length - 1] || "") !== -1
    };
  }

  window.OVSUtils = {
    configuredApiBase: configuredApiBase,
    frontendPrefix: frontendPrefix,
    toFrontendPath: toFrontendPath,
    toBackendPath: toBackendPath,
    pageInfo: pageInfo
  };
})();
