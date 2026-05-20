import { cn } from "@/lib/utils";

export function BrandLogo({ className, markOnly = false }: { className?: string; markOnly?: boolean }) {
  if (markOnly) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <img
          src="/brand/superprint-mark-64.png"
          alt="SuperPrint"
          className="size-9 object-contain"
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <img
        src="/brand/superprint-full-lockup-transparent.png"
        alt="SuperPrint"
        className="h-12 w-auto max-w-[210px] object-contain sm:h-14 sm:max-w-[260px]"
      />
    </span>
  );
}
