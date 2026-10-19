// Bumps the plugin version, commits it and tags it.
//
//   pnpm release patch | minor | major | <x.y.z>
//
// Updates package.json, manifest.json and versions.json (keeping each file's
// formatting), then creates a "<version>" commit and a "<version>" tag (no "v",
// which is what the release workflow and Obsidian expect). Nothing is pushed.
//
// This replaces `pnpm version`, which (as of pnpm 11) skips the "version"
// lifecycle script and ignores .npmrc's tag-version-prefix.
import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

/** Reads a JSON file along with the indentation it uses, so it can be written back the same way. */
function readJson(path) {
  const text = readFileSync(path, "utf8");
  const indent = text.match(/^[ \t]+(?=")/m)?.[0] ?? "  ";
  return { data: JSON.parse(text), indent };
}

function writeJson(path, { data, indent }) {
  writeFileSync(path, JSON.stringify(data, null, indent) + "\n");
}

function nextVersion(current, bump) {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const [major, minor, patch] = current.split(".").map(Number);
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "major") return `${major + 1}.0.0`;
  fail(`unknown bump "${bump ?? ""}", use patch, minor, major or an explicit x.y.z`);
}

// ── Checks ───────────────────────────────────────────────────────────────────

if (git("status", "--porcelain") !== "") fail("working tree has uncommitted changes, commit or stash them first");

const pkg = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");

const version = nextVersion(pkg.data.version, process.argv[2]);
if (git("tag", "--list", version) !== "") fail(`tag ${version} already exists`);

// ── Bump ─────────────────────────────────────────────────────────────────────

pkg.data.version = version;
manifest.data.version = version;
versions.data[version] = manifest.data.minAppVersion;

writeJson("package.json", pkg);
writeJson("manifest.json", manifest);
writeJson("versions.json", versions);

git("add", "package.json", "manifest.json", "versions.json");
git("commit", "-m", version);
git("tag", version);

process.stdout.write(
  `Bumped to ${version}, committed and tagged. To release:\n\n` +
    `  git push origin ${git("branch", "--show-current")}\n` +
    `  git push origin ${version}\n`
);
