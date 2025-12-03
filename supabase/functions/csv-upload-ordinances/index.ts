import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CSVData {
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  csvColumn: string;
  dbColumn: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvData, columnMappings }: { csvData: CSVData; columnMappings: ColumnMapping[] } = await req.json();

    if (!csvData || !columnMappings) {
      throw new Error('CSV data and column mappings are required');
    }

    // Initialize Supabase client
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

    // Check if user has admin role
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError) {
      throw new Error('Failed to check user permissions');
    }

    const hasAdminRole = userRoles?.some(role => role.role === 'admin');
    if (!hasAdminRole) {
      throw new Error('Admin role required for CSV upload');
    }

    console.log(`Processing CSV upload with ${csvData.rows.length} rows for user ${user.id}`);

    // Create column mapping lookup
    const columnMap = new Map<string, string>();
    columnMappings.forEach(mapping => {
      const csvColumnIndex = csvData.headers.indexOf(mapping.csvColumn);
      if (csvColumnIndex !== -1) {
        columnMap.set(csvColumnIndex.toString(), mapping.dbColumn);
      }
    });

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process rows in batches
    const batchSize = 100;
    for (let i = 0; i < csvData.rows.length; i += batchSize) {
      const batch = csvData.rows.slice(i, i + batchSize);
      const recordsToInsert = [];

      for (const [rowIndex, row] of batch.entries()) {
        try {
          const record: any = {
            last_updated_by: user.id
          };

          // Map CSV columns to database columns
          row.forEach((cellValue, columnIndex) => {
            const dbColumn = columnMap.get(columnIndex.toString());
            if (dbColumn && cellValue?.trim()) {
              record[dbColumn] = cellValue.trim();
            }
          });

          // Validate required fields
          if (!record.jurisdiction || !record.zone) {
            errors.push(`Row ${i + rowIndex + 2}: Missing required fields (jurisdiction, zone)`);
            errorCount++;
            continue;
          }

          recordsToInsert.push(record);
        } catch (error) {
          errors.push(`Row ${i + rowIndex + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          errorCount++;
        }
      }

      // Insert batch
      if (recordsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('jurisdiction_ordinances')
          .insert(recordsToInsert);

        if (insertError) {
          console.error('Batch insert error:', insertError);
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
          errorCount += recordsToInsert.length;
        } else {
          successCount += recordsToInsert.length;
          console.log(`Successfully inserted batch of ${recordsToInsert.length} records`);
        }
      }
    }

    console.log(`Upload completed: ${successCount} successful, ${errorCount} errors`);

    return new Response(JSON.stringify({
      successCount,
      errorCount,
      errors: errors.slice(0, 10), // Return first 10 errors
      totalProcessed: csvData.rows.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in csv-upload-ordinances function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      successCount: 0,
      errorCount: 0 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});