import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ArchitecturalIssueReport {
  id: string;
  checklist_item_id: string;
  analysis_session_id: string;
  plan_sheet_name: string;
  issue_description: string;
  location_in_sheet: string;
  issue_type: "Missing" | "Non-compliant" | "Inconsistent" | "Zoning" | "Landscape";
  compliance_source: string;
  specific_code_identifier: string;
  short_code_requirement: string;
  long_code_requirement: string;
  source_link: string;
  confidence_level: "High" | "Medium" | "Low";
  confidence_rationale: string;
  created_at: string;
}

interface AnalysisResultsProps {
  issues: ArchitecturalIssueReport[];
}

export const AnalysisResults = ({ issues }: AnalysisResultsProps) => {
  if (issues.length === 0) {
    return null;
  }

  const getIssueTypeColor = (type: string) => {
    switch (type) {
      case 'Missing':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Non-compliant':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Inconsistent':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Zoning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Landscape':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Analysis Results</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Found {issues.length} compliance issues in the uploaded plans
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="font-medium text-xs">Plan<br/>Sheet</TableHead>
                <TableHead className="font-medium text-xs">Issue<br/>Description</TableHead>
                <TableHead className="font-medium text-xs">Location</TableHead>
                <TableHead className="font-medium text-xs">Issue Type</TableHead>
                <TableHead className="font-medium text-xs">Compliance<br/>Source</TableHead>
                <TableHead className="font-medium text-xs">Code<br/>Reference</TableHead>
                <TableHead className="font-medium text-xs min-w-[200px]">Short Requirement</TableHead>
                <TableHead className="font-medium text-xs min-w-[250px]">Long Requirement</TableHead>
                <TableHead className="font-medium text-xs">Source Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue, index) => (
                <TableRow key={index} className="border-b hover:bg-muted/50">
                  <TableCell className="font-medium text-sm align-top py-4">
                    {issue.plan_sheet_name}
                  </TableCell>
                  <TableCell className="text-sm align-top py-4">
                    {issue.issue_description}
                  </TableCell>
                  <TableCell className="text-sm align-top py-4">
                    {issue.location_in_sheet}
                  </TableCell>
                  <TableCell className="align-top py-4">
                    <span className={`inline-block px-3 py-1 rounded-md text-xs font-medium border ${getIssueTypeColor(issue.issue_type)}`}>
                      {issue.issue_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm align-top py-4">
                    {issue.compliance_source}
                  </TableCell>
                  <TableCell className="font-mono text-xs align-top py-4">
                    {issue.specific_code_identifier}
                  </TableCell>
                  <TableCell className="text-sm align-top py-4">
                    <span className="text-blue-600" title={issue.short_code_requirement}>
                      {issue.short_code_requirement}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm align-top py-4">
                    {issue.long_code_requirement}
                  </TableCell>
                  <TableCell className="text-sm align-top py-4">
                    {issue.source_link ? (
                      <a 
                        href={issue.source_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View Source
                      </a>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};