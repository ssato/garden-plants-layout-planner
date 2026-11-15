# What's this

Garden Layout & Plant Manager is a lightweight web application built with Google Apps Script and Konva.js.

It lets you sketch garden boundaries using rectangles or freehand drawing, arrange and resize circular plant markers on a scaled grid canvas, and log detailed plant profiles and care notes—all automatically synced to Google Sheets for easy viewing and editing.

## Features

- Visual Grid Canvas: Sketch garden beds with rectangles or freehand lines and arrange plants with grid snapping and real-world (cm) scale conversion.

- Plant Profiles & Care Logs: Click any plant marker to view or edit species, variety, height, blooming season, planting date, and care notes.

- Google Sheets Backend: All layout coordinates and plant records are stored directly in Google Sheets for effortless backup and spreadsheet access.

# Setup

1. Google スプレッドシートを新規作成し、「拡張機能 > Apps Script」でスクリプトを作成する（本アプリはスプレッドシートにバインドされた GAS を前提とします）。
2. `.clasp.json.example` を `.clasp.json` にコピーし、`scriptId` を作成した GAS プロジェクトの ID に書き換える。
3. `npm install` の後、`npm run deploy`（ビルド + `clasp push`）を実行する。
4. Apps Script エディタから「デプロイ > 新しいデプロイ > ウェブアプリ」で公開する。

ローカルでの動作確認は `npm run dev`（Vite）で行えます。GAS 外では保存先がブラウザの localStorage になります。

# Info

- Author: Satoru SATOH
- License: MIT
