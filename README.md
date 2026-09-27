# Thoughts (Portfolio Notes Content)

A Git-based, canonical MDX source repository for engineering notes and technical writing featured on the portfolio.

This repository serves as the single source of truth for all Note content. Content is written in standard MDX, strictly validated via Zod schemas in CI, and synchronized via the Notes API into portfolio metadata storage.

---

## Architecture & Publishing Flow

```text
Author writes MDX in notes/*.mdx
              │
              ▼
    Pull Request Opened
              │
              ▼
 GitHub Actions: validate.yml
   (Typecheck + Zod Schema + Slug + Date + MDX Integrity)
              │
              ▼
        Merge to main
              │
              ▼
  GitHub Actions: publish.yml
   (Builds generated/notes.json manifest)
              │
              ▼
  HTTP POST to Notes API (/sync)
   (Authenticated via NOTES_SYNC_TOKEN)
              │
              ▼
   Notes API updates Firestore
              │
              ▼
  Portfolio UI renders Note
```

> **Security Note:** This repository never communicates with Firebase/Firestore directly and holds no database credentials. The Notes API manages Firestore mutations.

---

## Directory Structure

```text
.
├── .github/
│   └── workflows/
│       ├── validate.yml      # CI workflow for pull requests
│       └── publish.yml       # CD workflow for main branch sync
├── notes/                    # Canonical MDX content files
│   ├── building-billoma.mdx
│   ├── example-note.mdx
│   ├── realtime-ai-voice.mdx
│   └── scalable-saas-architecture.mdx
├── schemas/
│   └── note.ts               # Canonical Zod schema & TypeScript contracts
├── scripts/
│   ├── validate-notes.ts     # Content validation script
│   └── build-index.ts        # Metadata manifest generator
├── .editorconfig             # Editor format configurations
├── .gitignore                # Secret and artifact ignore patterns
├── package.json              # Scripts and build dependencies
├── tsconfig.json             # TypeScript compiler configuration
└── README.md                 # Repository documentation
```

---

## Creating a Note

Create a new `.mdx` file in the `notes/` directory. The filename must match the note's `slug` (e.g. `notes/my-new-post.mdx` with `slug: "my-new-post"`).

```mdx
---
title: "Designing Distributed Queues"
slug: "designing-distributed-queues"
description: "Lessons on idempotency, dead-letter queues, and partition strategies under high concurrency."
publishedAt: "2026-09-27"
status: "published"
sequence: "05"
readingTime: 7
tags:
  - Architecture
  - Distributed Systems
related:
  - scalable-saas-architecture
---

Content goes here using standard Markdown and MDX.

## Section Heading

Paragraph explaining architectural decisions.

```typescript
async function processTask(task: Task) {
  // Idempotent task execution
}
```
```

---

## Frontmatter Schema Reference

| Field | Type | Required | Description |
|---|---|:---:|---|
| `title` | `string` | **Yes** | Note headline displayed on the article and card. |
| `slug` | `string` | **Yes** | Lowercase kebab-case identifier (must match filename). |
| `description` | `string` | **Yes** | Teaser summary used for card previews and SEO meta description. |
| `publishedAt` | `string` | **Yes** | Publication date in `YYYY-MM-DD` ISO format. |
| `updatedAt` | `string` | No | Last revision date in `YYYY-MM-DD` ISO format. |
| `status` | `"draft" \| "published" \| "archived"` | No | Publication state (default: `"published"`). |
| `tags` | `string[]` | No | List of categorization tags (default: `[]`). |
| `related` | `string[]` | No | List of related note slugs for cross-referencing. |
| `sequence` | `string` | No | Sequence identifier (e.g., `"01"`). Auto-computed if omitted. |
| `readingTime` | `number` | No | Reading time in minutes. Auto-computed if omitted. |
| `author` | `{ name: string; avatar?: string }` | No | Optional author metadata. |
| `coverImage` | `{ src: string; alt: string }` | No | Optional cover image metadata. |

---

## Local Development & Validation

### 1. Install Dependencies
```bash
npm install
```

### 2. Typecheck
Verify schema and script typings:
```bash
npm run typecheck
```

### 3. Validate MDX Content
Run complete integrity and schema checks:
```bash
npm run validate
```

### 4. Build Metadata Manifest
Generate `generated/notes.json`:
```bash
npm run build:index
```

---

## CI/CD Secrets Configuration

To enable automated synchronization with the Notes API, configure the following repository secrets in GitHub (`Settings` > `Secrets and variables` > `Actions`):

* `NOTES_API_URL`: The HTTPS base URL of your deployed Notes API (e.g. `https://api.portfolio.dev`).
* `NOTES_SYNC_TOKEN`: The bearer authentication token accepted by the Notes API sync endpoint.
