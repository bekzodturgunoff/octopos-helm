import {Link, LinkProps} from "@tanstack/react-router";
import {Button} from "@yeahuz/kdsx-react";
import {ChevronLeft, ChevronRight} from "lucide-react";

type Props = {
  page: number;
  pages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  from: LinkProps["from"];
};

function getPageRange(current: number, total: number): (number | "...")[] {
  if (total < 7) return [...Array(total).keys()].map((i) => i + 1);

  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];

  return [1, "...", current - 1, current, current + 1, "...", total];
}

export function Pagination({page, pages, hasNext, hasPrevious, from}: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Button size="lg" icon={true} color="neutral" variant="fill" asChild disabled={!hasPrevious}>
        <Link from={from} search={(prev) => ({...prev, page: page - 1})}>
          <ChevronLeft size={16} />
        </Link>
      </Button>

      {getPageRange(page, pages).map((p, i) =>
        p === "..." ? (
          <span key={`gap-${i}`} className="text-on-surface-secondary px-1">
            …
          </span>
        ) : (
          <Button size="lg" icon key={p} color={p === page ? "brand" : "neutral"} asChild>
            <Link from={from} search={(prev) => ({...prev, page: p})}>
              {p}
            </Link>
          </Button>
        ),
      )}
      <Button size="lg" icon={true} color="neutral" variant="fill" asChild disabled={!hasNext}>
        <Link from={from} search={(prev) => ({...prev, page: page + 1})}>
          <ChevronRight size={16} />
        </Link>
      </Button>
    </div>
  );
}
