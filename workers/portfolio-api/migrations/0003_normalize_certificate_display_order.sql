-- Purpose: Normalize certificate ordering before cursor pagination.
-- Affected tables: Certificates.
-- Data impact: Replaces only NULL display_order values with the existing default 0.
-- Compatibility: Existing certificate content and ordering values remain unchanged.
-- Rollback: Restore NULL values only with a reviewed forward migration if required.

UPDATE Certificates
SET display_order = 0
WHERE display_order IS NULL;
