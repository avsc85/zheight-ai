-- Fix RLS policies for AI chat tables
-- Run this to fix permissions issues

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to read documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON documents;
DROP POLICY IF EXISTS "Allow authenticated users to read embeddings" ON document_embeddings;
DROP POLICY IF EXISTS "Allow service role to manage embeddings" ON document_embeddings;
DROP POLICY IF EXISTS "Users can read their own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can read their own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can create chat messages" ON chat_messages;

-- Create correct policies for documents
-- Everyone can read documents (for AI chat)
CREATE POLICY "Enable read for authenticated users" ON documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can upload/modify/delete documents
CREATE POLICY "Enable insert for admins only" ON documents
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Enable update for admins only" ON documents
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Enable delete for admins only" ON documents
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create correct policies for document_embeddings
CREATE POLICY "Enable read for authenticated users" ON document_embeddings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for service role" ON document_embeddings
  FOR ALL USING (true);

-- Create correct policies for chat_sessions
CREATE POLICY "Enable read for authenticated users" ON chat_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable insert for authenticated users" ON chat_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for authenticated users" ON chat_sessions
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Create correct policies for chat_messages
CREATE POLICY "Enable read for authenticated users" ON chat_messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable insert for authenticated users" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
