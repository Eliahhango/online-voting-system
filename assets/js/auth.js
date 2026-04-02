(function () {
  function utils() {
    return window.OVSUtils || {};
  }

  function toBackend(target) {
    if (typeof utils().toBackendPath === "function") {
      return utils().toBackendPath(target);
    }
    return "../backend/" + String(target || "").replace(/^\/+/, "");
  }

  function toPath(target) {
    if (typeof utils().toFrontendPath === "function") {
      return utils().toFrontendPath(target);
    }
    return target;
  }

  function pageInfo() {
    if (typeof utils().pageInfo === "function") {
      return utils().pageInfo();
    }
    return { file: "", isAuthPage: false };
  }

  function showMessage(form, message, type) {
    var node = form.querySelector("[data-auth-message]");
    if (!node) {
      node = document.createElement("div");
      node.setAttribute("data-auth-message", "1");
      node.style.marginTop = "10px";
      node.style.padding = "10px 12px";
      node.style.borderRadius = "4px";
      node.style.fontSize = "0.85rem";
      node.style.fontFamily = "Manrope, Arial, sans-serif";
      form.appendChild(node);
    }

    if (type === "error") {
      node.style.background = "#fee2e2";
      node.style.border = "1px solid #fca5a5";
      node.style.color = "#991b1b";
    } else if (type === "success") {
      node.style.background = "#dcfce7";
      node.style.border = "1px solid #86efac";
      node.style.color = "#14532d";
    } else {
      node.style.background = "#e0f2fe";
      node.style.border = "1px solid #7dd3fc";
      node.style.color = "#0c4a6e";
    }

    node.textContent = message;
  }

  function setButtonLoading(button, loading) {
    if (!button) {
      return;
    }
    if (!button.dataset.authLabel) {
      button.dataset.authLabel = button.textContent || "Submit";
    }
    button.disabled = !!loading;
    button.textContent = loading ? "Please wait..." : button.dataset.authLabel;
  }

  async function postJson(endpoint, payload) {
    var res = await fetch(toBackend(endpoint), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload || {})
    });

    var contentType = String(res.headers.get("content-type") || "");
    var rawText = "";
    var json = null;
    try {
      rawText = await res.text();
      json = rawText ? JSON.parse(rawText) : null;
    } catch (e) {
      json = null;
    }

    return {
      ok: res.ok,
      status: res.status,
      json: json,
      rawText: rawText,
      contentType: contentType
    };
  }

  function authErrorMessage(response, fallback) {
    if (response && response.json && response.json.message) {
      return String(response.json.message);
    }

    var status = response && response.status ? Number(response.status) : 0;
    var contentType = String(response && response.contentType ? response.contentType : "").toLowerCase();
    var raw = String(response && response.rawText ? response.rawText : "").trim();
    var looksHtml = contentType.indexOf("text/html") !== -1 || /^<!doctype html/i.test(raw) || /^<html/i.test(raw);
    var host = String((window.location && window.location.hostname) || "").toLowerCase();

    if (status === 404 && looksHtml) {
      if (host.indexOf("vercel.app") !== -1) {
        return "Backend API not found on Vercel. Deploy the PHP backend separately and set OVS_API_BASE to that backend URL.";
      }
      return "Backend endpoint was not found (404). Check backend deployment path.";
    }
    if (status >= 500) {
      return "Server error from backend (" + status + "). Check backend logs.";
    }
    if (!response || status === 0) {
      return "Network error. Backend may be offline or blocked by CORS.";
    }
    if (looksHtml) {
      return "Unexpected HTML response from backend. Confirm PHP API is deployed and reachable.";
    }
    return fallback;
  }

  function findInput(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        return el;
      }
    }
    return null;
  }

  function safeNextUrl() {
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

  function loginPortal() {
    var params = new URLSearchParams(window.location.search || "");
    var portal = String(params.get("portal") || "").toLowerCase();
    if (portal === "admin" || portal === "voter") {
      return portal;
    }

    var next = safeNextUrl();
    if (next && next.indexOf("/frontend/admin/") !== -1) {
      return "admin";
    }
    return "voter";
  }

  function roleDashboard(role) {
    return role === "admin" ? toPath("admin/dashboard.html") : toPath("voter/dashboard.html");
  }

  function ensurePasswordInput(form) {
    var existing = form.querySelector('input[type="password"], input[name="password"], #password');
    if (existing) {
      return existing;
    }

    var identifier = findInput(["#voter-id", "#identifier", "input[type='text']", "input[type='email']"]);
    var wrapper = document.createElement("div");
    wrapper.className = "space-y-2";

    var label = document.createElement("label");
    label.textContent = "Password";
    label.setAttribute("for", "password");
    label.className = "block font-label text-sm font-bold uppercase tracking-tight text-on-surface";

    var input = document.createElement("input");
    input.type = "password";
    input.id = "password";
    input.name = "password";
    input.placeholder = "Enter your password";
    if (identifier && identifier.className) {
      input.className = identifier.className;
    } else {
      input.className = "w-full h-12 border border-outline-variant rounded px-4";
    }

    wrapper.appendChild(label);
    wrapper.appendChild(input);

    var submit = form.querySelector("button[type='submit'], button");
    if (submit && submit.parentNode) {
      submit.parentNode.insertBefore(wrapper, submit);
    } else {
      form.appendChild(wrapper);
    }

    return input;
  }

  function initLoginPage() {
    var form = document.querySelector("form");
    if (!form) {
      return;
    }
    var portal = loginPortal();

    var identifier = findInput([
      "#email",
      "input[name='email']",
      "#identifier",
      "input[name='identifier']",
      "#voter-id",
      "#voter_id",
      "input[name='voter_id']",
      "input[type='email']",
      "input[type='text']"
    ]);

    var password = ensurePasswordInput(form);
    var submitBtn = form.querySelector("button[type='submit'], button");

    if (identifier) {
      identifier.placeholder = "Email or Registration ID";
      identifier.setAttribute("autocomplete", "username");
      var label = null;
      if (identifier.id) {
        label = form.querySelector('label[for="' + identifier.id + '"]');
      }
      if (!label) {
        label = identifier.closest("div") ? identifier.closest("div").querySelector("label") : null;
      }
      if (label) {
        label.textContent = portal === "admin" ? "Admin Email or Registration ID" : "Email or Registration ID";
      }
    }

    var title = document.querySelector("main h2, h2");
    if (title) {
      title.textContent = portal === "admin" ? "Administrator Sign In" : "Sign In to Vote";
    }

    var subtitle = title && title.parentElement ? title.parentElement.querySelector("p") : null;
    if (subtitle) {
      subtitle.textContent =
        portal === "admin"
          ? "Use your administrator credentials to access the election control center."
          : "Enter your government-issued credentials to access your secure ballot dashboard.";
    }

    if (password) {
      password.setAttribute("autocomplete", "current-password");
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var idValue = identifier ? String(identifier.value || "").trim() : "";
      var passValue = password ? String(password.value || "") : "";

      if (!idValue || !passValue) {
        showMessage(form, "Identifier and password are required.", "error");
        return;
      }

      var payload = { password: passValue };
      payload.expected_role = portal;
      if (idValue.indexOf("@") !== -1) {
        payload.email = idValue;
      } else {
        payload.voter_id = idValue;
      }

      setButtonLoading(submitBtn, true);
      var response;
      try {
        response = await postJson("auth/login.php", payload);
      } catch (err) {
        setButtonLoading(submitBtn, false);
        showMessage(form, "Network error while logging in.", "error");
        return;
      }
      setButtonLoading(submitBtn, false);

      if (!response.ok || !response.json || response.json.success !== true) {
        var msg = authErrorMessage(response, "Login failed.");
        showMessage(form, msg, "error");
        return;
      }

      showMessage(form, "Login successful. Redirecting...", "success");

      var next = safeNextUrl();
      var role = response.json.data && response.json.data.user ? response.json.data.user.role : "voter";
      var adminTarget = portal === "admin" || (next && next.indexOf("/frontend/admin/") !== -1);

      if (adminTarget && role !== "admin") {
        try {
          await postJson("auth/logout.php", {});
        } catch (logoutErr) {
          /* ignore logout failures */
        }
        showMessage(form, "This account does not have admin access.", "error");
        return;
      }

      if (!adminTarget && role !== "voter") {
        try {
          await postJson("auth/logout.php", {});
        } catch (logoutErr2) {
          /* ignore logout failures */
        }
        showMessage(form, "This account is not allowed in voter portal.", "error");
        return;
      }

      window.location.href = next || (portal === "admin" ? toPath("admin/dashboard.html") : roleDashboard(role));
    });
  }

  function initSignupPage() {
    var form = document.querySelector("form");
    if (!form) {
      return;
    }

    var fullName = findInput(["#full_name", "#full-name", "input[name='full_name']"]);
    var email = findInput(["#email", "input[name='email']"]);
    var phone = findInput(["#phone", "input[name='phone']"]);
    var voterId = findInput(["#voter_id", "#voter-id", "input[name='voter_id']"]);
    var password = findInput(["#password", "input[name='password']", "input[type='password']"]);
    var confirm = findInput(["#confirm_password", "#confirm-password", "input[name='confirm_password']"]);
    var terms = findInput(["#terms", "input[name='terms']"]);
    var submitBtn = form.querySelector("button[type='submit'], button");

    if (voterId) {
      voterId.value = "";
      voterId.disabled = true;
      voterId.readOnly = true;
      voterId.placeholder = "Auto-generated after signup";
      voterId.style.backgroundColor = "#f1f5f9";
      voterId.style.cursor = "not-allowed";
      var voterIdLabel = null;
      if (voterId.id) {
        voterIdLabel = form.querySelector('label[for="' + voterId.id + '"]');
      }
      if (!voterIdLabel) {
        voterIdLabel = voterId.closest("div") ? voterId.closest("div").querySelector("label") : null;
      }
      if (voterIdLabel) {
        voterIdLabel.textContent = "Registration ID (Auto-generated)";
      }
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      var payload = {
        full_name: fullName ? String(fullName.value || "").trim() : "",
        email: email ? String(email.value || "").trim() : "",
        phone: phone ? String(phone.value || "").trim() : "",
        password: password ? String(password.value || "") : ""
      };

      var confirmValue = confirm ? String(confirm.value || "") : "";

      if (!payload.full_name || !payload.email || !payload.password) {
        showMessage(form, "Please fill all required fields.", "error");
        return;
      }

      if (confirm && payload.password !== confirmValue) {
        showMessage(form, "Password and confirm password do not match.", "error");
        return;
      }

      if (terms && !terms.checked) {
        showMessage(form, "You must accept the terms before continuing.", "error");
        return;
      }

      setButtonLoading(submitBtn, true);
      var response;
      try {
        response = await postJson("auth/register.php", payload);
      } catch (err) {
        setButtonLoading(submitBtn, false);
        showMessage(form, "Network error while creating account.", "error");
        return;
      }

      if (!response.ok || !response.json || response.json.success !== true) {
        setButtonLoading(submitBtn, false);
        showMessage(form, authErrorMessage(response, "Registration failed."), "error");
        return;
      }

      var debugToken = response.json.data ? response.json.data.verification_token : null;
      if (debugToken) {
        try {
          await postJson("auth/verify-account.php", { token: debugToken });
        } catch (e) {
          /* ignore verify auto-step errors */
        }
      }

      setButtonLoading(submitBtn, false);
      var generatedId = response.json && response.json.data ? response.json.data.voter_id : "";
      var successText = generatedId
        ? "Account created. Your Registration ID is " + generatedId + ". Redirecting to login..."
        : "Account created successfully. Redirecting to login...";
      showMessage(form, successText, "success");
      setTimeout(function () {
        window.location.href = toPath("login.html");
      }, 1000);
    });
  }

  function initForgotPasswordPage() {
    var form = document.querySelector("form");
    if (!form) {
      return;
    }

    var identifier = findInput(["#identifier", "#email", "input[name='identifier']", "input[name='email']", "input[type='text']", "input[type='email']"]);
    var submitBtn = form.querySelector("button[type='submit'], button");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var value = identifier ? String(identifier.value || "").trim() : "";
      if (!value) {
        showMessage(form, "Please provide your email or voter ID.", "error");
        return;
      }

      setButtonLoading(submitBtn, true);
      var response;
      try {
        response = await postJson("auth/forgot-password.php", { identifier: value });
      } catch (err) {
        setButtonLoading(submitBtn, false);
        showMessage(form, "Network error while requesting reset.", "error");
        return;
      }
      setButtonLoading(submitBtn, false);

      if (!response.ok || !response.json || response.json.success !== true) {
        showMessage(form, authErrorMessage(response, "Unable to process request."), "error");
        return;
      }

      var data = response.json.data || {};
      if (data.debug_reset_token) {
        localStorage.setItem("ovs_reset_token", data.debug_reset_token);
        showMessage(form, "Reset token generated. Redirecting to reset page...", "success");
        setTimeout(function () {
          window.location.href = toPath("reset-password.html") + "?token=" + encodeURIComponent(data.debug_reset_token);
        }, 1000);
      } else {
        showMessage(form, "If your account exists, a reset link has been sent.", "info");
      }
    });
  }

  function initResetPasswordPage() {
    var form = document.querySelector("form");
    if (!form) {
      return;
    }

    var token = new URLSearchParams(window.location.search || "").get("token") || localStorage.getItem("ovs_reset_token") || "";
    var password = findInput(["#new-password", "#password", "input[name='new_password']", "input[type='password']"]);
    var confirm = findInput(["#confirm-password", "#confirm_password", "input[name='confirm_password']"]);
    var submitBtn = form.querySelector("button[type='submit'], button");

    if (!token) {
      showMessage(form, "Missing reset token. Start from Forgot Password first.", "error");
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      var passValue = password ? String(password.value || "") : "";
      var confirmValue = confirm ? String(confirm.value || "") : "";

      if (!token) {
        showMessage(form, "Reset token is missing or expired.", "error");
        return;
      }

      if (!passValue) {
        showMessage(form, "New password is required.", "error");
        return;
      }

      if (confirm && passValue !== confirmValue) {
        showMessage(form, "Password and confirm password do not match.", "error");
        return;
      }

      setButtonLoading(submitBtn, true);
      var response;
      try {
        response = await postJson("auth/reset-password.php", {
          token: token,
          new_password: passValue
        });
      } catch (err) {
        setButtonLoading(submitBtn, false);
        showMessage(form, "Network error while resetting password.", "error");
        return;
      }
      setButtonLoading(submitBtn, false);

      if (!response.ok || !response.json || response.json.success !== true) {
        showMessage(form, authErrorMessage(response, "Password reset failed."), "error");
        return;
      }

      localStorage.removeItem("ovs_reset_token");
      showMessage(form, "Password reset successful. Redirecting to login...", "success");
      setTimeout(function () {
        window.location.href = toPath("login.html");
      }, 1000);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var info = pageInfo();
    if (!info.isAuthPage) {
      return;
    }

    if (info.file === "login.html") {
      initLoginPage();
      return;
    }

    if (info.file === "signup.html") {
      initSignupPage();
      return;
    }

    if (info.file === "forgot-password.html") {
      initForgotPasswordPage();
      return;
    }

    if (info.file === "reset-password.html") {
      initResetPasswordPage();
    }
  });
})();
