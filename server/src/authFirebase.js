const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

let ready = false;

function initFirebaseAdmin() {
  if (ready) return true;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "Firebase Admin not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
    );
    return false;
  }

  // dotenv may keep wrapping quotes; private keys use \n escapes in .env
  privateKey = privateKey.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
  ready = true;
  console.log("Firebase Admin ready");
  return true;
}

async function verifyIdToken(token) {
  if (!initFirebaseAdmin()) {
    throw new Error("Firebase Admin is not configured on the server");
  }
  return getAuth().verifyIdToken(token);
}

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = {
  initFirebaseAdmin,
  verifyIdToken,
  adminEmails,
};
