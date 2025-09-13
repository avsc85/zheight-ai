import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ArchitecturalIssueReport {
  id: string;
  checklist_item_id: string;
  analysis_session_id: string;
  plan_sheet_name: string;
  issue_description: string;
  location_in_sheet: string;
  issue_type: "Missing" | "Non-compliant" | "Inconsistent";
  compliance_source: "California Code" | "Local";
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Analysis Results</CardTitle>
        <CardDescription>
          Found {issues.length} compliance issues in the uploaded plans
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan Sheet</TableHead>
              <TableHead>Issue Description</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Issue Type</TableHead>
              <TableHead>Compliance Source</TableHead>
              <TableHead>Code Reference</TableHead>
              <TableHead>Short Requirement</TableHead>
              <TableHead>Long Requirement</TableHead>
              <TableHead>Source Link</TableHead>
              <TableHead>Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{issue.plan_sheet_name}</TableCell>
                <TableCell>{issue.issue_description}</TableCell>
                <TableCell>{issue.location_in_sheet}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    issue.issue_type === 'Missing' ? 'bg-red-100 text-red-800' :
                    issue.issue_type === 'Non-compliant' ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {issue.issue_type}
                  </span>
                </TableCell>
                <TableCell>{issue.compliance_source}</TableCell>
                <TableCell className="font-mono text-sm">{issue.specific_code_identifier}</TableCell>
                <TableCell className="max-w-xs truncate" title={issue.short_code_requirement}>
                  {issue.short_code_requirement}
                </TableCell>
                <TableCell className="max-w-sm truncate" title={issue.long_code_requirement}>
                  {issue.long_code_requirement}
                </TableCell>
                <TableCell>
                  {issue.source_link && (
                    <a 
                      href={issue.source_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      View Code
                    </a>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    issue.confidence_level === 'High' ? 'bg-green-100 text-green-800' :
                    issue.confidence_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {issue.confidence_level}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};