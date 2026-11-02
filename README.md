# Groove Machine (offline)

A drum machine and strum trainer for guitar practice that works with **no network at all** once it's on your home screen.

Plain HTML/CSS/JS — no frameworks, no build step, no dependencies. Every drum sound is synthesised live with the Web Audio API, so there are no audio files to download and the whole app is about 45 KB.

---

## Try it right now on the iPad (no setup)

While the Mac is awake and on the same Wi-Fi, serve the folder:

```bash
cd ~/Documents/Code/groove-machine && python3 -m http.server 8788
```

Then open this on the iPhone or iPad:

```
http://192.168.1.52:8788/
```

This is good for trying the feel of it. It will **not** work offline — plain `http://` can't register a service worker. For that you need the GitHub Pages step below. Press `Ctrl-C` in the Terminal when you're done.

---

## Put it online so it works offline

Sounds backwards, but iOS only runs a web app offline if a service worker cached it during install, and service workers only register over `https://`. So it needs one real HTTPS home. GitHub Pages is free and permanent.

1. Go to **github.com** and sign in (create an account if you don't have one).
2. Click **+** (top right) → **New repository**.
3. Name it `groove-machine`, choose **Public**, and click **Create repository**.
4. On the next page click **uploading an existing file**.
5. Open `~/Documents/Code/groove-machine` in Finder, select all nine files, and drag them onto the browser window. Everything sits at the top level — there are no subfolders, deliberately, because GitHub's file picker flattens them.
6. Click **Commit changes**.
7. Go to **Settings** → **Pages** (left sidebar).
8. Under *Build and deployment*, set **Source** to *Deploy from a branch*, **Branch** to `main`, folder `/ (root)`, then **Save**.
9. Wait a minute or two, then reload that page. It will show your URL:

```
https://<your-username>.github.io/groove-machine/
```

## Install it on the iPhone / iPad

Do this **before** you go off grid.

1. Open that URL in **Safari** (it must be Safari — Chrome on iOS can't install web apps).
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Launch it once from the new home-screen icon and press play, so the service worker caches everything.

## Prove it actually works offline

Turn on **Airplane Mode**, then open it from the home screen icon. It should load and play normally. Worth doing before you leave rather than finding out in the woods.

---

## Using it

| Control | What it does |
|---|---|
| **Play / space bar** | Start and stop |
| **Pads** | Tap to toggle a hit on or off |
| **Auto 8ths** | Hi-hat plays straight 8ths regardless of the pads |
| **Tap** | Tap it a few times in rhythm to set the tempo |
| **Beats** | Six built-in grooves, plus anything you've saved |
| **Share** | Puts the whole current groove into a link — the way to move one from the iPhone to the iPad |
| **16th notes** | Switches the grid from 8 pads a bar to 16 |
| **Swing 8ths / 16ths** | Delays the off-beats by the swing amount in Settings |
| **Practice L1–L3** | Fades the kit out for 2, 3 or 5 seconds every 4 bars and fades it back, so you have to hold tempo through the silence |
| **Auto fills** | Hi-hat count-in bar, then a fill on every 4th bar |

### Strum tracks

**+ Add strum/pick track** adds a row where you type the pattern instead of tapping pads:

| Symbol | Meaning |
|---|---|
| `D` | Accented downstroke |
| `d` | Downstroke |
| `u` | Upstroke |
| `U` | Accented upstroke |
| `.` or blank | Rest |

Two characters in one box play as two 16ths inside that beat — so `du` is a down-up pair. You can add as many strum rows as you want, mute them individually, and tap the row name to rename it ("Verse", "Chorus pick").

It opens with two strum rows, the first carrying `d . D . d . D .` so the notation explains itself.

### Sharing a groove

**Share** encodes the whole setup — pads, strum rows and their names, tempo, kit, time signature, swing — into a link. Opening that link loads the groove and then strips it from the address bar.

Nothing is uploaded. The groove rides inside the link's `#fragment`, which browsers never send to a server; the link only goes anywhere if you hand it to someone. It's also how you get a groove from the iPhone to the iPad, since saved grooves live in each device's own storage.

### Saved grooves

Saved on the device with no sign-in and no limit. They survive closing the app. They live in that one browser's storage, so the iPhone and the iPad each keep their own.

---

## Updating it later

Edit the files, then drag the changed ones into the GitHub repo again (**Add file → Upload files**). One thing to remember: **bump the cache name in `sw.js`** — change `groove-machine-v2` to `-v3`, etc. Without that, the old service worker keeps serving the old cached copy and your changes won't show up.

Open the app once while online after an update. It notices the new version, caches it, and reloads itself.

---

## If there's no sound

In rough order of likelihood:

1. **The side switch on the iPhone.** iOS mutes web audio with the ringer switch. The app can't override that.
2. **It was in the background too long.** iOS doesn't just pause audio when you leave an app, it *interrupts* it, and an interrupted audio context often won't come back on its own. The app now detects this, parks the transport instead of leaving a lit play button over silence, and tells you what happened — tap play and it rebuilds the audio from scratch.
3. **The volume slider is at zero.** The app says so in an amber line under the transport.
4. **Bluetooth.** Check it isn't still playing to a speaker in another room.

---

## How it fits together

- `index.html` — markup and layout
- `styles.css` — dark theme, large touch targets, phone breakpoint at 620 px
- `app.js` — audio synthesis, the scheduler, the sequencer, and all UI wiring
- `sw.js` — service worker; precaches everything on install, then serves cache-first
- `manifest.webmanifest` — makes it installable as a standalone app
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — home-screen icons

Timing uses a lookahead scheduler: a 25 ms timer queues any note falling in the next 120 ms directly onto the Web Audio clock, so note onsets are sample-accurate and the JS timer only decides *what* to queue, never *when* it sounds. Measured at 180 BPM in 16ths, every step landed at exactly 83.3333 ms with zero cumulative drift over 7.5 bars.
