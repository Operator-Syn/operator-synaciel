---
title: Models
tags:
  - architecture
  - database
role: catalog
---

# Models

Models under `src/model/` are the main persistence and data-shaping layer for
the Worker. Most receive a `D1Database`, issue parameterized SQL, and map rows
into API-facing objects. `SnippetsPageModel` also receives an `R2Bucket`.

## Model groups

| Group | Responsibility |
| --- | --- |
| `SettingsModel` | CRUD for keyed `site_settings` values and conversion to a key/value object. |
| `ProfileModel` | Ordered CRUD for `profile_info` entries. |
| `SectionsModel` and `SectionItemsModel` | Ordered CRUD for dynamic sections and their child content. |
| `HomePageModel` | Parallel home-content queries and nested section, pitch, social, and loadout shaping. |
| `ProjectsModel` and `GalleryModel` | CRUD and row mapping for projects and project media. |
| `ProjectsPageModel` | Builds cursor-backed project archive pages, counts the archive, and batches nested gallery rows. |
| `CertificatesModel` and `CertificateItemsModel` | Certificate and certificate-media CRUD plus row mapping. |
| `CertificatesPageModel` | Builds cursor-backed certificate archive pages, counts the archive, and batches certificate items. |
| `SnippetsPageModel` | Recursive snippet-tree queries, file/folder rules, bounded preview/document metadata, R2 content operations, and cleanup. |

## Model responsibilities

Models currently own more than query strings:

- SQL selection, insertion, update, deletion, ordering, and joins;
- conversion from D1 row values into stable response shapes;
- aggregate construction for home and project pages;
- snippet parent validation and folder-cycle prevention;
- R2 upload, read, and deletion coordination for snippet files;
- compensating R2 cleanup when a snippet database insert fails;
- content type, download header, and safe filename decisions for snippet files.
- bounded R2-prefix reads, paragraph/line/code-fence-safe excerpts, derived
  document paths, and inline-versus-download content disposition for the v2
  snippet read contracts.

Drizzle is currently a schema and migration-generation tool only. It does not
replace these runtime model queries in this phase.

`SnippetsPageModel` is therefore a persistence-and-storage coordinator rather
than a pure D1 model. The other models are mostly direct D1 repositories with
small response-mapping responsibilities.

## Change guidance

Keep SQL and database-specific mapping in models. Keep request parsing and HTTP
status decisions in controllers. If a model begins coordinating unrelated
resources or an HTTP concern appears inside a model, review [[architecture/layer-boundaries|the
layer assessment]] before expanding the boundary.

The schema reference is [[database/schema|Database schema]]. The controller
callers are documented in [[architecture/controllers|Controllers]].
