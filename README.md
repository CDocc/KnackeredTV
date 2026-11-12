# KnackeredTV

A modern IPTV player for Windows built with Electron, React, TypeScript and Tailwind CSS. It connects to **Xtream Codes** providers and gives you Live TV, Movies and Series in one fast desktop app.

> **KnackeredTV does not provide any content.** You need your own IPTV subscription and the legal right to access the streams you play.

An early native Android app for phones and Android TV is also in `android/`. It uses the same layout and styling as the desktop app but has a smaller feature set; see [Android development](#android-development).

## Features

- **Live TV**
  - Browse channels by category, with a search box and lazy-loaded channel grid that stays smooth with thousands of channels
  - Click to play in a **mini player** that keeps going while you browse, double-click for full screen
  - Auto-reconnect when a stream drops or stalls
- **Movies and Series**
  - Poster grids by category, detail pages, season and episode lists
  - **Continue watching**: playback position is saved and resumed
- **Favorites**
  - Star any channel, movie or series; everything lives on the Favorites page, split into Live TV / Movies / Series
  - Favorites are stored per profile
- **Global search**
  - Search all live channels, movies and series at once from the sidebar box or with `Ctrl+K`
  - The full catalogue is loaded once per session, so results appear instantly as you type
  - Multi-word matching, with names that start with your query ranked first; favorite or open results straight from the list
- **Channel zapping, audio and subtitles, EPG**
  - Zap with PgUp/PgDn, type a channel number, or flip back to the last channel
  - Pick audio tracks and text subtitles for movies and series (language names, codec, channel layout)
  - Now/next programme with a progress bar on every channel card, plus a Guide timeline view
- **Recording and catch-up**
  - Record any live channel with one click (`⏺ Record`); files are saved as MKV with no re-encoding
  - Choose your recordings folder in **Settings**; manage, play, show and delete recordings on the Recordings page
  - **Catch-up TV** on channels where your provider keeps an archive: pick a past programme and play it
  - **Scheduled recordings**: in the Guide view, click a programme that hasn't started yet to schedule it (click again to cancel). Recording starts 1 minute early and ends 3 minutes late; pending schedules are listed on the Recordings page and survive restarts
  - Note: recording opens a second connection to your provider, which some accounts do not allow while you are watching. Scheduled recordings only run while KnackeredTV is open
- **Multi-view**
  - Watch 2 or 4 live channels side by side; click a screen to hear it (only one is unmuted), or expand it to full screen
  - Pick channels from search or your favorites; your layout is remembered per profile
  - Note: every screen opens its own connection, so accounts with a low connection limit may only support one or two
- **Parental controls**
  - Set a 4 to 8 digit PIN per profile in **Settings** and lock any Live TV, Movies or Series category (🔒 buttons appear beside categories once the PIN is entered)
  - Locked categories are hidden from browsing, search, favorites and multi-view until unlocked; use "Lock now" in the sidebar to re-lock
  - "Auto-lock adult categories" locks categories with names like Adult/XXX/18+
  - The PIN is stored salted and hashed. This is family-level protection, not a hard security boundary
- **Player**
  - HLS (`.m3u8`) and MPEG-TS (`.ts`) live streams, plus MP4/MKV on demand
  - **Automatic audio conversion**: movies in MKV, AVI and similar containers often use AC3, E-AC3 or DTS audio that Chromium cannot decode. KnackeredTV transparently converts the audio to AAC with a bundled ffmpeg, keeping the video untouched where possible
  - Volume bar with persistence, mute, mouse-wheel volume, fullscreen and Picture-in-Picture
  - Screen sharing friendly: the window keeps rendering when it is covered, so Discord streams do not go black
- **Profiles**: save several IPTV servers and switch between them from the sidebar; passwords are stored encrypted in a local SQLite database
- **M3U playlists**: besides Xtream logins, add the free [iptv-org](https://github.com/iptv-org/iptv) channel lists (worldwide, by category, country or language) as a public playlist, or your own private playlist URL / local `.m3u` file. Playlist profiles get Live TV, favorites, search, multi-view and recording (no Movies, Series, guide or catch-up)

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek 5 seconds (movies and series) |
| `PgUp` / `PgDn` | Next / previous channel (live) |
| `0`–`9` + `Enter` | Jump to a channel number (live) |
| `Backspace` | Previous channel (live) |
| `↑` / `↓` or mouse wheel | Volume |
| `M` | Mute |
| `F` | Fullscreen |
| `P` | Picture-in-Picture |
| `Esc` | Exit fullscreen, minimize live player, or close |
| `Ctrl+K` | Open global search |

## Getting started

### Requirements

- Windows 10 or later
- [Node.js](https://nodejs.org/) 20 or later and npm

### Install and run

```bash
git clone https://github.com/CDocc/KnackeredTV.git
cd KnackeredTV
npm install
npm run build
npm start
```

`npm install` also downloads a platform build of ffmpeg (via `ffmpeg-static`), which is used for the audio conversion.

### Development

```bash
npm run dev
```

### Build an installer

```bash
npm run dist
```

This produces two files in `release/`: an installer (`KnackeredTV-Installer-<version>.exe`) and a portable build (`KnackeredTV-Portable-<version>.exe`). The electron-builder settings live in the `build` field of `package.json`; ffmpeg is already unpacked from the asar archive there. Builds are unsigned, so Windows SmartScreen may warn on first run.

Installed builds write their log to `%APPDATA%\knackeredtv\logs\app.log` (credentials in stream URLs are masked).

### Publish a release

Releases are built by GitHub Actions. Add a `## X.Y.Z` section to `CHANGELOG.md`, set the new version in `package.json` (and `versionName`/`versionCode` in `android/app/build.gradle`), commit, then tag and push:

```bash
git tag v0.3.0
git push origin v0.3.0
```

The workflow in `.github/workflows/release.yml` builds on Windows and attaches the installer and portable exe to a new GitHub Release, then a second job builds the Android APK (`KnackeredTV-Android-<version>.apk`) and attaches it too. The tag must match `versionName` in `android/app/build.gradle` or the Android job fails. The matching `CHANGELOG.md` section becomes the release notes.

**Android signing:** an installed app can only be updated by an APK signed with the same key. Create a keystore once (`keytool -genkeypair -v -keystore release.jks -alias knackeredtv -keyalg RSA -keysize 2048 -validity 10000`), keep it somewhere safe, and add these repository secrets: `ANDROID_KEYSTORE_BASE64` (the file base64-encoded), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Without them the workflow still produces an APK, signed with a throwaway debug key that cannot update older installs. Never commit the keystore.

Both apps read the latest GitHub Releases on start-up and from **Settings > Updates**: they show the installed version, flag a newer release with a badge on Settings, and list the change log. Only published, non-pre-release releases with a `vX.Y.Z` tag count, and updates are downloaded from the release page rather than installed automatically.

## Android development

The Android app is a separate native app; building it does not change the Windows version. It runs in landscape and mirrors the desktop design: a sidebar with **Live TV, Movies, Series, Favorites, Search and Settings**, glass panels, category lists and poster grids. It supports Xtream logins, public iptv-org playlists, private M3U URLs or files, multiple profiles, favorites, sort and reload on Movies and Series, continue watching, and Media3/ExoPlayer playback. Going back from full screen keeps the video playing in a **mini player** in the corner (tap it to expand, ✕ to close), and the full-screen player has a **screen size** option (Fit, Zoom, Stretch, 16:9, 4:3) that is remembered. The picture can extend behind a camera cutout. It is designed for both touch and TV remotes, but device and stream compatibility must be tested. The guide (EPG), catch-up, recording, multi-view, parental controls and audio/subtitle track selection are not yet available on Android, and AC3/E-AC3 audio depends on what your device can decode (there is no bundled ffmpeg). Android and Windows profiles and favorites are stored separately and do not sync.

Install Android Studio with the Android SDK Platform 35 and Build Tools 35.0.0, and use JDK 17. On Windows, from the repository root:

```powershell
cd android
.\gradlew.bat :app:testDebugUnitTest :app:assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a test device with `adb install -r app/build/outputs/apk/debug/app-debug.apk` from the `android` directory. A debug APK is for testing, not a Play Store release.

Profiles are encrypted using Android Keystore and remain on the device. Some IPTV providers still use HTTP, so the app permits cleartext connections for compatibility; URLs, credentials and streams sent over HTTP are not protected in transit. Prefer HTTPS when your provider supports it. The public playlist is maintained by iptv-org, not this project, and individual channels may be offline or region-restricted.

## Project structure

```
src/
├── main/          Electron main process: window, IPC, SQLite, audio converter
├── renderer/      React entry point and App shell
├── pages/         LiveTV, Movies, Series, Favorites, Recordings, Search, Settings
├── components/    VideoPlayer, VodPlayer, mini player host, PosterCard, contexts
├── utils/         Xtream Codes API client, VOD helpers
├── db/            SQLite database layer
└── types/         Shared TypeScript types
```

## How playback works

- **Live TV** uses hls.js or mpegts.js depending on the stream type.
- **Movies and episodes** play directly in an HTML5 video element. If the container is MKV/AVI-style (or no audio is decoded), the stream is routed through a small local server on `127.0.0.1` that runs ffmpeg to convert the audio to AAC and remux to fragmented MP4. Seeking in a converted stream restarts it at the new position.
- Logs from both processes are written to `logs/app.log` (credentials are masked) to make bug reports easier.

## Roadmap

- [x] Favorites for live, movies and series
- [x] Global search across live, movies and series
- [x] EPG: now/next with progress on channel cards, plus a Guide timeline view
- [x] Audio and subtitle track selection (text subtitles)
- [x] M3U playlists (public iptv-org and private)
- [ ] Stalker/MAC portal support
- [x] Recording and catch-up (timeshift archive)
- [x] Multi-view (several channels at once)
- [x] Parental controls (PIN-locked categories)
- [ ] Casting (Chromecast / DLNA)
- [ ] Android TV and Android phone app: first version with Live TV, Movies, Series, Favorites, Search and Settings is built; needs device testing, then guide/EPG, track selection and more

## Security notes

Credentials are encrypted with AES (CryptoJS) before they are stored locally. The key is currently hard-coded in the source, so this protects against casual inspection only. A better approach would be Electron's `safeStorage` or Windows Credential Manager, which is on the to-do list. Never commit your own database or log files; the provided `.gitignore` already excludes them.

## Troubleshooting

- **Stream error or no playback**: check the server URL and credentials, and that your provider's connection limit is not already used up (many accounts allow one stream at a time).
- **No audio on a movie**: look in `logs/app.log` for `[ffmpeg]` lines and open an issue with them.
- **Some servers reject requests**: set a custom User-Agent in Settings.

## Contributing

Issues and pull requests are welcome. Please do not include real server URLs, usernames or passwords in issues or logs.

## License

MIT
