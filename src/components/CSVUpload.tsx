import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, FileText, Trash2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

interface CSVData {
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  csvColumn: string;
  dbColumn: string;
}

const DATABASE_COLUMNS = [
  { value: '', label: 'Skip Column' },
  { value: 'tag_1', label: 'Tag 1' },
  { value: 'tag_2', label: 'Tag 2' },
  { value: 'jurisdiction', label: 'Jurisdiction *' },
  { value: 'zone', label: 'Zone *' },
  { value: 'code_reference', label: 'Code Reference' },
  { value: 'definition_lot_coverage', label: 'Definition Lot Coverage' },
  { value: 'lot_coverage', label: 'Lot Coverage' },
  { value: 'definition_floor_area', label: 'Definition Floor Area' },
  { value: 'floor_area_ratio', label: 'Floor Area Ratio' },
  { value: 'min_setback_front_ft', label: 'Minimum Setback Front (ft)' },
  { value: 'min_setback_side_ft', label: 'Minimum Setback Side (ft)' },
  { value: 'min_setback_rear_ft', label: 'Minimum Setback Rear (ft)' },
  { value: 'min_setback_corner_ft', label: 'Minimum Setback Corner (ft)' },
  { value: 'max_height_ft', label: 'Maximum Height (ft)' },
  { value: 'exemption_max_height', label: 'Exemption - Maximum Height' },
  { value: 'daylight_plan_rear', label: 'Daylight Plan Rear' },
  { value: 'daylight_plan_side', label: 'Daylight Plan Side' },
  { value: 'exemption_substandard_lot', label: 'Exemption Substandard Lot' },
  { value: 'exemption_side_setback_encroachment', label: 'Exemption Side Setback Encroachment' },
  { value: 'exemption_front_setback_encroachment', label: 'Exemption Front Setback Encroachment' },
  { value: 'min_garage_length', label: 'Min Garage Length' },
  { value: 'min_garage_width', label: 'Min Garage Width' },
  { value: 'parking', label: 'Parking' },
  { value: 'ordinance_source_link', label: 'Ordinance Source Link' },
  { value: 'notes', label: 'Notes' }
];

export function CSVUpload() {
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewRows, setPreviewRows] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { role } = useUserRole();

  // Only show component for admins
  if (role !== 'admin') {
    return null;
  }

  const parseCSV = (csvText: string): CSVData => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) throw new Error('CSV file is empty');

    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => 
      line.split(',').map(cell => cell.trim().replace(/"/g, ''))
    );

    return { headers, rows };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const data = parseCSV(csvText);
        setCsvData(data);
        
        // Initialize column mappings with auto-matching
        const mappings = data.headers.map(header => {
          const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const matchedColumn = DATABASE_COLUMNS.find(col => 
            col.value && col.value.toLowerCase().includes(lowerHeader.slice(0, 10))
          );
          
          return {
            csvColumn: header,
            dbColumn: matchedColumn?.value || ''
          };
        });
        setColumnMappings(mappings);
        toast.success('CSV file parsed successfully');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  const updateColumnMapping = (csvColumn: string, dbColumn: string) => {
    setColumnMappings(prev => 
      prev.map(mapping => 
        mapping.csvColumn === csvColumn 
          ? { ...mapping, dbColumn }
          : mapping
      )
    );
  };

  const validateMappings = (): boolean => {
    const requiredColumns = ['jurisdiction', 'zone'];
    const mappedDbColumns = columnMappings
      .filter(m => m.dbColumn)
      .map(m => m.dbColumn);
    
    const missingRequired = requiredColumns.filter(col => !mappedDbColumns.includes(col));
    
    if (missingRequired.length > 0) {
      toast.error(`Required columns missing: ${missingRequired.join(', ')}`);
      return false;
    }

    // Check for duplicate mappings
    const dbColumns = mappedDbColumns.filter(col => col);
    const duplicates = dbColumns.filter((col, index) => dbColumns.indexOf(col) !== index);
    
    if (duplicates.length > 0) {
      toast.error(`Duplicate column mappings detected: ${duplicates.join(', ')}`);
      return false;
    }

    return true;
  };

  const handleUpload = async () => {
    if (!csvData || !validateMappings()) return;

    setIsUploading(true);

    try {
      const { data, error } = await supabase.functions.invoke('csv-upload-ordinances', {
        body: {
          csvData,
          columnMappings: columnMappings.filter(m => m.dbColumn)
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`Successfully uploaded ${data.successCount} records`);
      if (data.errorCount > 0) {
        toast.warning(`${data.errorCount} records failed to upload`);
      }
      
      // Reset form
      setCsvData(null);
      setColumnMappings([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload CSV data');
    } finally {
      setIsUploading(false);
    }
  };

  const clearData = () => {
    setCsvData(null);
    setColumnMappings([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          CSV Upload - Jurisdiction Ordinances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            Upload a CSV file to append data to the jurisdiction ordinances table. 
            Required columns: Jurisdiction, Zone. Map your CSV columns to database columns below.
          </AlertDescription>
        </Alert>

        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="csv-file">Select CSV File</Label>
          <div className="flex gap-2">
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              ref={fileInputRef}
              disabled={isUploading}
            />
            {csvData && (
              <Button
                variant="outline"
                onClick={clearData}
                disabled={isUploading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {csvData && (
          <>
            {/* Column Mapping */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Column Mapping</h3>
              <div className="grid gap-4">
                {columnMappings.map((mapping, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{mapping.csvColumn}</Label>
                    </div>
                    <div className="flex-1">
                      <Select
                        value={mapping.dbColumn}
                        onValueChange={(value) => updateColumnMapping(mapping.csvColumn, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select database column" />
                        </SelectTrigger>
                        <SelectContent>
                          {DATABASE_COLUMNS.map(col => (
                            <SelectItem key={col.value} value={col.value}>
                              {col.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Preview ({csvData.rows.length} rows)</h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor="preview-rows">Show rows:</Label>
                  <Select value={previewRows.toString()} onValueChange={(value) => setPreviewRows(parseInt(value))}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {csvData.headers.map((header, index) => (
                        <TableHead key={index} className="whitespace-nowrap">
                          {header}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            → {columnMappings[index]?.dbColumn || 'Skip'}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.rows.slice(0, previewRows).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex} className="whitespace-nowrap">
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Upload Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={isUploading || !csvData}
                size="lg"
              >
                {isUploading ? 'Uploading...' : `Upload ${csvData.rows.length} Records`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}