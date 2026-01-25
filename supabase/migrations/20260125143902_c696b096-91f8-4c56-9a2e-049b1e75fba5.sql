-- Create optimized full-text search function using GIN index
CREATE OR REPLACE FUNCTION match_documents_by_text(
  search_query TEXT,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  document_id TEXT,
  content TEXT,
  rank FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.document_id,
    de.content,
    ts_rank_cd(de.content_tsv, to_tsquery('english', search_query))::FLOAT AS rank
  FROM document_embeddings de
  INNER JOIN documents d ON d.id = de.document_id
  WHERE d.status = 'indexed'
    AND de.content_tsv @@ to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION match_documents_by_text TO authenticated, anon, service_role;