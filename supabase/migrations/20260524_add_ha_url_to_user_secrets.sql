-- Add ha_url column to user_secrets so the HA instance URL survives Safari
-- ITP / storage-pressure eviction (previously stored only in localStorage).
--
-- Existing RLS policy "Users can manage own secrets" applies to ALL commands
-- with qual `auth.uid() = user_id` and is not column-scoped, so no new
-- policy is required for this column.
ALTER TABLE user_secrets ADD COLUMN ha_url text;
