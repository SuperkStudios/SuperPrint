import { cn } from "@/lib/utils";

export function BrandLogo({ className, markOnly = false }: { className?: string; markOnly?: boolean }) {
  if (markOnly) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <img
          src="/brand/superprint-mark-light-64.png"
          alt="SuperPrint"
          className="size-9 object-contain dark:hidden"
        />
        <img
          src="/brand/superprint-mark-64.png"
          alt=""
          aria-hidden="true"
          className="hidden size-9 object-contain dark:block"
        />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <img
        src="/brand/superprint-full-lockup-light.png"
        alt="SuperPrint"
        className="h-12 w-auto max-w-[210px] object-contain dark:hidden sm:h-14 sm:max-w-[260px]"
      />
      <img
        src="/brand/superprint-full-lockup-transparent.png"
        alt=""
        aria-hidden="true"
        className="hidden h-12 w-auto max-w-[210px] object-contain dark:block sm:h-14 sm:max-w-[260px]"
      />
    </span>
  );
}
