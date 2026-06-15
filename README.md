# Lightning Bowl - A comprehensive bowling tracker

Lightning Bowl is a free app designed for bowlers of all skill levels, from beginners to pros. Behind a clean, intuitive interface it brings together everything you need to track and improve your game — from pin-by-pin score entry and deep statistics to your ball arsenal, oil patterns and a map of nearby alleys.

## Disclaimer

This project is provided under a custom license. You are welcome to fork this repository for personal use. Please see the [LICENSE](LICENSE) file for full details.

## Features

- **Flexible score entry** — tap a frame to type scores, or switch to **pin-by-pin input** on a full pin deck (track the pins you hit or the pins you leave), with a quick strike/spare toolbar, undo and a live max-score projection.
- **Single games & series** — log a single game or a **3, 4, 5 or 6-game series** with live series stats while you bowl.
- **Scoresheet OCR** — snap a photo of a printed scoresheet to auto-fill your scores (currently West-Bowl format), then fine-tune before saving.
- **Rich game tagging** — attach a league, oil pattern, ball(s), a note and a practice flag to every game.
- **Deep statistics** — averages, highs, totals, clean/perfect and special games (Dutch 200, Varipapa 300, all-spare), plus throw, strike, spare and pin-leave breakdowns with charts. Drill into **per-session** stats and **filter** by date, league, pattern, ball and more.
- **Game history** — a searchable, filterable log; swipe to share, edit or delete, and **export/import to Excel**.
- **Leagues** — create and manage leagues, view league-specific stats and hide the ones you’re not focused on.
- **Equipment** — browse a live ball catalogue (powered by bowwwl.com) with search, sort, filter and favorites; inspect RG, differential, core and coverstock; find balls with **similar movement, the same core or the same coverstock**; build your **arsenal**; and **compare balls** side by side with hook/length/flare metrics and a radar chart.
- **Oil patterns** — a searchable pattern library with length, volume and ratio details.
- **Find alleys** — a map of nearby bowling alleys with search and details.
- **Make it yours** — multiple color themes, a custom name, a spare-name reference and a “games to reach your goal average” calculator.
- **Cloud sync & backup** — keep your data safe and synced across devices.
- **Bowling minigame** — a quick built-in game for downtime at the lanes.

## Screenshots

### Add Games

Log games effortlessly on the "Add" page. Score by tapping frames or flip to **pin-by-pin input** on a full pin deck, using a quick strike/spare toolbar with undo. You can even upload a photo of your scoresheet to enter scores automatically via OCR (currently compatible with West-Bowl’s scoring system), then tag each game with a league, pattern, ball and note.

<img src="src/assets/screenshots/games/score-entry.png" alt="Pin-by-pin input" width="300"/>

### Series Play & Live Stats

Bowling more than one game? Switch between single and **3-4-5-6 series** modes and follow your series stats live as you go.

<img src="docs/screenshots/games/series.png" alt="Series mode" width="300"/> <img src="docs/screenshots/games/mode-select.png" alt="Series mode select" width="300"/>

### View Statistics

The "Stats" page turns your games into insight. Track average score, highs, totals, strike/spare/mark rates, clean and perfect games and special games, and see which pin counts you miss most. Dedicated Overall, Throws, Spares and Pins tabs each add their own breakdown.

<img src="src/assets/screenshots/statistics/overall.png" alt="Overall stats" width="300"/> <img src="src/assets/screenshots/statistics/throws.png" alt="Throw stats" width="300"/> <img src="src/assets/screenshots/statistics/spares.png" alt="Spare stats" width="300"/> <img src="src/assets/screenshots/statistics/pins.png" alt="Pin leaves" width="300"/>

### Charts & Trends

Scroll any tab and the numbers turn visual — a score trend over time, average-score progression, score and throw distributions, converted-vs-missed spares and pin-leave diagrams.

<img src="docs/screenshots/statistics/overall-scrolled.png" alt="Score charts" width="300"/> <img src="docs/screenshots/statistics/throws-scrolled.png" alt="Throw distribution" width="300"/> <img src="docs/screenshots/statistics/spares-scrolled.png" alt="Spare charts" width="300"/> <img src="docs/screenshots/statistics/pins-scrolled.png" alt="Pin leave diagrams" width="300"/>

### Sessions & Filtering

Zoom in on a single session with the date picker, or filter every stat — and your history — by date, league, pattern, ball and more.

