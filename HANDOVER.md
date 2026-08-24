# Your website — the owner's guide

Everything here is written for you, not for a developer. There is no jargon you
need to learn and nothing you need to install on your computer.

---

## 1. What you have

A complete website with six kinds of page:

| Page | What it does |
|---|---|
| Home | Your name, what you do, six selected projects, and the before/after mix demo |
| Work | All your projects, filterable by originals / covers / screen work, and by language |
| A page per project | One for every project — 23 of them right now |
| About | Your story, your experience, your training, your skills |
| Services | What you offer, what it costs, how long it takes, and the common questions |
| Contact | An enquiry form and your direct details |

Two things on it are unusual, and both are deliberate:

**The player at the bottom keeps playing when someone changes page.** On almost
every website, clicking a link stops the music. On yours it does not. Someone can
start a track, read your About page, look at three projects, and it is still
playing. That is the single best way to keep a visitor on a musician's site.

**The before/after control on the home page.** A visitor hears the same
performance as a rough bounce and as a finished mix, switching instantly between
them. Both play at *the same loudness on purpose* — a louder version always
sounds better, so matching the levels is what makes it an honest demonstration
rather than a trick. There is a small panel next to it with the measured
differences (stereo width, brightness, low-mid build-up), and those numbers are
measured from the actual files, so they cannot drift out of date.

---

## 2. Putting it online — the first time

Your site is already online. The file `.github/workflows/publish.yml` in your
repository does it: every time you change your content, it rebuilds and
republishes within about two minutes. You never run anything, and you never have
to touch this again.

If you are ever setting this up in a fresh repository, the whole procedure is:
copy that one workflow file in, and push. It switches Pages on by itself.

**Using your own web address** (for example `abhishekvenkat.com`): buy the name
from any domain registrar, then go to **Settings → Pages** on GitHub and enter it
under "Custom domain". GitHub shows you the two settings to copy into your
registrar. Then change `meta.siteUrl` in your content file (see below) to match.
If those two disagree, your links look wrong when someone shares them.

---

## 3. Changing anything on your site

**Everything you can see on the website comes from one file:**

```
site/content/site.json
```

Your headline, your bio, every project, every price, your email address. One file.

**To edit it without installing anything:**

1. Open the file on GitHub.
2. Click the pencil icon (top right).
3. Make your change.
4. Scroll down, click **Commit changes**.
5. Wait about two minutes. Your site has updated.

**The one rule when editing.** The file uses quote marks, commas and brackets,
and they have to stay where they are. The safe way to edit is: change the words
*between* the quote marks, and leave everything else alone.

```
"tagline": "Records, produces, mixes and masters — with a classically trained ear.",
             ^-------------- change anything in here -----------------^
```

If you break it, nothing goes live and nothing is lost — the site simply refuses
to republish and tells you which line has the problem. Your existing site stays
up untouched until you fix it. There is a full field-by-field reference at
`site/content/GUIDE.md`.

---

## 4. Adding a new project

Find the `"works"` section and copy one of the existing blocks. A minimal one:

```json
{
  "slug": "my-new-song",
  "title": "My New Song",
  "kind": "original",
  "collection": "hindi",
  "artStyle": "raga",
  "roles": ["Producer", "Mix"],
  "summary": "One or two sentences about what this is and what you did on it.",
  "links": [
    { "label": "Watch on YouTube", "url": "https://youtube.com/watch?v=...", "type": "youtube" }
  ]
}
```

- `slug` becomes the web address (`yoursite.com/work/my-new-song`). Lower case,
  words joined by hyphens, no spaces.
- `kind` is one of `original`, `cover`, `screen`.
- `collection` is one of `hindi`, `tamil`, `bhajan`, `instrumental`, `media`.
- `artStyle` picks the generated artwork — see section 6.
- Add `"featured": true` to also show it on the home page.

The project page, the filter buttons, the sitemap and the artwork all appear on
their own. You do not have to touch anything else.

---

## 5. Putting your own audio on the site

Right now the site ships with **demonstration audio** — short pieces written by
computer specifically for this site, so that the player and the before/after
control work out of the box without using anyone's copyrighted music. They are
labelled "demo audio" on screen so nobody is misled.

**To replace them with your own:**

