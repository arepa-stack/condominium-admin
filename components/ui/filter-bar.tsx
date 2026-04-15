import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function FilterBar({ children, className, ...props }: FilterBarProps) {
  return (
    <Card
      className={cn(
        "p-4 border-border/50 bg-card/50 backdrop-blur-xl",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </Card>
  )
}
