import {useState} from "react";
import {Button} from "@yeahuz/kdsx-react";
import {Download} from "lucide-react";
import {useTranslation} from "react-i18next";
import {useToast} from "@/components/toaster";
import {downloadCsv, type Column} from "@/lib/csv";

/**
 * Exports what the list shows, every page of it: the rows are fetched fresh with the same filters,
 * so the file matches the screen rather than the one page that happens to be loaded.
 */
export function ExportButton<T>({name, load, columns}: {name: string; load: () => Promise<T[]>; columns: Column<T>[]}) {
  let {t} = useTranslation();
  let toast = useToast();
  let [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      color="neutral"
      variant="outline"
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          let rows = await load();
          downloadCsv(name, rows, columns);
          toast({tone: "success", title: t("common:exported", {defaultValue: "Exported {{count}} rows", count: rows.length})});
        } catch (err) {
          toast({tone: "error", title: err instanceof Error ? err.message : String(err)});
        } finally {
          setPending(false);
        }
      }}
    >
      <Download size={14} className="mr-1" />
      {t("common:exportCsv", {defaultValue: "Export CSV"})}
    </Button>
  );
}
