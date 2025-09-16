import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FeasibilityAnalysis } from '@/pages/AIFeasibility';

interface FeasibilityResultsProps {
  analysis: FeasibilityAnalysis;
  onUpdate: (updatedAnalysis: FeasibilityAnalysis) => void;
}

export function FeasibilityResults({ analysis, onUpdate }: FeasibilityResultsProps) {
  const [editedAnalysis, setEditedAnalysis] = useState<FeasibilityAnalysis>(analysis);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditedAnalysis(analysis);
  }, [analysis]);

  const handleFieldChange = (field: keyof FeasibilityAnalysis, value: string) => {
    setEditedAnalysis(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUpdate = async () => {
    setIsSaving(true);
    
    try {
      const { data, error } = await supabase
        .from('feasibility_analyses')
        .update({
          lot_size: editedAnalysis.lot_size,
          zone: editedAnalysis.zone,
          jurisdiction: editedAnalysis.jurisdiction,
          source_link: editedAnalysis.source_link,
          city_dept_link: editedAnalysis.city_dept_link,
          notes: editedAnalysis.notes,
          last_updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', editedAnalysis.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast.success('Feasibility analysis updated successfully');
      onUpdate(data);
      
    } catch (error) {
      console.error('Error updating feasibility analysis:', error);
      toast.error('Failed to update feasibility analysis');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(editedAnalysis) !== JSON.stringify(analysis);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lot-size">Lot Size</Label>
            <Input
              id="lot-size"
              value={editedAnalysis.lot_size || ''}
              onChange={(e) => handleFieldChange('lot_size', e.target.value)}
              placeholder="Lot size..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zone">Zone</Label>
            <Input
              id="zone"
              value={editedAnalysis.zone || ''}
              onChange={(e) => handleFieldChange('zone', e.target.value)}
              placeholder="Zoning designation..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jurisdiction">Jurisdiction</Label>
            <Input
              id="jurisdiction"
              value={editedAnalysis.jurisdiction || ''}
              onChange={(e) => handleFieldChange('jurisdiction', e.target.value)}
              placeholder="City/County..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-link">Source Link</Label>
            <Input
              id="source-link"
              value={editedAnalysis.source_link || ''}
              onChange={(e) => handleFieldChange('source_link', e.target.value)}
              placeholder="Source documentation link..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city-dept-link">City Dept. Link</Label>
            <Input
              id="city-dept-link"
              value={editedAnalysis.city_dept_link || ''}
              onChange={(e) => handleFieldChange('city_dept_link', e.target.value)}
              placeholder="City department link..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={editedAnalysis.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
        </div>

        {hasChanges && (
          <Button 
            onClick={handleUpdate} 
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? 'Updating...' : 'Update'}
          </Button>
        )}

        <div className="text-sm text-muted-foreground pt-2 border-t">
          <p>Last Updated: {new Date(editedAnalysis.last_updated).toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}