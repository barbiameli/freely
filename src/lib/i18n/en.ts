/**
 * Every string in the interface, in English.
 *
 * This file is the source of truth: `Dictionary` is derived from it, so any
 * other language that is missing a key, or has one spare, fails to compile.
 *
 * Grouped by where the text appears rather than by type, because the question
 * when translating is always "what does this screen say", never "where are all
 * the buttons". Sentences are whole: a phrase assembled from fragments works
 * in English and falls apart in a language with different word order.
 */
export const en = {
  common: {
    save: "Save",
    saveChanges: "Save changes",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    back: "Back",
    continue: "Continue",
    close: "Close",
    keep: "Keep",
    optional: "Optional",
    required: "Required",
    saving: "Saving...",
    deleting: "Deleting...",
    working: "Working...",
    loading: "Loading",
    seeAll: "See all",
    tryAgain: "Try again",
    somethingWentWrong: "That didn't work. Try again.",
    noConnection: "Couldn't reach the server. Check your connection and try again.",
    forExample: "For example",
    commonOnes: "Common ones",
  },

  nav: {
    quote: "Quote",
    track: "Track",
    diary: "Diary",
    invoices: "Invoices",
    memory: "Memory",
    team: "Team",
    account: "Account",
    signOut: "Sign out",
    language: "Language",
  },

  quote: {
    eyebrowStep1: "Quote - Step 1 of 2",
    eyebrowStep2: "Quote - Step 2 of 2",
    stepBrief: "The brief",
    stepQuote: "The quote",
    titleStep1: "What are we quoting?",
    subtitleStep1: "Everything the quote gets built from. Only the brief and your rate are needed.",
    titleStep2: "How should we package it?",
    subtitleStep2: "How the finished quote looks and what it includes.",

    pickUpWhereYouLeftOff: "Pick up where you left off",
    everyQuote: "Every quote you've made.",
    newQuote: "New quote",
    nothingHereYet: "Nothing here yet.",
    makeYourFirst: "Make your first quote",
    sendToTrack: "Send to Track",
    sending: "Sending...",
    tracked: "Tracked",
    inTrack: "In Track",
    draft: "Draft",
    published: "Published",
    deleteThisDraft: "Delete this draft",

    uploadBrief: "Upload a brief",
    uploadBriefHint: "PDF, DOCX, or a text file.",
    pasteText: "Paste text",
    pasteTextHint: "Notes, a transcript, or a scope you've typed up.",
    reading: "Reading...",

    howShouldItRun: "How should this project run?",
    howShouldItRunHint:
      "Anything you have already decided about this particular job: how it should be priced, how it should be split up, what needs agreeing before the next part starts.",
    howShouldItRunPlaceholder:
      "e.g. it is long, so I want the visual direction signed off before the design phase, and payment split across three milestones",
    workedOutFromBrief: "Left blank, this gets worked out from the brief and your past quotes.",

    yourRate: "Your rate",
    perHour: "Per hour",
    perDay: "Per day",
    usedAsTyped: "Used exactly as typed.",
    orResearched: "Or have one researched.",
    notSureWhatToCharge: "Not sure what to charge?",
    iKnowMyRate: "I know my rate",
    rememberThisRate: "Remember this as my usual rate",
    expertise: "Your expertise level",
    expertiseHint: "Used when no rate is given, to research a realistic one.",

    pricedFor: "Where is this being priced for?",
    pricedForHint:
      "The same job pays very differently from one market to the next, so a location is the one thing needed to research a rate.",
    pricedForFooter: "Your location or the client's is needed. The rest is optional.",
    yourLocation: "Where you are based",
    clientLocation: "Where the client is",
    clientType: "What kind of client",
    budgetHint: "Anything they said about budget",
    urgency: "Timing",
    experienceNote: "Done this kind of work before?",

    addSections: "Add sections",
    addSectionsHint:
      "Every quote covers the scope, deliverables and the price. Add anything else this one needs. Where a section asks a question, answering is optional: left blank, it gets worked out from the brief and your past quotes.",
    availabilityPrompt:
      "Anything specific worth saying? Start dates, how much time you can give it, or that availability is not held until the quote is agreed.",
    availabilitySkipped: "Left blank, this section is skipped rather than guessed at.",

    quoteLanguage: "Quote language",
    quoteLanguageHint: "The language the quote is written in, which need not be yours.",

    generate: "Generate brief",
    stop: "Stop",
    generatingTooLong:
      "This is taking longer than it should. It may still finish in the background, but don't wait on it. Try again, or simplify the source material first (a very large uploaded file slows this down a lot).",
    generateFailed: "Something went wrong generating the brief. Try again.",

    addSource: "Add some source material before generating a brief.",
    addRateOrLocation: "Add your rate, or say where you or the client are based.",
    addRateOrLocationLong:
      "Add your rate, or say where you or the client are based so a rate can be researched.",
  },

  brief: {
    quotationDraft: "Quotation, draft",
    quotationPublished: "Quotation, published",
    editOverview: "Edit overview",
    total: "Total",
    scope: "Scope",
    deliverables: "Deliverables",
    timeline: "Timeline",
    strategy: "Strategy",
    investment: "Investment",
    downloadPdf: "Download PDF",
    buildingPdf: "Building PDF...",
    pdfFailed: "Couldn't build the PDF. Try again in a moment.",
    addToTrack: "Add to Track",
    addToTrackFailed: "Couldn't send that to Track. Try again.",
    publish: "Publish",
    unpublish: "Unpublish",
    copyLink: "Copy link",
    copied: "Copied",
    hoursNeedNumber: "Hours needs to be a number.",
    priceNeedNumber: "Price needs to be a number.",
    oneDeliverablePerLine: "One deliverable per line. Delete a line to remove it.",
  },

  track: {
    eyebrow: "Track",
    allProjects: "All projects",
    done: "Done",
    pace: "Pace",
    nextUp: "Next up",
    hours: "Hours",
    notScheduled: "Not scheduled",
    nothingDated: "Nothing dated",
    paceAhead: "ahead",
    paceOnTrack: "on track",
    paceSlipping: "slipping",
    paceBehind: "behind",

    whenDoesThisStart: "When does this start?",
    whenDoesThisStartHint:
      "The quote says how long each stage takes. A start date turns that into real dates on every deliverable, which you can then move individually.",
    setTheSchedule: "Set the schedule",
    scheduling: "Scheduling...",
    reschedule: "Reschedule",
    rescheduleWarning:
      "This resets every deliverable date. Dates you moved by hand go back to the derived ones.",

    comingUp: "Coming up",
    hideComingUp: "Hide what's coming up",
    worthRaising: "Worth raising",
    allAnswered: "All answered.",
    answered: "Answered",
    reopen: "Reopen",
    needsAnAnswer: "Needs an answer",
    assuming: "Assuming",
    worthAsking: "Worth asking",

    deliverables: "Deliverables",
    noDeliverables: "No deliverables listed.",
    addDeliverable: "Add a deliverable",
    breakThisDown: "Break this down",
    workingItOut: "Working it out...",
    redo: "Redo",
    editSteps: "Edit steps",
    oneStepPerLine: "One step per line. Delete a line to remove it, add a line to add one.",
    saveSteps: "Save steps",
    setDate: "Set date",
    changeThisDate: "Change this date",
    noStepsYet: "No steps on this one yet.",

    workingOutSteps: "Working out the steps",
    allBrokenDown: "All broken down",
    lastDone: "Last done",

    projectDetails: "Project details",
    hide: "Hide",
    price: "Price",
    hoursBudgeted: "Hours budgeted",
    hoursLogged: "Hours logged",
    status: "Status",
    sendToDiary: "Send to Diary",
    generateInvoice: "Generate invoice",
    deleteProject: "Delete project",
  },

  memory: {
    title: "Memory",
    instructions: "Instructions",
    tone: "Tone",
    story: "Story and context",
    files: "Files",
    branding: "Branding",
    connections: "Connections",
    comingSoon: "Coming soon",
    yourUsualRate: "Your usual rate",
    yourUsualRateHint: "Prefilled into every quote, still editable per quote.",
  },

  invoices: {
    title: "Invoices",
    newInvoice: "New invoice",
    invoiceNumber: "Invoice",
    paid: "Marked as paid.",
    notPaid: "Not paid yet.",
    paymentDetails: "Payment details",
    paymentNotStored: "These go into the PDF and are never stored.",
    download: "Download",
    noInvoices: "No invoices yet.",
  },

  diary: {
    title: "Diary",
    addEntry: "Add entry",
    noEntries: "No entries yet.",
    clientSite: "Client site",
    publish: "Publish",
    published: "Published",
  },

  account: {
    title: "Account",
    name: "Name",
    studioName: "Studio name",
    changePassword: "Change password",
    currentPassword: "Current password",
    newPassword: "New password",
    deleteAccount: "Delete account",
    nameEmpty: "Name can't be empty.",
  },

  team: {
    title: "Team",
    members: "Members",
    justYou: "Just you for now, invite a teammate above.",
    pendingInvites: "Pending invites",
    invite: "Invite",
    shareableLink: "Shareable link",
    copyLink: "Copy link",
    revoke: "Revoke",
    removeFromTeam: "Remove from team",
    you: "(you)",
  },

  errors: {
    pageTitle: "That page didn't load.",
    pageBody: "Something went wrong on our side rather than yours. Your work is saved.",
    goToQuote: "Go to Quote",
    reference: "Reference",
    rootTitle: "Something went wrong.",
    rootBody: "This one is on us. Try again in a moment.",
    notFoundTitle: "There's nothing here.",
    notFoundBody: "This page may have been deleted, or the link may be wrong.",
    backToFreely: "Back to Freely",
  },
} as const;

/** The shape every language must satisfy. Derived from English, so adding a
 * string here immediately makes Spanish fail to compile until it is
 * translated, which is the point. */
export type Dictionary = {
  [Section in keyof typeof en]: { [Key in keyof (typeof en)[Section]]: string };
};
