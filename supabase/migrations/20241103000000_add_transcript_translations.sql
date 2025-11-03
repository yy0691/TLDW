-- Add support for storing transcript translations

-- Add columns to video_analyses table for storing translated transcripts
ALTER TABLE video_analyses
  ADD COLUMN IF NOT EXISTS transcript_zh_cn JSONB;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_video_analyses_transcript_zh_cn ON video_analyses(id) WHERE transcript_zh_cn IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN video_analyses.transcript_zh_cn IS 'Simplified Chinese translation of the transcript';
