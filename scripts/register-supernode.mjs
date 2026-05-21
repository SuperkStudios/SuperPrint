#!/usr/bin/env node

const apiUrl = process.env.SUPERPRINT_API_URL;
const registrationToken = process.env.SUPERNODE_REGISTRATION_TOKEN;
const nodeId = process.env.SUPERNODE_ID ?? "supernode-local";
const displayName = process.env.SUPERNODE_DISPLAY_NAME ?? "Local SuperNode";
const printerId = process.env.SUPERNODE_PRINTER_ID || null;

if (!apiUrl || !registrationToken) {
  console.error("Set SUPERPRINT_API_URL and SUPERNODE_REGISTRATION_TOKEN before running this script.");
  process.exit(1);
}

const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/supernode/register`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-supernode-registration-token": registrationToken
  },
  body: JSON.stringify({ nodeId, displayName, printerId })
});

const body = await response.json().catch(() => null);
if (!response.ok) {
  console.error(body?.error ?? `Registration failed with ${response.status}`);
  process.exit(1);
}

console.log("SuperNode registered. Save this secret in .env.supernode as SUPERNODE_SECRET:");
console.log(body.nodeSecret);
