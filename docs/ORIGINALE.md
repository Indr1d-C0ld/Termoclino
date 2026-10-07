> Catalogo delle schermate del gioco originale catturate in DOSBox il 07/10/2026 (versione DOS, `GAME.EXE` del 12/06/1989, VGA, 3000 cicli fissi). Le 103 immagini citate per nome stanno in `privato/schermate_dosbox/catalogo/`: sono grafica originale e non vanno nel repo pubblico.

# 688 Attack Sub (EA / John W. Ratcliff, 1989) - visual catalogue of screens and stations

Reference material for a faithful tribute. Everything below was captured by actually running the
original DOS game (copy of `/percorso/della/copia/688/`) in DOSBox 0.74-3 under a
private Xvfb display.

## 0. Setup used, files

| Item | Value |
|---|---|
| Emulator | DOSBox 0.74-3, `machine=svga_s3`, `core=normal`, `cycles=fixed 3000`, sound off (`nosound=true`), `scaler=none` |
| Start command | `688 40` (graphics 4 = VGA/MCGA 256 col, sound 0 = internal speaker), i.e. `TITLE.EXE 40` then `GAME 4` |
| Config | `schermate/dosbox.conf`, helper shell functions in `schermate/env.sh` |
| Final screenshots | `schermate/../privato/schermate_dosbox/catalogo/NNN_name.png`, 103 files, native **320x200** (mode 13h). One file (`101`) is 640x400 because the boss key switches to text mode |
| Contact sheet | `schermate/indice_contact_sheet.png` (all 103 thumbnails with names) |
| Working material | `schermate/raw/` (every intermediate grab, incl. full help sequences `raw/help_conn/`, `raw/help_sonar/`, `raw/help_alfa_conn/`, full mission-order scrolls `raw/orders1/`, `raw/orders_alfa/`, time series `raw/cav/`, `raw/tc/`, `raw/torp/`, `raw/guid*/`, `raw/srch/`, `raw/dive*/`); `schermate/view/` = 3x upscaled previews |

3000 fixed cycles worked well: the in-game clock ran 1:1 with wall-clock time, no glitches, and
mouse plus keyboard both worked. Mouse note: with `autolock=false`, DOSBox maps the host pointer
to the game cursor as `game_x = 0.95*host_x - 1` and `game_y = host_y` (the game's mouse range is
narrower than 320).

Copy protection: the game asks for the keycode in the Radio Room, not at boot. The prompt is
"`<SUB NAME>: <sentence fragment> ???`" and you enter the first 3 letters of the next word of the
manual paragraph tagged with that 688-class boat name. Examples seen: MIAMI "For this, you can be
at any depth and you ???" gives **DON**; CITY OF CORPUS CHRISTI "In both instances, one player ???"
gives **WIL**. The code is asked **only once per program run**: after "Play again" the uplink is
already established. The sonar-signature sheet from the docs is **not** used as copy protection,
but it matches the in-game analyzer (see 048).

---

## 1. The common "station frame" (all 688 stations except CONN, Radio, Status)

Most screens share one fixed skeleton. It is described once here and referenced as **[FRAME]**
below. Coordinates are native 320x200 pixels (x,y), approximate to +/-2 px.

* **Target information bar** (static art plus dynamic text, y 3-17, full width, black with a grey bevel):
  * Line 1 `TARGET:` label in red `#ff5555`. The value is in magenta `#ff55ff`, e.g.
    `C: FORREST SHERMAN CLASS DESTROYER`, `E: MARK 48 TORPEDO`, `CONTACT HAS BEEN LOST`,
    `UNKNOWN SURFACE CONTACT`.
  * Line 2 has red labels `BEARING: RANGE: COURSE: SPEED: DPT:` with magenta values. Depth is
    followed by `FT` in cyan. Bearing is relative to the bow (000-359 deg). Range is in nm with one
    decimal; ranges under 1 nm show as `.4`, where the dot is barely visible and reads like "4".
    On the Status panel the labels become `VIEW:` and `DEPTH:`.
* **Map window** (x 7-176, y 26-129, about 168x102, inside a double bevelled frame). It is 100%
  dynamic: the top-down map, the contour image, the periscope view, or a crew photo.
  * The **HUD** overlay is toggled with H. It contains:
    * A magenta compass tape at top centre (x 66-122, y 30-34) with minor ticks, a white triangle
      for own course and cardinal letters (`N`, `NW`, `W`, `SE`...) in cyan-white below.
    * A depth ladder on the right (x 163-170, y 43-108): magenta ticks, a green marker for own
      depth and a red marker for the depth of the bottom below. A longer tick (a short horizontal
      bar sticking out right) marks a thermal layer.
    * A periscope-direction word top-left in magenta (`PORT`, `STARBRD`, `AFT`; blank = forward).
  * Bottom strip inside the window (y 121-128): `CRS:320deg SPEED:0 DEPTH:20FT`. Labels are white
    and values cyan `#55ffff`. Speed is shown as `33.8`, `37.0`, `.7` and so on.
* **Map display control pad** (x 5-42, y 133-167): a 3x3 grid of cyan buttons with dark-blue
  letters `P F S / I H O / C B T`. Port / Forward / Starboard contour view, zoom In, HUD,
  zoom Out, Contour imaging, Bottom shading, Top-down map.
* **Information (crew message) bar** (y 172-182, black): crew messages in large white letters that
  scroll right-to-left, e.g. `TORPEDO LAUNCHED CAPTAIN`. During a crosshair action it shows the
  crosshair's map coordinates instead.
* **Status bar** (y 185-196, black): own position `03:05:36` + yellow `X`, `00:45:52` + yellow `Y`
  (map grid coordinates in a deg:min:sec-like format), and mission time `HH:MM:SS`. In the Radio
  Room before the mission starts this row reads `SPACE TO PAUSE` in magenta.
* **Panels** are static art in light grey `#aaaaaa` with dark-grey `#555555` bevels, black outer
  lines and small "screw" marks in the corners. Titles are engraved dark-grey on grey. Buttons
  come in three styles: (a) small square lamp buttons (cyan, red, green, blue), (b) black
  rectangular "screen" buttons with cyan-blue text (`TARGET`, `ON/OFF`, `DOWN/UP`, `BAND PASS`),
  (c) red `LAUNCH` with yellow text and yellow/black hazard-striped `DETONATE` /
  `EMERGENCY SURFACE`.
* **Cursor**: an arrow pointer whose colour changes per control group (white, blue, magenta,
  yellow, green, cyan). The control under the cursor is highlighted magenta.
