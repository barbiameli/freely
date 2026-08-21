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

Retired 2026-08-16: "Offer" was used for the Public Quote in some code and commits, with no fixed convention behind it. Existing "Offer" naming was a known inconsistency to rename, not a deliberate second concept — done 2026-08-21 (the `BreakdownOffer` component, an unrelated Track feature that happened to share the retired word, is now `BreakdownSuggestion`).
