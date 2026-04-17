import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusValue =
  | "PAID"
  | "APPROVED"
  | "SOLVENT"
  | "PENDING"
  | "PARTIAL"
  | "OVERDUE"
  | "REJECTED"
  | "CANCELLED"
  | "UNPAID"

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusValue | string
  label?: string
}

const STATUS_CONFIG: Record<StatusValue, { label: string; className: string }> = {
  PAID: {
    label: "Pagado",
    className: "bg-chart-1/20 text-chart-1 border-chart-1/40 hover:bg-chart-1/30",
  },
  APPROVED: {
    label: "Aprobado",
    className: "bg-chart-1/20 text-chart-1 border-chart-1/40 hover:bg-chart-1/30",
  },
  SOLVENT: {
    label: "Solvente",
    className: "bg-chart-1/20 text-chart-1 border-chart-1/40 hover:bg-chart-1/30",
  },
  PENDING: {
    label: "Pendiente",
    className: "bg-chart-2/20 text-chart-2 border-chart-2/40 hover:bg-chart-2/30",
  },
  PARTIAL: {
    label: "Parcial",
    className: "bg-chart-2/20 text-chart-2 border-chart-2/40 hover:bg-chart-2/30",
  },
  OVERDUE: {
    label: "Vencido",
    className: "bg-destructive/20 text-destructive border-destructive/40 hover:bg-destructive/30",
  },
  REJECTED: {
    label: "Rechazado",
    className: "bg-destructive/20 text-destructive border-destructive/40 hover:bg-destructive/30",
  },
  CANCELLED: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground border-border/50 hover:bg-muted/80",
  },
  UNPAID: {
    label: "Impago",
    className: "bg-destructive/20 text-destructive border-destructive/40 hover:bg-destructive/30",
  },
}

const FALLBACK = {
  label: "—",
  className: "bg-muted text-muted-foreground border-border/50",
}

export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const key = String(status).toUpperCase() as StatusValue
  const config = STATUS_CONFIG[key] ?? FALLBACK

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold uppercase tracking-wider text-[10px] transition-colors",
        config.className,
        className
      )}
      {...props}
    >
      {label ?? config.label}
    </Badge>
  )
}
