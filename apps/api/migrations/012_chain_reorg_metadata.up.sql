-- P0 reorg handling — store observed block anchor on execution attempts

ALTER TABLE execution_attempts
  ADD COLUMN IF NOT EXISTS block_number BIGINT,
  ADD COLUMN IF NOT EXISTS block_hash TEXT;

CREATE INDEX IF NOT EXISTS execution_attempts_block_hash_idx
  ON execution_attempts (block_hash)
  WHERE block_hash IS NOT NULL;
