import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface AgentCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  status: "active" | "processing" | "idle";
  children?: ReactNode;
  onAction?: () => void;
  actionLabel?: string;
}

export const AgentCard = ({ 
  title, 
  description, 
  icon: Icon, 
  status, 
  children, 
  onAction, 
  actionLabel = "Start Process" 
}: AgentCardProps) => {
  const statusConfig = {
    active: { label: "Active", className: "bg-accent text-accent-foreground" },
    processing: { label: "Processing", className: "bg-primary text-primary-foreground" },
    idle: { label: "Idle", className: "bg-muted text-muted-foreground" }
  };

  return (
    <Card className="p-6 shadow-soft hover:shadow-primary transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-primary">
            <Icon className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        <Badge className={statusConfig[status].className}>
          {statusConfig[status].label}
        </Badge>
      </div>
      
      {children && (
        <div className="mb-4">
          {children}
        </div>
      )}
      
      {onAction && (
        <Button 
          onClick={onAction}
          variant="gradient"
          className="w-full"
        >
          {actionLabel}
        </Button>
      )}
    </Card>
  );
};