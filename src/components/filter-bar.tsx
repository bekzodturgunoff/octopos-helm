import {Select} from "@yeahuz/kdsx-react";

export type FilterOption = {value: string; label: string};

/**
 * A row of selects bound to search params. Filters live in the URL, as the dash keeps them, so a
 * filtered list can be pasted into a chat and opens the same for the next person.
 */
export function FilterSelect({label, value, options, onChange}: {label: string; value: string | undefined; options: FilterOption[]; onChange: (value: string | undefined) => void}) {
  return (
    <Select aria-label={label} size="sm" className="w-auto min-w-36" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
