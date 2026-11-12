# Changelog

Each release's section is shown inside the apps (Settings > Updates), so write it for users.
When you tag `vX.Y.Z`, the release workflow publishes the `## X.Y.Z` section below as the release notes.
Keep the version in `package.json` and `android/app/build.gradle` in step with the tag.

## 0.3.0

### New
- Settings now shows your version, tells you when a newer release is available and lists what changed
- A badge on Settings in the sidebar appears when an update is out

### Android
- The info bar at the top of the player now hides itself after a few seconds instead of waiting for a screen size to be picked
- Buttons now highlight when you hover over them with a mouse or trackpad, including the Settings cog
- The mini player buttons are bigger and easier to reach with a remote. Press Menu to jump to the mini player and Stop to close it

## 0.2.0

### New
- M3U playlists (public iptv-org lists or your own), profile switching and a remove button on each profile
- Scheduled recordings from the Guide, listed on the Recordings page
- Sort and Reload on Movies and Series
- Docked preview player next to the Live TV grid

### Fixed
- Endless "Loading stream" hangs: streams now reconnect and fall back to alternate URLs

## 0.1.0

- First release: Live TV, Movies, Series, Favorites, Search, EPG, recording and catch-up, multi-view and parental controls
