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
 * Nothing here is marked as pending. Three clauses used to be: audits,
 * liability and governing law, each left as a gesture towards a term rather
 * than a term. They are written out now, and every commitment made about a
 * sub-processor was read out of that sub-processor's own current agreement
 * rather than assumed. Where a fact was not knowable, the clause resolves it by
 * rule instead of naming a country nobody has chosen: governing law follows the
 * account holder, which is also what the standard contractual clauses do for an
 * EU exporter.
 *
 * Clause 2 says the service is free today and that this changes none of the
 * obligations. Both halves matter. Somebody reading a contract from a product
 * that has never charged anybody deserves to know that, and a processor's
 * duties under Article 28 do not depend on being paid: a free service handling
 * a client list carries the same responsibilities as a paid one.
 *
 * This is written from the published agreements of the companies involved and
 * from Article 28 itself. It has not been reviewed by a lawyer, which is a fact
 * about the document rather than a clause in it, and is stated to the person
 * who publishes it rather than to the person reading it.
 */

export interface Clause {
  /** Numbered, so a clause can be pointed at in an email. */
  number: string;
  title: string;
  /** One paragraph per entry. */
  body: string[];
}

/** A company that touches customer data, and what for. */
export interface Subprocessor {
  name: string;
  purpose: string;
  location: string;
  terms: string;
}

/**
 * Where data protection questions go.
 *
 * One address, stated in the agreement rather than left to a contact form,
 * because clause 6 promises help with data subject requests and a promise with
 * no address behind it is not a promise.
 */
export const PRIVACY_CONTACT = "hello@free-ly.co";

/**
 * How much warning you get before a sub-processor changes.
 *
 * Fourteen days, which is the shortest notice period any of the four gives
 * Freely. Promising longer would mean promising something Freely might not be
 * able to pass on.
 */
export const SUBPROCESSOR_NOTICE_DAYS = 14;

export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Neon",
    purpose:
      "Hosts the database. Everything you enter is stored here: quotes, projects, invoices, Memory and the files you upload.",
    location: "Frankfurt, Germany (AWS eu-central-1). Your content does not leave the EU.",
    terms: "https://neon.com/dpa",
  },
  {
    name: "Vercel",
    purpose:
      "Runs the application. Handles your data in memory while a page is served and keeps no copy of it.",
    location:
      "United States, under the European Commission's standard contractual clauses and the UK addendum.",
    terms: "https://vercel.com/legal/dpa",
  },
  {
    name: "Anthropic",
    purpose:
      "Provides the model that writes quotes. Receives the brief you paste and the parts of Memory relevant to that quote. Does not train on it.",
    location:
      "Anthropic Ireland, Limited contracts for customers in the EEA and the UK; processing is in the United States under the standard contractual clauses and the UK addendum.",
    terms: "https://www.anthropic.com/legal/data-processing-addendum",
  },
  {
    name: "Resend",
    purpose:
      "Sends email: sign-in links, password resets and the quote you send a client. Receives the address and the message.",
    location:
      "Plus Five Five, Inc., United States, under the standard contractual clauses, the UK addendum, and the EU-US Data Privacy Framework.",
    terms: "https://resend.com/legal/dpa",
  },
];

export const LAST_UPDATED = "27 August 2026";

