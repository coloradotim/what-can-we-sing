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
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  topics: HelpTopic[];
};

export type HelpNavItem = {
  id: string;
  label: string;
};

export type HelpAcknowledgment = {
  name: string;
  contribution: string;
};

export const quickStartSteps = [
  "Add your display name so other singers know who is in the quartet.",
  "Add a few songs you are likely to sing. You can type songs in, copy songs from another singer, or add Harmony Brigade songs.",
  "For each song, choose the arrangement voicing and every barbershop part you can sing for that arrangement.",
  "Start a quartet or join someone else with a code, QR code, or shared link.",
  "Use Matches to pick something everyone can sing right now.",
] as const;

export const helpGuideSections: HelpGuideSection[] = [
  {
    id: "first-time-setup",
    eyebrow: "First Time Setup",
    title: "Get Singing Quickly",
    intro:
      "If you are using the app for the first time, you do not need to enter every song. Add a few songs you are likely to sing, join a quartet, and add more as you go.",
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
          "Start with songs you are likely to sing soon. You can add more later, copy songs from another singer, or add Harmony Brigade songs if that helps you get started faster. If you are already in a quartet, edits to My Songs refresh your active quartet snapshot so matches can update.",
        ],
      },
      {
        title: "Finding singers at an event",
        body: [
          "Event Mode lets signed-in singers find an event, mark themselves available there, and send private event-scoped messages to coordinate where and when to sing. Event Mode messages do not show your email address or phone number, do not expose your My Songs repertoire, and are separate from starting a quartet. Email notifications, when configured, link back to the event without including the message text or sender contact details.",
          "Once singers are physically together, use Start a quartet and have the others join by QR code, code, or link.",
        ],
      },
    ],
  },
  {
    id: "repertoire",
    eyebrow: "My Songs",
    title: "Manage The Songs You Know",
    intro:
      "My Songs stores your songs, arrangement voicings, barbershop parts, confidence, arranger information, notes, and last-sung tracking.",
    topics: [
      {
        title: "Song Title Autocomplete",
        body: [
          "Start typing to see suggestions. Suggestions are optional — you can always enter your own song title if the song is not listed or if your title is different.",
          "Selecting a suggestion can prefill title, arrangement voicing, and arranger. If one suggestion covers multiple voicings, choose the arrangement voicing you know before saving.",
        ],
      },
      {
        title: "How Suggestions Are Shared",
        body: [
          "When you add a song, the title, arrangement voicing, and arranger you enter can help future singers find the same song faster. Adding a song does not add it to anyone else’s saved songs.",
          "Suggestions do not expose private user details such as user IDs, singer names, notes, parts, confidence, timestamps, or your full personal song list.",
        ],
      },
      {
        title: "More Ways To Build My Songs",
        body: [
          "Use Copy songs from another singer when someone gives you a private link or code. You can copy song titles, arrangement voicings, and arrangers, then choose your own part and confidence before saving.",
          "Use Let another singer copy songs from My Songs to create a private link/code. The other singer cannot see your notes, confidence, last-sung history, email address, or account details.",
          "Use Add Harmony Brigade songs to choose a year and brigade, review lower voice (TTBB) songs from the reference data, and choose your own parts and confidence before adding anything.",
        ],
      },
      {
        title: "Arrangement voicings and barbershop parts",
        body: [
          "Barbershop uses four functional voice parts: Tenor, Lead, Baritone, and Bass. That is true whether the music is published for treble voices, mixed voices, or lower voices.",
          "Choose the arrangement voicing that matches the music you have: Treble (SSAA), Mixed (SATB), or Lower voice (TTBB).",
          "Treble (SSAA) music is often printed as Tenor, Lead, Baritone, and Bass. But you'll sometimes see (depending on the publisher) S1, S2, A1, A2. S1 then maps to Barbershop Tenor, S2 to Lead, A1 to Baritone, and A2 to Bass.",
          "Mixed (SATB) music, likewise, is often printed as TLBB. But, you will frequently see Soprano, Alto, Tenor, Bass. In that case, Soprano maps to Barbershop Tenor, Alto to Lead, Tenor to Baritone, and Bass to Bass.",
          "Lower voice (TTBB) music is usually printed as Tenor, Lead, Baritone, and Bass, but you'll occasionally see T1, T2, B1, B2. T1 then maps to Barbership Tenor, T2 to Lead, B1 to Baritone, and B2 to Bass.",
          "If you know the same song in more than one arrangement voicing, add it more than once — one entry for each voicing.",
        ],
      },
      {
        title: "Parts and Confidence",
        body: [
          "Select every barbershop part you can sing for that arrangement and set your confidence for each part.",
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
          "Notes are for your own memory — for example, version reminders, tags, first words, key, or tricky spots. They help you manage your songs but are not used to decide whether the quartet can sing a song.",
        ],
      },
      {
        title: "Last Sung",
        body: [
          "Last sung is based on songs you have marked as sung in the app, either from a quartet page or from My Songs. Not marked yet does not make any claim about your real-life singing history.",
          "You can use the Sung filter to show all songs, marked-sung songs, or songs that are not marked sung.",
        ],
      },
      {
        title: "Sorting and Filtering",
        body: [
          "Use search to filter by title. You can sort by title, newest or oldest added, sung recently, or least recently sung.",
          "Recently sung puts marked-sung songs first, newest to oldest. Least recently sung puts Not marked yet songs first, then marked-sung songs from oldest to newest.",
          "Open Filters when you need to narrow My Songs by voicing, functional barbershop part, or Sung state. Active filters appear above the song list and can be cleared together.",
        ],
      },
    ],
  },
  {
    id: "starting-a-quartet",
    eyebrow: "Starting A Quartet",
    title: "Start A Quartet For The Group",
    intro:
      "Use Start when you want to create the quartet for the group. The app gives you a code, QR code, and shareable link so the other singers can join from their phones.",
    topics: [
      {
        title: "What Start Does",
        body: [
          "Start creates a quartet session and gives it a short code. Other singers can enter the code, scan the QR code, or open the shared link to join.",
          "You are part of the quartet you start. Your saved songs are used along with the other singers’ saved songs to find matches, so add at least a few songs first.",
        ],
      },
      {
        title: "After Singers Join",
        body: [
          "Once singers join, the app compares the current quartet members’ saved song snapshots. A quartet is full when four singers have joined.",
          "Starting a quartet does not permanently change anyone else’s saved songs. It only creates a shared place where the group can compare what each singer already has saved.",
        ],
      },
      {
        title: "Fixing Something After Starting",
        body: [
          "If you notice a missing song, wrong part, confidence issue, arranger detail, or display name problem, you can still edit My Songs or your name after starting and return to the quartet.",
        ],
      },
    ],
  },
  {
    id: "joining-a-quartet",
    eyebrow: "Joining A Quartet",
    title: "Join A Quartet Someone Else Started",
    intro:
      "Use Join when another singer has already started a quartet. Enter the code they give you, scan the QR code, or open the shared link.",
    topics: [
      {
        title: "What Join Uses",
        body: [
          "When you join, the app uses your saved songs to look for songs the group can sing together. Joining does not add songs to My Songs or change the songs you already saved.",
          "If your song list is empty or missing common songs, the group may see fewer matches until you add or update entries.",
        ],
      },
      {
        title: "Signing In and Rejoining",
        body: [
          "If the app asks you to sign in or set a display name, do that first so the quartet can identify you and use your saved songs.",
          "If you leave and later rejoin with the same code or link while there is room, rejoining behaves like joining normally.",
        ],
      },
      {
        title: "When The Quartet Is Full",
        body: [
          "A quartet is full at four singers. If the quartet is full, the app will keep you from joining until someone leaves or is removed.",
        ],
      },
    ],
  },
  {
    id: "quartet-matches",
    eyebrow: "Quartet Matches",
    title: "Understand What Your Pick-Up Quartet Can Sing",
    intro:
      "The quartet page compares the current participant snapshots and groups matches by how ready they are to sing.",
    topics: [
      {
        title: "Ready to Sing",
        body: [
          "Ready to Sing matches are the cleanest matches. All required parts are covered, and the app assigns distinct singers to distinct required parts.",
          "For example, lower voice (TTBB) arrangements need Tenor, Lead, Baritone, and Bass covered by four different singers.",
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
          "The strongest signals are arrangement voicing, required part coverage, and distinct singers for the required parts. Different voicings are not combined.",
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
    ],
  },
  {
    id: "managing-a-quartet",
    eyebrow: "Managing A Quartet",
    title: "Update, Leave, Or Rejoin A Quartet",
    intro:
      "Quartet membership and match results come from the current quartet data. Use the quartet controls when someone updates saved songs, changes names, leaves, rejoins, or needs to be removed.",
    topics: [
      {
        title: "Managing The Quartet",
        body: [
          "When the quartet is full, use Manage to see quartet members, edit My Songs, change your name, or leave the quartet.",
          "If a song title, arrangement voicing, part, arranger, notes, or confidence looks wrong, update it from My Songs. If the name shown to others is wrong, use Change name.",
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

export const helpNavItems: HelpNavItem[] = [
  { id: "first-time-setup", label: "First time setup" },
  { id: "repertoire", label: "My Songs" },
  { id: "starting-a-quartet", label: "Starting a quartet" },
  { id: "joining-a-quartet", label: "Joining a quartet" },
  { id: "quartet-matches", label: "Quartet matches" },
  { id: "managing-a-quartet", label: "Managing a quartet" },
  { id: "acknowledgments", label: "Acknowledgments" },
  { id: "feedback", label: "Feedback" },
];

export const helpAcknowledgmentsIntro =
  "What Can We Sing exists because of the generosity, encouragement, and good ideas of people in the barbershop community.";

export const helpAcknowledgments: HelpAcknowledgment[] = [
  {
    name: "Alex Koller",
    contribution:
      "for inspiring this app with his OG in the 2010s, Instant Quartet",
  },
  {
    name: "Amber Reimer",
    contribution:
      "for encouraging this work and for her tireless support of Harmony Brigade singing",
  },
  {
    name: "Ross Wilkins",
    contribution: "for the use of his excellent Brigade song database",
  },
  {
    name: "Jessica Rodman",
    contribution: "for her enthusiastic support and suggesting Event Mode",
  },
  {
    name: "Scott Anderson",
    contribution: "for excellent early feedback and several feature suggestions",
  },
  {
    name: "Marcie Jones and Ann Monaghan McAlexander",
    contribution: "for crucial feedback on voicing terminology",
  },
  {
    name: "Sweet Adelines International",
    contribution:
      "for maintaining the sweetadelines.com published and arranged music list PDFs used as song suggestion sources",
  },
  {
    name: "Barbershop Harmony Society",
    contribution:
      "for maintaining the shop.barbershop.org published music Google sheet used as song suggestion sources",
  },
];

export const helpSongSuggestionSources: HelpAcknowledgment[] = [
  {
    name: "barbershopconnections.com",
    contribution: "for song suggestion reference data",
  },
  {
    name: "barbershoptracks.com",
    contribution: "for song suggestion reference data",
  },
  {
    name: "gud2brabah.com",
    contribution: "for Ross Wilkins’ Harmony Brigade database",
  },
  {
    name: "Scott Anderson’s International songs list",
    contribution: "for songs sung at International",
  },
  {
    name: "shop.barbershop.org",
    contribution: "for BHS published music suggestion data",
  },
  {
    name: "sweetadelines.com",
    contribution: "for published and arranged music suggestion data",
  },
  {
    name: "timtracks.com",
    contribution: "for song suggestion reference data",
  },
  {
    name: "kohlkitzmillermusic.com",
    contribution: "for song suggestion reference data",
  },
  {
    name: "melodyhinearrangements.com",
    contribution: "for song suggestion reference data",
  },
  {
    name: "sheetmusicplus.com",
    contribution: "for Barbershop genre catalog song suggestion reference data",
  },
];

export const helpDevelopmentNote =
  "What Can We Sing was built by Tim Peterson with substantial coding assistance from OpenAI Codex and ChatGPT. No OpenAI or other AI product runs inside the app or processes user quartet or repertoire activity in real time.";

export const helpWelcomeCopy =
  "We really hope you have a great time using What Can We Sing, and that it makes your convention, afterglow, or Brigade experience that much more fun and worthwhile.";

export const helpFeedbackInvitationCopy =
  "If the app helps you, confuses you, or gives you an idea for something better, please send a note using the feedback form at the bottom of this page.";

export const feedbackHelpCopy =
  "Report a bug, describe confusing behavior, suggest an improvement, or just let us know how you are using the app. If you like it, if it helped at a convention, afterglow, or Brigade, or if you have general feedback, choose General feedback and send a quick note. A short note about what you were trying to do and what happened is usually enough.";

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
