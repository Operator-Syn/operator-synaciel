import { sql } from "drizzle-orm";
import {
  check,
  customType,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const datetime = customType<{ data: string; driverData: string }>({
  dataType: () => "DATETIME",
});

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const profileInfo = sqliteTable("profile_info", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  value: text("value").notNull(),
  displayOrder: integer("display_order").default(0),
});

export const sections = sqliteTable("sections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  sectionType: text("section_type").notNull(),
  displayOrder: integer("display_order").default(0),
});

export const sectionItems = sqliteTable(
  "section_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sectionId: integer("section_id").notNull(),
    label: text("label"),
    content: text("content"),
    imageUrl: text("image_url"),
    targetUrl: text("target_url"),
    displayOrder: integer("display_order").default(0),
  },
  (table) => [
    foreignKey({
      columns: [table.sectionId],
      foreignColumns: [sections.id],
    }).onDelete("cascade"),
    index("idx_section_items_section_id").on(table.sectionId),
  ],
);

export const projects = sqliteTable(
  "Projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    type: text("type").notNull(),
    url: text("url").notNull(),
    shortDescription: text("short_description").notNull(),
    longDescription: text("long_description").notNull(),
    projectLink: text("project_link").notNull(),
    displayOrder: integer("display_order").default(0),
    createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("projects_type_check", sql`${table.type} IN ('video', 'image')`),
    index("idx_projects_display_order_id").on(table.displayOrder, table.id),
  ],
);

export const galleryItems = sqliteTable(
  "GalleryItems",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull(),
    type: text("type").notNull(),
    url: text("url").notNull(),
    displayOrder: integer("display_order").default(0),
  },
  (table) => [
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projects.id],
    }).onDelete("cascade"),
    check("gallery_items_type_check", sql`${table.type} IN ('video', 'image')`),
    index("idx_gallery_project_id").on(table.projectId),
  ],
);

export const certificates = sqliteTable(
  "Certificates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    type: text("type").notNull(),
    url: text("url").notNull(),
    shortDescription: text("short_description").notNull(),
    longDescription: text("long_description").notNull(),
    certificateLink: text("certificate_link"),
    displayOrder: integer("display_order").default(0),
    createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("certificates_type_check", sql`${table.type} IN ('video', 'image')`),
    index("idx_certificates_display_order_id").on(table.displayOrder, table.id),
  ],
);

export const certificateItems = sqliteTable(
  "CertificateItems",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    certificateId: integer("certificate_id").notNull(),
    type: text("type").notNull(),
    url: text("url").notNull(),
    displayOrder: integer("display_order").default(0),
  },
  (table) => [
    foreignKey({
      columns: [table.certificateId],
      foreignColumns: [certificates.id],
    }).onDelete("cascade"),
    check("certificate_items_type_check", sql`${table.type} IN ('video', 'image')`),
    index("idx_certificate_items_cert_id").on(table.certificateId),
  ],
);

export const snippets = sqliteTable(
  "Snippets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    parentId: integer("parent_id"),
    name: text("name").notNull(),
    type: text("type").notNull(),
    storagePath: text("storage_path"),
    sizeBytes: integer("size_bytes").default(0),
    fileFormat: text("file_format"),
    displayOrder: integer("display_order").default(0),
    createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`),
    modifiedAt: datetime("modified_at").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("cascade"),
    check(
      "snippets_content_type_check",
      sql`(
        (${table.type} = 'dir' AND ${table.fileFormat} IS NULL)
        OR
        (${table.type} = 'file' AND ${table.fileFormat} IN ('pdf', 'md'))
      )`,
    ),
    index("idx_snippets_parent_id").on(table.parentId),
    index("idx_snippets_parent_order").on(table.parentId, table.displayOrder, table.name),
  ],
);
