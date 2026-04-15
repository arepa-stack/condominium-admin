import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon
  title?: string
  message: string
  action?: React.ReactNode
  variant?: "card" | "inline"
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  variant = "card",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "card"
          ? "py-16 px-6 rounded-2xl border-2 border-dashed border-border/50 bg-card/30"
          : "py-10 px-4",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-primary/10 p-4">
          <Icon className="h-8 w-8 text-primary/70" />
        </div>
      )}
      {title && (
        <h3 className="text-base font-semibold text-foreground font-display tracking-tight mb-1">
          {title}
        </h3>
      )}
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
