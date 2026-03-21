-- Add a partial unique index to ensure only one embeddings row exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_xsimgcl_embeddings_singleton 
ON algorithm_results (algorithm_type) 
WHERE algorithm_type = 'xsimgcl-embeddings';
