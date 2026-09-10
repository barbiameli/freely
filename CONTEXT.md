# Freely

Freely helps freelancers turn a rough draft of a job into a priced, sendable quote, then track the work once a client accepts it.

## Language

**Draft**:
The freelancer's raw input before generation: hourly rate, notes, and any uploaded source document. Not a persisted record — it's the shape of the form that produces a Quote.
_Avoid_: Brief (as an input concept)

**Quote**:
The core document a freelancer sends to a client: title, scope, deliverables, timeline, price, hours, and optional strategy/terms sections. Generated from a Draft, then editable. Persisted as the `Brief` model in the database — that DB name is not being renamed, but "Quote" is the term for product surfaces, issue titles, and new code.
_Avoid_: Brief (in product copy or new code), Offer

**Public Quote**:
The client-facing artifact: the shareable page at `/q/[publicSlug]` and its PDF export, where a client views and can sign a Quote. Same underlying record, rendered for an external audience — not a separate entity.
_Avoid_: Offer, client page

**Client Portal**:
The page a client opens to find everything about working with you: the welcome pack, every published Project you have run for them, and the shared files. One per Client, at `/c/[publicSlug]`, off until switched on. Distinct from a Public Quote, which is one document; the Portal is the front door that a Project page hangs off.
_Avoid_: client page (ambiguous — it has meant the Public Quote, the Project's client-facing page, and this), CRM

**Welcome Pack**:
The short piece of writing at the top of a Client Portal saying what happens next and how you work. Set per Client, falling back to the account-level default.
_Avoid_: onboarding doc, process notes

Retired 2026-09-10: "client page" as a standalone term. It named three different surfaces in the code and in conversation at once, which is why the Portal needed a name of its own.

Retired 2026-08-16: "Offer" was used for the Public Quote in some code and commits, with no fixed convention behind it. Existing "Offer" naming was a known inconsistency to rename, not a deliberate second concept — done 2026-08-21 (the `BreakdownOffer` component, an unrelated Track feature that happened to share the retired word, is now `BreakdownSuggestion`).
