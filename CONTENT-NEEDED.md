# What is still needed before this goes public

The site is built and works. These are the details we could not verify, listed in
the order they matter. Each one names the exact place to put the answer.

Until the first two groups are filled in, the site builds only in *preview* mode —
the publish check refuses to put unfinished text on a public page.

---

## Blocking — the site will not publish without these

**1. ~~An email address.~~ DONE — `abhi.vs2000@gmail.com`, plus both phone
numbers (Dubai and India), taken from the old contact page.**

**2. How the screen work should be described.**
Five pieces are named after well-known properties: *The Dark Tower* (trailer and
scene), a *du* commercial, *Street Fighter V4*, and a *Dragon Ball Z* game
trailer. Writing original music to existing footage is completely standard
portfolio practice and worth showing — but it has to be labelled for what it is.
"Music for trailers" reads as though a studio hired him; "re-score, written to
picture as portfolio work" reads as a skills demonstration. Both are respectable.
Claiming the wrong one is the kind of thing a hiring producer checks.
→ each of those five entries → `rightsNote`, then delete the `NEEDS-CONFIRMATION`
   marker

**3. Prices, or a decision not to show them.**
Five services are listed with the price left blank; each currently shows "On
enquiry", which is a legitimate choice and looks fine. If you want numbers, put
them in. If you want the whole services page gone, set `services.enabled` to
`false` and it disappears, along with its link in the menu.
→ `services.items[].price`, or `services.enabled`

**4. The real web address.**
Currently set to the free GitHub address the draft is published at, which is
correct for today. When a domain is bought, change this to match — it decides the
links in the sitemap and what appears when someone shares the site, and if the two
disagree those links break.
→ `meta.siteUrl`

---

## Important, but the site publishes without them

**5. Social links.** The old contact page carried LinkedIn, Facebook and
Instagram icons, so those accounts exist — the addresses behind them were not
readable in the screenshot. YouTube and SoundCloud are needed too. All five are
listed with no address behind them, which means they are hidden rather than
broken. Only the Linktree link is live.
→ `social[].url`

**6. Photographs.** There are none. The About page expects a portrait, and every
project falls back to generated artwork. The generated artwork is good and can
stay permanently — but one real photograph of him working changes how the whole
site reads.
→ `site/public/img/portrait.jpg`, and `site/public/img/covers/` for projects

**7. His own audio.** The player and the before/after comparison currently use
synthesised demonstration pieces, clearly labelled as such. Real excerpts would be
far stronger — particularly a rough-bounce-and-final pair of the same song for the
comparison, which is the most persuasive thing on the site.
→ see HANDOVER.md, section 5

**8. Ten track titles we could not read.** The old site's audio page showed ten
tracks whose names were cut off in the screenshots:

| Shown as | Length | Section |
|---|---|---|
| Moonli… | 4:20 | Originals |
| Blue Tr… | 3:36 | Originals |
| Sang Geet I… | 5:57 | Originals |
| P… | 3:00 | Originals |
| Is Jagah … | 3:55 | Originals |
| Phir Se Udd… | 2:54 | Covers |
| Enna Sona | 2:24 | Covers |
| Thinking Out … | 3:24 | Covers |
| Kaash Cov… | 7:57 | Covers |
| Kabhi Kabhi | 5:23 | Covers |

Three of them (Phir Se Udd Chala, Enna Sona, and by inference Kaash and Kabhi
Kabhi) match projects already on the new site. The rest are not on it at all,
because guessing a song title on someone's professional portfolio is not a
reasonable thing to do. Send the full names and they take about ten minutes to add.

**9. Whether those Wix audio files can be exported.** Those ten tracks are hosted
inside the old Wix site. If the original MP3s still exist, they can go straight
into the player. If not, the projects can link out to YouTube and SoundCloud as
the others do.

---

## A decision he should make, not us

**His home address and date of birth.** The old contact page published both: a
full residential address in Al Furjan, and his date of birth. Neither is on the
new site, on purpose.

A full address plus an exact date of birth is the standard raw material for
identity theft, and a residential address adds a personal-safety exposure that
wins no work — a client needs to know he is in Dubai and how to reach him, not
which villa he lives in. "Dubai, UAE" is shown instead, and both phone numbers
and his email are one click away.

This is his call, not ours. If he wants either back it is a two-minute change —
but it should be a decision he makes knowingly rather than something inherited
from a template.

## Optional

**10. Testimonials.** The structure is there and empty, so the section does not
render. Two or three lines from artists he has worked with would be the single
highest-value addition after photographs.
→ `testimonials`

**11. Phone number.** Blank, so the row is hidden.
→ `contact.phone`

**12. Confirm the rewritten bio.** The About text was rewritten from his original
Wix wording — the facts are unchanged (audio engineer who produces, mixes and
masters; Hindustani vocal and western classical guitar; SAE Dubai), but the
phrasing is new and sharper. He should read it and confirm it sounds like him.
→ `about.lead` and `about.paragraphs`