<img src="docs/screenshots/statistics/sessions.png" alt="Session stats" width="300"/> <img src="docs/screenshots/statistics/filter.png" alt="Stats filter" width="300"/>

### Game History

In the "History" section, you’ll find a detailed log of all your past games. Swipe right to share, swipe even further to edit, or swipe left to delete. You can also export your game history to a readable Excel file or import games using the same format.

<img src="docs/screenshots/games/history.png" alt="Game history list" width="300"/> <img src="src/assets/screenshots/games/game-details.png" alt="Expanded scorecard" width="300"/>

### Leagues

Manage your leagues in the "Leagues" tab. You can add new leagues, view your performance within specific leagues, and see league-specific statistics. You can also hide leagues when longpressing the league.

<img src="src/assets/screenshots/leagues/list.png" alt="League list" width="300"/> <img src="docs/screenshots/leagues/detail-overall.png" alt="League detail" width="300"/> 

### Arsenal

Keep track of the balls you actually throw in the "Arsenal" section, accessible via the "More" tab. Add balls from the library or with the quick add-ball typeahead, and tap any ball to open its full detail — brand, core and coverstock specs and factory finish.

<img src="src/assets/screenshots/equipment/arsenal.png" alt="Arsenal" width="300"/> <img src="docs/screenshots/equipment/arsenal-add.png" alt="Add ball to arsenal" width="300"/> <img src="docs/screenshots/equipment/ball-details.png" alt="Ball detail" width="300"/>

### Ball Library

Browse a live, searchable catalogue of bowling balls (powered by bowwwl.com) with sort, filter and favorites. Each ball shows its RG, differential, core and coverstock specs, factory finish and length/flare potential — and you can add it straight to your arsenal.

<img src="src/assets/screenshots/equipment/ball-library.png" alt="Ball library" width="300"/> <img src="docs/screenshots/equipment/ball-filter.png" alt="Ball filter" width="300"/>

### Similar & Matching Balls

From any ball you can pull up balls with a **similar movement**, or that share the **same core** or **coverstock** — handy when you’re hunting for a benchmark or a replacement.

<img src="docs/screenshots/equipment/similar-balls.png" alt="Similar balls" width="300"/>

### Compare Balls

Put up to three balls head to head. The comparison view lines up their specs and rates hook, length and flare with a best-for lane-condition recommendation, while the chart tab plots them together on a radar chart.

<img src="src/assets/screenshots/equipment/comparison.png" alt="Ball comparison" width="300"/> <img src="docs/screenshots/equipment/comparison-chart.png" alt="Comparison chart" width="300"/>

### Pattern Library

Explore and search oil patterns in the "Pattern Library", accessible via the "More" tab. Open any pattern to see its length, volume and ratio, so you can prepare for different lane conditions.

<img src="src/assets/screenshots/patterns/library.png" alt="Pattern library" width="300"/> <img src="docs/screenshots/patterns/detail.png" alt="Pattern detail" width="300"/>

### Find Alleys

The map helps you discover bowling alleys near you. Browse the markers, tap an alley to see its details, or search a location to recenter the map.

<img src="docs/screenshots/alley-map/overview.png" alt="Alley map" width="300"/> 

### Settings

The "Settings" page allows you to personalize your experience. Customize your username and choose from a range of color themes to suit your style. You can also look up spare names or find out how many games you need to reach a certain average.

<img src="docs/screenshots/profile/settings.png" alt="App Screenshot" width="300"/> <img src="docs/screenshots/profile/theme.png" alt="Color theme picker" width="300"/>

### Cloud Sync & Backup

Keep your data safe and in sync across devices. Back up your games, leagues and arsenal to the cloud and restore them whenever you need.

<img src="docs/screenshots/profile/cloud-sync.png" alt="Cloud sync" width="300"/>

### Bowling Minigame

Waiting for your turn at the alley? Take a few shots in the built-in bowling minigame.

<img src="docs/screenshots/minigame/play.png" alt="Bowling minigame" width="300"/>

## Contributing

Currently i don't want anybody to contribute yet. But i am free for suggestions and feature request.

## Feedback

If you have any feedback, please reach out to us at lightningbowlapp@gmail.com

## Run Locally

Clone the project

```bash
  git clone https://github.com/HappyKnuckles/bowling-stats.git
```

Go to the project directory

```bash
  cd bowling-stats
```

Install dependencies

```bash
  npm install
```

Start the server

```bash
  ionic serve
```
