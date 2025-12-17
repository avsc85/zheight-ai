import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Monday.com inspired status variants
        done:
          "border-transparent bg-status-done text-white",
        started:
          "border-transparent bg-status-started text-white",
        queue:
          "border-transparent bg-status-queue text-white",
        ready:
          "border-transparent bg-status-ready text-white",
        blocked:
          "border-transparent bg-status-blocked text-white",
        // Softer status variants
        "done-soft":
          "border-status-done/30 bg-status-done/10 text-status-done",
        "started-soft":
          "border-status-started/30 bg-status-started/10 text-status-started",
        "queue-soft":
          "border-status-queue/30 bg-status-queue/10 text-status-queue",
        "ready-soft":
          "border-status-ready/30 bg-status-ready/10 text-status-ready",
        "blocked-soft":
          "border-status-blocked/30 bg-status-blocked/10 text-status-blocked",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
