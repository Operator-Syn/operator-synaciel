-- =====================================================
-- 1. GLOBAL & PROFILE SETTINGS
-- =====================================================

-- Singular global values (e.g., Site Title, Footer Text, Resume Link)
CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Simple Label-Value pairs for the profile card (e.g., Location, Email, Role)
CREATE TABLE IF NOT EXISTS profile_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    display_order INTEGER DEFAULT 0
);

-- =====================================================
-- 2. DYNAMIC SECTIONS (Skills, Socials, Pitch)
-- =====================================================

-- Categories for grouped content (Loadouts/Skills, Social Links, Elevator Pitch)
CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    section_type TEXT NOT NULL, -- 'loadout', 'social', 'pitch'
    display_order INTEGER DEFAULT 0
);

-- The actual items inside those sections (Badges, Links, Paragraphs)
CREATE TABLE IF NOT EXISTS section_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,
    label TEXT,              -- 'alt' text for badges or label for links
    content TEXT,            -- Paragraph text (used for 'pitch' type)
    image_url TEXT,          -- Shields.io badge URL or Icon URL
    target_url TEXT,         -- href link (for socials or loadout docs)
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

-- =====================================================
-- 3. PROJECTS & GALLERY (The Portfolio)
-- =====================================================

-- Main Projects table (The Cards on your Projects Page)
CREATE TABLE IF NOT EXISTS Projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT CHECK(type IN ('video', 'image')) NOT NULL, -- 'video' or 'image'
    url TEXT NOT NULL,       -- Main thumbnail or preview URL
    short_description TEXT NOT NULL,
    long_description TEXT NOT NULL,
    project_link TEXT NOT NULL,
    display_order INTEGER DEFAULT 0, -- Added here (idempotent)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Gallery Items (The 'Many' side: multiple images/videos per project)
CREATE TABLE IF NOT EXISTS GalleryItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    type TEXT CHECK(type IN ('video', 'image')) NOT NULL,
    url TEXT NOT NULL,       -- URL to the media file
    display_order INTEGER DEFAULT 0, -- To keep your gallery items ordered
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE
);

-- =====================================================
-- 4. PERFORMANCE INDEXES
-- =====================================================

-- Create indexes to ensure joins are fast when loading pages
CREATE INDEX IF NOT EXISTS idx_gallery_project_id ON GalleryItems(project_id);
CREATE INDEX IF NOT EXISTS idx_section_items_section_id ON section_items(section_id);

-- =====================================================
-- 6. CERTIFICATES & CERTIFICATE ITEMS
-- =====================================================

-- 6a. The Certificates Table (Mirrors Projects table)
CREATE TABLE IF NOT EXISTS Certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT CHECK(type IN ('video', 'image')) NOT NULL, -- Main thumbnail type
    url TEXT NOT NULL,       -- Main thumbnail URL
    short_description TEXT NOT NULL,
    long_description TEXT NOT NULL,
    certificate_link TEXT,   -- Optional link (e.g. to PDF), can be left empty
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6b. The Items (Gallery) for Certificates
-- Named 'CertificateItems' as requested
CREATE TABLE IF NOT EXISTS CertificateItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_id INTEGER NOT NULL,
    type TEXT CHECK(type IN ('video', 'image')) NOT NULL,
    url TEXT NOT NULL,       -- URL to the media file
    display_order INTEGER DEFAULT 0,
    FOREIGN KEY (certificate_id) REFERENCES Certificates(id) ON DELETE CASCADE
);

-- 6c. Index for performance
CREATE INDEX IF NOT EXISTS idx_certificate_items_cert_id ON CertificateItems(certificate_id);

-- =====================================================
-- 7. SNIPPETS (File System / Knowledge Base)
-- =====================================================

CREATE TABLE IF NOT EXISTS Snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- The Recursive Pointer: Points to the folder this item is inside.
    -- If NULL, it is at the root level.
    parent_id INTEGER, 
    
    -- Display Name (e.g., "Docker Basics")
    name TEXT NOT NULL,
    
    -- Is it a Folder or a File?
    type TEXT CHECK(type IN ('dir', 'file')) NOT NULL,
    
    -- BUCKET INTEGRATION:
    -- Where is this file actually located? 
    -- e.g. "snippets/docker/cheatsheet.pdf"
    storage_path TEXT,
    
    -- AUTO-COMPUTED SIZE:
    -- We store raw bytes (e.g. 120400). 
    -- Your frontend converts this to "120 KB" on the fly.
    size_bytes INTEGER DEFAULT 0,
    
    -- RESTRICTED FORMATS:
    -- Only 'pdf' or 'md' allowed for files. NULL for directories.
    file_format TEXT, 
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Key linkage to itself
    FOREIGN KEY (parent_id) REFERENCES Snippets(id) ON DELETE CASCADE,

    -- LOGIC GUARD:
    -- 1. If it's a DIR, the format MUST be NULL.
    -- 2. If it's a FILE, the format MUST be 'pdf' or 'md'.
    CONSTRAINT check_content_type CHECK (
        (type = 'dir' AND file_format IS NULL) 
        OR 
        (type = 'file' AND file_format IN ('pdf', 'md'))
    )
);

-- Index for fast lookups when opening a folder
CREATE INDEX IF NOT EXISTS idx_snippets_parent_id ON Snippets(parent_id);
