# Notion Dev Log Automation

This repo has a local `post-commit` hook that runs:

```sh
node scripts/notion-dev-log.mjs --commit HEAD
```

After each commit, the script creates a page in the `Togetli Dev Log` Notion database with:

- session title
- date
- status
- next step
- commit hash
- changed files
- diff stats
- commit message

## Setup

Create a Notion internal integration and share the `Togetli Dev Log` database with it. Then add these values to `.env.local`:

```sh
NOTION_TOKEN=secret_your_notion_integration_token
NOTION_DEV_LOG_DATABASE_ID=32564206e5f48098bec3e4b4b7c7cc3e
NOTION_DEV_LOG_STATUS=Progress
NOTION_DEV_LOG_NEXT_STEP="Review and test the committed changes."
```

The database ID above is the existing `Togetli Dev Log` database.

## Manual Run

To preview the payload without sending it:

```sh
node scripts/notion-dev-log.mjs --commit HEAD --dry-run
```

To create a log for the latest commit:

```sh
node scripts/notion-dev-log.mjs --commit HEAD
```

## Fallback Behavior

If `NOTION_TOKEN` is missing, or the Notion API call fails, the script writes a markdown backup to `.dev-log-outbox/`.

Use this to skip logging for one commit:

```sh
SKIP_NOTION_DEV_LOG=1 git commit -m "your message"
```

## Limitation

Git can only see commit data. It cannot know every command run, issue discovered, or decision made during a session unless those details are added to the commit message or captured manually before commit.
