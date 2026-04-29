export type HelpSection = {
  title: string;
  body: string[];
};

export type HelpTopic = {
  title: string;
  body: string[];
  bullets?: string[];
};

export type HelpGuideSection = {
  eyebrow: string;
  title: string;
  intro: string;
  topics: HelpTopic[];
};

export const quickStartSteps = [
  "Add your display name so other singers know who is in the quartet.",
  "Add a few songs you are likely to sing. You do not need to enter your entire repertoire before starting.",
  "For each song, choose the voicing and every part you can sing for that arrangement.",
  "Start a quartet or join someone else with a code, QR code, or shared link.",
  "Use Matches to pick something everyone can sing right now.",
] as const;

export const helpGuideSections: HelpGuideSection[] = [
  {
    eyebrow: "First Time Setup",
    title: "Get Singing Quickly",
    intro:
      "If you are using the app for the first time, you do not need to enter your entire repertoire. Add a few songs you are likely to sing, join a quartet, and add more as you go.",
    topics: [
      {
        title: "The basic flow",
        body: [
          "What Can We Sing is built for informal barbershop singing: rehearsals, afterglows, conventions, hospitality rooms, and any time a pickup quartet wants to find something to sing.",
          "Set your display name, add songs you know, then start or join a quartet. The match list answers the practical question: what can we sing together right now?",
        ],
        bullets: [...quickStartSteps],
      },
      {
        title: "Don't overthink entering all of your songs",
        body: [
          "Start with songs you are likely to sing soon. You can add more repertoire later, and if you are already in a quartet, repertoire edits refresh your active quartet snapshot so matches can update.",
        ],
      },
    ],
  },
  {
    eyebrow: "Repertoire",
    title: "Manage The Songs You Know",
    intro:
      "The Repertoire page stores your songs, voicings, parts, confidence, arranger information, notes, and recently sung history.",
    topics: [
      {
        title: "Song Title Autocomplete",
        body: [
          "Start typing to see suggestions. Suggestions are optional — you can always enter your own song title if the song is not listed or if your title is different.",
          "Selecting a suggestion can prefill title, voicing, and arranger. You can still edit the fields before saving.",
        ],
      },
      {
        title: "How Suggestions Are Shared",
        body: [
          "When you add a song, the title, voicing, and arranger you enter can help future singers find the same song faster. Adding a song does not add it to anyone else’s repertoire.",
          "Suggestions do not expose private user details such as user IDs, singer names, notes, parts, confidence, timestamps, or your full personal repertoire.",
        ],
      },
      {
        title: "Voicing",
        body: [
          "Choose the voicing for the arrangement you know. TTBB means Tenor, Lead, Baritone, Bass. SSAA means Soprano 1, Soprano 2, Alto 1, Alto 2. SATB means Soprano, Alto, Tenor, Bass.",
          "If you know the same song in more than one voicing, add it more than once — one entry for each voicing.",
        ],
      },
      {
        title: "Parts and Confidence",
        body: [
          "Select every part you can sing for that arrangement and set your confidence for each part.",
          "A singer may know multiple parts, but in a quartet match each singer can only cover one required part. The app looks for distinct singers covering the required parts.",
        ],
      },
      {
        title: "Arranger",
        body: [
          "Arranger is helpful when the same song exists in multiple arrangements. It gives the quartet context, but missing arranger information does not automatically prevent a match.",
          "Leaving arranger blank simply means no arranger entered or you don't know the arranger. Typing \"Unknown\" is treated as an entered value and stays visible as Unknown.",
        ],
      },
      {
        title: "Notes",
        body: [
          "Notes are for your own memory — for example, version reminders, tags, first words, key, or tricky spots. They help you manage your repertoire but are not used to decide whether the quartet can sing a song.",
        ],
      },
      {
        title: "Recently Sung",
        body: [
          "Recently sung helps you remember what you have sung lately. It can help you sort or filter your repertoire, but it does not remove the song from your repertoire or from possible matches.",
        ],
      },
      {
        title: "Sorting and Filtering",
        body: [
          "Use search to filter by title. You can sort by title, newest or oldest added, sung recently, or least recently sung.",
          "You can filter by voicing, part, and Never Sung. Active filters appear above the song list and can be cleared together.",
        ],
      },
    ],
  },
  {
    eyebrow: "Quartet Matches",
    title: "Understand What Your Pick-Up Quartet Can Sing",
    intro:
      "The quartet page compares the current participant snapshots and groups matches by how ready they are to sing.",
    topics: [
      {
        title: "Ready to Sing",
        body: [
          "Ready to Sing matches are the cleanest matches. All required parts are covered, and the app assigns distinct singers to distinct required parts.",
          "For example, TTBB needs Tenor, Lead, Baritone, and Bass covered by four different singers.",
        ],
      },
      {
        title: "Possible Matches",
        body: [
          "Possible matches are not necessarily bad. They may involve slightly different titles, missing arranger information, or possible arrangement differences.",
          "The quartet should quickly confirm the details before singing.",
        ],
      },
      {
        title: "What Matters Most",
        body: [
          "The strongest signals are voicing, required part coverage, and distinct singers for the required parts. Different voicings are not combined.",
          "Title variants, arranger differences, missing arranger information, confidence, and notes are context to help the quartet decide quickly. They are not all automatic blockers.",
        ],
      },
      {
        title: "Match Details",
        body: [
          "Open a match to see who is covering which part, what is missing if anything, which title variants are involved, and which arranger values singers entered.",
          "Personal notes can appear in details to remind you about your own version or caveats.",
        ],
      },
      {
        title: "Managing The Quartet",
        body: [
          "When the quartet is full, use Manage to see quartet members, edit repertoire, change your name, or leave the quartet.",
          "If a song title, voicing, part, arranger, notes, or confidence looks wrong, update it from Repertoire. If the name shown to others is wrong, use Change name.",
        ],
      },
      {
        title: "Leaving and Rejoining",
        body: [
          "Leaving removes you from the active quartet. If there is room and you still have the code or link, you can rejoin normally.",
          "If another singer removes you, your screen should stop treating that quartet as active.",
        ],
      },
    ],
  },
];

export const feedbackHelpCopy =
  "Report a bug, describe confusing behavior, or suggest an improvement. A short note about what you were trying to do and what happened is usually enough.";

export const helpSections: HelpSection[] = helpGuideSections.map((section) => ({
  title: section.title,
  body: [
    section.intro,
    ...section.topics.flatMap((topic) => [
      topic.title,
      ...topic.body,
      ...(topic.bullets ?? []),
    ]),
  ],
}));
