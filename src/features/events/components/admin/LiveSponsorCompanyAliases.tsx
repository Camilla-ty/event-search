type LiveSponsorCompanyAliasesProps = {
  aliases: readonly string[];
};

export function LiveSponsorCompanyAliases({ aliases }: LiveSponsorCompanyAliasesProps) {
  if (aliases.length === 0) {
    return null;
  }

  const label = aliases.length === 1 ? "Alias" : "Aliases";

  return (
    <p className="text-xs text-slate-500">
      {label}: {aliases.join(", ")}
    </p>
  );
}
