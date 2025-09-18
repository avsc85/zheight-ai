import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { JurisdictionOrdinance } from '@/pages/AIFeasibility';
import { toast } from 'sonner';

interface JurisdictionOrdinanceTableProps {
  ordinances: JurisdictionOrdinance[];
  onUpdate?: (updatedOrdinances: JurisdictionOrdinance[]) => void;
}

export function JurisdictionOrdinanceTable({ ordinances, onUpdate }: JurisdictionOrdinanceTableProps) {
  // Get the first ordinance for display, or create empty template
  const currentOrdinance = ordinances.length > 0 ? ordinances[0] : null;

  const ordinanceFields = [
    { key: 'jurisdiction', label: 'jurisdiction' },
    { key: 'zone', label: 'zone' },
    { key: 'code_reference', label: 'code_reference' },
    { key: 'definition_lot_coverage', label: 'definition_lot_coverage' },
    { key: 'lot_coverage', label: 'lot_coverage' },
    { key: 'definition_floor_area', label: 'definition_floor_area' },
    { key: 'floor_area_ratio', label: 'floor_area_ratio' },
    { key: 'min_setback_front_ft', label: 'min_setback_front_ft' },
    { key: 'min_setback_side_ft', label: 'min_setback_side_ft' },
    { key: 'min_setback_rear_ft', label: 'min_setback_rear_ft' },
    { key: 'min_setback_corner_ft', label: 'min_setback_corner_ft' },
    { key: 'max_height_ft', label: 'max_height_ft' },
    { key: 'exemption_max_height', label: 'exemption_max_height' },
    { key: 'daylight_plan_rear', label: 'daylight_plan_rear' },
    { key: 'daylight_plan_side', label: 'daylight_plan_side' },
    { key: 'exemption_substandard_lot', label: 'exemption_substandard_lot' },
    { key: 'exemption_side_setback_encroachment', label: 'exemption_side_setback_encroachment' },
    { key: 'exemption_front_setback_encroachment', label: 'exemption_front_setback_encroachment' },
    { key: 'min_garage_length', label: 'min_garage_length' },
    { key: 'min_garage_width', label: 'min_garage_width' },
    { key: 'parking', label: 'parking' },
  ];

  const handleUpdate = () => {
    toast.success('Ordinance data updated successfully');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Feasibility</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">#</TableHead>
                <TableHead className="min-w-[200px] w-[25%]">Ordinance</TableHead>
                <TableHead className="min-w-[300px] w-[45%]">Value</TableHead>
                <TableHead className="min-w-[200px] w-[30%]">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordinanceFields.map((field, index) => {
                const value = currentOrdinance ? (currentOrdinance as any)[field.key] : '';
                
                return (
                  <TableRow key={field.key} className="min-h-[60px]">
                    <TableCell className="font-medium text-center align-top pt-4">{index + 1}</TableCell>
                    <TableCell className="align-top pt-4">
                      <div className="break-words text-sm leading-tight">
                        {field.label}
                      </div>
                    </TableCell>
                    <TableCell className="align-top pt-2">
                      <Input
                        value={value || ''}
                        placeholder={currentOrdinance ? '' : 'No data available'}
                        readOnly
                        className="w-full min-h-[40px] text-sm leading-tight"
                        style={{ 
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      />
                    </TableCell>
                    <TableCell className="align-top pt-2">
                      <Input
                        placeholder="Add notes..."
                        className="w-full min-h-[40px] text-sm"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex justify-end mt-4">
          <Button onClick={handleUpdate}>
            UPDATE
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}