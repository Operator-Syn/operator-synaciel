-- Retain the current Google profile image URL for authenticated assistant identity.
-- The auth Worker validates HTTPS Google-hosted URLs before writing this column.
ALTER TABLE users
  ADD COLUMN picture_url TEXT
  CHECK (picture_url IS NULL OR length(picture_url) <= 2048);
