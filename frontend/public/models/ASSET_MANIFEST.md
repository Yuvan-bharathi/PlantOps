# PlantOps 3D Asset Manifest

External 3D assets used in the Digital Twin scene: real modeled GLB
buildings for all six Plant Overview sections, following the Processing
Cell pilot. See `frontend/src/components/DigitalTwin/IndustrialBuildingAssets.tsx`
for how these are wired into the existing FactoryCanvas scene (config-driven,
one entry per zone in `BUILDING_CONFIGS`).

All assets below are **CC0 (public domain)** — no attribution legally required,
but credited here as good practice and to keep sourcing traceable.

## kenney-city-kit-industrial/
Used for: all six zone exterior building shells + Processing Cell's tanks/chimneys
+ (Stage 3) PROCESS-01/PROCESS-02's vessel body.

- Source: Kenney "City Kit (Industrial)" v2.0
- URL: https://kenney.nl/assets/city-kit-industrial
- License: CC0 1.0 (public domain)
- Files included here (subset of the full 40-asset pack):
  - `building-a.glb` — Machining Cell exterior shell
  - `building-e.glb` — Robot Cell exterior shell
  - `building-t.glb` — Processing Cell exterior shell (hall + integrated stack)
  - `building-r.glb` — Assembly Cell exterior shell
  - `building-q.glb` — Packaging Cell exterior shell
  - `building-c.glb` — Maintenance Bay exterior shell (dual roll-up bay doors & workshop roof)
  - `detail-tank-large.glb`, `detail-tank.glb` — Processing Cell storage tanks
  - `chimney-large.glb`, `chimney-medium.glb` — Processing Cell exhaust stacks

## kenney-factory-kit/
Used for: Processing Cell interior detail; (Stage 2) the shared CNC-01..06
machine assembly in Machining Cell; (Stage 3) MIXER-01/PUMP-01/PRESS-01/
PROCESS-01/PROCESS-02 in Processing Cell; (Stage 4) ROBOT-01..04's turret
base and controller cabinet in Robot Cell (reuses `machine-bed.glb`,
`machine-window.glb`, `screen-small.glb` — no new files); (Stage 5)
ASMB-01..04 in Assembly Cell.

- Source: Kenney "Factory Kit" v3.0
- URL: https://kenney.nl/assets/factory-kit
- License: CC0 1.0 (public domain)
- Files included here (subset of the full 143-asset pack):
  - `floor-large.glb` — interior floor tile
  - `structure-wall.glb`, `structure-corner-outer.glb`, `structure-corner-inner.glb`,
    `structure-doorway.glb`, `structure-window.glb`, `structure-high.glb` — modular wall framing
  - `pipe-large.glb`, `pipe-large-bend.glb`, `pipe-large-valve.glb`,
    `pipe-large-junction.glb`, `pipe-large-long.glb` — pipe network
  - `catwalk-straight.glb`, `catwalk-corner.glb`, `catwalk-stairs.glb` — platforms/ladders
  - `hopper-high-round.glb`, `hopper-square.glb` — process vessel detail
  - `warning-orange.glb` — safety signage
  - `screen-panel-wide.glb` — control panel detail
  - `machine-bed.glb` — CNC base cabinet
  - `machine-window.glb` — CNC upper windowed machining chamber
  - `door.glb` — CNC side access door
  - `screen-small.glb` — CNC control panel/display
  - `lever-single.glb` — CNC handles (door + control panel)
  - `top.glb` — CNC front output/load tray
  - `piston-round.glb` — CNC roof tool-changer turret accent
  - `box-small.glb` — CNC chip tray
  - `machine.glb` — Pump body/motor housing; Mixer motor+gearbox top assembly
  - `cog-a.glb` — Mixer gearbox accent
  - `piston-square.glb` — Press hydraulic cylinder/ram
  - `machine-window-bar.glb` — Press safety guard
  - `top-large.glb` — Press bed surface
  - `conveyor-long.glb` — Assembly conveyor segment
  - `piston-thin-square.glb` — Assembly pneumatic actuator
  - `scanner-low.glb` — Assembly sensor/vision scanner
  - `lever-double.glb` — Assembly fixture clamp

## kenney-city-kit-roads/
Used for: campus environment enhancement (Stage 1) — the two internal-street
junctions, the Main Gate pedestrian crossing/sidewalk, a stop sign + traffic
light, street lights (replacing the earlier procedural stand-in), and
safety/utility accents (cones, barriers, fencing, a dumpster, electricity poles).

- Source: Kenney "City Kit (Roads)" v2.1
- URL: https://kenney.nl/assets/city-kit-roads
- License: CC0 1.0 (public domain)
- Files included here (subset of the full 90-asset pack):
  - `road-crossroad.glb` — junction accent tiles
  - `road-crossing.glb` — Main Gate pedestrian crossing
  - `road-side.glb` — sidewalk edge near the Main Gate
  - `road-sign-stop.glb`, `traffic-light.glb` — east junction signage
  - `light-square.glb` — street light poles (all 13 existing positions)
  - `construction-cone.glb`, `construction-barrier.glb`, `construction-fence.glb` — safety accents
  - `dumpster.glb` — Shipping & Receiving prop
  - `electricity-pole.glb` — Utility Area infrastructure

## kenney-car-kit/
Used for: campus logistics transport truck, ISO container haulage, and employee parking lot facility (SUV, truck, delivery, emergency vehicles).

- Source: Kenney "Car Kit" v1.0
- URL: https://kenney.nl/assets/car-kit
- License: CC0 1.0 (public domain)
- Files: full set (50 assets) including `truck.glb`, `truck-flat.glb`, `suv.glb`, `delivery.glb`, `sedan.glb`, `taxi.glb`, `ambulance.glb`, `firetruck.glb`.

## Not redistributed
Only the active `.glb` format models are installed in public/models/ for direct web delivery.
