# Emberhold — Game Concept

A free-to-play village builder in the mold of Clash of Clans. You start with a
campfire and a pile of logs, build a village, raise an army, raid other players,
and climb through Hall tiers. The early game is fast and generous. The late game
is deliberately, unapologetically grindy: upgrades take days, resources take
dozens of raids to gather, and the whole design leans into that slow burn.

The grind is not an accident. It is the product. This document explains the
loop, the systems, and exactly how the curve goes from "an upgrade every two
minutes" to "an upgrade every two weeks".

---

## 1. Pitch

- **Genre:** Base builder / asynchronous PvP raider (mobile-first, portrait).
- **Session shape:** Many short sessions a day (2 to 5 minutes) with a few
  longer ones on the weekend.
- **Fantasy:** You are the steward of a frontier settlement in a volcanic
  valley. Every Hall tier is a chapter in that settlement's story.
- **Hook:** Something is always cooking. Every time you open the app, at least
  one timer is close to finishing, one collector is close to full, or one raid
  shield is close to expiring.
- **Differentiator:** A storyline layer (see §9) that frames the grind as a
  saga. Each Hall tier unlocks a chapter, each chapter has a named antagonist,
  and the long upgrade waits are narrated by your villagers.

---

## 2. Core Loop

```
                 ┌──────────────────────────────────┐
                 │                                  │
                 ▼                                  │
   Collect resources ──► Queue upgrades ──► Wait (timers)
          ▲                                         │
          │                                         ▼
   Raid other villages ◄── Train troops ◄── Unlock new stuff
          │
          ▼
   Get raided (lose some resources, shield kicks in)
```

The loop in one sentence: gather, spend, wait, raid to gather faster, repeat.

Three sub-loops run at different speeds:

| Loop         | Cadence        | What drives it                                    |
|--------------|----------------|---------------------------------------------------|
| Minute loop  | every 2–5 min  | collectors fill, troops finish training           |
| Hour loop    | every 1–8 h    | building upgrades finish, shield expires          |
| Day loop     | every 1–14 d   | Hall upgrades, hero upgrades, clan war rounds     |

Early game, all three loops are compressed into the minute loop. Late game,
the minute loop is just raiding and the day loop is where progress actually
lives.

---

## 3. The Village

### 3.1 Hall tiers

The Ember Hall is the central building. Its level gates everything else:
which buildings exist, how high they go, how many of each you can place.

| Hall | Name in-story         | Build time | Cost (Stone) | Rough real time to reach |
|------|-----------------------|-----------:|-------------:|-------------------------:|
| 1    | The Campfire          | instant    | 0            | 0                        |
| 2    | The Palisade          | 10 s       | 500          | 5 minutes                |
| 3    | The Longhouse         | 15 min     | 4,000        | 1 hour                   |
| 4    | The Watchtower Town   | 2 h        | 25,000       | 1 day                    |
| 5    | The Stone Keep        | 8 h        | 150,000      | 4 days                   |
| 6    | The Walled Borough    | 1 d        | 750,000      | 2 weeks                  |
| 7    | The Iron Bastion      | 2 d        | 2,000,000    | 5 weeks                  |
| 8    | The Ember Citadel     | 4 d        | 4,500,000    | 10 weeks                 |
| 9    | The Obsidian Crown    | 7 d        | 8,000,000    | 5 months                 |
| 10   | The Caldera Throne    | 12 d       | 14,000,000   | 10 months                |
| 11   | The Ashen Dominion    | 14 d       | 20,000,000   | 16 months+               |

"Rough real time" assumes a free player who logs in 4 to 6 times a day and
upgrades sensibly. A paying player compresses it but never skips it entirely.

### 3.2 Building categories

- **Resource buildings:** Quarry (Stone), Lumber Camp (Wood), Emberwell (Ember,
  a late-game resource), plus a Storehouse per resource type.
- **Army buildings:** Barracks, Training Yard (unit upgrades), Stable, Forge
  (spells/siege), Hero Altar.
- **Defenses:** Archer Post, Catapult, Ballista, Oil Cauldron, Ember Cannon,
  Walls, Traps.
- **Utility:** Clan Hearth (clan membership and troop donations), Builder's
  Hut (one per builder), Laboratory (research).

Each building has 10 to 15 levels. The Hall caps every building's max level,
so the "ceiling" rises in steps, not continuously.

### 3.3 Builders

You start with 2 builders. A third is cheap. The fourth and fifth cost premium
currency (Ash) and are the single biggest quality-of-life purchase in the game.
With 2 builders at Hall 8, you are permanently bottlenecked. This is the main
place the grind becomes visible to the player, and the main place they are
nudged to spend.

---

## 4. Resources

