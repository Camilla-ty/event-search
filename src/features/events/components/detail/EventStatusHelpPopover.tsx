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
      {STATUS_HELP_ITEMS.map((item) => (
        <div key={item.label}>
          <p className="font-medium text-slate-800">{item.label}</p>
          <p>{item.description}</p>
        </div>
      ))}
    </InfoHelpPopover>
  );
}
