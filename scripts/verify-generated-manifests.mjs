import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const chromeManifestPath = join(root, ".output", "chrome-mv3", "manifest.json");
const firefoxManifestPath = join(root, ".output", "firefox-mv2", "manifest.json");

function readManifest(path, label) {
  if (!existsSync(path)) throw new Error(`${label} manifest is missing at ${path}. Run the matching WXT build first.`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function permissions(manifest) {
  return new Set(Array.isArray(manifest.permissions) ? manifest.permissions : []);
}

function assertPermissionSet(label, manifest, expected) {
  const actual = permissions(manifest);
  for (const item of expected) {
    if (!actual.has(item)) throw new Error(`${label} manifest is missing required permission ${item}.`);
  }
}

function hasAllUrlsHostCoverage(manifest) {
  return permissions(manifest).has("<all_urls>")
    || (Array.isArray(manifest.host_permissions) && manifest.host_permissions.includes("<all_urls>"));
}

const chrome = readManifest(chromeManifestPath, "Chrome");
const firefox = readManifest(firefoxManifestPath, "Firefox");
const chromePermissions = permissions(chrome);
const firefoxPermissions = permissions(firefox);

assertPermissionSet("Chrome", chrome, ["storage", "declarativeNetRequest", "webNavigation"]);
assertPermissionSet("Firefox", firefox, ["storage", "declarativeNetRequest", "webNavigation", "webRequest", "webRequestBlocking"]);

for (const forbidden of ["webRequest", "webRequestBlocking", "webRequestFilterResponse", "activeTab", "scripting"]) {
  if (chromePermissions.has(forbidden)) throw new Error(`Chrome manifest must not request ${forbidden}.`);
}

if (firefox.manifest_version === 3 && !firefoxPermissions.has("webRequestFilterResponse")) {
  throw new Error("Firefox MV3 manifest must request webRequestFilterResponse for filterResponseData.");
}

if (firefox.manifest_version !== 3 && firefoxPermissions.has("webRequestFilterResponse")) {
  throw new Error("Firefox MV2 manifest must not request the Firefox MV3-only webRequestFilterResponse permission.");
}

if (firefox.manifest_version !== 3) {
  if (!firefoxPermissions.has("<all_urls>")) {
    throw new Error("Firefox MV2 manifest must request <all_urls> through permissions, not host_permissions.");
  }
  if (Array.isArray(firefox.host_permissions) && firefox.host_permissions.length > 0) {
    throw new Error("Firefox MV2 manifest must not emit host_permissions; host permissions belong in permissions for Manifest V2.");
  }
}

for (const [label, manifest] of [["Chrome", chrome], ["Firefox", firefox]]) {
  if (permissions(manifest).has("activeTab")) throw new Error(`${label} manifest must not request activeTab.`);
  if (permissions(manifest).has("scripting")) throw new Error(`${label} manifest must not request scripting.`);
  if (!hasAllUrlsHostCoverage(manifest)) {
    throw new Error(`${label} manifest must keep explicit all-URL host coverage.`);
  }
}

console.log("Generated manifest verification passed.");