| Resource | Source                       | Spent on                         | Unlocks at |
|----------|------------------------------|----------------------------------|-----------:|
| Wood     | Lumber Camps, raids          | Army, resource buildings, traps  | Hall 1     |
| Stone    | Quarries, raids              | Defenses, walls, Hall            | Hall 1     |
| Ember    | Emberwells, raids (small)    | Heroes, top-tier troops, research| Hall 6     |
| Ash      | Premium; tiny trickle from   | Skip timers, extra builders,     | Hall 1     |
|          | achievements and obstacles   | resource packs                   |            |

Design notes:

- **Wood and Stone are symmetrical** in the early game so the player always
  has something to spend. By Hall 5 they diverge: Stone becomes the bottleneck
  because walls and defenses eat it, and raiding for Stone becomes the daily
  chore.
- **Ember is the late-game wall.** It is produced slowly, raids yield very
  little of it, and everything prestigious costs it. It arrives exactly when
  the player has become competent at the game and needs a new reason to keep
  logging in.
- **Storage caps are the hidden grind.** You cannot save up for a 2M Stone
  upgrade until your Storehouses hold 2M. Upgrading Storehouses costs Wood,
  which means raiding for Wood before you can even start raiding for Stone.
  This two-step dependency is one of the most effective "one more session"
  devices in the genre.

---

## 5. Upgrades and Timers

### 5.1 The curve

Every building follows the same shape:

```
cost(level)  = base_cost  * 1.65 ^ (level - 1)
time(level)  = base_time  * 1.80 ^ (level - 1)   (clamped by Hall tier)
```

The time multiplier is intentionally higher than the cost multiplier. Early
on, you are resource-limited (you wait for collectors). Later, you are
time-limited (you have the resources, you wait for builders). The transition
point is roughly Hall 5. From then on, the player is never really short of
things to do, only short of builders and days.

A worked example, Archer Post:

| Level | Cost (Stone) | Time    |
|------:|-------------:|---------|
| 1     | 1,000        | 1 min   |
| 3     | 2,700        | 3 min   |
| 5     | 7,400        | 10 min  |
| 7     | 20,000       | 35 min  |
| 9     | 55,000       | 2 h     |
| 11    | 150,000      | 7 h     |
| 13    | 410,000      | 22 h    |
| 15    | 1,100,000    | 3 d     |

### 5.2 Why the grind works (and doesn't just annoy)

The design has to make the long wait feel like investment, not punishment.
Four rules:

1. **Always visible progress.** Every timer shows a progress bar on the map.
   Scaffolding grows as the timer ticks. Villagers walk in and out carrying
   stone.
2. **Never a dead session.** Even at Hall 10 with every builder busy, a
   session has: collect resources, do one raid, donate troops to the clan,
   check the daily quest. Five minutes, every time.
3. **Chunked goals.** The UI never shows "14,000,000 Stone needed". It shows
   "Raid 12 more times" or "3 collections away". The player is always a
   small number away from something.
