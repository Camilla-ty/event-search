import {
  sponsorNoteDisplayMessage,
  type SponsorNoteType,
} from "@/src/features/events/lib/sponsorNoteType";

type EditionSponsorNoteProps = {
  sponsorNoteType: SponsorNoteType;
};

export function EditionSponsorNote({ sponsorNoteType }: EditionSponsorNoteProps) {
  return (
    <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
      {sponsorNoteDisplayMessage(sponsorNoteType)}
    </p>
  );
}
