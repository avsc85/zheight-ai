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

// Generate a simple session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Search for similar documents using vector similarity
async function searchSimilarDocuments(
  supabase: any,
  query: string,
  limit: number = 5
): Promise<string[]> {
  try {
    // Get OpenAI API key from environment
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not set');
      return [];
    }

    // Generate embedding for the query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
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

    if (!embeddingResponse.ok) {
      console.error('Failed to generate embedding:', await embeddingResponse.text());
      return [];
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Search for similar documents using the match_documents function
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit,
    });

    if (error) {
      console.error('Vector search error:', error);
      return [];
    }

    return data?.map((doc: any) => doc.content) || [];
  } catch (error) {
    console.error('Error in searchSimilarDocuments:', error);
    return [];
  }
}

// Generate chat response using OpenRouter (cheaper and better models)
async function generateChatResponse(
  message: string,
  context: string[],
  conversationHistory: ChatMessage[]
): Promise<string> {
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!openrouterKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Build system prompt with context
  const systemPrompt = `You are an expert Building Code Compliance AI assistant for ZHeight AI. 
You help architects, project managers, and building professionals understand California building codes, local ordinances, and compliance requirements.

${context.length > 0 ? `Here is relevant information from the knowledge base:

${context.join('\n\n')}

Use this information to provide accurate, specific answers. If the information isn't in the knowledge base, say so and provide general guidance if possible.` : 'No specific context was found in the knowledge base. Provide general guidance based on common building code knowledge, but acknowledge the limitation.'}

Guidelines:
- Be professional, clear, and concise
- Cite specific code sections when available
- Explain complex requirements in simple terms
- If unsure, acknowledge uncertainty
- Focus on California Residential Code and local ordinances`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10), // Last 10 messages for context
    { role: 'user', content: message },
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zheight-ai.com', // Optional
        'X-Title': 'ZHeight AI Compliance Chat', // Optional
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet', // Better and cheaper than GPT-4
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error('Failed to generate response');
    }

    const data = await response.json();
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
    
    if (!sessionId) {
      await supabase.from('chat_sessions').insert({
        id: currentSessionId,
      });
    }

    // Save user message
    await supabase.from('chat_messages').insert({
      session_id: currentSessionId,
      role: 'user',
      content: message,
    });

    // Get conversation history
    const { data: historyData } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true })
      .limit(20);

    const conversationHistory: ChatMessage[] = historyData || [];

    // Search for relevant context
    console.log(`💬 User message: "${message}"`);
    const context = await searchSimilarDocuments(supabase, message, 5);
    
    if (context.length === 0) {
      console.warn('⚠️ No relevant context found for query');
    } else {
      console.log(`✅ Retrieved ${context.length} relevant chunks`);
    }

    // Generate response using OpenAI
    const assistantMessage = await generateChatResponse(message, context, conversationHistory);
    console.log(`🤖 Assistant response generated`);

    // Save assistant message
    await supabase.from('chat_messages').insert({
      session_id: currentSessionId,
      role: 'assistant',
      content: assistantMessage,
    });

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
        message: 'I apologize, but I encountered an error processing your message. Please try again.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
