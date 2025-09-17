import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";

// Utility function for exponential backoff with jitter
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const getRetryDelay = (attempt: number) => {
  const baseDelay = Math.min(1000 * Math.pow(2, attempt), 10000); // Cap at 10s
  const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
  return baseDelay + jitter;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Address format validation
const validateAddress = (address: string): { isValid: boolean; suggestions?: string[] } => {
  if (!address || address.trim().length < 10) {
    return {
      isValid: false,
      suggestions: ['Address must be at least 10 characters long']
    };
  }

  const hasNumber = /\d/.test(address);
  const hasState = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i.test(address);
  const hasComma = address.includes(',');

  const suggestions = [];
  if (!hasNumber) suggestions.push('Include street number (e.g., "123 Main St")');
  if (!hasComma) suggestions.push('Separate city/state with comma (e.g., "Street, City, State")');
  if (!hasState) suggestions.push('Include state abbreviation (e.g., "CA", "NY")');

  return {
    isValid: hasNumber && hasState,
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
};

// Enhanced logging function with instrumentation
const logAPIMetrics = (modelUsed: string, success: boolean, extractedFields: string[], address: string, tokens: any, responseTime: number) => {
  console.log('📊 API METRICS:', {
    timestamp: new Date().toISOString(),
    model: modelUsed,
    success,
    extractionRate: `${extractedFields.length}/3`,
    extractedFields,
    address: address.substring(0, 50) + (address.length > 50 ? '...' : ''),
    tokens: tokens || null,
    responseTime
  });
};

// Web scraping utilities
const searchDuckDuckGo = async (query: string): Promise<string[]> => {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    console.log('🔍 Searching DuckDuckGo:', query);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.warn('⚠️ DuckDuckGo search failed:', response.status);
      return [];
    }
    
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const links: string[] = [];
    
    doc?.querySelectorAll('a[href*="zillow.com"], a[href*="redfin.com"]')
      .forEach((link: any) => {
        const href = link.getAttribute('href');
        if (href && (href.includes('zillow.com') || href.includes('redfin.com'))) {
          links.push(href);
        }
      });
    
    console.log('🔗 Found property links:', links.slice(0, 3));
    return links.slice(0, 3); // Return top 3 links
  } catch (error) {
    console.error('❌ DuckDuckGo search error:', error);
    return [];
  }
};

const fetchPropertyData = async (url: string): Promise<{ lotSize?: string; zone?: string; source: string }> => {
  try {
    console.log('🏠 Fetching property data from:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.warn('⚠️ Failed to fetch:', url, response.status);
      return { source: url };
    }
    
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    let lotSize: string | undefined;
    let zone: string | undefined;
    
    if (url.includes('zillow.com')) {
      // Zillow-specific parsing
      const textContent = doc?.textContent || '';
      
      // Look for lot size patterns
      const lotSizeMatch = textContent.match(/(?:lot.{0,20}size|acres?)[:\s]*([0-9,]+(?:\.[0-9]+)?)\s*(sq\.?\s*ft|acres?|sf)/i);
      if (lotSizeMatch) {
        lotSize = `${lotSizeMatch[1].replace(/,/g, '')} ${lotSizeMatch[2]}`;
      }
      
      // Look for zoning info
      const zoningMatch = textContent.match(/zon(?:ing|e)[:\s]*([A-Z0-9\-]+)/i);
      if (zoningMatch) {
        zone = zoningMatch[1];
      }
    } else if (url.includes('redfin.com')) {
      // Redfin-specific parsing
      const textContent = doc?.textContent || '';
      
      // Look for lot size patterns
      const lotSizeMatch = textContent.match(/(?:lot.{0,20}size)[:\s]*([0-9,]+(?:\.[0-9]+)?)\s*(sq\.?\s*ft|acres?|sf)/i);
      if (lotSizeMatch) {
        lotSize = `${lotSizeMatch[1].replace(/,/g, '')} ${lotSizeMatch[2]}`;
      }
      
      // Look for zoning info
      const zoningMatch = textContent.match(/zon(?:ing|e)[:\s]*([A-Z0-9\-]+)/i);
      if (zoningMatch) {
        zone = zoningMatch[1];
      }
    }
    
    console.log('📦 Extracted from', url.includes('zillow') ? 'Zillow' : 'Redfin', ':', { lotSize, zone });
    return { lotSize, zone, source: url };
    
  } catch (error) {
    console.error('❌ Property data fetch error:', error);
    return { source: url };
  }
};