4. **Stacked timers.** Upgrades are queued so that something finishes on
   every natural check-in: one at breakfast, one at lunch, one at bedtime.
   The new-player flow teaches this explicitly ("Start a long one before you
   sleep!").

### 5.3 Skipping

Any timer can be finished instantly with Ash. Price scales with remaining
time, roughly 1 Ash per 3 minutes early on, flattening to 1 Ash per 10
minutes for multi-day timers. The player always sees both "wait 3d 4h" and
"finish now for 420 Ash" side by side.

---

## 6. Raiding

### 6.1 Attacking

- Scout a random opponent of similar Hall tier (a matchmaking band of ±1).
- See their full village before committing. Can "Next" for a small Wood fee.
- Deploy troops by tapping. Troops are fire-and-forget with simple AI
  (nearest building, prefer defenses, prefer resources).
- 3 minutes max. Earn up to 3 stars: 50% destroyed, Hall destroyed, 100%.
- Loot a percentage of their stored resources (collectors are juicier than
  storehouses, so inactive players with full collectors are prime targets).

### 6.2 Defending

- When attacked you are offline. You get a replay and a notification.
- Losing a raid gives you a **shield** (8h for a heavy loss, 2h for light) during
  which you cannot be attacked. Attacking someone yourself drops your shield.
- Walls, traps, and defenses do the work. Layout is the player's expression
  of skill.

### 6.3 Troops

Troops are consumed on use and must be retrained (Wood cost, timer). This is
the clearest "raid cost" lever and the reason raiding never becomes free.

| Troop          | Role                     | Unlock   | Housing |
|----------------|--------------------------|----------|--------:|
| Militia        | cheap meat               | Hall 1   | 1       |
| Slinger        | ranged chip damage       | Hall 2   | 1       |
| Goat Rider     | fast, targets defenses   | Hall 3   | 3       |
| Sapper         | explodes on walls        | Hall 4   | 2       |
| Shieldbearer   | tank                     | Hall 5   | 5       |
| Ember Mage     | AoE splash               | Hall 6   | 4       |
| Cinder Wyrm    | flying, ignores walls    | Hall 8   | 12      |
| Obsidian Golem | siege tank               | Hall 9   | 25      |

Each troop has 8 upgrade levels researched in the Laboratory. Research uses
the same cost/time curve as buildings, and the Lab can only research one
thing at a time. This is a second builder-style bottleneck.

### 6.4 Heroes

Unlocked at Hall 7 (Warden) and Hall 9 (Ember Witch). Heroes are reusable,
regenerate instead of dying, and have 40 levels each costing Ember. Hero
levels are the single longest grind in the game: fully maxing both heroes at
Hall 11 is roughly 80 days of continuous upgrade time plus the Ember farming
to pay for it.

---

## 7. The Grind, Phase by Phase

This is the heart of the concept. The same loop is tuned to feel different at
each stage.

### Phase 1 — Honeymoon (Hall 1–3, first hour)

- Upgrades finish in seconds to minutes.
- Tutorial raids are scripted and always won.
- Resources are handed out faster than you can spend them.
- Goal: teach the loop, make the player place 20+ buildings, give them
  ownership of a layout.
- Grind level: none.

### Phase 2 — Rhythm (Hall 4–5, days 1–7)

- Upgrades take 30 min to 8 h. The player learns to queue before sleeping.
- First real raids against real players. First time being raided.
- First real shortage: Stone. First real taste of "I need 3 more raids".
- Clan joining is pushed hard here (Clan Hearth unlocked at Hall 3, nagged at
  Hall 4). Retention data in this genre says a clanned player at day 7 is
  worth several unclanned ones.
- Grind level: pleasant. Feels like a hobby.

### Phase 3 — The Wall (Hall 6–7, weeks 2–8)

- Ember unlocks. The player discovers a resource they can barely earn.
- Hall 6 costs 750k Stone. Storehouses must be upgraded first. The player
  spends a week just enabling the ability to save for the upgrade.
- Builders are all busy, always. The 4th builder becomes the obvious purchase.
- Walls: 250 segments, each needing individual upgrades. Wall grinding is the
  canonical "I have 10 minutes and 80k Stone, let me upgrade 3 walls"
  activity. It is deliberately a bottomless resource sink.
- Grind level: visible. This is where churn is highest, and where the
  storyline (§9) and clan wars (§8) must carry the player.

### Phase 4 — The Long Haul (Hall 8–10, months 3–12)

- Upgrades take 3 to 12 days. A builder does maybe 2 jobs a week.
- A full Hall tier is 60 to 100 upgrades. The player does the math and
  realizes this is a year.
- Play becomes a routine: morning collection + 2 raids, evening collection +
  3 raids + clan war attack. 15 minutes a day.
- Hero upgrades sit at 7 days each. Heroes are unusable while upgrading, which
  hurts raiding, which slows Ember farming, which slows hero upgrades. The
  loop deliberately eats its own tail here.
- Grind level: severe, and openly so. The game stops pretending. The chapter
  titles for these tiers are literally "The Long Watch" and "Years of Ash".

### Phase 5 — Maxed (Hall 11, year 2+)

- The player has nothing left to build. Progress shifts entirely to clan
  wars, leagues, and cosmetics.
- New Hall tiers are released roughly every 6 to 9 months to re-open the
  grind for this cohort.

---

## 8. Social Layer

- **Clans:** up to 50 members. Troop donation (request, members fill it, donor
  gets XP). Clan chat. Shared Clan Hearth level that gives small perks.
- **Clan Wars:** 2-day events. Day 1 is preparation (scout the enemy clan's
  bases, donate defensive troops), day 2 is battle (each member gets 2
  attacks). Stars are tallied. Winning clan gets a loot bonus proportional to
  stars earned.
- **Leagues:** trophies from raids place you in Bronze through Obsidian
  leagues. Higher leagues give better loot bonuses per raid. Trophies decay
  weekly to force continued play.
- **Friendly challenges:** attack a clanmate's base with no loot or trophy
  stakes. Used for testing layouts.

---

## 9. Storyline Layer

This is the thing that distinguishes Emberhold from a plain clone. Every Hall
tier is a chapter. Every chapter has:

- **A named antagonist clan** controlled by the game (the Ashborn, the Hollow
  Court, the Cartographers of the Rift...). Their bases appear as campaign
  raids you can attack for a one-time loot bounty. These are single-player
  puzzle bases with scripted layouts.
- **Villager dialogue.** Four named villagers (the Quartermaster, the Warden,
  the Child, the Old Mason) comment on what you're building. The dialogue is
  tied to timers: "Three more days on the Keep, steward. The Mason says the
  foundations are the slow part." This turns the wait into narrative.
- **A chapter goal.** Not just "reach Hall 7" but "reach Hall 7 and defeat the
  Hollow Court's siege base". Chapter completion gives a cosmetic (banner,
  Hall skin) and a lump of Ash.
