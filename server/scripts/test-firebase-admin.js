require("dotenv").config();
const { initFirebaseAdmin, adminEmails } = require("../src/authFirebase");

console.log("emails", adminEmails());
console.log("init", initFirebaseAdmin());
