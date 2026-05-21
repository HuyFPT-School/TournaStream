const crypto = require("crypto");
const mongoose = require("mongoose");
const { env } = require("../src/config/env");
const { User } = require("../src/models/User");
const { createRefreshToken, hashToken } = require("../src/utils/token");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:4000";

const createCookieJar = () => {
  const jar = new Map();

  const setCookies = (setCookieHeaders = []) => {
    setCookieHeaders.forEach((cookieLine) => {
      const [pair] = cookieLine.split(";");
      const [name, value] = pair.split("=");
      if (name) {
        jar.set(name.trim(), (value || "").trim());
      }
    });
  };

  const header = () => {
    if (jar.size === 0) return "";
    return Array.from(jar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  };

  return { setCookies, header };
};

const getSetCookieHeaders = (headers) => {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,(?=[^;]+=[^;]+)/);
};

const requestJson = async (url, options = {}, jar) => {
  const headers = { ...(options.headers || {}) };
  if (jar) {
    const cookieHeader = jar.header();
    if (cookieHeader) {
      headers.cookie = cookieHeader;
    }
  }

  const response = await fetch(url, { ...options, headers });

  if (jar) {
    jar.setCookies(getSetCookieHeaders(response.headers));
  }

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { response, json };
};

const record = (results, name, ok, detail) => {
  results.push({
    test: name,
    status: ok ? "PASS" : "FAIL",
    detail: detail || "",
  });
};

const ensureDatabase = async () => {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }
  await mongoose.connect(env.mongodbUri);
};

const test = async () => {
  const jar = createCookieJar();
  const results = [];
  const email = `test+${crypto.randomBytes(6).toString("hex")}@example.com`;
  const password = "Test@1234";
  const newPassword = "New@1234";
  const resetPassword = "Reset@1234";

  try {
    const health = await requestJson(`${BASE_URL}/api/health`);
    record(results, "health", health.json?.status === "ok", health.json);

    const registerInvalid = await requestJson(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Test User",
        email: "bad",
        password,
      }),
    });
    record(
      results,
      "register invalid email",
      registerInvalid.response.status === 400,
    );

    const registerShort = await requestJson(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Test User",
        email: "short@example.com",
        password: "123",
      }),
    });
    record(
      results,
      "register short password",
      registerShort.response.status === 400,
    );

    const register = await requestJson(
      `${BASE_URL}/api/auth/register`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: "Test User", email, password }),
      },
      jar,
    );
    record(
      results,
      "register",
      register.response.status === 201,
      register.json,
    );

    const registerDup = await requestJson(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName: "Test User", email, password }),
    });
    record(results, "register duplicate", registerDup.response.status === 409);

    const loginWrong = await requestJson(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "wrong" }),
    });
    record(results, "login wrong password", loginWrong.response.status === 401);

    const login = await requestJson(
      `${BASE_URL}/api/auth/login`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
      jar,
    );
    record(results, "login", login.response.status === 200, login.json);

    const accessToken = login.json?.accessToken;
    const me = await requestJson(
      `${BASE_URL}/api/auth/me`,
      { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
      jar,
    );
    record(results, "me", me.response.status === 200, me.json);

    const refresh = await requestJson(
      `${BASE_URL}/api/auth/refresh`,
      { method: "POST" },
      jar,
    );
    record(results, "refresh", refresh.response.status === 200, refresh.json);

    const change = await requestJson(
      `${BASE_URL}/api/auth/change-password`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ currentPassword: password, newPassword }),
      },
      jar,
    );
    record(
      results,
      "change password",
      change.response.status === 200,
      change.json,
    );

    const loginOld = await requestJson(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    record(results, "login old password", loginOld.response.status === 401);

    const loginNew = await requestJson(
      `${BASE_URL}/api/auth/login`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: newPassword }),
      },
      jar,
    );
    record(results, "login new password", loginNew.response.status === 200);

    const forgotInvalid = await requestJson(
      `${BASE_URL}/api/auth/forgot-password`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "bad" }),
      },
    );
    record(
      results,
      "forgot password invalid",
      forgotInvalid.response.status === 400,
    );

    const forgot = await requestJson(
      `${BASE_URL}/api/auth/forgot-password`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      },
      jar,
    );
    record(
      results,
      "forgot password",
      forgot.response.status === 200,
      forgot.json,
    );

    await ensureDatabase();
    const user = await User.findOne({ email });
    if (!user) {
      record(results, "reset password", false, "User not found in DB");
    } else {
      const resetToken = createRefreshToken();
      user.resetTokenHash = hashToken(resetToken);
      user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const reset = await requestJson(
        `${BASE_URL}/api/auth/reset-password`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            token: resetToken,
            newPassword: resetPassword,
          }),
        },
        jar,
      );
      record(
        results,
        "reset password",
        reset.response.status === 200,
        reset.json,
      );

      const loginAfterReset = await requestJson(
        `${BASE_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password: resetPassword }),
        },
        jar,
      );
      record(
        results,
        "login after reset",
        loginAfterReset.response.status === 200,
        loginAfterReset.json,
      );
    }

    const logout = await requestJson(
      `${BASE_URL}/api/auth/logout`,
      { method: "POST" },
      jar,
    );
    record(results, "logout", logout.response.status === 200, logout.json);

    const refreshAfter = await requestJson(
      `${BASE_URL}/api/auth/refresh`,
      { method: "POST" },
      jar,
    );
    record(
      results,
      "refresh after logout",
      refreshAfter.response.status === 401,
    );
  } catch (error) {
    record(results, "unexpected error", false, error.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }

  console.table(results);
  const failed = results.filter((item) => item.status !== "PASS");
  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

test();