- **Seasonal arcs.** Every 2 months a story event: a 4-week series of campaign
  raids with a seasonal reward track. Players at any Hall tier can
  participate at scaled difficulty. This is the retention mechanism for
  Phase 3 and 4 players: when your builders are busy for 5 days, there is a
  story thread to pull on.

The story never blocks progression and never requires reading. A player who
skips every dialogue box loses nothing mechanically. The player who reads
them gets a reason to care about Hall 9.

---

## 10. Monetization

Free to play. Ash is the premium currency.

| Item                     | Ash   | Approx. USD | Notes                                 |
|--------------------------|------:|------------:|---------------------------------------|
| Pocket of Ash            | 80    | $0.99       | Welcome offer, 1x                      |
| Sack of Ash              | 500   | $4.99       |                                        |
| Crate of Ash             | 1,200 | $9.99       |                                        |
| Chest of Ash             | 2,500 | $19.99      |                                        |
| Vault of Ash             | 14,000| $99.99      |                                        |
| 3rd Builder's Hut        | 500   |             | Available Hall 2                        |
| 4th Builder's Hut        | 1,000 |             | Available Hall 4                        |
| 5th Builder's Hut        | 2,000 |             | Available Hall 6                        |
| Ember Pass (season)      |       | $5.99       | 4-week reward track, +10% builder speed |
| Hall skins               | 1,500 |             | Cosmetic only                           |

Principles:

- **No pay-to-win troops.** Everything in combat is earnable. Paying buys
  time, not power.
- **Builders are the honest sell.** A 4th and 5th builder is the purchase
  that most directly reduces the grind, and the game is upfront about that.
- **Shields are purchasable** (1-day, 2-day, 7-day) for people going on
  holiday. This is a goodwill item more than a revenue item.
- **The grind is the funnel.** Phase 3 (the Wall) is where the free player
  either converts, joins a clan and settles into the routine, or churns. The
  design accepts all three outcomes and optimizes for the first two.

---

## 11. Retention Mechanics

| Mechanic                  | Purpose                                             |
|---------------------------|-----------------------------------------------------|
| Push notifications        | "Your Quarry is full", "Upgrade complete", "You were raided" |
| Daily quests              | 3 per day, reset at local midnight, give Ash trickle |
| Login streak              | 7-day calendar, day 7 is a Builder Potion (1h of double speed) |
| Clan war schedule         | Fixed 48h cadence gives a reason to open the app twice a week minimum |
| Trophy decay              | Forces raiding even when not upgrading               |
| Obstacles                 | Rocks and trees spawn on the map; clearing them gives 1–6 Ash and costs Wood. A tiny dopamine hit per session |
| Seasonal story arcs       | Covers the dead zone when all builders are on multi-day jobs |

---

## 12. Tuning Knobs

Numbers that get adjusted in live ops, in priority order:

1. Hall tier build times (the single biggest lever on pace).
2. Loot percentage from raids (governs how many raids per upgrade).
3. Ember production rate.
4. Builder count and builder prices.
5. Storage cap curve.
6. Shield durations.

Everything above is a starting guess, not a final balance.

---

## 13. MVP Scope

To get a playable vertical slice:

- Hall 1 through 5.
- 6 building types: Hall, Quarry, Lumber Camp, Storehouse, Barracks, Archer
  Post, Walls.
- 3 troops: Militia, Slinger, Goat Rider.
- Raiding against pre-built AI villages (no real PvP yet).
- Timers, resource collection, one builder plus purchasable second builder.
- Local save. No clans, no heroes, no Ember, no story.

Success metric for the slice: a tester plays for 3 real days without being
told to and asks when the next Hall tier is coming.

---

## 14. Open Questions

- Should walls be individually upgradeable (the authentic grind) or
  upgraded in rings (friendlier, less sticky)?
- Does Ember unlock at Hall 6 or Hall 7? Hall 6 is where the churn spike is,
  and introducing a scarce resource at the same moment may compound it.
- How much of the story layer is voiced versus text? Voiced villagers are
  costly but make the timer-narration land much better.
- Do heroes become usable during upgrades (less grind, less sting) or not
  (authentic, harsh)? Leaning toward "usable at half level" as a middle
  ground.
