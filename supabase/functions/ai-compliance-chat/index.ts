import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatRequest {
  message: string;
  sessionId?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RetrievedDoc {
  content: string;
  similarity: number;
  document_id: string;
}

// Generate a simple session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Rerank documents using semantic relevance scoring
function rerankDocuments(docs: RetrievedDoc[], query: string): RetrievedDoc[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  return docs.map(doc => {
    const content = doc.content.toLowerCase();
    // Calculate keyword overlap score
    const keywordScore = queryTerms.reduce((score, term) => {
      return score + (content.includes(term) ? 0.1 : 0);
    }, 0);
    
    // Boost similarity with keyword relevance
    const boostedSimilarity = doc.similarity + Math.min(keywordScore, 0.2);
    return { ...doc, similarity: boostedSimilarity };
  }).sort((a, b) => b.similarity - a.similarity);
}

// Deduplicate similar content chunks
function deduplicateChunks(docs: RetrievedDoc[]): RetrievedDoc[] {
  const seen = new Set<string>();
  return docs.filter(doc => {
    // Create a simple hash of the first 100 chars to detect duplicates
    const contentKey = doc.content.substring(0, 100).toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(contentKey)) return false;
    seen.add(contentKey);
    return true;
  });
}

// Search for similar documents using vector similarity with optimizations
async function searchSimilarDocuments(
  supabase: any,
  query: string,
  limit: number = 8
): Promise<string[]> {
  const startTime = Date.now();
  
  try {
    // Get Lovable API key from environment
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      console.error('LOVABLE_API_KEY not set');
      return [];
    }

    // Generate embedding using Lovable AI Gateway (faster)
    const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      // Fallback to OpenAI if Lovable gateway fails
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (openaiKey) {
        const fallbackResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: query,
          }),
        });
        
        if (!fallbackResponse.ok) {
          console.error('Fallback embedding failed:', await fallbackResponse.text());
          return [];
        }
        
        const fallbackData = await fallbackResponse.json();
        const queryEmbedding = fallbackData.data[0].embedding;
        
        const { data, error } = await supabase.rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: 0.4, // Lower threshold for broader results
          match_count: limit * 2, // Fetch more for reranking
        });
        
        if (error) {
          console.error('Vector search error:', error);
          return [];
        }
        
        const reranked = rerankDocuments(data || [], query);
        const deduped = deduplicateChunks(reranked);
        
        console.log(`⚡ Retrieval (fallback) took ${Date.now() - startTime}ms`);
        return deduped.slice(0, limit).map(doc => doc.content);
      }
      console.error('Failed to generate embedding:', await embeddingResponse.text());
      return [];
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search with lower threshold and higher count for reranking
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.4, // Lower threshold captures more potential matches
      match_count: limit * 2, // Fetch more for reranking
    });

    if (error) {
      console.error('Vector search error:', error);
      return [];
    }

    // Apply reranking and deduplication
    const reranked = rerankDocuments(data || [], query);
    const deduped = deduplicateChunks(reranked);
    
    console.log(`⚡ Retrieval took ${Date.now() - startTime}ms, found ${deduped.length} unique chunks`);
    return deduped.slice(0, limit).map(doc => doc.content);
  } catch (error) {
    console.error('Error in searchSimilarDocuments:', error);
    return [];
  }
}

// Generate chat response using Lovable AI Gateway
async function generateChatResponse(
  message: string,
  context: string[],
  conversationHistory: ChatMessage[]
): Promise<string> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  // Build optimized system prompt with context
  const contextText = context.length > 0 
    ? `## Knowledge Base Context\n\n${context.map((c, i) => `[${i + 1}] ${c}`).join('\n\n---\n\n')}`
    : '';

  const systemPrompt = `You are the zHeight Support Assistant, a helpful AI that answers questions about the zHeight platform.

## About zHeight
zHeight is an AI-powered platform for architectural project management, plan checking, feasibility analysis, and compliance workflows. Key features include:
- Project Management: Track projects, tasks, milestones, and team assignments
- AI Plan Checker: Automated review of architectural plans for code compliance
- Feasibility Analysis: Evaluate project feasibility based on zoning and regulations
- Knowledge Base: Centralized documentation for compliance and building codes
- Team Collaboration: Assign tasks to project managers and architectural reviewers

${contextText}

## Response Guidelines
- Be helpful, friendly, and professional
- Provide clear, concise answers
- If information is in the context, cite it specifically
- If unsure, acknowledge the limitation and offer to help find more information
- Focus on helping users understand and use zHeight effectively
- Keep responses focused and actionable`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-8), // Last 8 messages for faster processing
    { role: 'user', content: message },
  ];

  const startTime = Date.now();

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview', // Fast and capable
        messages: messages,
        temperature: 0.7,
        max_tokens: 800, // Optimized for faster responses
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', errorText);
      
      // Handle rate limits
      if (response.status === 429) {
        return "I'm experiencing high demand right now. Please try again in a moment.";
      }
      if (response.status === 402) {
        return "The AI service is temporarily unavailable. Please try again later.";
      }
      
      throw new Error('Failed to generate response');
    }

    const data = await response.json();
    console.log(`🤖 AI response generated in ${Date.now() - startTime}ms`);
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStart = Date.now();

  try {
    const { message, sessionId }: ChatRequest = await req.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get or create session
    let currentSessionId = sessionId || generateSessionId();
    
    // Run session creation and message saving in parallel with retrieval
    const sessionPromise = !sessionId 
      ? supabase.from('chat_sessions').insert({ id: currentSessionId })
      : Promise.resolve();

    const saveUserMsgPromise = supabase.from('chat_messages').insert({
      session_id: currentSessionId,
      role: 'user',
      content: message,
    });

    // Start retrieval immediately (don't wait for DB ops)
    const contextPromise = searchSimilarDocuments(supabase, message, 6);

    // Get conversation history in parallel
    const historyPromise = supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true })
      .limit(16);

    // Wait for all parallel operations
    const [, , context, { data: historyData }] = await Promise.all([
      sessionPromise,
      saveUserMsgPromise,
      contextPromise,
      historyPromise,
    ]);

    console.log(`💬 Query: "${message.substring(0, 50)}..."`);
    console.log(`📚 Retrieved ${context.length} context chunks`);

    const conversationHistory: ChatMessage[] = historyData || [];

    // Generate response
    const assistantMessage = await generateChatResponse(message, context, conversationHistory);

    // Save assistant message (don't await - fire and forget for speed)
    supabase.from('chat_messages').insert({
      session_id: currentSessionId,
      role: 'assistant',
      content: assistantMessage,
    }).then(() => {}).catch(e => console.error('Failed to save assistant message:', e));

    console.log(`⏱️ Total request time: ${Date.now() - requestStart}ms`);

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        sessionId: currentSessionId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process chat message',
        message: 'I apologize, but I encountered an error. Please try again.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
