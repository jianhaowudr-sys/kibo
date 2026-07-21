# 部署身分證 — Kibo 健身 (kibo)
> 這個專案「用哪個帳號、部到哪、怎麼部」的唯一權威記錄。部署前先看這份。

| 欄位 | 值 |
|---|---|
| 平台 | Expo (EAS Build / EAS Submit) |
| 帳號 / 團隊 | EAS 登入帳號：**`jianhaowu.dr`**（Owner；同時擁有組織 `@jianhaowudrs-organization`）— 2026-07-21 以 `eas whoami` 確認。Apple：appleTeamId `XGY266T6Y8`、appleId `m013020082@gmail.com`。<br>⚠️ 注意本機還有另外兩個身分容易混淆：git push 憑證是 **`jianhaowudr-sys`**（GitHub，已 per-project 綁定）、git commit 署名是 `JJGOD2`。另有 `zhuoyiclinic-coder`（琢藝專案，**與 kibo 無關**）。 |
| 專案名稱 / ID | EAS project `kibo`；EAS projectId `741662aa-5bb4-4554-8df3-166a7957dd39` |
| 線上網址 | iOS：App Store（bundleId `app.kibo.fitness`、ascAppId `6764039298`）；Android：Google Play（package `app.kibo.fitness`） |
| 部署方式 | EAS build（雲端打包）＋ EAS submit（上架商店） |
| 部署指令 | 打包：`eas build -p all --profile production`；上架 iOS：`eas submit -p ios --profile production`；上架 Android：`eas submit -p android --profile production` |
| Git 遠端 | `github.com/jianhaowudr-sys/kibo`（分支 `main`）|
| 後端 / DB | Supabase（`@supabase/supabase-js`；schema 見 `.supabase-tables.sql` / `supabase/`） |
| 密鑰位置 | EAS Secrets / EAS 環境變數；Android 上架金鑰 `google-play-service-account.json`（未提交）；`.pgyer-keys.json`（未提交）；勿提交 |

## 部署前檢查（避免部錯帳號）
1. `git remote -v` 確認 origin 是 `github.com/jianhaowudr-sys/kibo`
2. `eas whoami` 確認登入的是 `@jianhaowudrs-organization`（projectId `741662aa-...`）；submit 前再確認 Apple（`XGY266T6Y8` / `m013020082@gmail.com`）與 Google Play service account 是同一組帳號
3. 確認帳號與你當下一致，再執行 build / submit 指令
> ⚠️ 不要把任何 token/密鑰寫進這份檔案或提交到 repo。（`google-play-service-account.json`、`.pgyer-keys.json`、EAS secrets 一律不入 repo）
