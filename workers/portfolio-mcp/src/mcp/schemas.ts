import { z } from "zod";
import {
  GITHUB_COMMIT_FILE_LIMIT,
  GITHUB_COMMIT_MESSAGE_MAX_CHARACTERS,
  GITHUB_README_MAX_CHARACTERS,
  MAX_LIST_LIMIT,
  MAX_SEARCH_RESULTS,
  MAX_SNIPPET_CHUNK_CHARACTERS,
  MAX_SNIPPET_OFFSET,
} from "../config.ts";

const mediaTypeSchema = z.enum(["video", "image"]);

const profileRecordSchema = z.strictObject({
  label: z.string(),
  value: z.string(),
});

const sectionItemSchema = z.strictObject({
  label: z.string().nullable(),
  content: z.string().nullable(),
  image_url: z.string().nullable(),
  target_url: z.string().nullable(),
});

const sectionRecordSchema = z.strictObject({
  id: z.number().int().positive(),
  title: z.string(),
  section_type: z.string(),
  items: z.array(sectionItemSchema),
});

const siteSchema = z.strictObject({
  headerPhrase: z.string().optional(),
  mobileHeaderPhrase: z.string().optional(),
  profileImage: z.string().optional(),
  status: z.string().optional(),
});

const projectRecordSchema = z.strictObject({
  id: z.number().int().positive(),
  title: z.string(),
  type: mediaTypeSchema,
  url: z.string(),
  short_description: z.string(),
  long_description: z.string(),
  project_link: z.string(),
  display_order: z.number().int(),
  created_at: z.string(),
});

const projectGalleryItemSchema = z.strictObject({
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  type: mediaTypeSchema,
  url: z.string(),
  display_order: z.number().int(),
});

const certificateRecordSchema = z.strictObject({
  id: z.number().int().positive(),
  title: z.string(),
  type: mediaTypeSchema,
  url: z.string(),
  short_description: z.string(),
  long_description: z.string(),
  certificate_link: z.string().nullable(),
  display_order: z.number().int(),
  created_at: z.string(),
});

const certificateMediaItemSchema = z.strictObject({
  id: z.number().int().positive(),
  certificate_id: z.number().int().positive(),
  type: mediaTypeSchema,
  url: z.string(),
  display_order: z.number().int(),
});

const paginationSchema = z.strictObject({
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT),
  total: z.number().int().nonnegative(),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
});

const publicSnippetSchema = z.strictObject({
  id: z.number().int().positive(),
  name: z.string(),
  format: z.enum(["pdf", "md"]).nullable(),
  modified: z.string(),
  size: z.number().int().nonnegative(),
  path_segments: z.array(z.string()),
  page_url: z.string(),
  download_url: z.string(),
});

const markdownSnippetSchema = z.strictObject({
  id: z.number().int().positive(),
  name: z.string(),
  type: z.literal("file"),
  modified: z.string(),
  size: z.number().int().nonnegative(),
  format: z.literal("md"),
  path_segments: z.array(z.string()),
  page_url: z.string(),
  offset: z.number().int().nonnegative().max(MAX_SNIPPET_OFFSET),
  content: z.string().max(MAX_SNIPPET_CHUNK_CHARACTERS),
  next_offset: z.number().int().nonnegative().max(MAX_SNIPPET_OFFSET),
  total_characters: z.number().int().nonnegative().max(MAX_SNIPPET_OFFSET),
  complete: z.boolean(),
});

const pdfSnippetSchema = z.strictObject({
  id: z.number().int().positive(),
  name: z.string(),
  type: z.literal("file"),
  modified: z.string(),
  size: z.number().int().nonnegative(),
  format: z.literal("pdf"),
  path_segments: z.array(z.string()),
  page_url: z.string(),
  download_url: z.string(),
  content_available: z.literal(false),
});

const githubRepositorySchema = z.strictObject({
  owner: z.string().max(39),
  name: z.string().max(100),
  full_name: z.string().max(140),
  description: z.string().max(500).nullable(),
  canonical_url: z.string().url(),
  branch: z.literal("main"),
  main_available: z.boolean(),
  main_sha: z
    .string()
    .regex(/^[0-9a-f]{40}$/i)
    .nullable(),
  readme_available: z.boolean(),
  commit_history_available: z.boolean(),
});

const githubCommitAuthorSchema = z.strictObject({
  login: z.string().max(100).nullable(),
  name: z.string().max(200).nullable(),
});