* **Palette**: the whole UI uses the 16 EGA colours (`#000000 #0000aa #00aaaa #555555 #aaaaaa
  #ffffff #ff5555 #ff55ff #55ffff #55ff55 #ffff55`...). Only the map, the periscope picture, the
  crew photos and the CONN backdrop use extra VGA colours. Sea-depth shades go from shallow to
  deep: `#dfffff #9af3ff #51b2ff #4d92ff #4d82ff #45459a`. Land is `#86b600` with a `#38b600` edge.

---

## 2. Screenshot catalogue

### Front end

| File | How reached | Description |
|---|---|---|
| `001_title.png` | Launch `688 40` (TITLE.EXE) | Photo-realistic painting of a 688 surfacing bow-first through white spray on a dark sea. Red "ELECTRONIC ARTS" text, big white "688 ATTACK SUB" title with a blue shadow, blue "BY JOHN W. RATCLIFF". "PRESS A KEY TO BEGIN MISSION SELECTION" in white. Red copyright line at the bottom with the EA logo. Fully static (TITLE.PAK/PAL). |
| `002_mission_selection.png` | Any key on the title | Grey screen. "MISSION SELECTION" plaque at top. Left panel lists `1. TORPEX '89` ... `0. HIT AND RUN` in a white outlined font. A **lightning-bolt icon** marks the modem-playable missions (1,2,5,7,8,9). Right panel has a blue `688` button column and a red `ALFA` button column (mission 1 offers `688` vs `700` = USS Dallas, mission 3 is Alfa only, missions 4,6,0 are 688 only). The pointer changes to blue or red over the buttons. Up/Down arrows or Tab cycle through the buttons; Enter or click selects. |
| `003_config_panel.png` | Select a mission | "CONFIGURATION PANEL" with the mission name top-left. Six bevelled groups: BEGIN GAME / MISSION SELECTION / EXIT TO DOS (green/red lamps); DEFAULT SOUND / COVOX ON LPT1 / LPT2; NO MODEM / MODEM ON COM1 / COM2 (magenta lamps, lightning icons); SET PLAY LEVEL STANDARD / BEGINNER (cyan); SET TELEPHONE NUMBER, 11 cyan digit boxes each with `UP` above and `DN` below; ORIGINATE / AUTO-ANSWER / MANUAL ANSWER (blue). The active option's lamp is brighter. The choices are saved to PROFILE.688 (the copy changed from STANDARD to BEGINNER). |
| `004_conn_688.png` | BEGIN GAME | **688 CONN** (main menu, game paused). Full-screen painted control room: the periscope column in the centre with a purple pod, the plotting table with a sea map in the foreground, a smoking officer on the left, a sonarman with a headset at bottom right, crewmen at consoles in the back. No HUD or text. The hotspots (found with F1 / Tab) are: **Radio Room** = left wall hatch (lightning cursor), **Ship's Control** = left/centre consoles (crosshair cursor), **Periscope** = centre column, **Navigation** = plotting table, **Weapons** = right-centre consoles, **Sonar** = right wall hatch (headphones cursor), **Exit** = small `EXIT` tag top-left. Each hotspot turns the cursor into a small station icon. |
| `005_help_conn_intro.png` | F1 in CONN | A white text box over the CONN: "688 ATTACK SUB / WRITTEN BY JOHN W. RATCLIFF / COPYRIGHT 1989" with a small 688 profile picture. Space advances, Esc exits. The next pages show "USER INTERFACE" text, then "WATCH THE COMPUTER TAB THROUGH THE ACTIVE HOTSPOTS" (an automatic cursor demo), then one box per station (full sequence in `raw/help_conn/`). |
| `006_help_conn_station_radio.png` | F1, Space x n | Station help box "RADIO ROOM:R:F2 - The radio room provides for both satellite communications capabilities as well as chat mode in the modem game". The other boxes say: SHIPS CONTROL PANEL:T:F4, PERISCOPE:P:F5, NAVIGATION:N:F6, WEAPONS CONTROL PANEL:W:F7, SONAR ROOM:S:F8, EXIT:X:0. |
| `007_help_station_button_popup.png` | F1 inside a station (Sonar) | In-station help: the cursor jumps to each control in turn and a white popup names it with its hotkey ("BUTTON P / LOOK TO PORT IN CONTOUR MODE", "TARGET:6 BUTTON", "FILTER:2", "TARGETING PULSE:2", "DEPLOY ARRAY:2", "ANALYZE:3", "EXIT:X:0"). The game clock is frozen during help. |

### Radio Room (F2)

| File | How reached | Description |
|---|---|---|
| `008_radio_keycode.png` | F2 at mission start | Top: target bar (empty). Middle: **message window** (x 5-313, y 25-110), dark grey `#555555`, with text printed by a teletype printhead sprite that runs along a rail at y 97. Green "ESTABLISHING SATELLITE UPLINK.... / SATELLITE UPLINK ESTABLISHED / SECURITY ACCESS KEYCODE FOLLOWS:" and the white challenge "MIAMI: FOR THIS, YOU CAN BE AT ANY DEPTH AND YOU ???". Bottom panels: (1) three letter boxes (white on black, starting at `A`) with green brackets and left/right arrow buttons below, `SEND CODE` with a red lamp; (2) `MSG REVIEW` with `PREV` / `NEXT`, `TRANSMIT` with a red lamp; (3) `ESM LEVEL` row of 10 grey lamps, `PERISCOPE` `DOWN` and `ANTENNA` `DOWN` black buttons. Info bar is empty and the status row says `SPACE TO PAUSE`. |
| `009_radio_mission_orders_end.png` | After SEND CODE (code DON) | Red "TRANSMITTING CODE TO UPLINK SATELLITE. / AWAITING CONFIRMATION OF CODE SEQUENCE. / INCOMING MESSAGE:", then white "MISSION ORDERS", green header, then **yellow** order text scrolling up line by line (about 1.5 min in total; Esc aborts with "PRESS ESC TO ABORT MISSION ORDERS" in the info bar). This frame shows the tail: "...SHOW THOSE SKIMMERS AND FLY BOYS WHAT SILENT AND DEADLY REALLY MEANS! GOOD LUCK CAPTAIN. RADM J.W. RATCLIFF III". The info bar says "READY TO BEGIN MISSION CAPTAIN" and the status row now shows X/Y/time. A wrong code gives "INVALID CODE SEQUENCE. UNAUTHORIZED ACCESS ATTEMPT. SATTELITE UPLINK LOST." (string in EXE, not triggered). |
| `010_radio_orders_header.png` | Second mission start (no code needed) | Orders header in close-up: magenta "INCOMING MESSAGE:", white "MISSION ORDERS", green "FM: CINCLANTFLT / TO: USS LOS ANGELES (SSN 688) / SUBJ: TORPEX NLANT". The full TORPEX text is in `raw/orders1/`: three decommissioned Forrest Shermans running NW through the Faeroes, a LAMPS III helicopter and the surface ships will try to find you, SOSUS referees the exercise and ends it with three sonar blasts if you are found, 15-minute limit. |

