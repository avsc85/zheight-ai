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
    { key: 'tag_1', label: 'Tag_1' },
    { key: 'tag_2', label: 'Tag_2' },
    { key: 'definition_lot_coverage', label: 'Definition_Lot_Coverage' },
    { key: 'lot_coverage', label: 'Lot_Coverage' },
    { key: 'definition_floor_area', label: 'Definition_Floor_Area' },
    { key: 'floor_area_ratio', label: 'Floor_Area_Ratio' },
    { key: 'min_setback_front_ft', label: 'Minimum_Setback_Front_(ft)' },
    { key: 'min_setback_side_ft', label: 'Minimum_Setback_Side_(Ft)' },
    { key: 'min_setback_rear_ft', label: 'Minimum_Setback_Rear_(ft)' },
    { key: 'min_setback_corner_ft', label: 'Minimum_Setback_Corner_(ft)' },
    { key: 'max_height_ft', label: 'Maximum_Height_(ft)' },
    { key: 'exemption_max_height', label: 'Exemption_-_Maximum_Height' },
    { key: 'daylight_plan_rear', label: 'Daylight_Plan_Rear' },
    { key: 'daylight_plan_side', label: 'Daylight_Plan_Side' },
    { key: 'exemption_substandard_lot', label: 'Exemption_Substandard_Lot' },
    { key: 'exemption_side_setback_encroachment', label: 'Exemption_Side_Setback_Encroachment' },
    { key: 'exemption_front_setback_encroachment', label: 'Exemption_Front_Setback_Encroachment' },
    { key: 'min_garage_length', label: 'Min_Garage_Length' },
    { key: 'min_garage_width', label: 'Min_Garage_Width' },
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-1/3">Ordinance</TableHead>
              <TableHead className="w-1/3">Value</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordinanceFields.map((field, index) => {
              const value = currentOrdinance ? (currentOrdinance as any)[field.key] : '';
              
              return (
                <TableRow key={field.key}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{field.label}</TableCell>
                  <TableCell>
                    <Input
                      value={value || ''}
                      placeholder={currentOrdinance ? '' : 'No data available'}
                      readOnly
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Add notes..."
                      className="w-full"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        <div className="flex justify-end mt-4">
          <Button onClick={handleUpdate}>
            UPDATE
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}