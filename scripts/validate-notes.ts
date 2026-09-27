import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { NoteFrontmatterSchema } from "../schemas/note.js";

const NOTES_DIR = path.resolve(process.cwd(), "notes");

interface ValidationError {
  file: string;
  category: "frontmatter" | "slug" | "date" | "mdx" | "duplicate" | "relation";
  message: string;
}

function findMdxFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
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

function validateCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function validateBasicMdx(body: string): string | null {
  if (!body || body.trim().length < 20) {
    return "MDX body is empty or too short (minimum 20 characters required)";
  }

  // Check for unclosed code fences
  const codeBlockCount = (body.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    return "MDX body has unclosed code fence (```)";
  }

  return null;
}

function main() {
  console.log("Notes Validation");
  console.log("────────────────────────────\n");

  const mdxFiles = findMdxFiles(NOTES_DIR);
  if (mdxFiles.length === 0) {
    console.error(`✗ No MDX files discovered in ${NOTES_DIR}`);
    process.exit(1);
  }

  console.log(`Discovered: ${mdxFiles.length} note${mdxFiles.length === 1 ? "" : "s"}\n`);

  const errors: ValidationError[] = [];
  const discoveredSlugs = new Map<string, string>(); // slug -> relativePath
  const parsedNotes: { file: string; slug: string; related: string[] }[] = [];

  const categoryPass = {
    frontmatter: true,
    slug: true,
    dates: true,
    mdx: true,
    duplicates: true,
    relations: true,
  };

  for (const filePath of mdxFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    const fileName = path.basename(filePath);
    const expectedSlug = path.parse(fileName).name;

    // File size check (max 500 KB)
    const stats = fs.statSync(filePath);
    if (stats.size > 500 * 1024) {
      errors.push({
        file: relativePath,
        category: "mdx",
        message: `File size exceeds 500 KB limit (${(stats.size / 1024).toFixed(1)} KB)`,
      });
      categoryPass.mdx = false;
    }

    let rawContent = "";
    try {
      rawContent = fs.readFileSync(filePath, "utf-8");
    } catch (err) {
      errors.push({
        file: relativePath,
        category: "frontmatter",
        message: `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
      });
      categoryPass.frontmatter = false;
      continue;
    }

    let parsedMatter: matter.GrayMatterFile<string>;
    try {
      parsedMatter = matter(rawContent);
    } catch (err) {
      errors.push({
        file: relativePath,
        category: "frontmatter",
        message: `Malformed frontmatter YAML: ${err instanceof Error ? err.message : String(err)}`,
      });
      categoryPass.frontmatter = false;
      continue;
    }

    const { data: frontmatter, content: body } = parsedMatter;

    // Validate frontmatter schema with Zod
    const zodResult = NoteFrontmatterSchema.safeParse(frontmatter);
    if (!zodResult.success) {
      for (const issue of zodResult.error.issues) {
        errors.push({
          file: relativePath,
          category: "frontmatter",
          message: `${issue.path.join(".") || "frontmatter"}: ${issue.message}`,
        });
      }
      categoryPass.frontmatter = false;
    }

    const slug = frontmatter.slug as string | undefined;

    // Validate slug
    if (slug) {
      if (slug !== expectedSlug) {
        errors.push({
          file: relativePath,
          category: "slug",
          message: `Slug '${slug}' does not match filename '${expectedSlug}'`,
        });
        categoryPass.slug = false;
      }

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        errors.push({
          file: relativePath,
          category: "slug",
          message: `Slug '${slug}' is not valid lowercase kebab-case`,
        });
        categoryPass.slug = false;
      }

      if (slug.includes(" ") || slug.includes("/") || slug.includes("\\") || slug.includes("..")) {
        errors.push({
          file: relativePath,
          category: "slug",
          message: `Slug contains forbidden characters (spaces, slashes, or '..')`,
        });
        categoryPass.slug = false;
      }

      // Check duplicates
      if (discoveredSlugs.has(slug)) {
        errors.push({
          file: relativePath,
          category: "duplicate",
          message: `Duplicate slug '${slug}' already used in '${discoveredSlugs.get(slug)}'`,
        });
        categoryPass.duplicates = false;
      } else {
        discoveredSlugs.set(slug, relativePath);
      }
    } else {
      categoryPass.slug = false;
    }

    // Validate dates
    if (frontmatter.publishedAt) {
      if (!validateCalendarDate(String(frontmatter.publishedAt))) {
        errors.push({
          file: relativePath,
          category: "date",
          message: `publishedAt '${frontmatter.publishedAt}' is not a valid calendar date (YYYY-MM-DD)`,
        });
        categoryPass.dates = false;
      }
    }
    if (frontmatter.updatedAt) {
      if (!validateCalendarDate(String(frontmatter.updatedAt))) {
        errors.push({
          file: relativePath,
          category: "date",
          message: `updatedAt '${frontmatter.updatedAt}' is not a valid calendar date (YYYY-MM-DD)`,
        });
        categoryPass.dates = false;
      }
    }

    // Validate MDX body
    const mdxError = validateBasicMdx(body);
    if (mdxError) {
      errors.push({
        file: relativePath,
        category: "mdx",
        message: mdxError,
      });
      categoryPass.mdx = false;
    }

    if (slug) {
      parsedNotes.push({
        file: relativePath,
        slug,
        related: Array.isArray(frontmatter.related) ? frontmatter.related : [],
      });
    }
  }

  // Repository-wide relational check
  for (const note of parsedNotes) {
    for (const relSlug of note.related) {
      if (!discoveredSlugs.has(relSlug)) {
        errors.push({
          file: note.file,
          category: "relation",
          message: `Related note slug '${relSlug}' does not exist in repository`,
        });
        categoryPass.relations = false;
      }
    }
  }

  // Print per-file status
  const filesWithErrors = new Set(errors.map((e) => e.file));
  for (const filePath of mdxFiles) {
    const relativePath = path.relative(process.cwd(), filePath);
    if (filesWithErrors.has(relativePath)) {
      console.log(`✗ ${path.basename(filePath)}`);
      const fileErrors = errors.filter((e) => e.file === relativePath);
      for (const err of fileErrors) {
        console.log(`    [${err.category}] ${err.message}`);
      }
    } else {
      console.log(`✓ ${path.basename(filePath)}`);
    }
  }

  console.log("\n────────────────────────────");
  console.log(`Frontmatter ........ ${categoryPass.frontmatter ? "✓" : "✗"}`);
  console.log(`Slugs .............. ${categoryPass.slug ? "✓" : "✗"}`);
  console.log(`Dates .............. ${categoryPass.dates ? "✓" : "✗"}`);
  console.log(`MDX ................ ${categoryPass.mdx ? "✓" : "✗"}`);
  console.log(`Duplicates ......... ${categoryPass.duplicates ? "✓" : "✗"}`);
  console.log(`Relations .......... ${categoryPass.relations ? "✓" : "✗"}`);
  console.log("────────────────────────────\n");

  const validCount = mdxFiles.length - filesWithErrors.size;
  console.log(`${validCount}/${mdxFiles.length} notes valid.\n`);

  if (errors.length > 0) {
    console.error("Validation failed.");
    process.exit(1);
  }

  console.log("Validation passed.");
  process.exit(0);
}

main();
