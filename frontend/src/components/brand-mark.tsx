import { cn } from "@/lib/utils";

type BrandMarkProps = {
  inverse?: boolean;
  compact?: boolean;
  className?: string;
};

export function BrandMark({ inverse = false, compact = false, className }: BrandMarkProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="π Bank"
    >
      <span
        className={cn(
          "font-serif text-[46px] font-black leading-none tracking-[-0.08em]",
          inverse ? "text-white" : "text-bank-blue",
          compact && "text-[38px]",
        )}
        aria-hidden="true"
      >
        π
      </span>
      <span
        className={cn(
          "text-[23px] font-bold tracking-[-0.025em]",
          inverse ? "text-white" : "text-bank-navy",
          compact && "text-xl",
        )}
      >
        Bank
      </span>
    </div>
  );
}
