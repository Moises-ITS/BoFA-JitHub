import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "..");
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "playwright-report",
  "test-results",
]);

const EXCLUDED_FILES = new Set([
  ".env.example",
  "README.md",
  "REQUIREMENTS.md",
  "scan-secrets.mjs",
]);

const secretPatterns = [
  { name: "Clerk secret key", regex: /\bsk_(test|live)_[A-Za-z0-9]{20,}\b/g },
  { name: "GitHub token", regex: /\bghp_[A-Za-z0-9]{20,}\b/g },
  { name: "OpenAI key", regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: "Google API key", regex: /\bAIza[0-9A-Za-z\-_]{20,}\b/g },
  { name: "Database URL with password", regex: /postgres(ql)?:\/\/[^:\s]+:[^@\s]+@/gi },
  { name: "Generic private key", regex: /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----/g },
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...(await walk(full)));
      continue;
    }
    out.push(full);
  }
  return out;
}

async function main() {
  const files = await walk(ROOT);
  const findings = [];

  for (const file of files) {
    const name = path.basename(file);
    if (EXCLUDED_FILES.has(name)) continue;
    if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".gif")) continue;

    let text;
    try {
      text = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }

    for (const pattern of secretPatterns) {
      if (pattern.regex.test(text)) {
        findings.push({
          file: path.relative(ROOT, file),
          pattern: pattern.name,
        });
        break;
      }
    }
  }

  if (findings.length) {
    console.error("Potential secrets detected:");
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.pattern}`);
    }
    process.exit(1);
  }

  console.log("No obvious secrets detected.");
}

await main();
