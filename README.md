# ADOBO YEP 2026: Paskong Feud

A Family Feud game for the ADOBO Year-End Party 2026, in a denim-and-white Christmas theme.
It is built on the same engine as the Anime Matsuri Feud: plain HTML/CSS/JS with no build step and nothing to install.

## Pages
| URL | What it is |
|---|---|
| `/` | **Host console**: the live stage, host controls, and the answer key |
| `/?view=board` | **Audience screen** for the projector or TV. It opens with the *Audience screen* button. Press **F** for fullscreen. |
| `/admin` | **Organizer admin** (PIN `adobo2026`): edit questions, survey points, the round lineup, and team names |

## Step-by-step: from now to party night

### 1. Run your survey (about 1 week before)
- Send the 8 questions to people who are **not** playing, using Google Forms or MS Forms.
- Count how often each answer comes up. Group similar answers together (for example, "Masahe" and "Hilot").
- Keep the top 8 answers for each question. Each answer's points = the number of people who gave it (or its percentage).
  Keep each question's total at about 100 points or less.

### 2. Put the real answers into the game
- Open `/admin` and sign in with PIN `adobo2026`.
- **Question bank**: open each question and replace the sample answers and points. Click **Sort by points**.
- **Main-game rounds**: choose the order and multipliers. The default is 8 rounds (×1 ×1 ×2 ×2 ×2 ×2 ×3 ×3).
  If time is short, remove a few rounds and keep about 5.
- Set the **team names** under *Event*, then click **Save**.
- Click **Export JSON** and keep the file. Admin edits are saved only in that browser, so if the game will run on
  another laptop, use **Import JSON** there.

### 3. Deploy to Vercel (same as last time)
1. Create a new GitHub repo (for example, `adobo-yep-2026-feud`) and push this folder to it:
   ```
   git init && git add . && git commit -m "ADOBO YEP 2026 feud"
   git branch -M main
   git remote add origin https://github.com/<you>/adobo-yep-2026-feud.git
   git push -u origin main
   ```
2. In Vercel, go to **Add New → Project** and import the repo. Set **Framework preset: Other**, leave the build command
   empty, and keep the output directory at the root. Then click **Deploy**.
3. Optional: in **Settings → Domains**, rename the project URL (for example, `adobo-yep-2026.vercel.app`).
4. Any later `git push` to `main` redeploys the game automatically.

### 4. Rehearse (the day before)
- On the **party laptop**, open the Vercel URL, then open `/admin` and import your JSON (or re-enter your edits). Click **Save**.
- On the host console, click **New game** so it loads the saved questions.
- Connect the projector as an **extended** display (Win + P → *Extend*).
- Click **Audience screen**, drag that window to the projector, click it once to enable sound, then press **F**.
- Play one round all the way through to test the sound, strikes, and reveals.

### 5. Party night
- Host console on the laptop screen, audience screen on the projector.
- Flow: **Title → Teams** (type the player names) **→ Rules → Round intro → Board**, and so on.
- Keys: **1–8** reveal answers · **X** strike · **Enter / →** next · **Ctrl+Z** undo.
- Face-off: reveal the answer someone gives, then click the team that will **PLAY**.
  After 3 strikes the other team gets one steal guess.
- If the page refreshes, the game picks up where it left off.

## Default lineup
| Round | Points | Question |
|---|---|---|
| 1 | ×1 | Pagkaing Pinoy na inuulit ang pangalan. |
| 2 | ×1 | Bukod sa may sakit, bakit ka nagle-leave sa trabaho? |
| 3 | ×2 | Pinakasikat na loveteam sa Pilipinas sa lahat ng panahon? |
| 4 | ×2 | Anong anime ang may pinakamagandang Episode 1? |
| 5 | ×2 | Paboritong gawin ng mga babae kapag magkakasama. |
| 6 | ×2 | Magbigay ng Marvel character na patay na (sa ngayon). |
| 7 | ×3 | Magbigay ng bagay na masakit pero masarap. |
| Final | ×3 | Magbigay ng bagay na pinapasok sa katawan ng tao. |

The bank also has 2 spare Christmas rounds (Noche Buena and exchange gifts) and 5 Christmas Fast Money questions.
Fast Money is **off**. You can turn it on in `/admin`.

> ⚠️ The answers were chosen with web research, but the **points are estimates**. Replace them with your real survey results.
> Avengers: Doomsday opens Dec 18, 2026, so re-check the Marvel answers if the party is after that date.

The game screens are in Tagalog. The organizer admin page stays in English.

## Run locally
`python -m http.server 8766` in this folder, then open http://127.0.0.1:8766/ (use `admin.html` locally).

## Notes
- The admin PIN is a client-side gate (only a SHA-256 hash is in the source). It is fine for a party game but it is not real security.
- Saved data uses its own keys (`adobo-feud.*`), so it never mixes with the Anime Matsuri game in the same browser.
