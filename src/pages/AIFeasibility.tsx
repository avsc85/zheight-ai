import { useState } from 'react';
import { Header } from '@/components/Header';
import { FeasibilityInput } from '@/components/FeasibilityInput';
import { FeasibilityResults } from '@/components/FeasibilityResults';
import { JurisdictionOrdinanceTable } from '@/components/JurisdictionOrdinanceTable';
import { CSVUpload } from '@/components/CSVUpload';

export interface FeasibilityAnalysis {
  id: string;
  project_address: string;
  lot_size: string | null;
  zone: string | null;
  jurisdiction: string | null;
  source_link: string | null;
  city_dept_link: string | null;
  notes: string | null;
  last_updated_by: string | null;
  last_updated: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface JurisdictionOrdinance {
  id: string;
  tag_1: string | null;
  tag_2: string | null;
  jurisdiction: string;
  zone: string;
  code_reference: string | null;
  definition_lot_coverage: string | null;
  lot_coverage: string | null;
  definition_floor_area: string | null;
  floor_area_ratio: string | null;
  min_setback_front_ft: string | null;
  min_setback_side_ft: string | null;
  min_setback_rear_ft: string | null;
  min_setback_corner_ft: string | null;
  max_height_ft: string | null;
  exemption_max_height: string | null;
  daylight_plan_rear: string | null;
  daylight_plan_side: string | null;
  exemption_substandard_lot: string | null;
  exemption_side_setback_encroachment: string | null;
  exemption_front_setback_encroachment: string | null;
  min_garage_length: string | null;
  min_garage_width: string | null;
  parking: string | null;
  ordinance_source_link: string | null;
  notes: string | null;
  last_updated_by: string | null;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

export default function AIFeasibility() {
  const [feasibilityAnalysis, setFeasibilityAnalysis] = useState<FeasibilityAnalysis | null>(null);
  const [ordinances, setOrdinances] = useState<JurisdictionOrdinance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalysisComplete = (analysis: FeasibilityAnalysis, matchedOrdinances: JurisdictionOrdinance[]) => {
    setFeasibilityAnalysis(analysis);
    setOrdinances(matchedOrdinances);
    setIsLoading(false);
  };

  const handleAnalysisStart = () => {
    setIsLoading(true);
  };

  const handleAnalysisEnd = () => {
    setIsLoading(false);
  };

  const handleFeasibilityUpdate = (updatedAnalysis: FeasibilityAnalysis) => {
    setFeasibilityAnalysis(updatedAnalysis);
  };

  const handleOrdinanceUpdate = (updatedOrdinances: JurisdictionOrdinance[]) => {
    setOrdinances(updatedOrdinances);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="mb-2">
            <h1 className="text-3xl font-bold text-foreground mb-2">AI Feasibility Analyzer</h1>
            <p className="text-muted-foreground">
              Analyze residential single-family house feasibility using AI-powered lot analysis
            </p>
          </div>

          {/* Input and Output Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FeasibilityInput 
              onAnalysisComplete={handleAnalysisComplete}
              onAnalysisStart={handleAnalysisStart}
              onAnalysisEnd={handleAnalysisEnd}
              isLoading={isLoading}
            />
            
            {/* Output Section - Always visible */}
            <FeasibilityResults 
              analysis={feasibilityAnalysis || {
                id: '',
                project_address: '',
                lot_size: null,
                zone: null,
                jurisdiction: null,
                source_link: null,
                city_dept_link: null,
                notes: null,
                last_updated_by: null,
                last_updated: '',
                user_id: '',
                created_at: '',
                updated_at: ''
              }}
              ordinances={ordinances}
              onUpdate={handleFeasibilityUpdate}
            />
          </div>

          {/* Ordinance Table Section - Always visible */}
          <div className="w-full">
            <JurisdictionOrdinanceTable 
              ordinances={ordinances}
              onUpdate={handleOrdinanceUpdate}
            />
          </div>

          {/* CSV Upload Section - Admin only */}
          <div className="w-full">
            <CSVUpload />
          </div>
        </div>
      </main>
    </div>
  );
}
