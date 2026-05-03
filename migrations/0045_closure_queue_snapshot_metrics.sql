-- Migration 0045: add DQ.33 closure-queue lane metrics to snapshot history.
--
-- These columns are written by nightly cron automation so /admin/data-quality
-- can chart queue throughput and lane mix over time.

ALTER TABLE data_quality_snapshots ADD COLUMN closure_total_pairs INTEGER;
ALTER TABLE data_quality_snapshots ADD COLUMN closure_automation_pairs INTEGER;
ALTER TABLE data_quality_snapshots ADD COLUMN closure_manual_pairs INTEGER;