1. Export 30–60 second excerpts as MP3.
2. Put them in the folder `site/public/audio/` (drag and drop on GitHub works).
3. In your content file, find `"player"` and change each `"src"` to your filename,
   and change `"isDemo": true` to `"isDemo": false`. The "demo audio" label
   disappears by itself.

**For the before/after control**, you need the *same performance* twice: a rough
bounce and the finished master. Put both in the same folder, point `"raw"` and
`"mixed"` at them in the `"compare"` section, and set `"isDemo": false`.

> One thing to be careful about: the two files must be the *same length and start
> at the same point*, because they play in sync. If one has a two-bar count-in
> and the other does not, the comparison will not line up.

The waveform drawings and the measured comparison figures are produced from
whatever files are there, by running `npm run assets` — or ask whoever helps you
with the technical side to run it once after you swap the audio.

---

## 6. The artwork

Every project has its own cover image, drawn by the site rather than pulled from
YouTube. That is on purpose: thumbnails from other platforms come in different
shapes, carry other people's logos, and break the day a video is made private.

The drawing style follows the kind of work:

| `artStyle` | What it draws | Used for |
|---|---|---|
| `raga` | Interference waves | Hindi originals |
| `mandala` | A radial figure built from the harmonic series | Devotional |
| `spectrum` | A frozen spectrum analyser | Instrumental |
| `contour` | Contour lines, like land from above | The Tamil songs |
| `groove` | Vinyl grooves with one lit arc | Covers |
| `frames` | Film frames over a waveform | Screen work |

**To use a real photo or your own cover art instead**, put the image in
`site/public/img/covers/` and add one line to that project:

```json
"cover": "/img/covers/my-song.jpg"
```

Square images, at least 1000×1000 pixels.

**Your portrait** for the About page goes at `site/public/img/portrait.jpg`.

---

## 7. Turning the enquiry form on

At the moment the form works by opening the visitor's own email app with their
message already written. That works, but it is not as smooth as it could be.

To have enquiries arrive in your inbox directly:

1. Sign up free at **formspree.io** (50 enquiries a month at no cost).
2. Create a form. It gives you a web address like `https://formspree.io/f/abcdxyz`.
3. Paste it into your content file: `"formEndpoint": "https://formspree.io/f/abcdxyz"`.

The form has a hidden trap field that catches spam robots. There is no puzzle for
your visitors to solve, and no tracking of any kind.

---

## 8. If something looks wrong

**The site did not update.** Go to the **Actions** tab on GitHub. A red cross
means the check found a problem, and clicking it shows a message written in plain
English saying exactly what and where. Your live site is unaffected until it
passes.

**A project page is missing.** Check that its `slug` is spelled the same
everywhere and is not shared with another project.

**The player will not play.** Browsers block sound until the visitor clicks
something — that is the browser, not the site, and it is the correct behaviour. A
site that starts making noise at a stranger gets closed.

**Everything looks unstyled.** Almost always a half-finished edit to the content
file. Undo your last change on GitHub (the History view lets you restore any
previous version) and the site returns.

---

## 9. Things that are deliberately not here

Being explicit so these read as decisions, not oversights:

- **No light mode.** The brand is a dark studio room. A half-committed light
  version would look worse than none.
- **No cookie banner, no analytics, no tracking.** Nothing about your visitors is
  collected, so there is nothing to disclose and no banner to show. If you later
  want visitor numbers, a privacy-respecting counter can be added in one line.
- **No blog.** Easy to add later; not worth the empty page today.
- **Nothing embedded from YouTube or Instagram on page load.** Your project pages
  link out instead. This keeps the site fast and means no third party is told
  about your visitors before they click.
- **No server and no database.** The whole site is a folder of files. There is
  nothing to keep patched, nothing to be hacked, and hosting is free forever.

---

## 10. Ownership and licences

- **Everything on this site is yours** — the design, the code, the text and the
  generated artwork.
- **The two typefaces** (Archivo and Inter) are under the SIL Open Font Licence:
  free to use commercially, and served from your own site rather than from Google,
  so no visitor data goes anywhere.
- **The demonstration audio** was synthesised for this site. It is original and
  free of any third-party rights — you may keep it, replace it, or delete it.
- **One thing to settle before you publish** — see `CONTENT-NEEDED.md`. Some of
  the screen-work pieces are named after well-known films and games. How those
  should be described depends on whether they were commissioned or written as
  portfolio exercises to existing footage, and only you know which. It matters
  because the two are read very differently by anyone hiring.
