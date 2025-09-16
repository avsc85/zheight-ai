import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { JurisdictionOrdinance } from '@/pages/AIFeasibility';

interface OrdinanceTableProps {
  ordinances: JurisdictionOrdinance[];
  onUpdate: (updatedOrdinances: JurisdictionOrdinance[]) => void;
}

export function OrdinanceTable({ ordinances, onUpdate }: OrdinanceTableProps) {
  const [editingOrdinance, setEditingOrdinance] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<JurisdictionOrdinance>>({});
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = (ordinance: JurisdictionOrdinance) => {
    setEditingOrdinance(ordinance.id);
    setEditedValues(ordinance);
  };

  const cancelEditing = () => {
    setEditingOrdinance(null);
    setEditedValues({});
  };

  const handleFieldChange = (field: keyof JurisdictionOrdinance, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveChanges = async () => {
    if (!editingOrdinance || !editedValues) return;

    setIsSaving(true);
    
    try {
      const { data, error } = await supabase
        .from('jurisdiction_ordinances')
        .update({
          ...editedValues,
          last_updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', editingOrdinance)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update local state
      const updatedOrdinances = ordinances.map(ord => 
        ord.id === editingOrdinance ? data : ord
      );
      onUpdate(updatedOrdinances);

      toast.success('Ordinance updated successfully');
      setEditingOrdinance(null);
      setEditedValues({});
      
    } catch (error) {
      console.error('Error updating ordinance:', error);
      toast.error('Failed to update ordinance');
    } finally {
      setIsSaving(false);
    }
  };

  const ordinanceFields = [
    { key: 'code_reference', label: 'Code Reference' },
    { key: 'definition_lot_coverage', label: 'Lot Coverage Definition' },
    { key: 'lot_coverage', label: 'Lot Coverage' },
    { key: 'definition_floor_area', label: 'Floor Area Definition' },
    { key: 'floor_area_ratio', label: 'Floor Area Ratio' },
    { key: 'min_setback_front_ft', label: 'Min Setback Front (ft)' },
    { key: 'min_setback_side_ft', label: 'Min Setback Side (ft)' },
    { key: 'min_setback_rear_ft', label: 'Min Setback Rear (ft)' },
    { key: 'min_setback_corner_ft', label: 'Min Setback Corner (ft)' },
    { key: 'max_height_ft', label: 'Max Height (ft)' },
    { key: 'exemption_max_height', label: 'Height Exemption' },
    { key: 'daylight_plan_rear', label: 'Daylight Plan Rear' },
    { key: 'daylight_plan_side', label: 'Daylight Plan Side' },
    { key: 'exemption_substandard_lot', label: 'Substandard Lot Exemption' },
    { key: 'exemption_side_setback_encroachment', label: 'Side Setback Encroachment' },
    { key: 'exemption_front_setback_encroachment', label: 'Front Setback Encroachment' },
    { key: 'min_garage_length', label: 'Min Garage Length' },
    { key: 'min_garage_width', label: 'Min Garage Width' },
    { key: 'parking', label: 'Parking Requirements' }
  ];

  if (ordinances.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Feasibility - Jurisdiction Ordinances</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Source Link</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordinances.map((ordinance) => (
                <>
                  {ordinanceFields.map((field) => (
                    <TableRow key={`${ordinance.id}-${field.key}`}>
                      <TableCell className="font-medium">{field.label}</TableCell>
                      <TableCell>
                        {editingOrdinance === ordinance.id ? (
                          <Input
                            value={(editedValues as any)[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key as keyof JurisdictionOrdinance, e.target.value)}
                            className="min-w-[150px]"
                          />
                        ) : (
                          <span className="text-sm">
                            {(ordinance as any)[field.key] || '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingOrdinance === ordinance.id ? (
                          <Input
                            value={editedValues.ordinance_source_link || ''}
                            onChange={(e) => handleFieldChange('ordinance_source_link', e.target.value)}
                            placeholder="Source link..."
                            className="min-w-[150px]"
                          />
                        ) : (
                          <span className="text-sm">
                            {ordinance.ordinance_source_link ? (
                              <a 
                                href={ordinance.ordinance_source_link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                View Source
                              </a>
                            ) : (
                              '-'
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingOrdinance === ordinance.id ? (
                          <Textarea
                            value={editedValues.notes || ''}
                            onChange={(e) => handleFieldChange('notes', e.target.value)}
                            placeholder="Add notes..."
                            rows={2}
                            className="min-w-[200px]"
                          />
                        ) : (
                          <span className="text-sm">
                            {ordinance.notes || '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {field.key === 'code_reference' && ( // Only show actions on first row per ordinance
                          <>
                            {editingOrdinance === ordinance.id ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={saveChanges}
                                  disabled={isSaving}
                                >
                                  {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditing}
                                  disabled={isSaving}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditing(ordinance)}
                              >
                                Edit
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
        
        <div className="text-sm text-muted-foreground mt-4 pt-4 border-t">
          <p>Found {ordinances.length} matching ordinance(s) for the jurisdiction and zone.</p>
        </div>
      </CardContent>
    </Card>
  );
}