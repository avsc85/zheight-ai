import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
// Import PDF.js for PDF text extraction
import { getDocument } from "npm:pdfjs-dist@4.0.379";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract text from different file types
async function extractText(file: File): Promise<string> {
  const fileType = file.type.toLowerCase();
  
  // Handle PDFs
  if (fileType === 'application/pdf' || file.name.endsWith('.pdf')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }
  
  // Handle images (use GPT-4 Vision for image text extraction)
  if (fileType.startsWith('image/')) {
    try {
      const base64 = await fileToBase64(file);
      return await extractTextFromImage(base64);
    } catch (error) {
      console.error('Image extraction error:', error);
      throw new Error('Failed to extract text from image');
    }
  }
  
  // Handle plain text, DOCX, etc. - just read as text
  return await file.text();
}

// Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Extract text from image using GPT-4 Vision
async function extractTextFromImage(base64Image: string): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all text from this image. Include building codes, regulations, ordinances, and any technical information. Return only the extracted text without any additional commentary.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to extract text from image');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Chunk text into smaller pieces (like project folder)
function chunkText(text: string, chunkSize: number = 800, overlap: number = 150): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+\s+/);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Add overlap by keeping last part of previous chunk
      const words = currentChunk.split(' ');
      currentChunk = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 50); // Skip very small chunks
}

// Generate embeddings for text chunks
async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const embeddings: number[][] = [];
  
  // Process in batches to avoid rate limits
  for (const chunk of chunks) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: chunk,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    embeddings.push(data.data[0].embedding);
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return embeddings;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'General';

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📤 Uploading: ${file.name} (${file.size} bytes)`);

    // Extract text from file (supports PDF, images, text)
    const text = await extractText(file);
    console.log(`📝 Extracted ${text.length} characters`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create document ID
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Save document to database (status: processing)
    const { error: docError } = await supabase.from('documents').insert({
      id: documentId,
      name: file.name,
      type: file.type || 'text/plain',
      folder: folder,
      content: text,
      size: file.size,
      status: 'processing',
    });

    if (docError) {
      console.error('Database error:', docError);
      throw docError;
    }

    console.log('✅ Document saved, starting chunking...');

    // Chunk the text (like project folder)
    const chunks = chunkText(text, 800, 150);
    console.log(`✂️ Created ${chunks.length} chunks`);

    // Generate embeddings for each chunk
    console.log('🧮 Generating embeddings...');
    const embeddings = await generateEmbeddings(chunks);
    console.log(`✅ Generated ${embeddings.length} embeddings`);

    // Save chunks and embeddings to database
    const embeddingRecords = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_index: index,
      content: chunk,
      embedding: embeddings[index],
    }));

    const { error: embeddingError } = await supabase
      .from('document_embeddings')
      .insert(embeddingRecords);

    if (embeddingError) {
      console.error('Embedding error:', embeddingError);
      throw embeddingError;
    }

    // Update document status to indexed
    await supabase
      .from('documents')
      .update({ 
        status: 'indexed',
        indexed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    console.log(`✅ Document ${documentId} fully indexed!`);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        chunksCreated: chunks.length,
        message: 'Document uploaded and indexed successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process document',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
