(function () {
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
    frontendPrefix: frontendPrefix,
    toFrontendPath: toFrontendPath,
    toBackendPath: toBackendPath,
    pageInfo: pageInfo
  };
})();