### Status Panel (F3)

| File | How reached | Description |
|---|---|---|
| `011_status_panel.png` | F3 | No map. A large static picture on an ocean-blue gradient: **top** a cutaway side view of the 688 (cyan hull, rooms and machinery in grey/white/yellow, sail with masts), **bottom** an external side view (grey stippled hull, red screw). The target bar has `VIEW:` and `DEPTH:`. Bottom panel: a `SELECT` button (cyan text in a black box) and a black text field "SYSTEM NAME" (white) + "STATUS" (green). The manual says damaged systems are highlighted on the diagram; this was not observed (see 077). |
| `012_status_select_sonar_ok.png` | SELECT (S + Enter / click) | The field cycles through: "SHIPS SYSTEMS 100 PERCENT OPERATIONAL", "SONAR COMPUTER : SYSTEM OK", "TOWED ARRAY : ...", "PERISCOPE : ...", "TARGETING SONAR : ...", "ENGINES : ...", "ANTENNA : SYSTEM OK". |

### Ship's Control Panel (F4)

| File | How reached | Description |
|---|---|---|
| `013_ship_control.png` | F4 | [FRAME] with the top-down map (Faeroe island in olive green at left, an orange `X` sonar contact NW, own boat = small green square at the map centre). Right column: **CAVITATION LEVEL** gauge (x 192-308, y 37-47), 10 square lamps. **RISE/DIVE** dive-plane lever (x 190-222, y 62-128): a vertical slot with a cyan handle; the handle sits mid-slot for neutral. **AUTO FUNCTION** (x 228-315): cyan lamps `150 FT`, `PERISCOPE DEPTH`, and a red lamp `EMERGENCY SURFACE` in a hazard-striped box. Bottom: **rudder** slider (x 53-155, y 140-165, ruled scale above and below, cyan knob at centre). **Engine telegraph** (x 160-275, y 135-168): a cyan ball on a black track; stops `STOP 1/3 2/3 STD FULL` along the top (green notch marks), `REV` below left (yellow mark) and `FLANK` below right (magenta mark). **AUTO PILOT** `OFF/ON` box (x 282-315). |
| `014_crew_portrait_dive_order.png` | Order `150 FT` | A **digitised grey-scale crew photo** (a dark-haired officer at a control console) replaces the map for about 2 s. Info bar: "HEADING TO 150 FEET CAPTAIN." The lever moves to DIVE. Depth reads 28FT. |
| `015_ship_control_flank_cavitation.png` | 150 ft, Engine -> FLANK | The ball sits at FLANK. The cavitation gauge shows 5/10 lit (3 blue, 2 green) **while accelerating**. Speed 24.4 and rising. The own-boat square shows a short wake line. |
| `016_ship_control_reverse_cavitation.png` | Engine -> REV at 150 ft | The ball is at REV. Cavitation is 5/10. Speed drops quickly. A **yellow diamond** NW is the PLOT PROJ marker for own position in 10 min. |

### Contour imaging (688 only)

| File | How reached | Description |
|---|---|---|
| `017_contour_computing.png` | C + Enter on any station | A black box with green "COMPUTING IMAGE DATA" (and "PRESS SPACE TO ABORT") over the frozen map for about 4-5 s. |
| `018_contour_forward.png` | (result, F) | A pseudo-3D **side-scan picture** of the sea floor ahead: dark-teal water gradient above, a blue/violet seabed made of horizontal cyan contour strokes that rise to a ridge at left. Contact `E` is drawn as a white letter box in the water. The HUD stays on, and the compass shows a small sub icon. It is a snapshot, not live. |
| `019_contour_port.png` | P + Enter | Port view, the "PORT" label top-left. Seabed is flat. The cavitation gauge is empty: at a steady 37.0 kt there is no cavitation. |
| `020_contour_starboard.png` | S + Enter | Starboard view, "STARBRD" label. |

### Navigation Board (F6)

| File | How reached | Description |
|---|---|---|
| `021_navigation_board.png` | F6 | [FRAME] + a **PLOTTING** panel (x 187-313, y 26-127): three black toggle boxes `ON ALL TRACKS`, `OFF TARGET TRACK`, `ON PLOT PROJ`, and a **TIME PROJECTION** sub-panel (arrow buttons plus a 2-digit box `1 0` `min`). Bottom: `TARGET` button (x 60-105, y 145-157); **WAYPOINT CONTROL** with three red lamps `SET` `CLEAR` `TIME`; **AUTO PILOT** `OFF`. |
| `022_nav_time_compression.png` | Q + Enter (TIME) | A white box over the plotting panel: "TIME COMPRESSION IS IN EFFECT PRESS THE ENTER KEY TO ABORT." The map scrolls fast and contacts `A`, `E` (green letters) appear. |
| `023_nav_select_target_crosshair.png` | G + Enter | A white **crosshair** snaps onto the nearest contact. The target bar shows live data ("B: FORREST SHERMAN CLASS DESTROYER, BEARING 000, RANGE .4, COURSE 316, SPEED 9.1, DPT 0FT") and the info bar says "SELECT TARGET". Tab (or the letter key) cycles contacts and Enter confirms. **The game clock is frozen while the crosshair is up.** Tracks: black dotted own track, contacts' tracks as solid black dashes. |
| `024_nav_plot_projection_diamond.png` | PLOT PROJ on, 10 min | The yellow diamond = own projected position in 10 min on the current course. A red diamond = the selected target's projection (visible in 064/065). |
| `025_nav_waypoint_crosshair.png` | W + Enter, mouse | A free white crosshair. The info bar's upper row shows the **crosshair's map coordinates** (`03:05:44X 00:46:48Y`). |
| `026_nav_waypoint1_autopilot_on.png` | Enter | A magenta numeral `1` marks the waypoint. AUTO PILOT switches to `ON` automatically. Info bar: "WAYPOINT SET CAPTAIN". |

### Map zoom levels (any station, I/O)

| File | Description |
|---|---|
| `027_map_zoom_closest.png` | The default (closest) zoom used at start: big blocky depth cells (about 8x8 px tiles), island coast, own square at the centre. |
| `028_map_zoom_level2.png` | One step out. Contact `B` (green letter in a circle) top-left with its red target-track line. |
| `029_map_zoom_out3_contacts.png` | Out x3: the Faeroe chain. Contacts `C`, `E` and a third with dark circles; the selected target `C` has a red track. |
| `030_map_zoom_out6.png` | Out x6: the whole island chain at fine resolution (1 px cells, smooth VGA depth gradient, deep trenches dark violet). Contacts cluster as overlapping circles. |
| `031_map_zoom_max_out.png` | The 10th level. The info bar says "CANNOT ZOOM FURTHER OUT CAPTAIN". The own boat is **no longer centred** at the widest levels. |

