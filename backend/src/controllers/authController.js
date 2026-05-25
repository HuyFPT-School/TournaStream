const bcrypt = require("bcryptjs");
const { User } = require("../models/User");
const { env } = require("../config/env");
const {
  createAccessToken,
  createRefreshToken,
  hashToken,
} = require("../utils/token");
const {
  validateEmail,
  validatePassword,
  validateFullName,
} = require("../utils/validators");
const {
  sendVerificationEmail,
  sendResetPasswordEmail,
} = require("../services/emailService");

function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    maxAge: env.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
  });
}

async function register(req, res) {
  const { fullName, email, password } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!validateFullName(fullName)) {
    return res.status(400).json({ message: "Invalid full name" });
  }
  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({ message: "Invalid email" });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ message: "Invalid password" });
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "Email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const role = (normalizedEmail === "admin@tournastream.com" || normalizedEmail.endsWith("@tournastream.admin"))
    ? "admin"
    : "user";

  const user = new User({
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    isVerified: env.skipEmailVerification || role === "admin",
    role,
  });

  if (!user.isVerified) {
    const verifyToken = createRefreshToken();
    user.verificationTokenHash = hashToken(verifyToken);
    user.verificationTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );
    const link = `${env.clientUrl}/verify-email?token=${verifyToken}&email=${encodeURIComponent(
      normalizedEmail,
    )}`;
    await sendVerificationEmail({ to: normalizedEmail, link });
  }

  await user.save();

  res.status(201).json({
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
    requiresVerification: !user.isVerified,
  });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!validateEmail(normalizedEmail) || !password) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (!user.isVerified) {
    return res.status(403).json({ message: "Email not verified" });
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken();
  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(
    Date.now() + env.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
  );
  await user.save();

  setRefreshCookie(res, refreshToken);

  res.json({
    accessToken,
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  });
}

async function refresh(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ message: "Missing refresh token" });
  }

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    refreshTokenHash: tokenHash,
    refreshTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const accessToken = createAccessToken(user);
  const newRefreshToken = createRefreshToken();
  user.refreshTokenHash = hashToken(newRefreshToken);
  user.refreshTokenExpiresAt = new Date(
    Date.now() + env.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
  );
  await user.save();

  setRefreshCookie(res, newRefreshToken);

  res.json({
    accessToken,
    user: {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  });
}

async function logout(req, res) {
  const token = req.cookies?.refreshToken;
  if (token) {
    const tokenHash = hashToken(token);
    await User.updateOne(
      { refreshTokenHash: tokenHash },
      { $set: { refreshTokenHash: null, refreshTokenExpiresAt: null } },
    );
  }

  clearRefreshCookie(res);
  res.json({ message: "Logged out" });
}

async function forgotPassword(req, res) {
  const { email } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({ message: "Invalid email" });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (user) {
    const resetToken = createRefreshToken();
    user.resetTokenHash = hashToken(resetToken);
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const link = `${env.clientUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(
      normalizedEmail,
    )}`;
    await sendResetPasswordEmail({ to: normalizedEmail, link });
  }

  res.json({ message: "If the email exists, reset instructions were sent." });
}

async function resetPassword(req, res) {
  const { email, token, newPassword } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();

  if (!validateEmail(normalizedEmail)) {
    return res.status(400).json({ message: "Invalid email" });
  }
  if (!token || !validatePassword(newPassword)) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    email: normalizedEmail,
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid reset token" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  await user.save();

  res.json({ message: "Password updated" });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !validatePassword(newPassword)) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    return res.status(400).json({ message: "Current password incorrect" });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ message: "Password changed" });
}

async function verifyEmail(req, res) {
  const { token, email } = req.query || {};
  const normalizedEmail = (email || "").toString().trim().toLowerCase();

  if (!validateEmail(normalizedEmail) || !token) {
    return res.status(400).json({ message: "Invalid request" });
  }

  const tokenHash = hashToken(token.toString());
  const user = await User.findOne({
    email: normalizedEmail,
    verificationTokenHash: tokenHash,
    verificationTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid verification token" });
  }

  user.isVerified = true;
  user.verificationTokenHash = null;
  user.verificationTokenExpiresAt = null;
  await user.save();

  res.json({ message: "Email verified" });
}

async function getMe(req, res) {
  const user = await User.findById(req.user.id).select("fullName email role");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  res.json({
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  getMe,
};
