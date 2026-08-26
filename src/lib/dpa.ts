/**
 * The Data Processing Agreement, as content rather than as a page.
 *
 * Article 28 of the GDPR requires a written contract wherever one party
 * processes personal data on behalf of another. A customer putting their own
 * clients' details into Freely is the controller and Freely is the processor,
 * so that contract is not optional and the terms page does not substitute for
 * it. The terms page is a notice Freely publishes and can change; this is an
 * obligation Freely takes on.
 *
 * English only, deliberately, and the opposite of the choice made for the
 * terms page. That page is a plain-language description of what the product
 * does, where a Spanish freelancer being unable to read it is the worse
 * outcome. This is a contract, and a mistranslated liability or audit clause
 * is a liability of its own. It says which language governs, which is the
 * ordinary way this is handled.
 *
 * Structured rather than one blob of prose so the page can mark which clauses
 * are close to boilerplate and which want a lawyer's eye before this is relied
 * on. That distinction is the honest part: most of the below is standard, and
 * two clauses are not.
 */

export interface Clause {
  /** Numbered, so a clause can be pointed at in an email. */
  number: string;
  title: string;
  /** One paragraph per entry. */
  body: string[];
  /**
   * Whether this clause wants review before anybody relies on it.
   *
   * Marked on the page rather than hidden in a comment. Publishing a document
   * that reads binding while quietly knowing two clauses are unreviewed would
   * be worse than not publishing one at all.
   */
  review?: boolean;
}

/** A company that touches customer data, and what for. */
export interface Subprocessor {
  name: string;
  purpose: string;
  location: string;
  terms: string;
}

export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Neon",
    purpose: "Hosts the database. All content you enter is stored here.",
    location: "European Union",
    terms: "https://neon.com/dpa",
  },
  {
    name: "Vercel",
    purpose: "Runs the application. Stores no customer content.",
    location: "United States, with EU standard contractual clauses",
    terms: "https://vercel.com/legal/dpa",
  },
  {
    name: "Anthropic",
    purpose:
      "Provides the model that drafts quotes. Receives the brief text and the parts of Memory relevant to that quote.",
    location: "United States, with EU standard contractual clauses",
    terms: "https://www.anthropic.com/legal/commercial-terms",
  },
  {
    name: "Resend",
    purpose: "Sends email. Receives your email address and the message body.",
    location: "United States, with EU standard contractual clauses",
    terms: "https://resend.com/legal/dpa",
  },
];

export const LAST_UPDATED = "26 August 2026";

export const CLAUSES: Clause[] = [
  {
    number: "1",
    title: "Who this is between, and what it covers",
    body: [
      "This agreement is between you, the account holder, and Freely. Where you enter personal data belonging to other people, most often your clients, you are the controller of that data and Freely is your processor. Where Freely holds data about you as its own customer, such as your email address and sign-in details, Freely is the controller of that.",
      "The subject matter is the provision of the Freely service. The processing lasts as long as your account does. Its nature and purpose is producing quotes, tracking projects and producing invoices at your instruction.",
      "The personal data processed is whatever you enter: names, email addresses, company details and free text about people and projects. The categories of data subject are your clients, their staff, and anyone you name in a brief or a project.",
    ],
  },
  {
    number: "2",
    title: "Freely processes only on your instructions",
    body: [
      "Freely processes personal data only on your documented instructions, including in relation to transfers outside the European Economic Area, unless required otherwise by law that applies to it. Where the law requires otherwise, Freely will tell you before processing unless that law forbids telling you.",
      "Using the product is an instruction. Generating a quote, publishing one, tracking a project and producing an invoice are all instructions, and this agreement plus the terms page together are the documented form of them.",
      "Freely will tell you if, in its opinion, an instruction infringes data protection law.",
    ],
  },
  {
    number: "3",
    title: "Confidentiality",
    body: [
      "Everyone Freely authorises to process personal data is bound by a duty of confidence, whether by contract or by statute. Access to the production database is limited to the person operating Freely and is used only to keep the service running, to investigate a fault, to prevent misuse, or where the law requires it.",
    ],
  },
  {
    number: "4",
    title: "Security",
    body: [
      "Freely takes the measures required by Article 32. Data is encrypted in transit and at rest, access is authenticated and limited to what each account owns, and the hosting providers named in clause 6 each hold current SOC 2 Type 2 attestations.",
      "Payment credentials are never stored. An invoice PDF is generated at the moment of download and no copy is kept, so bank details typed into one exist only in the file your browser receives.",
    ],
  },
  {
    number: "5",
    title: "Helping you meet your own obligations",
    body: [
      "If one of your clients asks you what data you hold about them, asks for it to be corrected, or asks for it to be deleted, Freely will help you answer, so far as is possible given the nature of the processing.",
      "Freely will help you with data protection impact assessments and with consultations with a supervisory authority, so far as the information needed is information Freely has.",
    ],
  },
  {
    number: "6",
    title: "Sub-processors",
    body: [
      "You give general authorisation for Freely to engage the sub-processors listed on this page. Freely imposes on each of them data protection obligations no less protective than those in this agreement, and remains responsible to you for their performance.",
      "Freely will give you notice before adding or replacing a sub-processor, and you may object on reasonable data protection grounds. If an objection cannot be resolved, you may terminate your account and Freely will delete your data under clause 9.",
    ],
  },
  {
    number: "7",
    title: "Breaches",
    body: [
      "Freely will notify you without undue delay after becoming aware of a personal data breach affecting your data, and will include the information you need to make your own notification to a supervisory authority.",
    ],
  },
  {
    number: "8",
    title: "Transfers outside the EEA",
    body: [
      "Your data is stored in the European Union. Some sub-processors named above operate from the United States, and those transfers rely on the European Commission's standard contractual clauses, incorporated into each of the agreements linked beside them.",
    ],
  },
  {
    number: "9",
    title: "What happens when you leave",
    body: [
      "On termination, Freely deletes all personal data processed on your behalf, unless you ask for it to be returned first, and unless a law requires it to be kept. Deleting your account in the product does this immediately.",
      "Backups are retained for up to 30 days and are then overwritten in the ordinary course.",
    ],
  },
  {
    number: "10",
    title: "Audits and information",
    body: [
      "Freely will make available the information needed to demonstrate compliance with Article 28, and will allow and contribute to audits conducted by you or an auditor you appoint.",
      "In the first instance Freely will answer in writing and provide the attestations held by its sub-processors. An on-site audit may be requested once in any twelve month period, on reasonable notice, at your cost, and subject to confidentiality.",
    ],
    review: true,
  },
  {
    number: "11",
    title: "Liability",
    body: [
      "Each party is liable for its own compliance with data protection law. Liability under this agreement is subject to any limitation of liability agreed in the terms of service between you and Freely.",
      "Nothing here limits a data subject's rights against either party under Article 82.",
    ],
    review: true,
  },
  {
    number: "12",
    title: "Governing language and precedence",
    body: [
      "This agreement is written in English and the English text governs. Where it conflicts with the terms page, this agreement prevails in respect of the processing of personal data.",
    ],
    review: true,
  },
];

/** How many clauses want a lawyer before this is relied on. */
export function needsReview(clauses: Clause[] = CLAUSES): Clause[] {
  return clauses.filter((clause) => clause.review);
}