### Periscope (F5)

| File | How reached | Description |
|---|---|---|
| `032_periscope_down.png` | F5 | [FRAME] (map) + right column: **ESM LEVEL** (10 grey lamps, x 207-295, y 39-48); **PERISCOPE** `DOWN` and **ANTENNA** `DOWN` black buttons; **PERISCOPE ROTATION** with left/right arrow buttons around a `000deg` box; **WEAPON CONTROL**: red `LAUNCH` + a dark slot showing the currently selected weapon icon. Bottom-centre `TARGET` button. |
| `033_periscope_up_ship.png` | U + Enter (at 20 ft) | The map window becomes the **periscope view**: a cyan-to-white sky gradient, a horizon at y about 90, a teal sea gradient, green/brown 3D-shaded island silhouettes, and a **grey destroyer sprite** (about 24x8 px) on the horizon. HUD overlays remain. Info bar: "PERISCOPE RAISED CAPTAIN". |
| `034_periscope_target_crosshair.png` | G + Enter | The crosshair snaps onto the ship and the target bar fills ("C: FORREST SHERMAN CLASS DESTROYER, BRG 001, RANGE 10.1, CRS 316, SPD 9.0, DPT 0FT"). **Visual ID is instant at 10 nm.** |
| `035_periscope_target_acquired.png` | Enter | "TARGET ACQUIRED". |
| `036`-`038_periscope_000/045/180` | `=`/`-` to move to the rotate arrows, then Enter | The periscope turns in **45 deg steps** (000, 045, ... 315). The view label reads PORT (225-315), STARBRD (045-135), AFT (180), none (000). The compass tape keeps showing own heading, not the scope bearing. The ship sprite is the same at every range (only its position changes). |
| `039_periscope_two_ships_random_start.png` | New TORPEX run | A different random start (course 270, two destroyers closer, about 6.5 nm). The sprites are larger and show superstructure detail. |
| `040_periscope_not_at_depth_msg.png` | U at 150 ft | "WE MUST BE AT PERISCOPE DEPTH". The weapon slot shows the red torpedo icon (= armed torpedo selected). |
| `041_periscope_esm_high.png` | Periscope up with a helicopter around | ESM 8/10 lamps lit (3 blue, 3 green, 2 yellow). Empty sea. |
| `042_periscope_antenna_up_esm.png` | N + Enter | Antenna `UP`, "ANTENNA HAS BEEN RAISED CAPTAIN". ESM 5-6 lamps (it fluctuates). |
| `043_periscope_destroyer_hit_smoke.png` | After the Harpoon (063) | The destroyer with a tall **grey smoke column** and a red flame at its base. |
| `044_periscope_destroyer_burning.png` | some seconds later | Still burning. The target slowed from 7.9 to 6.4 kt and is turning. |
| `045_periscope_target_sunk.png` | After the torpedo hit (070) | Only a tiny dark mast stub on the horizon: the ship is gone. |

### Sonar Room (F8)

| File | How reached | Description |
|---|---|---|
| `046_sonar_room.png` | F8 | [FRAME] + **SONAR COMPUTER**: a black analyzer screen (x 195-302, y 28-52) with **16 vertical bar slots** (dark grey), a small ruled scale on the left, and 6 tick marks below grouping the spectrum (low freq = ships, then subs, bio, high = torpedoes). Green-lamp `ANALYZE` button. A separate `TARGET` box. **SONAR CONTROLS**: FILTER `BAND PASS`, ACTIVE `TRGT PULSE`, TOWED ARRAY `DEPLOY`. **There is no waterfall, broadband, narrowband or towed-array trace display anywhere in the game.** |
| `047_sonar_crew_portrait_analysis.png` | 3 + Enter (ANALYZE) | A grey-scale photo of the sonar operator (bearded, aviator glasses, headset) replaces the map. "PERFORMING ANALYSIS CAPTAIN". |
| `048_sonar_analyzer_forrest_sherman.png` | about 3 s later | The bars fill in **magenta** with a **red cap on the peak**. For the Forrest Sherman, bar 1 is tallest, which matches the doc sheet pattern `O` at position 1. Other bars show low random noise and flicker slightly frame to frame, but the signature is stable. |
| `049_sonar_ping_crew_portrait.png` | ACTIVE (click) | Sonar operator photo + "SENDING ACTIVE SONAR PING CAPTAIN". |
| `050_sonar_towed_array_deploying.png` | DEPLOY | The button text changes to `RETRIEVE`. "DEPLOYING TOWED ARRAY" (reeling takes minutes). |
| `051_sonar_high_pass.png` | FILTER | The button reads `HIGH PASS`. "HIGH PASS FILTER ACTIVATED SIR". |

### Weapons Control (F7)

