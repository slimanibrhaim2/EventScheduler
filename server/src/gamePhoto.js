const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "games");
const MAX_BYTES = 1_800_000; // ~1.8MB decoded
const PUBLIC_PREFIX = "/api/game-photos";
const LEGACY_PREFIX = "/uploads/games";

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

function extensionForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

function photoBasename(photoUrl) {
  if (!photoUrl || typeof photoUrl !== "string") return "";
  if (photoUrl.startsWith("data:")) return "";
  if (!photoUrl.startsWith(`${PUBLIC_PREFIX}/`) && !photoUrl.startsWith(`${LEGACY_PREFIX}/`)) {
    return "";
  }
  const base = path.basename(photoUrl.split("?")[0]);
  if (!base || base === "." || base === ".." || base.includes("\0")) return "";
  return base;
}

/** Normalize stored paths to the public API route (works through nginx /api proxy). */
function publicPhotoUrl(photoUrl) {
  if (!photoUrl || typeof photoUrl !== "string") return "";
  if (photoUrl.startsWith("data:")) return photoUrl;
  const base = photoBasename(photoUrl);
  return base ? `${PUBLIC_PREFIX}/${base}` : "";
}

function absolutePhotoPath(photoUrl) {
  const base = photoBasename(photoUrl);
  if (!base) return null;
  return path.join(UPLOAD_ROOT, base);
}

/** Save a data-URL or raw base64 image. Returns public path `/api/game-photos/...`. */
function saveGamePhoto(dataUrl, gameIdHint = "game") {
  const text = String(dataUrl || "").trim();
  if (!text) return null;

  const match = text.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Photo must be a base64 image (jpg, png, webp, or gif)");
  }
  const mime = match[1].toLowerCase();
  if (!mime.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("Photo data is empty");
  if (buffer.length > MAX_BYTES) {
    throw new Error("Photo is too large (max about 1.5MB). Try a smaller image.");
  }

  ensureUploadDir();
  const ext = extensionForMime(mime);
  const safeHint = String(gameIdHint || "game")
    .replace(/[^\w-]+/g, "_")
    .slice(0, 40);
  const name = `${safeHint}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const filePath = path.join(UPLOAD_ROOT, name);
  fs.writeFileSync(filePath, buffer);
  return `${PUBLIC_PREFIX}/${name}`;
}

function deleteGamePhoto(photoUrl) {
  const filePath = absolutePhotoPath(photoUrl);
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore missing/locked files
  }
}

function mimeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

module.exports = {
  saveGamePhoto,
  deleteGamePhoto,
  publicPhotoUrl,
  absolutePhotoPath,
  mimeForFile,
  UPLOAD_ROOT,
  ensureUploadDir,
  PUBLIC_PREFIX,
};
