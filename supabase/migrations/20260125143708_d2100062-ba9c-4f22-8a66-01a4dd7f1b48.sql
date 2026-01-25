-- ============================================
-- RAG Query Optimization Migration
-- ============================================

-- 1. Add HNSW index for fast vector similarity search
-- HNSW is faster than IVFFlat for datasets under 1M rows
CREATE INDEX IF NOT EXISTS idx_document_embeddings_hnsw 
ON document_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 2. Add tsvector column for efficient full-text search
ALTER TABLE document_embeddings 
ADD COLUMN IF NOT EXISTS content_tsv tsvector;

-- 3. Populate tsvector column with weighted tokens
UPDATE document_embeddings 
SET content_tsv = to_tsvector('english', content);

-- 4. Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_document_embeddings_fts 
ON document_embeddings USING gin(content_tsv);

-- 5. Create trigger to auto-update tsvector on insert/update
CREATE OR REPLACE FUNCTION update_content_tsv()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_tsv := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_content_tsv ON document_embeddings;
CREATE TRIGGER trg_update_content_tsv
BEFORE INSERT OR UPDATE OF content ON document_embeddings
FOR EACH ROW
EXECUTE FUNCTION update_content_tsv();

-- 6. Create optimized hybrid search function (vector + lexical)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.25,
  match_count INT DEFAULT 20,
  lexical_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  document_id TEXT,
  content TEXT,
  similarity FLOAT,
  rank_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  -- Build tsquery from plain text
  tsquery_val := plainto_tsquery('english', query_text);
  
  RETURN QUERY
  WITH vector_results AS (
    -- Vector similarity search
    SELECT 
      de.id,
      de.document_id,
      de.content,
      (1 - (de.embedding <=> query_embedding)) AS vec_similarity
    FROM document_embeddings de
    INNER JOIN documents d ON d.id = de.document_id
    WHERE d.status = 'indexed'
      AND (1 - (de.embedding <=> query_embedding)) > match_threshold
    ORDER BY de.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  lexical_results AS (
    -- Full-text search with ranking
    SELECT 
      de.id,
      de.document_id,
      de.content,
      ts_rank_cd(de.content_tsv, tsquery_val) AS lex_rank
    FROM document_embeddings de
    INNER JOIN documents d ON d.id = de.document_id
    WHERE d.status = 'indexed'
      AND de.content_tsv @@ tsquery_val
    LIMIT match_count
  ),
  combined AS (
    -- Combine and score
    SELECT 
      COALESCE(v.id, l.id) AS id,
      COALESCE(v.document_id, l.document_id) AS document_id,
      COALESCE(v.content, l.content) AS content,
      COALESCE(v.vec_similarity, 0.0) AS similarity,
      -- Hybrid score: weighted combination
      (COALESCE(v.vec_similarity, 0.0) * (1 - lexical_weight)) + 
      (COALESCE(l.lex_rank, 0.0) * lexical_weight * 10) AS rank_score
    FROM vector_results v
    FULL OUTER JOIN lexical_results l ON v.id = l.id
  )
  SELECT 
    c.id,
    c.document_id,
    c.content,
    c.similarity::FLOAT,
    c.rank_score::FLOAT
  FROM combined c
  ORDER BY c.rank_score DESC
  LIMIT match_count;
END;
$$;

-- 7. Grant execute permission
GRANT EXECUTE ON FUNCTION hybrid_search TO authenticated, anon, service_role;