import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import getReadingTime from "reading-time";
import { NoteFrontmatterSchema, NoteMetadata } from "../schemas/note.js";

const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/ShlokChaitanya/thoughts/refs/heads/main";

const NOTES_DIR = path.resolve(process.cwd(), "notes");
const OUTPUT_DIR = path.resolve(process.cwd(), "generated");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "notes.json");

const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function formatDateDisplay(isoDate: string): string {
  const [yearStr, monthStr] = isoDate.split("-");
  const monthIndex = Number.parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIndex] || "JAN";
  return `${monthName} ${yearStr}`;
}

function findMdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMdxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(fullPath);
    }
  }

  return files;
}

function main() {
  console.log("Building Notes Manifest");
  console.log("────────────────────────────\n");

  const mdxFiles = findMdxFiles(NOTES_DIR);
  if (mdxFiles.length === 0) {
    console.error(`✗ No MDX files found in ${NOTES_DIR}`);
    process.exit(1);
  }

  const rawNotes: {
    frontmatter: ReturnType<typeof NoteFrontmatterSchema.parse>;
    relativePath: string;
    readingTimeMinutes: number;
  }[] = [];

  for (const filePath of mdxFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = matter(content);

    const validation = NoteFrontmatterSchema.safeParse(parsed.data);
    if (!validation.success) {
      console.error(`✗ Schema validation failed for ${relativePath}:`);
      console.error(validation.error.message);
      process.exit(1);
    }

    const calculatedReading = Math.max(1, Math.ceil(getReadingTime(parsed.content).minutes));
    rawNotes.push({
      frontmatter: validation.data,
      relativePath,
      readingTimeMinutes: validation.data.readingTime ?? calculatedReading,
    });
  }

  // Sort notes chronologically by publishedAt descending
  rawNotes.sort((a, b) => {
    return new Date(b.frontmatter.publishedAt).getTime() - new Date(a.frontmatter.publishedAt).getTime();
  });

  const notes: NoteMetadata[] = rawNotes.map((item, index) => {
    const fm = item.frontmatter;
    const computedNumber = String(rawNotes.length - index).padStart(2, "0");

    return {
      slug: fm.slug,
      number: fm.sequence ?? computedNumber,
      title: fm.title,
      description: fm.description,
      publishedAt: fm.publishedAt,
      updatedAt: fm.updatedAt,
      date: formatDateDisplay(fm.publishedAt),
      dateISO: fm.publishedAt,
      minutes: item.readingTimeMinutes,
      tags: fm.tags,
      related: fm.related,
      status: fm.status,
      path: `${GITHUB_RAW_BASE}/${item.relativePath.replace(/\\/g, "/")}`,
    };
  });

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: notes.length,
    notes,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`✓ Manifest generated: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`✓ Indexed ${notes.length} notes:`);
  for (const note of notes) {
    console.log(`   [#${note.number}] ${note.slug} (${note.date} · ${note.minutes} min)`);
  }
  console.log("\nBuild complete.");
}

main();
