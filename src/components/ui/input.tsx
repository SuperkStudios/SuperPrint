import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none file:border-0 file:bg-transparent file:text-sm focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
