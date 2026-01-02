import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, XCircle, Download, ExternalLink } from "lucide-react";

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

interface ArchitecturalIssueReportsProps {
  issues: ArchitecturalIssueReport[];
  analysisSessionId?: string;
}

export const ArchitecturalIssueReports = ({ issues, analysisSessionId }: ArchitecturalIssueReportsProps) => {
  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-accent mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Issues Found</h3>
          <p className="text-muted-foreground">
            The architectural plans appear to be compliant with all checklist requirements.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getIssueTypeConfig = (issueType: string) => {
    switch (issueType) {
      case "Missing":
        return {
          icon: XCircle,
          color: "text-destructive",
          badge: "destructive"
        };
      case "Non-compliant":
        return {
          icon: AlertTriangle,
          color: "text-yellow-600",
          badge: "secondary"
        };
      case "Inconsistent":
        return {
          icon: AlertTriangle,
          color: "text-blue-600",
          badge: "outline"
        };
      default:
        return {
          icon: AlertTriangle,
          color: "text-muted-foreground",
          badge: "outline"
        };
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "High":
        return "text-accent";
      case "Medium":
        return "text-yellow-600";
      case "Low":
        return "text-muted-foreground";
      default:
        return "text-muted-foreground";
    }
  };

  const stats = {
    total: issues.length,
    missing: issues.filter(i => i.issue_type === "Missing").length,
    nonCompliant: issues.filter(i => i.issue_type === "Non-compliant").length,
    inconsistent: issues.filter(i => i.issue_type === "Inconsistent").length,
    highConfidence: issues.filter(i => i.confidence_level === "High").length,
  };

  const handleExportReport = () => {
    const csvContent = [
      // CSV headers
      [
        "Sheet Name",
        "Issue Type", 
        "Issue Description",
        "Location",
        "Code Source",
        "Code Identifier",
        "Requirement",
        "Confidence",
        "Confidence Rationale"
      ].join(","),
      // CSV data
      ...issues.map(issue => [
        `"${issue.plan_sheet_name}"`,
        `"${issue.issue_type}"`,
        `"${issue.issue_description}"`,
        `"${issue.location_in_sheet}"`,
        `"${issue.compliance_source}"`,
        `"${issue.specific_code_identifier}"`,
        `"${issue.short_code_requirement}"`,
        `"${issue.confidence_level}"`,
        `"${issue.confidence_rationale}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `architectural-issues-${analysisSessionId || Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Architectural Issue Report</CardTitle>
              <p className="text-muted-foreground text-sm mt-1">
                Analysis complete - {stats.total} compliance issues identified
              </p>
            </div>
            <Button onClick={handleExportReport} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Issues</p>
            </div>
            <div className="text-center p-3 bg-destructive/10 rounded-lg">
              <p className="text-2xl font-bold text-destructive">{stats.missing}</p>
              <p className="text-sm text-muted-foreground">Missing</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{stats.nonCompliant}</p>
              <p className="text-sm text-muted-foreground">Non-compliant</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.inconsistent}</p>
              <p className="text-sm text-muted-foreground">Inconsistent</p>
            </div>
            <div className="text-center p-3 bg-accent/10 rounded-lg">
              <p className="text-2xl font-bold text-accent">{stats.highConfidence}</p>
              <p className="text-sm text-muted-foreground">High Confidence</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Detailed Issues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sheet & Location</TableHead>
                  <TableHead>Issue Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Code Reference</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => {
                  const config = getIssueTypeConfig(issue.issue_type);
                  const Icon = config.icon;
                  
                  return (
                    <TableRow key={issue.id}>
                      <TableCell className="min-w-[200px]">
                        <div>
                          <p className="font-medium text-foreground">{issue.plan_sheet_name}</p>
                          <p className="text-sm text-muted-foreground">{issue.location_in_sheet}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          <Badge variant={config.badge as any}>{issue.issue_type}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[300px]">
                        <div>
                          <p className="text-foreground">{issue.issue_description}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            <strong>Requirement:</strong> {issue.short_code_requirement}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {issue.specific_code_identifier}
                          </code>
                          <Badge variant="outline" className="text-xs">
                            {issue.compliance_source}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className={`font-medium ${getConfidenceColor(issue.confidence_level)}`}>
                            {issue.confidence_level}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1" title={issue.confidence_rationale}>
                            {issue.confidence_rationale.length > 50 
                              ? `${issue.confidence_rationale.substring(0, 50)}...`
                              : issue.confidence_rationale
                            }
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {issue.source_link && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(issue.source_link, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};