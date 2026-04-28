export type HelpSection = {
  title: string;
  body: string[];
};

export const quickStartSteps = [
  "Add your display name. This is the name other singers will see in the quartet.",
  "Add your repertoire. Add the songs you know, choose the voicing, select the parts you can sing, and set your confidence.",
  "Start or join a quartet. One singer can start a quartet and share the code, QR code, or link. Other singers can join from their phones.",
  "Pick a match and sing. Use the match list to find songs the quartet can sing together right now.",
] as const;

export const helpSections: HelpSection[] = [
  {
    title: "What Is This App For?",
    body: [
      "This app is built for informal barbershop singing: rehearsals, afterglows, conventions, hospitality rooms, and any other time a pickup quartet wants to find something to sing.",
      "It is not trying to be a perfect music library. It is meant to be fast, forgiving, and useful in the moment.",
    ],
  },
  {
    title: "Add Your Repertoire",
    body: [
      "Use Repertoire to add songs you know. For each song, choose the voicing, select the part or parts you can sing, and set your confidence.",
      "You can edit your repertoire later. If you are already in an active quartet, your updated repertoire can refresh your quartet snapshot so the match list stays current.",
    ],
  },
  {
    title: "Start A Quartet",
    body: [
      "Use Start when you want to create a new quartet. The app will create a quartet code that other singers can use to join.",
      "Other singers can join by entering the code, scanning the QR code, or opening the shared link.",
    ],
  },
  {
    title: "Join A Quartet",
    body: [
      "Use Join when another singer has already started a quartet. Enter the code they give you, or use the QR code or shared link.",
      "When you join, your saved repertoire is loaded into that quartet so the app can look for matches.",
    ],
  },
  {
    title: "Reading The Match List",
    body: [
      "A match appears when the quartet has different singers covering the required parts for the same song and voicing.",
      "For example, a TTBB song needs Tenor, Lead, Baritone, and Bass covered by four distinct singers. One singer may know multiple parts, but a valid quartet match only uses each singer once.",
    ],
  },
  {
    title: "Possible Matches",
    body: [
      "Sometimes the app may show a possible match instead of a clean match. This can happen when song titles are slightly different, arranger information is missing, or the same song may exist in more than one arrangement.",
      "Use the match details to compare what each singer has entered. If the titles or arrangement details do not match, check with the quartet before singing.",
    ],
  },
  {
    title: "Update Your Songs Or Name",
    body: [
      "Use Repertoire to add, edit, or delete songs. Use Change my display name or Profile to update the name other singers see.",
      "If something looks wrong in a match, the first thing to check is usually whether the song title, voicing, part, or arranger is entered consistently in everyone's repertoire.",
    ],
  },
  {
    title: "Leaving Or Being Removed",
    body: [
      "Use Leave quartet when you want to remove yourself from the active quartet.",
      "If another singer removes you from a quartet, you will be returned to the join flow. You can rejoin with the code if that is what the group wants and there is still room.",
    ],
  },
  {
    title: "Feedback And Problems",
    body: [
      "If something is confusing, broken, or missing, please send feedback from this page.",
      "A short note about what you were trying to do and what happened is usually enough.",
    ],
  },
];
