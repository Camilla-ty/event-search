import { InfoHelpPopover } from "@/src/components/common/InfoHelpPopover";

const STATUS_HELP_ITEMS = [
  {
    label: "Active",
    description: "The event brand is current and ongoing.",
  },
  {
    label: "Discontinued",
    description: "The event brand no longer runs.",
  },
  {
    label: "Merged",
    description: "The event brand has been incorporated into another event brand.",
  },
] as const;

export function EventStatusHelpPopover() {
  return (
    <InfoHelpPopover ariaLabel="About Event Status" title="About Event Status">
      <div className="space-y-3.5">
        {STATUS_HELP_ITEMS.map((item) => (
          <div key={item.label}>
            <p className="text-sm font-semibold text-slate-700">{item.label}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
          </div>
        ))}
      </div>
    </InfoHelpPopover>
  );
}