const extractWithGPT = async (html: string, address: string, openAIApiKey: string): Promise<{ lot_size?: string; zone?: string; jurisdiction?: string }> => {
  try {
    console.log('🤖 Using GPT-5 to extract from HTML content');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'Extract property data from the provided HTML content. Look for lot size, zoning information, and jurisdiction. Return only JSON: {"lot_size": "value with units or null", "zone": "zoning code or null", "jurisdiction": "jurisdiction or null"}' 
          },
          { 
            role: 'user', 
            content: `Extract lot size, zone, and jurisdiction for ${address} from this HTML content (first 4000 chars): ${html.substring(0, 4000)}` 
          }
        ],
        max_completion_tokens: 500,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "html_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                lot_size: { type: ["string", "null"] },
                zone: { type: ["string", "null"] },
                jurisdiction: { type: ["string", "null"] }
              },
              required: ["lot_size", "zone", "jurisdiction"],
              additionalProperties: false
            }
          }
        }
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      if (content) {
        const data = JSON.parse(content);
        console.log('🧠 GPT extracted from HTML:', data);
        return data;
      }
    }
    
    return {};
  } catch (error) {
    console.error('❌ GPT HTML extraction error:', error);
    return {};
  }
};

const performWebSearch = async (address: string, openAIApiKey: string): Promise<{ lot_size?: string; zone?: string; jurisdiction?: string; sourceLinks: string[] }> => {
  console.log('🌐 Starting web search for:', address);
  
  // Search for property listings
  const searchQueries = [
    `"${address}" site:zillow.com`,
    `"${address}" site:redfin.com`,
    `"${address}" lot size zoning`
  ];
  
  const allLinks: string[] = [];
  const sourceLinks: string[] = [];
  let extractedData: any = {};
  
  for (const query of searchQueries) {
    const links = await searchDuckDuckGo(query);
    allLinks.push(...links);
  }
  
  // Remove duplicates
  const uniqueLinks = [...new Set(allLinks)].slice(0, 5);
  
  for (const link of uniqueLinks) {
    const propertyData = await fetchPropertyData(link);
    
    if (propertyData.lotSize || propertyData.zone) {
      sourceLinks.push(propertyData.source);
      
      if (propertyData.lotSize && !extractedData.lot_size) {
        extractedData.lot_size = propertyData.lotSize;
      }
      
      if (propertyData.zone && !extractedData.zone) {
        extractedData.zone = propertyData.zone;
      }
      
      // If we have both lot_size and zone, we can break
      if (extractedData.lot_size && extractedData.zone) {
        break;
      }
    }
    
    // Add small delay between requests
    await sleep(1000);
  }
  
  // Extract jurisdiction from address
  const addressParts = address.split(',');
  if (addressParts.length >= 2) {
    const cityState = addressParts[addressParts.length - 2].trim();
    extractedData.jurisdiction = `City of ${cityState}` || `${cityState} County`;
  }
  
  console.log('🎯 Web search results:', extractedData);
  return { ...extractedData, sourceLinks };
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const processingStartTime = Date.now();
  let modelUsed = 'gpt-5-2025-08-07';

  try {
    const { projectAddress, prompt } = await req.json();

    if (!projectAddress) {
      throw new Error('Project address is required');
    }

    // Address Validation
    const addressValidation = validateAddress(projectAddress);
    if (!addressValidation.isValid) {
      console.warn('⚠️ ADDRESS VALIDATION WARNING:', {
        address: projectAddress,
        suggestions: addressValidation.suggestions
      });
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('🏠 Processing feasibility analysis for address:', projectAddress);
    console.log('📝 User prompt:', prompt);

    // Step 1: Perform web search and scraping first
    console.log('🔍 Phase 1: Web search and data extraction');
    const webSearchResults = await performWebSearch(projectAddress, openAIApiKey);
    
    let extractedData = {
      lot_size: webSearchResults.lot_size || null,
      zone: webSearchResults.zone || null,
      jurisdiction: webSearchResults.jurisdiction || null
    };
    
    let sourceLinks = webSearchResults.sourceLinks || [];
    
    console.log('🌐 Web search completed:', extractedData);
    
    // Step 2: Use GPT-5 for any missing fields or to enhance existing data
    const missingFields = [];
    if (!extractedData.lot_size) missingFields.push('lot_size');
    if (!extractedData.zone) missingFields.push('zone');
    if (!extractedData.jurisdiction) missingFields.push('jurisdiction');
    
    if (missingFields.length > 0) {
      console.log(`🤖 Phase 2: Using GPT-5 for missing fields: ${missingFields.join(', ')}`);
      
      const systemPrompt = `You are a US property research AI. Based on the address and any web data provided, extract missing property information. Focus on finding authoritative data from government sources, tax assessor records, and official planning documents.

REQUIRED JSON FORMAT:
{
  "lot_size": "size with units (e.g., '8,000 sq ft', '0.25 acres') or null",
  "zone": "official zoning code (e.g., 'R-1', 'RS-6000') or null", 
  "jurisdiction": "building/planning dept (e.g., 'City of Palo Alto', 'Los Angeles County') or null"
}

CRITICAL: Return ONLY the JSON object with all three fields, using null for unknown values.`;
      
      const userMessage = `ADDRESS: ${projectAddress}
CURRENT DATA: ${JSON.stringify(extractedData)}
SOURCE LINKS: ${sourceLinks.join(', ')}
MISSING: ${missingFields.join(', ')}
CONTEXT: ${prompt}

Find the missing fields and return complete JSON with all three fields.`;

      console.log('📤 GPT-5 Enhancement Request for missing fields');

      let openAIResponse: Response;
      
      // Robust retry logic with exponential backoff
      const makeOpenAIRequest = async (isRetry = false, attempt = 0): Promise<Response> => {
      const maxRetries = 3;
      
      for (let retryAttempt = 0; retryAttempt <= maxRetries; retryAttempt++) {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelUsed,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
              ],
              max_completion_tokens: 10000, // Increased for sufficiency as requested
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "property_research_response",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      lot_size: { 
                        type: ["string", "null"]
                      },
                      zone: { 
                        type: ["string", "null"]
                      },
                      jurisdiction: { 
                        type: ["string", "null"]
                      }
                    },
                    required: ["lot_size", "zone", "jurisdiction"],
                    additionalProperties: false
                  }
                }
              }
            }),
          });

          // Handle 503 and other retryable errors
          if (response.status === 503 || (response.status >= 500 && response.status !== 500)) {
            if (retryAttempt < maxRetries) {
              const delay = getRetryDelay(retryAttempt);
              console.log(`🔄 OpenAI ${response.status} error, retrying in ${Math.round(delay)}ms (attempt ${retryAttempt + 1}/${maxRetries + 1})`);
              await sleep(delay);
              continue;
            }
          }

        return response;
        } catch (error) {
          if (retryAttempt < maxRetries) {
            const delay = getRetryDelay(retryAttempt);
            console.log(`🔄 Network error, retrying in ${Math.round(delay)}ms (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, error);
            await sleep(delay);
            continue;
          }
          throw error;
        }
      }
      
      throw new Error('Max retries exceeded');
      };
      
      try {
        openAIResponse = await makeOpenAIRequest();

          if (!openAIResponse.ok) {
            const errorText = await openAIResponse.text();
            console.error('❌ OpenAI API Error:', {
              status: openAIResponse.status,
              statusText: openAIResponse.statusText,
              error: errorText
            });
            
            logAPIMetrics(`${modelUsed}-failed`, false, [], projectAddress, null, Date.now());
            throw new Error(`OpenAI API error (${modelUsed}): ${openAIResponse.status} - ${errorText}`);
          }

      const result = await openAIResponse.json();
      
      console.log('✅ OpenAI API response data:', {
        id: result.id,
        model: result.model,
        usage: result.usage,
        choices: result.choices?.length,
        hasContent: !!result.choices?.[0]?.message?.content,
        finishReason: result.choices?.[0]?.finish_reason
      });

      const content = result.choices?.[0]?.message?.content;
      console.log('📄 Raw OpenAI response content:', JSON.stringify(content));

      // Check for token exhaustion and attempt salvage
      const finishReason = result.choices?.[0]?.finish_reason;
      if (!content || finishReason === 'length') {
        console.log('⚠️ Model returned empty/truncated content, attempting salvage call...');
        
        // Second-chance salvage call with ultra-compact prompt
        try {
          const salvageResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelUsed,
              messages: [
                { 
                  role: 'system', 
                  content: 'Extract property data. Return only JSON: {"lot_size": "value or null", "zone": "value or null", "jurisdiction": "value or null"}' 
                },
                { role: 'user', content: `Address: ${projectAddress}` }
              ],
              max_completion_tokens: 200,
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "salvage_response",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      lot_size: { type: ["string", "null"] },
                      zone: { type: ["string", "null"] },
                      jurisdiction: { type: ["string", "null"] }
                    },
                    required: ["lot_size", "zone", "jurisdiction"],
                    additionalProperties: false
                  }
                }
              }
            }),
          });
          
          if (salvageResponse.ok) {
            const salvageResult = await salvageResponse.json();
            const salvageContent = salvageResult.choices?.[0]?.message?.content;
            console.log('🚑 Salvage call content:', salvageContent);
            
            if (salvageContent) {
              extractedData = JSON.parse(salvageContent);
              console.log('✅ Salvage call successful:', extractedData);
              logAPIMetrics(`${modelUsed}-salvage-success`, true, [], projectAddress, salvageResult.usage, Date.now());
            } else {
              throw new Error('Salvage call also returned empty content');
            }
        } else {
          throw new Error('Salvage call failed');
        }
      } catch (salvageError) {
        console.error('❌ Salvage call failed:', salvageError);
        logAPIMetrics(`${modelUsed}-error`, false, [], 'error-occurred', null, Date.now());
        throw new Error(`${modelUsed} returned empty content and salvage failed`);
      }
    } else {
      try {
        const gptData = JSON.parse(content);
        console.log('✅ GPT-5 enhancement results:', gptData);
        
        // Merge GPT-5 results with web search results (prioritize web search)
        extractedData = {
          lot_size: extractedData.lot_size || gptData.lot_size || null,
          zone: extractedData.zone || gptData.zone || null,
          jurisdiction: extractedData.jurisdiction || gptData.jurisdiction || null
        };
        
        console.log('🔗 Final merged data:', extractedData);
      } catch (parseError) {
        console.error('❌ JSON parsing error:', parseError, 'Content:', content);
        console.log('⚠️ Using web search results only due to GPT parsing error');
      }
    }

    } catch (error) {
      console.error(`💥 Error in GPT-5 enhancement:`, error);
      console.log('⚠️ Continuing with web search results only');
    }
    } else {
      console.log('✅ All fields found via web search, skipping GPT-5 enhancement');
    }

    // Enhanced data normalization and validation
    const normalizeField = (value: any): string | null => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed === '' || trimmed.toLowerCase() === 'unknown' ? null : trimmed;
    };

    // Normalize extracted data fields
    extractedData = {
      lot_size: normalizeField(extractedData.lot_size),
      zone: normalizeField(extractedData.zone), 
      jurisdiction: normalizeField(extractedData.jurisdiction)
    };

    console.log('🔧 Final normalized data:', extractedData);

    // Validation and field completion tracking
    const extractedFieldsList = [];
    const missingFields = [];
    const suggestions = [];
    
    if (extractedData.lot_size) extractedFieldsList.push('lot_size');
    else {
      missingFields.push('lot_size');
      suggestions.push('Verify the address exists in public tax records');
    }
    
    if (extractedData.zone) extractedFieldsList.push('zone'); 
    else {
      missingFields.push('zone');
      suggestions.push('Check municipal zoning maps or planning department website');
    }
    
    if (extractedData.jurisdiction) extractedFieldsList.push('jurisdiction');
    else {
      missingFields.push('jurisdiction');
      suggestions.push('Confirm the city/county responsible for building permits');
    }

    console.log('📈 Final extraction analytics:', {
      webSearchSuccess: webSearchResults.lot_size || webSearchResults.zone ? true : false,
      finalSuccess: extractedFieldsList.length === 3,
      extractionRate: `${extractedFieldsList.length}/3`,
      extractedFields: extractedFieldsList,
      missingFields: missingFields,
      sourceLinks: sourceLinks,
      address: projectAddress
    });

    // Store the analysis results
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    console.log('💾 Storing feasibility analysis for user:', user.id);

    // Enhanced database insert with better error handling
    const { data: feasibilityData, error: insertError } = await supabase
      .from('feasibility_analyses')
      .insert({
        project_address: projectAddress,
        lot_size: extractedData.lot_size,
        zone: extractedData.zone,
        jurisdiction: extractedData.jurisdiction,
        user_id: user.id,
        last_updated_by: user.id,
        source_link: sourceLinks.length > 0 ? sourceLinks[0] : null,
        city_dept_link: sourceLinks.length > 1 ? sourceLinks[1] : null,
        notes: `Analysis completed using web scraping + ${modelUsed}. Processing time: ${Date.now() - processingStartTime}ms. Sources: ${sourceLinks.join(', ')}. Fields extracted: ${extractedFieldsList.length}/3`
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      logAPIMetrics(`${modelUsed}-db-error`, false, extractedFieldsList, projectAddress, null, Date.now());
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('✅ Successfully stored feasibility analysis:', feasibilityData.id);

    // Enhanced ordinance matching with better logic
    let ordinances = [];
    if (extractedData.jurisdiction && extractedData.zone) {
      console.log('🔍 Searching for matching ordinances...');
      
      const { data: ordinanceData, error: ordinanceError } = await supabase
        .from('jurisdiction_ordinances')
        .select('*')
        .ilike('jurisdiction', `%${extractedData.jurisdiction}%`)
        .ilike('zone', `%${extractedData.zone}%`);

      if (ordinanceError) {
        console.warn('⚠️ Ordinance query error:', ordinanceError);
      } else {
        ordinances = ordinanceData || [];
        console.log(`📋 Found ${ordinances.length} matching ordinances`);
      }
    } else {
      console.log('⚠️ Insufficient data for ordinance matching (missing jurisdiction or zone)');
    }

    // Log successful metrics
    logAPIMetrics(modelUsed, extractedFieldsList.length === 3, extractedFieldsList, projectAddress, null, Date.now());

    // Enhanced response with analytics and warnings for partial results
    const finalResponse = {
      success: true,
      feasibilityAnalysis: feasibilityData,
      ordinances: ordinances,
      extractedData: extractedData,
      analytics: {
        modelUsed,
        processingTimeMs: Date.now() - processingStartTime,
        extractionRate: `${extractedFieldsList.length}/3`,
        successRate: `${Math.round((extractedFieldsList.length / 3) * 100)}%`,
        ordinancesFound: ordinances.length,
        addressValidation: addressValidation.isValid ? 'PASSED' : 'FAILED',
        warningsFound: missingFields.length > 0,
        webSearchSuccess: sourceLinks.length > 0,
        sourceLinks: sourceLinks
      },
      warnings: missingFields.length > 0 ? {
        missingFields,
        suggestions
      } : undefined
    };

    console.log('🎉 Analysis completed successfully:', {
      analysisId: feasibilityData.id,
      totalTimeMs: Date.now() - processingStartTime,
      extractedFields: extractedFieldsList,
      ordinanceCount: ordinances.length
    });

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const processingTimeMs = Date.now() - processingStartTime;
    
    console.error(`💥 Error in ai-feasibility-analyzer function:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs,
      modelUsed: modelUsed
    });

    logAPIMetrics(`${modelUsed}-error`, false, [], 'error-occurred', null, Date.now());

    // Return 500 only for unexpected errors, not validation failures
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred during analysis',
      processingTimeMs,
      suggestions: [
        'Try again in a few moments',
        'Verify your address format is correct',
        'Check if the address exists in public records'
      ]
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});