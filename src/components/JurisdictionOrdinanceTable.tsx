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
    { key: 'jurisdiction', label: 'Jurisdiction' },
    { key: 'zone', label: 'Zone' },
    { key: 'code_reference', label: 'Code Reference' },
    { key: 'definition_lot_coverage', label: 'Definition Lot Coverage' },
    { key: 'lot_coverage', label: 'Lot Coverage' },
    { key: 'definition_floor_area', label: 'Definition Floor Area' },
    { key: 'floor_area_ratio', label: 'Floor Area Ratio' },
    { key: 'min_setback_front_ft', label: 'Min Setback Front Ft' },
    { key: 'min_setback_side_ft', label: 'Min Setback Side Ft' },
    { key: 'min_setback_rear_ft', label: 'Min Setback Rear Ft' },
    { key: 'min_setback_corner_ft', label: 'Min Setback Corner Ft' },
    { key: 'max_height_ft', label: 'Max Height Ft' },
    { key: 'exemption_max_height', label: 'Exemption Max Height' },
    { key: 'daylight_plan_rear', label: 'Daylight Plan Rear' },
    { key: 'daylight_plan_side', label: 'Daylight Plan Side' },
    { key: 'exemption_substandard_lot', label: 'Exemption Substandard Lot' },
    { key: 'exemption_side_setback_encroachment', label: 'Exemption Side Setback Encroachment' },
    { key: 'exemption_front_setback_encroachment', label: 'Exemption Front Setback Encroachment' },
    { key: 'min_garage_length', label: 'Min Garage Length' },
    { key: 'min_garage_width', label: 'Min Garage Width' },
    { key: 'parking', label: 'Parking' },
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
                        {field.label.replace(/_/g, ' ')}
                      </div>
                    </TableCell>
                    <TableCell className="align-top pt-2">
                      <Input
                        value={value || ''}
                        placeholder={currentOrdinance ? '' : 'No data available'}
                        readOnly
                        className="w-full min-h-[40px] text-sm leading-tight resize-none"
                        style={{ 
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                          overflow: 'visible'
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