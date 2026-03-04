-- ============================================================
-- MIGRATION 004: Screen-level permissions (checkbox model)
-- ============================================================

CREATE TABLE IF NOT EXISTS screen_permissions (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    screen_key  VARCHAR(50) NOT NULL,
    can_view    BOOLEAN DEFAULT FALSE,
    can_create  BOOLEAN DEFAULT FALSE,
    can_edit    BOOLEAN DEFAULT FALSE,
    can_delete  BOOLEAN DEFAULT FALSE,
    UNIQUE (user_id, screen_key)
);

CREATE INDEX IF NOT EXISTS idx_perms_user ON screen_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_perms_screen ON screen_permissions(screen_key);
