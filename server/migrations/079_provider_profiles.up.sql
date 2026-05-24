ALTER TABLE "user" ADD COLUMN provider_profiles JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "user" ADD COLUMN active_provider_profile_id TEXT;
