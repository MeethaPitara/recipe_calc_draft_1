-- Migration: Add Production Lock, Versioning, and Tags to Recipes

ALTER TABLE recipes 
ADD COLUMN is_production_locked boolean DEFAULT false,
ADD COLUMN version_number integer DEFAULT 1,
ADD COLUMN tags text[] DEFAULT '{}';