export const CLAUSES: Clause[] = [
  {
    number: "1",
    title: "Who this is between, and what it covers",
    body: [
      "This agreement is between you, the account holder, and Freely. Where you enter personal data belonging to other people, most often your clients, you are the controller of that data and Freely is your processor. Where Freely holds data about you as its own customer, such as your email address and sign-in details, Freely is the controller of that.",
      "Freely is currently operated by one person rather than by a registered company, and that person carries these obligations personally. If Freely is later incorporated, this agreement transfers to that company on the same terms, and you will be told before it happens.",
      "The subject matter is the provision of the Freely service. The processing lasts as long as your account does. Its nature and purpose is producing quotes, tracking projects and producing invoices at your instruction.",
      "The personal data processed is whatever you enter: names, email addresses, company details and free text about people and projects. The categories of data subject are your clients, their staff, and anyone you name in a brief or a project. Freely does not ask for special category data under Article 9 and the product has no field intended for it.",
    ],
  },
  {
    number: "2",
    title: "Freely is free at the moment, and that changes nothing here",
    body: [
      "Freely is in testing. It is provided free of charge, nobody is being billed for it, and it is not being run as a business yet: there is no company, no revenue and no paid plan. If you were invited to try it, you were invited, not sold to.",
      "None of that reduces the obligations in this agreement. A processor's duties under Article 28 do not depend on being paid, and a free service holding your client list carries exactly the responsibilities a paid one would. Every commitment below applies today.",
      "It also does not make Freely a charity or a non-profit in any legal sense. It is an unfunded project that intends to charge for itself eventually.",
      "If Freely does start charging, this agreement stays as it is unless it is updated under clause 15, and you will be told before any change takes effect. Nothing you agreed to while it was free becomes weaker because you later pay for it.",
    ],
  },
  {
    number: "3",
    title: "Freely processes only on your instructions",
    body: [
      "Freely processes personal data only on your documented instructions, including in relation to transfers outside the European Economic Area, unless required otherwise by law that applies to it. Where the law requires otherwise, Freely will tell you before processing unless that law forbids telling you.",
      "Using the product is an instruction. Generating a quote, publishing one, tracking a project and producing an invoice are all instructions, and this agreement plus the terms page together are the documented form of them.",
      "Freely will not sell or share your data, will not use it for its own purposes, and will not combine it with data from anywhere else. It is not used to train any model: Anthropic's terms prohibit training on customer content, and Freely sends nothing anywhere else.",
      "Freely will tell you if, in its opinion, an instruction infringes data protection law.",
    ],
  },
  {
    number: "4",
    title: "Confidentiality",
    body: [
      "Everyone Freely authorises to process personal data is bound by a duty of confidence, whether by contract or by statute. Access to the production database is limited to the person operating Freely and is used only to keep the service running, to investigate a fault, to prevent misuse, or where the law requires it.",
      "That access is not used to read your quotes out of interest, and it is not used to build anything. Where a fault can be diagnosed without opening your content, it is.",
    ],
  },
  {
    number: "5",
    title: "Security",
    body: [
      "Freely takes the measures required by Article 32. Data is encrypted in transit with TLS and at rest, access is authenticated and limited to what each account owns, sign-in is by one-time link or password with rate limiting, and the hosting providers named in clause 7 each hold current SOC 2 Type 2 attestations.",
      "Payment credentials are never stored. An invoice PDF is generated at the moment of download and no copy is kept, so bank details typed into one exist only in the file your browser receives.",
      "A published quote is reachable by anyone holding its link, because that is what publishing it is for. The link contains a random identifier that cannot be guessed from another one, and unpublishing takes the page down.",
    ],
  },
  {
    number: "6",
    title: "Helping you meet your own obligations",
    body: [
      "If one of your clients asks you what data you hold about them, asks for it to be corrected, or asks for it to be deleted, Freely will help you answer, so far as is possible given the nature of the processing. Most of it you can do yourself in the product, which is the fastest route; where you cannot, write to " +
        PRIVACY_CONTACT +
        " and Freely will act within five working days.",
      "If a data subject contacts Freely directly about data you control, Freely will not answer on your behalf. It will pass the request to you and tell the person it has done so.",
      "Freely will help you with data protection impact assessments and with consultations with a supervisory authority, so far as the information needed is information Freely has.",
    ],
  },
  {
    number: "7",
    title: "Sub-processors",
    body: [
      "You give general authorisation for Freely to engage the sub-processors listed on this page. Freely imposes on each of them data protection obligations no less protective than those in this agreement, and remains responsible to you for their performance as it is for its own.",
      "Freely will give you at least " +
        SUBPROCESSOR_NOTICE_DAYS +
        " days' notice by email before adding or replacing a sub-processor, and you may object on reasonable data protection grounds within that period. If an objection cannot be resolved, you may terminate your account and Freely will delete your data under clause 10.",
      "Each sub-processor's own agreement is linked beside it, so what they commit to can be read rather than taken on trust.",
    ],
  },
  {
    number: "8",
    title: "Breaches",
    body: [
      "Freely will notify you without undue delay, and in any event within 48 hours, after becoming aware of a personal data breach affecting your data.",
      "The notice will describe what happened, the categories and approximate number of people and records involved so far as they are known, the likely consequences, and what is being done about it. Where it is not all known at once, it will be sent in stages rather than held back until complete, so that you can make your own notification to a supervisory authority inside the 72 hours Article 33 gives you.",
    ],
  },
  {
    number: "9",
    title: "Transfers outside the EEA",
    body: [
      "Everything you enter is stored in Frankfurt, in the European Union, and stays there.",
      "Three of the four sub-processors operate from the United States: Vercel runs the application, Anthropic writes the quotes, and Resend sends the email. Those transfers rely on the European Commission's standard contractual clauses, incorporated into each of the agreements linked beside them, with the UK international data transfer addendum where the UK GDPR applies and the Swiss addendum where Swiss law applies. Anthropic contracts through its Irish entity for customers in the EEA and the UK. Resend is additionally certified under the EU-US Data Privacy Framework.",
      "Freely relies on those clauses rather than on consent, and will provide what it holds if you need to complete a transfer impact assessment of your own.",
    ],
  },
  {
    number: "10",
    title: "What happens when you leave",
    body: [
      "On termination, Freely deletes all personal data processed on your behalf, unless you ask for it to be returned first, and unless a law requires it to be kept. Deleting your account in the product does this immediately.",
      "Backups are retained for up to 30 days and are then overwritten in the ordinary course. Sub-processors delete on their own timetables once instructed: Anthropic within 30 days, Resend within 90.",
      "Freely will confirm the deletion in writing if you ask.",
    ],
  },
  {
    number: "11",
    title: "If Freely stops",
    body: [
      "An unfunded project run by one person can end. If Freely is going to shut down, you will be given at least 30 days' notice by email and the means to export your quotes, projects and invoices before it does. Your data is then deleted under clause 10 rather than sold, transferred or left running unattended.",
      "If Freely is ever sold or transferred to another operator, that is a change of sub-processor and a change of the party you contracted with. You will be told before it happens, and you may object and terminate under clause 7.",
    ],
  },
  {
    number: "12",
    title: "Audits and information",
    body: [
      "Freely will make available the information needed to demonstrate compliance with Article 28, and will allow and contribute to audits conducted by you or an auditor you appoint.",
      "In the first instance Freely will answer your questions in writing, within 30 days, and provide the SOC 2 reports and certifications held by its sub-processors so far as those may be shared. For most people that is the whole of it, and it costs nothing.",
      "Where written answers are genuinely not enough under data protection law, you may audit further once in any twelve month period, on 30 days' notice, at your own cost, through an auditor who is not a competitor of Freely and who signs a confidentiality agreement. The scope is agreed in advance and limited to the processing of your data. That limit does not apply where a supervisory authority requires an audit, or where there has been a breach affecting your data, in which case Freely bears its own costs and the twelve month restriction does not apply.",
    ],
  },
  {
    number: "13",
    title: "Liability",
    body: [
      "Each party is liable for its own compliance with data protection law. You are responsible for the lawfulness of what you put into Freely and for having a basis to process it; Freely is responsible for what it does with it once it is there.",
      "Liability under this agreement is subject to any limitation of liability agreed in the terms of service between you and Freely. Where those terms cap liability, the cap applies to this agreement too, and applies once across both rather than separately to each.",
      "While the service is provided free of charge, a cap expressed as a multiple of fees paid would come to nothing, and a contract that limits liability to zero is not a limitation, it is a disclaimer. So it is said plainly instead: during the free period Freely's liability is limited to what the law allows it to be limited to, and no further. This is the clause most worth a lawyer's eye if this document is ever relied on commercially.",
      "That limit does not apply to a party's liability for death or personal injury caused by negligence, for fraud, or to anything else that cannot be limited by law. Nothing here limits a data subject's rights against either party under Article 82, and nothing here prevents either party from recovering from the other under Article 82(5) the share of any compensation that corresponds to the other's part in the damage.",
      "Freely remains liable to you for the acts and omissions of its sub-processors to the same extent as for its own.",
    ],
  },
  {
    number: "14",
    title: "Governing law and jurisdiction",
    body: [
      "This agreement is governed by the law of the country in which you are established, and the courts of that country have jurisdiction. Where you are established outside the European Economic Area and the United Kingdom, it is governed by the law of Ireland and the courts of Ireland have jurisdiction.",
      "The law follows you rather than Freely because you are the controller: a Spanish freelancer answers to the Spanish supervisory authority for this data, and an agreement that sent the dispute somewhere else would be of little use in that conversation.",
      "The competent supervisory authority is the one in the country where you are established, or, where that is outside the EEA and you have appointed a representative, the one where your representative is.",
    ],
  },
  {
    number: "15",
    title: "Language, precedence, and changes",
    body: [
      "This agreement is written in English and the English text governs. A translation may be provided for convenience and does not change the meaning of anything here.",
      "Where this agreement conflicts with the terms page, this agreement prevails in respect of the processing of personal data. Where it conflicts with the standard contractual clauses referred to in clause 9, those clauses prevail.",
      "It is incorporated into the terms of service and takes effect when you create an account. No signature is needed for it to bind Freely. If your own client or your accountant wants a countersigned copy, write to " +
        PRIVACY_CONTACT +
        " and you will get one.",
      "Freely may update this agreement where the law changes, where a sub-processor changes, or when it starts charging, and will tell account holders by email before an update takes effect. Where an update reduces your protection, you may terminate before it takes effect and clause 10 applies. The date at the top says when it last changed, and previous versions are kept and sent on request.",
    ],
  },
];
