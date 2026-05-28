#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const NOTION_VERSION = "2022-06-28";
const OUTBOX_DIR = ".dev-log-outbox";
const DEFAULT_DATABASE_ID = "32564206e5f48098bec3e4b4b7c7cc3e";

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue
      .replace(/^['"]|['"]$/g, "")
      .replace(/\\n/g, "\n");
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    commit: "HEAD",
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--commit") {
      parsed.commit = args[index + 1] ?? "HEAD";
      index += 1;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    }
  }

  return parsed;
}

function notionText(content) {
  return {
    type: "text",
    text: { content: content.slice(0, 2000) },
  };
}

function paragraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: text ? [notionText(text)] : [] },
  };
}

function heading(text) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [notionText(text)] },
  };
}

function bullet(text) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [notionText(text)] },
  };
}

function codeBlock(text, language = "plain text") {
  return {
    object: "block",
    type: "code",
    code: {
      language,
      rich_text: [notionText(text || "(none)")],
    },
  };
}

function compactFileList(nameStatus) {
  if (!nameStatus) return ["No file list available."];

  return nameStatus
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 40)
    .map((line) => {
      const [status, ...fileParts] = line.split(/\s+/);
      return `${status}: ${fileParts.join(" ")}`;
    });
}

function getCommitInfo(commitRef) {
  const format = "%H%x1f%h%x1f%s%x1f%b%x1f%an%x1f%ad";
  const raw = runGit(["show", "-s", `--format=${format}`, "--date=short", commitRef]);
  const [sha, shortSha, subject, body, author, date] = raw.split("\x1f");
  const nameStatus = runGit(["diff-tree", "--no-commit-id", "--name-status", "-r", sha]);
  const stat = runGit(["show", "--stat", "--oneline", "--format=", sha]);

  return {
    sha,
    shortSha,
    subject,
    body: body.trim(),
    author,
    date,
    nameStatus,
    stat,
  };
}

function buildMarkdown(info, nextStep) {
  const files = compactFileList(info.nameStatus).map((file) => `- ${file}`).join("\n");

  return `## Goal of Session

Capture commit ${info.shortSha}: ${info.subject}

## Commit

- Hash: ${info.sha}
- Author: ${info.author}
- Date: ${info.date}

## Files Edited

${files}

## Diff Stats

\`\`\`
${info.stat || "(none)"}
\`\`\`

## Commit Message

${info.body ? `${info.subject}\n\n${info.body}` : info.subject}

## Next Step

${nextStep}
`;
}

function buildNotionPayload(databaseId, info, markdown, nextStep) {
  const title = `Dev Session Log - ${info.date} - ${info.subject}`;
  const files = compactFileList(info.nameStatus);

  return {
    parent: { database_id: databaseId },
    properties: {
      "Session Title": {
        title: [{ type: "text", text: { content: title.slice(0, 2000) } }],
      },
      Date: {
        date: { start: info.date },
      },
      Status: {
        select: { name: process.env.NOTION_DEV_LOG_STATUS || "Progress" },
      },
      "Next Step": {
        rich_text: [notionText(nextStep)],
      },
    },
    children: [
      heading("Goal of Session"),
      paragraph(`Capture commit ${info.shortSha}: ${info.subject}`),
      heading("Commit"),
      bullet(`Hash: ${info.sha}`),
      bullet(`Author: ${info.author}`),
      bullet(`Date: ${info.date}`),
      heading("Files Edited"),
      ...files.map(bullet),
      heading("Diff Stats"),
      codeBlock(info.stat || "(none)"),
      heading("Commit Message"),
      paragraph(info.body ? `${info.subject}\n\n${info.body}` : info.subject),
      heading("Next Step"),
      paragraph(nextStep),
      heading("Markdown Backup"),
      codeBlock(markdown, "markdown"),
    ],
  };
}

function writeOutbox(info, markdown) {
  mkdirSync(OUTBOX_DIR, { recursive: true });
  const outboxPath = path.join(OUTBOX_DIR, `${info.date}-${info.shortSha}.md`);
  writeFileSync(outboxPath, markdown);
  return outboxPath;
}

async function createNotionPage(payload, token) {
  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion API ${response.status}: ${text}`);
  }

  return response.json();
}

async function main() {
  const repoRoot = runGit(["rev-parse", "--show-toplevel"]);
  process.chdir(repoRoot);

  loadEnvFile(path.join(repoRoot, ".env"));
  loadEnvFile(path.join(repoRoot, ".env.local"));

  if (process.env.SKIP_NOTION_DEV_LOG === "1") {
    console.log("Notion dev log skipped because SKIP_NOTION_DEV_LOG=1.");
    return;
  }

  const { commit, dryRun } = parseArgs();
  const info = getCommitInfo(commit);
  const nextStep =
    process.env.NOTION_DEV_LOG_NEXT_STEP || "Review and test the committed changes.";
  const markdown = buildMarkdown(info, nextStep);
  const databaseId = process.env.NOTION_DEV_LOG_DATABASE_ID || DEFAULT_DATABASE_ID;
  const token = process.env.NOTION_TOKEN;
  const payload = buildNotionPayload(databaseId, info, markdown, nextStep);

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (!token) {
    const outboxPath = writeOutbox(info, markdown);
    console.warn(
      `NOTION_TOKEN is not set. Wrote pending dev log to ${outboxPath}.`
    );
    return;
  }

  try {
    const page = await createNotionPage(payload, token);
    console.log(`Created Notion dev log: ${page.url}`);
  } catch (error) {
    const outboxPath = writeOutbox(info, markdown);
    console.error(`${error.message}\nWrote pending dev log to ${outboxPath}.`);
    process.exitCode = 1;
  }
}

main();
