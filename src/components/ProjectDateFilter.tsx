import { useState } from "react";
import { format, startOfDay, startOfWeek, startOfYear, endOfDay, isWithinInterval } from "date-fns";
import { Filter, X, CalendarIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export type DateFilterOption = "all" | "today" | "this_week" | "this_year" | "year_2025" | "custom";

export interface ProjectDateFilters {
  option: DateFilterOption;
  customStartDate?: Date;
  customEndDate?: Date;
}

export const defaultProjectDateFilters: ProjectDateFilters = {
  option: "all",
};

interface ProjectDateFilterProps {
  filters: ProjectDateFilters;
  onFiltersChange: (filters: ProjectDateFilters) => void;
}

const filterOptions: { value: DateFilterOption; label: string }[] = [
  { value: "all", label: "All Projects" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_year", label: "This Year" },
  { value: "year_2025", label: "Year 2025" },
  { value: "custom", label: "Custom Range" },
];

export function ProjectDateFilter({ filters, onFiltersChange }: ProjectDateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempCustomStart, setTempCustomStart] = useState<Date | undefined>(filters.customStartDate);
  const [tempCustomEnd, setTempCustomEnd] = useState<Date | undefined>(filters.customEndDate);

  const handleOptionSelect = (option: DateFilterOption) => {
    if (option === "custom") {
      onFiltersChange({
        option,
        customStartDate: tempCustomStart,
        customEndDate: tempCustomEnd,
      });
    } else {
      onFiltersChange({ option });
      setIsOpen(false);
    }
  };

  const handleApplyCustomRange = () => {
    onFiltersChange({
      option: "custom",
      customStartDate: tempCustomStart,
      customEndDate: tempCustomEnd,
    });
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    onFiltersChange(defaultProjectDateFilters);
    setTempCustomStart(undefined);
    setTempCustomEnd(undefined);
    setIsOpen(false);
  };

  const getActiveFilterLabel = () => {
    if (filters.option === "all") return null;
    if (filters.option === "custom" && filters.customStartDate && filters.customEndDate) {
      return `${format(filters.customStartDate, "MMM d")} - ${format(filters.customEndDate, "MMM d, yyyy")}`;
    }
    return filterOptions.find(o => o.value === filters.option)?.label;
  };

  const activeLabel = getActiveFilterLabel();
  const hasActiveFilter = filters.option !== "all";

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasActiveFilter ? "default" : "outline"}
            size="sm"
            className={cn(
              "gap-2",
              hasActiveFilter && "bg-primary text-primary-foreground"
            )}
          >
            <Filter className="h-4 w-4" />
            Filter by Date
            {hasActiveFilter && (
              <Badge variant="secondary" className="ml-1 bg-primary-foreground/20 text-primary-foreground">
                1
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Filter by Creation Date</h4>
              {hasActiveFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={handleClearFilters}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="p-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                  filters.option === option.value
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted"
                )}
                onClick={() => handleOptionSelect(option.value)}
              >
                <span>{option.label}</span>
                {filters.option === option.value && option.value !== "custom" && (
                  <Check className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>

          {/* Custom Date Range Section */}
          {filters.option === "custom" && (
            <div className="p-4 border-t space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempCustomStart && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempCustomStart ? format(tempCustomStart, "PPP") : "Select start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempCustomStart}
                      onSelect={setTempCustomStart}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempCustomEnd && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempCustomEnd ? format(tempCustomEnd, "PPP") : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempCustomEnd}
                      onSelect={setTempCustomEnd}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                className="w-full"
                onClick={handleApplyCustomRange}
                disabled={!tempCustomStart || !tempCustomEnd}
              >
                Apply Custom Range
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Show active filter as a badge that can be cleared */}
      {activeLabel && (
        <Badge
          variant="secondary"
          className="gap-1 pl-2 pr-1 py-1 cursor-pointer hover:bg-secondary/80"
          onClick={handleClearFilters}
        >
          {activeLabel}
          <X className="h-3 w-3 ml-1" />
        </Badge>
      )}
    </div>
  );
}

// Helper function to apply date filters to projects
export function applyProjectDateFilters<T extends { created_at?: string; start_date?: string }>(
  projects: T[],
  filters: ProjectDateFilters
): T[] {
  if (filters.option === "all") return projects;

  const now = new Date();
  const today = startOfDay(now);

  return projects.filter((project) => {
    // Use created_at if available, otherwise fall back to start_date
    const dateStr = project.created_at || project.start_date;
    if (!dateStr) return true; // Include projects without dates

    const projectDate = new Date(dateStr);

    switch (filters.option) {
      case "today":
        return startOfDay(projectDate).getTime() === today.getTime();

      case "this_week":
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        return projectDate >= weekStart && projectDate <= now;

      case "this_year":
        const yearStart = startOfYear(now);
        return projectDate >= yearStart && projectDate <= now;

      case "year_2025":
        const year2025Start = new Date(2025, 0, 1);
        const year2025End = new Date(2025, 11, 31, 23, 59, 59);
        return projectDate >= year2025Start && projectDate <= year2025End;

      case "custom":
        if (filters.customStartDate && filters.customEndDate) {
          return isWithinInterval(projectDate, {
            start: startOfDay(filters.customStartDate),
            end: endOfDay(filters.customEndDate),
          });
        }
        return true;

      default:
        return true;
    }
  });
}