| File | How reached | Description |
|---|---|---|
| `052_weapons_control.png` | F7 | [FRAME] + **TORPEDOES** panel: white-on-black tube numbers `1 2 3` (left column) and `4` plus aux `1 2` (right column), each with a dark slot for the weapon icon; `MISSILES` with a counter (`2`) and a slot; red `LAUNCH`. A `TARGET` button. **TORPEDO CONTROL**: `SELECT`, `DIRECT`, `SEARCH` green lamps and a hazard-striped `DETONATE` with a red lamp. The selected tube has a green-bordered number box. |
| `053_weapons_arming_tube1.png` | R + Enter, or click the tube box twice | A **yellow torpedo icon** appears in slot 1 (arming). "WEAPON BEING ARMED". |
| `054_weapons_tubes_armed_and_arming.png` | click tubes 2,3,4 | Tube 1 icon is **red** = armed and ready; 2-4 are yellow = arming. |
| `055_weapons_all_tubes_armed.png` | +about 20 s | All four red. |
| `056_weapons_torpedo_launched.png` | L + Enter | "TORPEDO LAUNCHED CAPTAIN". Tube 1 goes back to yellow (auto-reload) and the selection auto-advances to tube 2. The torpedo appears on the map as a **yellow letter** (here `F`). Black dotted own track. |
| `057_torpedo_running_contact_lost_at_flank.png` | Watching at 37 kt | "TARGET: CONTACT HAS BEEN LOST": at flank speed own sonar loses every contact, leaving only orange `X` bearings and the old tracks. |
| `058_torpedo_running_letter_on_map.png` | Launch at B at 0.2 nm | The torpedo letter `A` (yellow) runs along the red target track toward the destroyer. |
| `059_torpedo_reached_target.png` | | "A TORPEDO HAS REACHED ITS TARGET". |
| `060_target_contact_lost_after_hit.png` | | The target disappears ("CONTACT HAS BEEN LOST"). The debrief later claimed **no ships damaged**, see section 3. |
| `061_weapons_crew_portrait_no_contacts.png` | G with no contacts | A third crew photo (a younger officer in front of machinery). "NO CONTACTS DISPLAYED". |
| `062_weapons_missile_arming.png` | click the MISSILES box twice | A **Harpoon icon** (yellow, blunt nose) in the missile slot. The counter drops 2 -> 1 at arming. |
| `063_weapons_missile_launched.png` | L + Enter (periscope depth, ID'd surface target) | "MISSILE LAUNCHED CAPTAIN". The counter shows 0 while the second missile is already arming. The missile is shown only as a tiny red mark that leaves the map. |
| `064_weapons_torpedo_launched_projection.png` | Launch at A | The torpedo `E` is at the centre (over own boat). The target `A` has a red track, and a **red diamond** = its projected position. |
| `065_torpedo_select_crosshair.png` | SELECT | The crosshair snaps onto torpedo `E`. The target bar shows "E: MARK 48 TORPEDO ... SPEED 33" (the torpedo is accelerating). "SELECT TARGET". |
| `066_torpedo_direct_crosshair_coords.png` | Enter, then DIRECT | A free crosshair (moved with the mouse or arrows). The info bar shows its map X/Y. |
| `067_torpedo_weapon_directed.png` | Enter | "WEAPON DIRECTED CAPTAIN". The torpedo turns to course 294. |
| `068_torpedo_wire_guided_run.png` | +60 s | Torpedo `E` (yellow) heads NW with a red dotted track back to own boat (it is the "target" now). Speed peaked at 52.1 kt and then settled at 48.4 kt. "TORPEDO ARMED" messages keep coming. |
| `069_torpedo_search_active_sonar.png` | SEARCH near the point | "ACTIVE SONAR" (torpedo pinging). The torpedo swings toward A (course 263 -> 273). |
| `070_torpedo_reached_target_A.png` | | "A TORPEDO HAS REACHED ITS TARGET". |
| `071_target_A_sunk_track_remains.png` | | A disappears. Only its track squiggle remains. See 045 for the periscope view. |
| `072_weapons_noisemaker_not_armed.png` | click aux 1 twice, L too early | A **noisemaker icon** (thin yellow cylinder) in aux 1. "WEAPON NOT ARMED CAPTAIN". |
| `073_noisemaker_released.png` | L when ready | "NOISEMAKER RELEASED". No separate map symbol was visible. |

### Depth, layers, damage

| File | How reached | Description |
|---|---|---|
| `074_thermal_layer_crossed_hud.png` | Full DIVE on the lever (D) | "WE CROSSED A THERMAL LAYER SIR" at about 400-420 ft. The HUD depth ladder shows the layer as a longer bar on its right edge. |
| `075_damage_red_palette.png` | Hit the bottom (998 ft) | **The whole palette flashes to red/black** (emergency lighting, about 1 s) and the screen shakes. (Addendum: Ctrl-D disables the colour change.) |
| `076_scraped_bottom_hull_damaged.png` | | Same red flash, with "WE SCRAPED BOTTOM, HULL DAMAGED!". The lever springs back to neutral. Depth is stuck at 998FT (the sea floor). |
| `077_status_84_percent_after_scrape.png` | F3 + SELECT | "SHIPS SYSTEMS 84 PERCENT OPERATIONAL". Every subsystem still reads OK, and nothing is highlighted on the diagram. |

### End of mission

| File | How reached | Description |
|---|---|---|
| `078_time_game_over.png` | 15:00 mission time | The info bar shows "TIME:GAME OVER" (2 messages overlapping). |
| `079_debrief_header.png` | auto, in the Radio Room | Green "FM: CINCLANTFLT / TO: USS LOS ANGELES (SSN 688) / INFO: ALL SUBS ATLANTIC / SUBJ: FAEROE ISLANDS RANGE RESULTS". The status row reads "MISSION TIME: 00:15:00". The code boxes now show `1 2 3`. |
| `080_debrief_text.png` | | Yellow: "(CONFIDENTIAL) CODE: 1-5-ACP. THE LOS ANGELES IS TO RETURN TO PORT IMMEDIATELY ... CAPTAIN, YOU AND YOUR OFFICERS WILL BE MY GUESTS AS YOU EXPLAIN TO ME YOUR LACKLUSTER (NO SHIPS DAMAGED AT ALL!) PERFORMANCE AT THE WEAPONS RANGE. BE SURE TO BRING YOUR GEAR WITH YOU, BECAUSE YOU WON'T NEED IT ON BOARD FOR THE NEXT MONTH." There is **no score screen, rank or medal**: the debrief is just a teletype message. |
| `081_end_of_mission_dialog.png` | auto after the debrief | A grey dialog "DO YOU WANT TO... PLAY AGAIN (green) / CONTINUE PLAY (blue) / EXIT TO DOS (red)". |
| `082_exit_dialog_from_conn.png` | X + Enter in CONN | The same dialog over the CONN (Alfa CONN shown). |

### Soviet Alfa side (mission 3 "Sub Ops", Alfa)

| File | How reached | Description |
|---|---|---|
| `083_alfa_conn.png` | Mission 3 ALFA, BEGIN | **Alfa CONN** (ALFA.PAK): a busier, more saturated control room with a converging-perspective corridor and a grid ceiling. In front: a smiling officer at bottom-left with an "I [heart] [hammer & sickle]" mug; bearded sonarman with headset left; officer writing at a console right; a yellow-grid plotting board on the back wall; the periscope column centre with a floor hatch ring; a pink/yellow chart table with a triangle and a lamp at the bottom right. |
| `084_alfa_help_conn_status.png` | F1 | The help is the same text as on the 688 ("STATUS PANEL:U:F3 ... DAMAGE CONTROL INFORMATION **FOR THE 688 CLASS SUBMARINE**": text reused unchanged). |
| `085_alfa_radio_keycode.png` | F2 | The Alfa Radio Room in **pseudo-Cyrillic** (Latin letters swapped for look-alikes: `ТАЯБЭТ`, `ЪЭАЯИИБ`, `ЗЗМ L3V3L`). The panels are **teal `#00aaaa` with blue/white bevels**. Code entry: three letter boxes with `UP`/`DN` arrow pairs. `SEND CODE`, `TRANSMIT`, `REVIEW` (up/dn) as label plates with round grey **knobs** + square lamps; ESM LEVEL as 10 **round** lamps; ANTENNA / PERISCOPE as small toggle switches with UP/DN. |
| `086_alfa_radio_orders.png` | code WIL | "FM: GLAVNY SF / TO: PLA LENINSKII KOMSOMOL / SUBJ: COASTAL PATROL (TOP SECRET) ... execute search procedures along the Polyarnyy coastline. Should you discover intruders, move close to the intruder and activate sonar. Follow the intruder out of the area ... VITSE ADMIRAL A.P. BEREZINSKII". |
| `087_alfa_status.png` | F3 | **No sub diagram**: just the blue water gradient. SELECT + system/status field as on the 688. |
| `088`-`092_alfa_*_cyrillic` | F4-F8 | The five stations in Cyrillic mode (see the Latin versions below for layout). |
| `093_alfa_ship_control_latin.png` | Ctrl-R in CONN, F4 | Latin labels. Map pad replaced by `SCALE` with `UP/DN` arrows, `CONTOUR` (bottom-shading knob), `HUD` knob. **No cavitation gauge.** RISE/DIVE lever; AUTO FUNCTIONS `150 FT`, `PERISCOPE DEPTH`, `EMERGENCY SURFACE` as label plates with knobs; `AUTO HELM` knob; `RUDDER` slider with `0` mark; `ENGINES` telegraph graduated **-10, 0, 25, 50, 75, 100, 110** (percent; 110 = flank). |
| `094_alfa_periscope_up_night.png` | F5, U | The periscope uses a **night palette** (navy sky, dark sea, no ships). Right: ESM LEVEL round lamps, ANTENNA / PERISCOPE toggles, `ROTATE` with a 3-digit odometer `000` + RT/LF, and a "CCCP" badge; **TORPEDO CONTROL** `LAUNCH` knob and `STATUS` window (current weapon icon). |
| `095_alfa_navigation_latin.png` | F6 | WAYPOINT CONTROL: `SET`, `CLEAR`, `TIME COMP`, `AUTO HELM` (knob + lamp each). CONTACT TRACKING: `TARGET TRACK`, `ALL TRACKS` (red lamp), `PLOT PROJ` (red lamp), `TIME PROJ` 2-digit `10` + UP/DN. |
| `096_alfa_weapons_latin.png` | F7 | **Six torpedo tubes** `1-6` (tube 6 = noisemakers until they run out), `LAUNCH` knob. **REMOTE CONTROL**: `SELECT` (with a box showing the selected weapon number), `DIRECT`, `SEARCH`, `DETONATE`. No missiles. |
| `097_alfa_sonar_latin.png` | F8 | SONAR COMPUTER: the same 16-bar analyzer in a rounded bezel, with a "TOSHIBA MADE IN JAPAN" nameplate half-covered by a red "CCCP" sticker (a joke on the Toshiba-Kongsberg scandal). `ANALYZE`; SONAR CONTROLS `ACTIVE SONAR`, `NOISE FILTER`, `TOWED ARRAY`. |
| `098_alfa_ping_crew_portrait_red.png` | ACTIVE SONAR | The Alfa crew photo is **tinted red** (a young man). "SENDING ACTIVE SONAR PING CAPTAIN". |
| `099_alfa_after_ping_contact.png` | | An orange `X` contact appears NE after the ping. |
| `100_alfa_weapons_arming_torpedo_noisemaker.png` | click tubes | Tube 2: a chunky **Type 53** torpedo icon; tube 6: a slender **noisemaker** icon (both yellow while arming). |

### Misc

| File | How reached | Description |
|---|---|---|
| `101_boss_key_fake_dos.png` | F10 | Text mode, black screen with a fake prompt `A:\RATCLIFF>_` (640x400). F10 again returns to the game. |
| `102_modem_establishing_channel.png` | Config: MODEM ON COM1 + ORIGINATE | A white box "ESTABLISHING COMMUNICATIONS CHANNEL WITH THE OTHER COMPUTER." (it waits indefinitely and the box jumps position). |
| `103_modem_failure_to_communicate.png` | Esc | "WHAT WE HAVE HERE IS A FAILURE TO COMMUNICATE. DO YOU WISH TO TRY AGAIN?" (Cool Hand Luke) with yellow `CANCEL` / `OK` buttons. |

---

## 3. Behavioural observations (from play, beginner level)

**Time**
* At 3000 cycles the mission clock runs 1:1 with real time.
* The clock is frozen during F1 help and **while any crosshair is up** (targeting, waypoint, direct); I saw both.
* The CONN pauses the game (manual) and Space pauses (on-screen "SPACE TO PAUSE"). I did not time either.
* **Time compression** (Navigation `TIME`) is about **6x** on this setting: 3 min 48 s of game time in about 36 s real. The manual says "about 2x, CPU dependent". It covers the plotting panel with a modal box. Abort with Enter; the first Enter was not always taken, so I overshot by 2 game minutes.
* **Distances are compressed versus the speeds shown, by about 3.5x.** At 37 kt own speed against a 9 kt target running away, the range closed about 0.9 nm in 32 game seconds (real knots would give about 0.25). A Mk 48 shown at 48 kt covered about 2.8 nm per game minute. This matches the designer's notes ("scaled down" world, every torpedo has a 10 nm range).
* The mission time limit is in game time (TORPEX = 15:00), so compression does not help against the clock.

**Own boat dynamics**
* Acceleration at FLANK is about **0.5 kt per game second** (0 to 37.0 kt in about 70 s). 688 flank = **37.0 kt**, FULL = 33.8 kt.
* Coasting down from 33.8 kt at 1/3 loses about 0.35 kt/s. REV brakes at about 1-2 kt/s.
* STD/FULL/FLANK are refused at 100 ft or shallower (manual). I always set them at 150 ft.
* Diving: `150 FT` auto takes about 30 s from 20 ft. **Full dive planes at 0 kt** still sink the boat at about **18 ft/s** (20 to 998 ft in about 55 s). This is unrealistic: depth is controlled like a ballast elevator, and the planes do not need water flow.
* Hitting the bottom only "scrapes": hull damage 16% (84% operational), red flash, the boat stays on the bottom. There is no crush depth in that spot (water was 998 ft).
* Turning: the rudder is incremental. The autopilot steers to waypoints, slows for turns and never returns to FLANK (manual). Touching the rudder cancels the autopilot.

**Noise and cavitation**
* The cavitation gauge depends on **acceleration and throttle**, not on steady speed: about 5/10 while accelerating at FLANK at 150 ft, **0/10 once steady at 37 kt**, 0 at FULL from rest, about 5/10 at REV at 150 ft. The manual says shallower is worse; shallow was not measured.
* **Own speed deafens the sonar.** At 33.8-37 kt every lettered contact dropped ("CONTACT HAS BEEN LOST", "NO CONTACTS DISPLAYED"), leaving only `X` bearings and old tracks. After slowing to about 8 kt the contacts did not come back within about a minute. An active ping showed nothing ahead (the remaining destroyers were probably out of the forward cone).

**Contacts, classification, "solutions"**
* Map symbols:
  * Orange/red `X` = bearing-only detection, always drawn halfway to the map edge.
  * A **letter** = a fixed contact with exact position, course and speed. Letters are assigned A, B, C... and re-used: a lost and regained contact can get a new letter, and torpedoes take letters too.
  * Green letters/circles = identified; dark-blue circles = not yet identified.
  * **Yellow letters = weapons** (own torpedoes).
  * Own boat = green square with a short wake.
  * Black dotted line = own track; black dash tracks = other contacts; **red dots = the selected target's track**.
  * Magenta digits = waypoints.
  * Yellow diamond = own projected position; red diamond = target's projected position (PLOT PROJ + TIME PROJ minutes).
* **There is no TMA** (no bearing lines, no solution building, no dot stacks). Once the sonar operator "gets a fix" a contact simply becomes a letter with perfect data in the target bar. The only "solution" tool is the plot projection.
* Identification:
  * Periscope targeting identifies a surface ship instantly, even at 10 nm.
  * Sonar ID depends on the operator. ANALYZE shows the 16-bar spectrum: the class pattern (tall bars) matches the doc sheet; low bars are random noise.
  * The "manual" skill the game expects is recognising the bar pattern. It shows the **currently targeted** contact only, and does not work on air contacts ("CAN'T ANALZYE AIR CONTACTS SIR" in the EXE strings).
* Targeting crosshair: it snaps to the nearest contact and Tab or the contact's letter cycles. The target bar updates live while hovering.
* Thermal layer: "WE CROSSED A THERMAL LAYER SIR" at about 400-420 ft there. Shown on the HUD ladder. Its effect on detection was not quantified.

**Weapons**
* Arming takes about 15-25 game seconds for a torpedo, about 15 s for a Harpoon, and over 25 s for a noisemaker.
* Launching auto-reloads the tube (the icon goes yellow, then red) and auto-selects the next armed tube. The missile counter decrements at arming time.
* "CAN'T LAUNCH ANOTHER YET, CAPTAIN" exists in the strings: there is a launch interval.
* Torpedo: it starts at 0 kt, accelerates to about 52 kt and settles at **48.4 kt**. It runs at the target selected **at launch**; you are free to change target afterwards.
* Wire: 7.5 nm (manual), with the strings "torpedo about to go off guidance" and "guidance cable cut captain".
* Torpedo control:
  * SELECT puts a crosshair on one of your torpedoes.
  * DIRECT moves a free crosshair to a map point: "WEAPON DIRECTED CAPTAIN", and the torpedo turns.
  * SEARCH makes the torpedo go active ("ACTIVE SONAR") and home.
  * DETONATE = remote detonation.
  * Directing to an empty spot without SEARCH leaves the torpedo drifting until it runs out of fuel (manual).
* Hits:
  * On beginner, **one Mk 48 sank a Forrest Sherman** (the manual says more are needed). The letter vanished, and through the periscope only a mast stub remained.
  * A Harpoon hit produced a smoke column and fire. The ship slowed (7.9 to 6.4 kt) and kept turning, but did not sink at once.
  * There is no explosion graphic on the map; you only get messages, and sound in the original.
* Harpoon needs periscope depth, a surface target, range info and ID. Strings: "only fire missles at surface vessels", "target too close to launch missile at", "need range information to launch".
* **Possible bug / oversimplification:** in run 2 a torpedo "reached its target" on destroyer B at 0.4 nm and B vanished (while I was at 33.8 kt, so it may only have been contact loss). The debrief still said "NO SHIPS DAMAGED AT ALL!". The reach message is not proof of damage, or kills are not always credited.

**Sensors and masts**
* ESM is 0 with everything down. With the periscope or antenna up, the helicopter radar showed 5-8 of 10 lamps, fluctuating.
* Periscope and antenna can only be raised at 20 ft ("WE MUST BE AT PERISCOPE DEPTH"). The periscope turns in 45 deg steps only.
* Towed array: the button flips to RETRIEVE at once. "DEPLOYING TOWED ARRAY" was still showing after about 1 game minute; the manual says reeling out takes minutes and speed is then limited to 2/3. The manual also says that at high speed you are asked whether to cut it (not seen).
* Active ping: the crew photo, then the map. It "temporarily informs you of everything ahead" and alerts everyone. With the Alfa it revealed an `X`.
* High pass filter: shows only high-frequency sources (torpedoes) on the map.

**Crew messages seen** (info bar; the full list of the ~110 strings is in GAME.EXE):

READY TO BEGIN MISSION CAPTAIN · PERISCOPE RAISED/LOWERED CAPTAIN · ANTENNA HAS BEEN RAISED CAPTAIN · HEADING TO 150 FEET CAPTAIN. · HEADING FOR PERISCOPE DEPTH CAPTAIN · WEAPON BEING ARMED · TORPEDO ARMED · WEAPON NOT ARMED CAPTAIN · TORPEDO LAUNCHED CAPTAIN · MISSILE LAUNCHED CAPTAIN · NOISEMAKER RELEASED · SELECT TARGET · TARGET ACQUIRED · CONTACT HAS BEEN LOST · NO CONTACTS DISPLAYED · A TORPEDO HAS REACHED ITS TARGET · WEAPON DIRECTED CAPTAIN · ACTIVE SONAR · PERFORMING ANALYSIS CAPTAIN · SENDING ACTIVE SONAR PING CAPTAIN · DEPLOYING TOWED ARRAY · HIGH PASS FILTER ACTIVATED SIR · WAYPOINT SET CAPTAIN · CANNOT ZOOM FURTHER OUT CAPTAIN · WE MUST BE AT PERISCOPE DEPTH · WE CROSSED A THERMAL LAYER SIR · WE SCRAPED BOTTOM, HULL DAMAGED! · TIME:GAME OVER.

Strings in the EXE that I did not trigger:
* "we are being pinged hard sir", "underwater explosion captain!", "we've been hit and damaged sir!", "submarine flooded and destroyed!!!"
* "she canna stand the strain jim", "we just hit a friendly.....sir?", "backfire bomber attacking", "surface vessel defending itself", "detected sonar target marker"
* "the towed array is gone", "a torpedo ran out of fuel sir"

**Crew photos**: digitised grey-scale portraits replace the map for about 2 s on some orders: three different men on the 688 (diving officer, sonar operator, weapons officer). The Alfa uses a red-tinted portrait.

**Randomness**: TORPEX start positions vary between runs (03:05:36X 00:45:52Y, course 320, ships about 10 nm vs 03:12:00X 00:52:16Y, course 270, ships about 6.5 nm).

**Alfa vs 688 (functional differences)**
* No contour imaging.
* No cavitation gauge.
* No damage diagram.
* Engine in % (-10..110).
* 6 bow tubes (the 6th fires noisemakers) and no missiles.
* Towed array limits it to 50% (manual).
* Zoom is SCALE UP/DN instead of I/O.
* Same station set and hotkeys (F2-F8).
* A pseudo-Cyrillic label font, toggled with Ctrl-R in the CONN. It also affects the info texts in the Radio Room.
* Teal panels with knobs and lamps instead of grey panels with buttons.
* Red-tinted crew photo; night palette in Sub Ops.

**Two-player (modem / null-modem) mode**
* Only from the Configuration Panel: MODEM ON COM1/COM2, an 11-digit phone number set with UP/DN, then ORIGINATE / AUTO-ANSWER / MANUAL ANSWER.
* MODEM.688 holds the init string (`ATV1E0X3`, max 33 bytes).
* Modem-capable missions are marked with a lightning bolt (1,2,5,7,8,9).
* In mission 1 it is 688 vs 688 ("700" = Dallas) with no missiles; in the others it is 688 vs Alfa.
* Per the manual: no pause, no time compression, standard level forced, chat through the Radio Room TRANSMIT at any depth, Ctrl-K surrender, and the session stays connected for "Play again".
* Here, ORIGINATE with no peer gives the two dialogs 102/103. An actual head-to-head session was **not** run (see section 5).

---

## 4. Keyboard map (confirmed by use unless marked)

| Key | Effect |
|---|---|
| Tab / Shift-Tab | next / previous control group (confirmed) |
| Left / Right | previous / next control inside the group (e.g. the engine telegraph REV-STOP-1/3-2/3-STD-FULL-FLANK) |
| Up / Down | previous / next control regardless of group (also on Mission Selection) |
| Enter (or any mouse button) | **activates** the control under the cursor. Letter and number hotkeys only **move** the cursor; you must press Enter afterwards. Enter also aborts time compression and confirms crosshairs. |
| Space | pause ("SPACE TO PAUSE"); next help page; speeds up scrolling messages |
| Esc | leave help; abort the mission-orders teletype |
| F1 | help (CONN tour or per-station control tour with hotkeys) |
| F2 Radio, F3 Status, F4 Ship's Control, F5 Periscope, F6 Navigation, F7 Weapons, F8 Sonar, F9 CONN | stations (all confirmed) |
| F10 | boss key (fake `A:\RATCLIFF>` prompt); press again to resume (confirmed) |
| X (or 0) then Enter | Exit hotspot (CONN: PLAY AGAIN / CONTINUE / EXIT TO DOS) (confirmed) |
| 1-9 | jump to control group N on the current screen (confirmed `3` = Analyze, `5` = Auto function) |
| **Map (all stations)** P / F / S | contour view port / forward / starboard (confirmed) |
| I / O | zoom in / out, 10 levels (confirmed) |
| C | contour imaging (at the periscope: back to the scope view) (confirmed) |
| T | top-down map (confirmed) |
| H | HUD on/off (not tested) |
| B | bottom shading on/off (not tested) |
| **Ship's Control** R rudder, E engine (confirmed), D dive planes, `.` autopilot, 5 auto functions (confirmed) | |
| **Navigation** G target (confirmed), W set waypoint (confirmed), K clear waypoint, Q time compression (confirmed), `.` autopilot, 4 plotting | |
| **Weapons** G target, R torpedo tubes (confirmed), A aux tubes, M missile, L launch (confirmed), 2 torpedo control (688) / 3 (Alfa) | |
| **Periscope** U periscope up/down (confirmed), N antenna (confirmed), G target (confirmed), L launch, `-` / `=` rotate left / right (confirmed: `=` then Enter, 45 deg per press) | |
| **Sonar** G target, 3 analyze (confirmed), 2 sonar controls (688) / 4 (Alfa) | |
| **Radio** A antenna, P periscope, S send code, T transmit, 2 message review | |
| **Status** S select | |
| Ctrl-R | pseudo-Cyrillic on/off, from the CONN (confirmed) |
| Ctrl-N | sound on/off (not tested) |
| Ctrl-Q | all sound effects off (addendum; not tested) |
| Ctrl-D | disable the red damage palette (addendum; not tested) |
| Ctrl-A | disable mouse (not tested) |
| Ctrl-K | surrender (modem only; not tested) |
| Mouse | moves the cursor freely and clicks any hotspot; also moves crosshairs (confirmed) |

---

## 5. What was **not** captured, and why

* **Waterfall, broadband, narrowband and towed-array trace displays**: they do not exist in this game. The sonar room is a 16-bar spectrum "sonar computer" plus three buttons.
* **TMA / target motion analysis**: it does not exist. Contacts jump from `X` (bearing) straight to a lettered perfect fix.
* **External / 3D views of own boat or targets**: none exist. The only out-of-boat pictures are the periscope view, the contour sonar image, and the static status-panel side views.
* **Radio TRANSMIT ("MISSION" review, chat) and MSG REVIEW PREV/NEXT**: not exercised for lack of time. The layout is in 008/085.
* **Own boat torpedoed or sunk, depth-charged, "being pinged hard"**: not provoked in the time available (TORPEX opponents are passive). I only got bottom-scrape damage.
* **A winning debrief (praise) or any score/rank screen**: the game has no score or rank screen; debriefs are teletype messages. I only reached the failing one ("no ships damaged") because the TORPEX timer ran out.
* **Missions 2, 4-10 and the Alfa missions other than Sub Ops**: not played. Their station layouts are the same as captured; only the maps, palettes (day/night) and contacts change.
* **Actual head-to-head modem game**: it needs two DOSBox instances linked by `serial1=nullmodem`, each going through its own keycode, and was not attempted. The configuration screen and the originate/failure dialogs are captured, and the manual's description is summarised in section 3.
* **Hercules/EGA/CGA/Tandy graphics modes**: not captured. Only VGA/MCGA (mode 4) was used.
* **The help tours of every station**: the full sequences were captured for the CONN (688 and Alfa) and the Sonar station only (`raw/help_*`). The other stations' hotkeys come from the manual table above.
