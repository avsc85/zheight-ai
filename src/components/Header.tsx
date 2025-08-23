import { Building2, Bot } from "lucide-react";

export const Header = () => {
  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-primary">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">CodeCheck AI</h1>
              <p className="text-sm text-muted-foreground">Building Code Compliance Automation</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="w-4 h-4" />
            <span>2 AI Agents Active</span>
          </div>
        </div>
      </div>
    </header>
  );
};