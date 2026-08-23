# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page WeChat Mini Program (微信小程序) — "人生周历" / "人生如格" — the mini-program port of the "My Life in Weeks" webpage. It visualizes a lifespan as a grid of dots: one dot = one week, 52 dots = one year, grouped into 10-year "decade" cards. Black/gold dots = weeks already lived, colored dots = future weeks, a pulsing white ring = the current week.

## Running / developing

There is **no CLI build, lint, or test tooling** — this is a native mini program, not a Node project (no `package.json`). The only way to run it is:

1. Open WeChat DevTools (微信开发者工具) → **导入项目** → select this `miniprogram/` folder.
2. Enter a real AppID or choose "测试号" (test account).
3. The tool auto-compiles and previews in the simulator; use "预览" to run on a real phone via QR code.

There are no automated tests and nothing to run from a terminal. "Does it still work" is verified by loading it in DevTools.

## Architecture

Everything lives in one page. The `pages/index/` directory is the entire app; `app.js` is an empty stub (`onLaunch() {}`).

| File | Role |
|---|---|
| `app.json` | Global config — declares the single route `pages/index/index`, window title "人生如格" |
| `app.wxss` | Global styles (page background + dark-mode `@media`) |
| `pages/index/index.js` | **All logic** (see below) |
| `pages/index/index.wxml` | Template — two mutually exclusive states: onboarding (`wx:if="{{needBirthday}}"`) vs. main view (`wx:else`) |
| `pages/index/index.wxss` | All page styles, including a dark-mode block |
| `project.config.json` | DevTools config — contains the AppID |

## Core data flow (`pages/index/index.js`)

- **`getWeekState(totalWeek)` is the single source of truth** for classifying each week into one of four states: `'now'`, `'milestone'`, `'passed'`, `'future'`. It is shared by both the WXML render (`updateCalendar`) and the canvas poster (`generatePoster`) so the color semantics never diverge.
- **`updateCalendar()`** is the central render routine: parses `birthdate`, computes `this._ageInWeeks`, builds the `decades[]` array (each `decade` → `weeks[]` of `{ state, totalWeek, color? , style? }`), the `stats` object, and the passed/future progress percentages. It's called on load, date change, lifespan change, and onboarding confirm.
- **`this._ageInWeeks`** is an instance field (deliberately *not* in `data`, since it doesn't drive the template) holding the number of weeks lived, clamped to `[0, totalWeeks]`. `getWeekState` and `onWeekTap` read it.
- **Persistence**: `birthdate` and `lifespan` are stored locally via `wx.getStorageSync` / `wx.setStorageSync`. `needBirthday` (`false` once a birthday exists) gates the first-run onboarding flow.
- **Poster**: `generatePoster(save)` draws onto a `<canvas type="2d">` and exports via `wx.canvasToTempFilePath`. It's pre-generated on `onReady` (`preGeneratePoster`) so shares carry an image. `save === true` triggers `wx.saveImageToPhotosAlbum` (with a `handleSaveFail` fallback that routes album-permission denials to `wx.openSetting`).

## Gotchas that are easy to get wrong

- **Date parsing must use `/`, not `-`**: `new Date(birthdate.replace(/-/g, '/'))` — a bare `-` string is parsed as UTC on iOS, shifting the date by a day. There are three call sites (`updateCalendar`, `onWeekTap`); keep them consistent.
- **Sizing uses `rpx`**, where `750rpx` = full screen width. Don't introduce fixed `px` widths for grid dots — the original webpage's fixed `10px` dots overflowed phones.
- **Canvas/DPR cap**: poster `dpr` is clamped to `2` because high-DPR iPhones (pixelRatio 3) push the canvas past iOS's ~4096px limit and silently fail the export.
- **Colors must be hex, not `hsl()`**: `hsl()` is unreliable in canvas `addColorStop`/`fillStyle` on real iOS devices, so `getRandomColor()` converts via `hslToHex`. Keep CSS and canvas colors hex.
- **`roundRect` is hand-rolled** (`ctx.arcTo` based) rather than native `ctx.roundRect`, for compatibility.
- **`project.private.config.json` is gitignored** (contains local/upload secrets); `project.config.json` holds the AppID.
- The README references a `部署上线指南.md` deployment guide that is **not** in the repo — don't assume it exists.
