export type HelpSection = {
  title: string;
  body: string;
};

export const quickStartSteps = [
  "Add a display name so other singers know who you are.",
  "Add songs you know, including voicing, parts, and confidence.",
  "Start a quartet or join one with a code, QR code, or shared link.",
  "Use the match list to pick something everyone can sing right now.",
] as const;

export const helpSections: HelpSection[] = [
  {
    title: "What Can We Sing?",
    body: "This app helps a pickup quartet answer one question: what can we sing together right now?",
  },
  {
    title: "Add Your Repertoire",
    body: "Add each song you know, choose the voicing, and mark the parts you can sing. You can edit songs later.",
  },
  {
    title: "Start A Quartet",
    body: "Start creates a quartet code. Other singers can join with the code, QR code, or link.",
  },
  {
    title: "Join A Quartet",
    body: "Join with a code from another singer. Your saved repertoire is loaded into that quartet for matching.",
  },
  {
    title: "Reading Matches",
    body: "A match appears when different singers cover the required parts for the same song and voicing.",
  },
  {
    title: "Possible Matches",
    body: "Possible matches may mean song titles are slightly different or arrangement details are missing. Check with the quartet before singing.",
  },
  {
    title: "Update Your Songs Or Name",
    body: "Use Repertoire to change songs and Profile to change your display name. Repertoire edits refresh your active quartet snapshot.",
  },
  {
    title: "Leaving Or Being Removed",
    body: "Leaving removes you from the active quartet. If another singer removes you, you can join again with the code if that is what the group wants.",
  },
];
