-- Migration 002: Add CSRF token support to sessions table
-- Sprint 6 - Security enhancements

-- Add csrf_token column to sessions table
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS csrf_token VARCHAR(36);

-- Add index for CSRF token lookups (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_sessions_csrf_token ON sessions(csrf_token);

-- Note: Existing sessions without csrf_token will be rejected by the backend
-- This is intentional for security reasons
