-- Purpose: Record the existing D1 schema as the Drizzle migration baseline.
-- Affected tables: All portfolio, content, and snippet tables plus indexes.
-- Data impact: Schema creation only; existing rows are preserved.
-- Compatibility: Every DDL statement is idempotent for the deployed schema.
-- Rollback: Do not drop baseline tables; use a reviewed forward migration.

CREATE TABLE IF NOT EXISTS `CertificateItems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`certificate_id` integer NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`display_order` integer DEFAULT 0,
	FOREIGN KEY (`certificate_id`) REFERENCES `Certificates`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "certificate_items_type_check" CHECK("CertificateItems"."type" IN ('video', 'image'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_certificate_items_cert_id` ON `CertificateItems` (`certificate_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Certificates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`short_description` text NOT NULL,
	`long_description` text NOT NULL,
	`certificate_link` text,
	`display_order` integer DEFAULT 0,
	`created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "certificates_type_check" CHECK("Certificates"."type" IN ('video', 'image'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `GalleryItems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`display_order` integer DEFAULT 0,
	FOREIGN KEY (`project_id`) REFERENCES `Projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "gallery_items_type_check" CHECK("GalleryItems"."type" IN ('video', 'image'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_gallery_project_id` ON `GalleryItems` (`project_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `profile_info` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`display_order` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`short_description` text NOT NULL,
	`long_description` text NOT NULL,
	`project_link` text NOT NULL,
	`display_order` integer DEFAULT 0,
	`created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "projects_type_check" CHECK("Projects"."type" IN ('video', 'image'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `section_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`section_id` integer NOT NULL,
	`label` text,
	`content` text,
	`image_url` text,
	`target_url` text,
	`display_order` integer DEFAULT 0,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_section_items_section_id` ON `section_items` (`section_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`section_type` text NOT NULL,
	`display_order` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Snippets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`storage_path` text,
	`size_bytes` integer DEFAULT 0,
	`file_format` text,
	`display_order` integer DEFAULT 0,
	`created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
	`modified_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`parent_id`) REFERENCES `Snippets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "snippets_content_type_check" CHECK((
        ("Snippets"."type" = 'dir' AND "Snippets"."file_format" IS NULL)
        OR
        ("Snippets"."type" = 'file' AND "Snippets"."file_format" IN ('pdf', 'md'))
      ))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_snippets_parent_id` ON `Snippets` (`parent_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_snippets_parent_order` ON `Snippets` (`parent_id`,`display_order`,`name`);
