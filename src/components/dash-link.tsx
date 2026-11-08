import {useTranslation} from "react-i18next";
import {ExternalLink} from "lucide-react";
import {CopyButton} from "@/components/remote-access";
import {dashUrl} from "@/lib/dash";

/** The client's own dash: the address, a copy button, and a link that opens it. */
export function DashLink({slug, className}: {slug: string; className?: string}) {
  let {t} = useTranslation();
  let url = dashUrl(slug);
  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-1 ${className ?? ""}`}>
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 font-mono break-all underline-offset-2 hover:underline">
        {url.replace("https://", "")}
        <ExternalLink size={14} className="shrink-0" />
      </a>
      <CopyButton value={url} label={t("clients:copyLink", {defaultValue: "Copy link"})} />
    </span>
  );
}
