import { z } from "zod";

/**
 * Status of a Note publication lifecycle
 */
export const NoteStatusSchema = z.enum(["draft", "published", "archived"]);
export type NoteStatus = z.infer<typeof NoteStatusSchema>;

/**
 * Frontmatter Schema for validating individual MDX note files
 */
export const NoteFrontmatterSchema = z.object({
  title: z
    .string({ required_error: "title is required" })
    .min(1, "title cannot be empty"),
  slug: z
    .string({ required_error: "slug is required" })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "slug must be lowercase kebab-case (e.g., 'building-billoma')",
    }),
  description: z
    .string({ required_error: "description is required" })
    .min(1, "description cannot be empty"),
  publishedAt: z
    .string({ required_error: "publishedAt is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "publishedAt must be in YYYY-MM-DD format",
    }),
  updatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "updatedAt must be in YYYY-MM-DD format",
    })
    .optional(),
  status: NoteStatusSchema.default("published"),
  tags: z.array(z.string().min(1)).default([]),
  related: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "related items must be valid note slugs")
    )
    .default([]),
  readingTime: z
    .number()
    .int()
    .positive("readingTime must be a positive integer in minutes")
    .optional(),
  sequence: z
    .string()
    .regex(/^\d{2,}$/, "sequence must be at least 2 digits (e.g. '01')")
    .optional(),
  author: z
    .object({
      name: z.string().min(1),
      avatar: z.string().url().optional(),
    })
    .optional(),
  coverImage: z
    .object({
      src: z.string().min(1),
      alt: z.string().min(1),
    })
    .optional(),
});

export type NoteFrontmatter = z.infer<typeof NoteFrontmatterSchema>;

/**
 * Canonical Note Metadata representation used in generated manifests and API sync
 */
export const NoteMetadataSchema = z.object({
  slug: z.string(),
  number: z.string(), // Sequence string (e.g., "01", "02")
  title: z.string(),
  description: z.string(),
  publishedAt: z.string(),
  updatedAt: z.string().optional(),
  date: z.string(), // Display date (e.g., "SEP 2026")
  dateISO: z.string(), // Machine readable ISO date
  minutes: z.number(), // Reading time in minutes
  tags: z.array(z.string()),
  related: z.array(z.string()),
  status: NoteStatusSchema,
  path: z.string(), // Repository relative path
});

export type NoteMetadata = z.infer<typeof NoteMetadataSchema>;

/**
 * Full Note entity contract expected by portfolio/API
 */
export interface Note extends NoteMetadata {
  content?: string; // Optional raw MDX body
}
