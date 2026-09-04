-- Record provider-reported aggregate input and output token usage.
-- Existing reservations remain compatible through nullable columns and the
-- runtime fallback to estimated_tokens until a completed turn is settled.
ALTER TABLE rolling_token_usage
  ADD COLUMN actual_input_tokens INTEGER
  CHECK (actual_input_tokens IS NULL OR actual_input_tokens >= 0);

ALTER TABLE rolling_token_usage
  ADD COLUMN actual_output_tokens INTEGER
  CHECK (actual_output_tokens IS NULL OR actual_output_tokens >= 0);
