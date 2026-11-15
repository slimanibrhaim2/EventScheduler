const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "games");
const MAX_BYTES = 1_800_000; // ~1.8MB decoded

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

function extensionForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

/** Save a data-URL or raw base64 image. Returns public path `/uploads/games/...`. */
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
  return `/uploads/games/${name}`;
}

function deleteGamePhoto(photoUrl) {
  if (!photoUrl || typeof photoUrl !== "string") return;
  if (!photoUrl.startsWith("/uploads/games/")) return;
  const base = path.basename(photoUrl);
  if (!base || base === "." || base === "..") return;
  const filePath = path.join(UPLOAD_ROOT, base);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore missing/locked files
  }
}

module.exports = { saveGamePhoto, deleteGamePhoto, UPLOAD_ROOT, ensureUploadDir };
