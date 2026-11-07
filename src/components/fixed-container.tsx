import {Link} from "@tanstack/react-router";
import {Button} from "@yeahuz/kdsx-react";
import {X} from "lucide-react";

export function FixedContainer({children}: {children: React.ReactNode}) {
  return (
    <div className="bg-surface fixed top-0 flex h-full w-full flex-col px-4">
      <div className="border-b-border-secondary border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between py-6">
          <Link to="/" className="text-primary-dim flex-1 shrink-0 text-2xl font-semibold tracking-tighter">
            Octopos <span className="text-on-surface-secondary font-normal">Helm</span>
          </Link>
          <Button size="lg" icon={true} color="neutral" className="ml-auto shrink-0" asChild>
            <Link to="/">
              <X size={20} />
            </Link>
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