const githubCommitSummarySchema = z.strictObject({
  sha: z.string().regex(/^[0-9a-f]{40}$/i),
  message: z.string().max(GITHUB_COMMIT_MESSAGE_MAX_CHARACTERS),
  author: githubCommitAuthorSchema,
  authored_at: z.string().max(64).nullable(),
  committed_at: z.string().max(64).nullable(),
  canonical_url: z.string().url(),
});

const githubChangedFileSchema = z.strictObject({
  filename: z.string().max(512),
  status: z.string().max(32),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  changes: z.number().int().nonnegative(),
});

const githubCommitDetailsSchema = githubCommitSummarySchema.extend({
  files: z.array(githubChangedFileSchema).max(GITHUB_COMMIT_FILE_LIMIT),
  files_truncated: z.boolean(),
});

export const portfolioOverviewOutputSchema = z.strictObject({
  site: siteSchema,
  profile: z.array(profileRecordSchema),
  sections: z.array(sectionRecordSchema),
});

export const listProjectsOutputSchema = z.strictObject({
  data: z.array(projectRecordSchema),
  pagination: paginationSchema,
});

export const projectDetailsOutputSchema = z.strictObject({
  project: projectRecordSchema,
  gallery: z.array(projectGalleryItemSchema),
  canonical_url: z.string(),
});

export const listCertificatesOutputSchema = z.strictObject({
  data: z.array(certificateRecordSchema),
  pagination: paginationSchema,
});

export const certificateDetailsOutputSchema = z.strictObject({
  certificate: certificateRecordSchema,
  items: z.array(certificateMediaItemSchema),
  canonical_url: z.string(),
});

const profileSearchResultSchema = z.strictObject({
  kind: z.literal("profile"),
  title: z.string(),
  summary: z.string(),
  url: z.string(),
});

const projectSearchResultSchema = z.strictObject({
  kind: z.literal("project"),
  id: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  url: z.string(),
  project_link: z.string(),
});

const certificateSearchResultSchema = z.strictObject({
  kind: z.literal("certificate"),
  id: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  url: z.string(),
  certificate_link: z.string().nullable(),
});

const snippetSearchResultSchema = z.strictObject({
  kind: z.literal("snippet"),
  id: z.number().int().positive(),
  name: z.string(),
  format: z.enum(["pdf", "md"]).nullable(),
  modified: z.string(),
  size: z.number().int().nonnegative(),
  path_segments: z.array(z.string()),
  page_url: z.string(),
  download_url: z.string(),
  title: z.string(),
  summary: z.string(),
});

export const searchResultSchema = z.discriminatedUnion("kind", [
  profileSearchResultSchema,
  projectSearchResultSchema,
  certificateSearchResultSchema,
  snippetSearchResultSchema,
]);

export const searchPortfolioOutputSchema = z.strictObject({
  query: z.string().min(1).max(200),
  results: z.array(searchResultSchema).max(MAX_SEARCH_RESULTS),
});

export const listSnippetsOutputSchema = z.strictObject({
  snippets: z.array(publicSnippetSchema),
});

export const readSnippetOutputSchema = z.discriminatedUnion("format", [
  markdownSnippetSchema,
  pdfSnippetSchema,
]);

export const getProjectRepositoryOutputSchema = z.strictObject({
  project_id: z.number().int().positive(),
  repository: githubRepositorySchema,
});

export const getProjectReadmeOutputSchema = z.strictObject({
  project_id: z.number().int().positive(),
  repository_url: z.string().url(),
  branch: z.literal("main"),
  path: z.literal("README.md"),
  canonical_url: z.string().url(),
  offset: z.number().int().nonnegative().max(GITHUB_README_MAX_CHARACTERS),
  content: z.string().max(MAX_SNIPPET_CHUNK_CHARACTERS),
  next_offset: z.number().int().nonnegative().max(GITHUB_README_MAX_CHARACTERS),
  total_characters: z.number().int().nonnegative().max(GITHUB_README_MAX_CHARACTERS),
  complete: z.boolean(),
});

export const listProjectCommitsOutputSchema = z.strictObject({
  project_id: z.number().int().positive(),
  repository_url: z.string().url(),
  branch: z.literal("main"),
  commits: z.array(githubCommitSummarySchema).max(MAX_LIST_LIMIT),
  pagination: z.strictObject({
    limit: z.number().int().min(1).max(MAX_LIST_LIMIT),
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
  }),
});

export const getProjectCommitOutputSchema = z.strictObject({
  project_id: z.number().int().positive(),
  repository_url: z.string().url(),
  branch: z.literal("main"),
  commit: githubCommitDetailsSchema,
});
