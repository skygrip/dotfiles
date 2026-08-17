---
name: openscad
description: 3D parametric CSG modeling in OpenSCAD. Enforces immutable SSA variable rules, difference/union CSG hygiene, BOSL2 library usage, and OpenSCAD MCP preview generation.
---

# OpenSCAD Agent Guide

This document covers what LLMs get wrong when writing OpenSCAD — traps, anti-patterns, and practical rules that aren't in the manual. It does **not** duplicate the language reference; consult the official docs for syntax details.

## Official References

Look up primitives, transforms, functions, and modules here — do not guess syntax from memory:
- **Cheat Sheet**: [openscad.org/cheatsheet](https://openscad.org/cheatsheet/)
- **Full Manual**: [OpenSCAD Wikibook](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/The_OpenSCAD_Language)
- **BOSL2 Library Wiki**: [github.com/revarbat/BOSL2/wiki](https://github.com/revarbat/BOSL2/wiki)
- **MCP Server**: [quellant/openscad-mcp](https://github.com/quellant/openscad-mcp)

---

## Mental Model Shifts

OpenSCAD is **declarative and functional**, not imperative.

### Variables Are Compile-Time Constants (SSA)
All assignments are evaluated at compile time. You cannot mutate a variable. Reassignment shadows it within that scope only, and the **last assigned value in a scope wins** for all references in that scope.

```openscad
// WRONG — expecting mutation
x = 5;
if (condition) {
    x = 10; // Shadows x ONLY inside this block
}
// x is still 5 here!

// CORRECT — ternary for conditional values
x = condition ? 10 : 5;
```

**List comprehensions for collections:**
```openscad
// Modern OpenSCAD: list comprehension instead of recursion
coords = [for (i = [0:5]) [i * 10, sin(i * 30) * 10, 0]];
```

### Modules Generate Geometry, Functions Return Values
- **`module`**: Produces 2D/3D shapes. Cannot return values. No `return` keyword.
- **`function`**: Computes and returns numbers, vectors, strings. Cannot produce geometry.

### `use` vs `include`
```openscad
use <file.scad>      // Imports modules and functions ONLY. Does NOT run top-level code.
include <file.scad>  // Runs EVERYTHING in the file, including top-level geometry.
```

---

## Syntax & Performance Traps

### Trap 1: The Transformation Semicolon
A semicolon after a transformation terminates it with empty geometry. The child block then renders at the origin, detached.

```openscad
// WRONG — semicolon kills the transform
translate([0, 0, 10]);
{
    cube([5, 5, 5]); // Renders at [0,0,0]!
}

// CORRECT — no semicolon before child
translate([0, 0, 10]) {
    cube([5, 5, 5]); // Renders at [0,0,10]
}
```

### Trap 2: Transformation Order Is Inside-Out
Transformations apply from the **innermost** (closest to geometry) **outward**. Read them bottom-up.

```openscad
// This ROTATES first, THEN translates:
translate([10, 0, 0])
    rotate([0, 0, 45])
        cube([5, 5, 5]);
```

### Trap 3: Resolution & Preview Performance (`$fa`, `$fs`, `$preview`)
Avoid setting a fixed global `$fn = 64` — it wastes thousands of polygons on tiny screw holes while leaving large curved plates faceted.

Instead, control smoothness globally with `$fa` (minimum angle in degrees) and `$fs` (minimum fragment size in mm), coupled with dynamic `$preview` LOD:

```openscad
// Fast draft preview in MCP, ultra-smooth for export:
$fa = $preview ? 12 : 5;
$fs = $preview ? 1.5 : 0.4;

// Reserve $fn ONLY for intentional geometric polygons:
cylinder(h = 6, r = 4, $fn = 6); // Hex nut pocket
```

---

## 2D-First Modeling & Fillets

2D booleans and offsets are **10x to 100x faster** than 3D CSG boolean operations. Design profiles in 2D and extrude them.

### Rounded Corners via 2D `offset()`
Avoid 3D `minkowski()` — it causes exponential render slowdowns and freezing. Use `offset()` in 2D:

```openscad
// Rounded rectangle in 2D, extruded to 3D
linear_extrude(height = 10, convexity = 10)
    offset(r = 3)
        offset(delta = -3)
            square([40, 30], center = true);

// Rounded hollow casing with uniform walls:
linear_extrude(height = 15, convexity = 10)
    difference() {
        offset(r = 4) square([50, 30], center = true);
        offset(r = 2) square([50 - 4, 30 - 4], center = true);
    }
```

### Organic Transitions with `hull()`
Use `hull()` on 2D/3D primitives instead of manual trigonometric joins:
```openscad
// Smooth bracket arm
hull() {
    cylinder(h = 5, r = 8);
    translate([30, 0, 0]) cylinder(h = 5, r = 4);
}
```

---

## Manifold Geometry & Tolerances

### Epsilon Overlaps for `difference()`
Never align cutting shapes flush with the surface being cut. Always extend cutting geometry by `2 * epsilon` and translate by `-epsilon`:
```openscad
epsilon = 0.01;

difference() {
    cube([20, 20, 10]);
    // Cut extending past top and bottom faces
    translate([10, 10, -epsilon])
        cylinder(h = 10 + 2 * epsilon, r = 3);
}
```

### 3D Printing Clearance Tolerances
3D printed holes print smaller due to plastic shrinkage and perimeter tension:
- **Slide / Loose Fit**: Add `+0.3mm` to `+0.4mm` clearance.
- **Press Fit**: Add `+0.1mm` to `+0.15mm` clearance.
- **M3 Screw Hole**: Use `d = 3.4mm` (nominal 3.0mm + 0.4mm).
- **M4 Screw Hole**: Use `d = 4.4mm`.

---

## Multi-Part MCP Inspection Pattern

Structure multi-part projects so MCP can inspect fit, exploded internal cavities, and flat print plates:

```openscad
/* [View Mode] */
mode = "assembled"; // [assembled, exploded, print_base, print_lid]

/* [Hidden] */
explode_offset = (mode == "exploded") ? 20 : 0;

module base() {
    color("DodgerBlue") {
        // Base geometry on Z=0
    }
}

module lid() {
    color("Goldenrod", 0.85) {
        // Lid geometry positioned on top of base
    }
}

// Assembly switch
if (mode == "assembled" || mode == "exploded") {
    base();
    translate([0, 0, 15 + explode_offset]) lid();
} else if (mode == "print_base") {
    base();
} else if (mode == "print_lid") {
    // Oriented flat on build bed for printing
    rotate([180, 0, 0]) lid();
}
```

## BOSL2 Attachment Model & Semantic Alignment

When using the **BOSL2** library (`include <BOSL2/std.scad>`), avoid manual nested `translate()` and `rotate()` trigonometry. Instead, use BOSL2's semantic attachment system:

```openscad
include <BOSL2/std.scad>

// Attach a cylinder directly to the TOP face of a cuboid:
cuboid([40, 30, 15], rounding=3, anchor=BOTTOM) {
    // Child geometry attaches relative to parent surface
    attach(TOP, align=CENTER)
        cyl(d=12, h=10, anchor=BOTTOM);
        
    // Attach screw boss to the RIGHT side
    position(RIGHT)
        cyl(d=8, h=6, anchor=LEFT);
}
```

### BOSL2 Anchors Reference
- **Cardinal Anchors**: `TOP`, `BOTTOM`, `LEFT`, `RIGHT`, `FRONT`, `BACK`, `CENTER`.
- **Compound Anchors**: `TOP+RIGHT`, `BOTTOM+FRONT+LEFT`.
- **`attach()` vs `position()`**:
  - `attach(face)`: Re-orients the child so its default bottom attaches perpendicular to the parent's face.
  - `position(face)`: Moves the child to the parent's anchor point without rotating it.

---

## Headless CLI Image & STL Rendering (Zero-MCP Fallback)

If the OpenSCAD MCP server is unavailable, render previews directly from the command line:

```bash
# 1. Fast PNG preview render with Manifold backend & custom camera
openscad -o preview.png --camera=0,0,0,55,0,25,120 --imgsize=1024,768 --colorscheme="Tomorrow Night" --backend=manifold model.scad

# 2. Orthographic top-down / front view
openscad -o top_view.png --projection=o --camera=0,0,0,0,0,0,100 model.scad

# 3. Export production STL or 3MF
openscad -o output.stl --backend=manifold model.scad
openscad -o output.3mf --backend=manifold model.scad
```

---

## MCP Workflow

Use the [openscad-mcp](https://github.com/quellant/openscad-mcp) server tools to validate and render models. **Never rely solely on code review — always visually verify.**

### Design Loop
1. **Write/edit** the `.scad` code following the rules in this document.
2. **Validate syntax** $\rightarrow$ `validate_scad`.
3. **Render previews** $\rightarrow$ `render_perspectives` for multi-angle views, or `render_single` for a specific view.
4. **Visually inspect** the rendered images — check for:
   - Flatness on $Z = 0$ build plane
   - Missing or misplaced cuts (use `#` highlight modifier if unclear)
   - Wall thickness ($> 1.2\text{ mm}$ for FDM printing)
   - Overhang angles ($< 45^\circ$ without support)
5. **Export** $\rightarrow$ `export_model` to generate STL/3MF once verified.

> [!TIP]
> **Fast CSG Rendering (`Manifold` Backend):**
> Modern OpenSCAD features the high-performance **Manifold** backend, rendering CSG booleans **100x to 1000x faster** than the legacy CGAL engine. In CLI commands, pass `--backend=manifold`. In OpenSCAD GUI, enable via **Edit > Preferences > Advanced > 3D Rendering > Backend > Manifold**.

---

## Complete Parametric Example

```openscad
// Parametric Mounting Bracket (Production Quality)

/* [Bracket Dimensions] */
base_width  = 30;  // [20:60]
base_depth  = 20;  // [10:40]
base_thick  = 4;   // [2:0.5:8]
wall_height = 25;  // [15:50]
wall_thick  = 3;   // [2:0.5:6]

/* [Mounting Holes] */
hole_d      = 3.4; // [2.5:0.1:6] M3 clearance (+0.4mm print tolerance)
hole_inset  = 6;   // [4:15]

/* [Reinforcement] */
rib_thick   = 3;   // [2:6]

/* [Hidden] */
epsilon     = 0.01;
$fa         = $preview ? 12 : 5;
$fs         = $preview ? 1.5 : 0.4;

module bracket_body() {
    // Base plate
    cube([base_width, base_depth, base_thick]);
    
    // Upright wall with overlap into base
    translate([0, 0, base_thick - epsilon])
        cube([wall_thick, base_depth, wall_height + epsilon]);
        
    // Triangular gusset rib using 2D polygon extrusion
    translate([wall_thick - epsilon, (base_depth - rib_thick) / 2, base_thick - epsilon])
        rotate([0, -90, 0])
            linear_extrude(height = rib_thick, convexity = 4)
                polygon(points = [
                    [0, 0],
                    [wall_height - 5, 0],
                    [0, base_width - wall_thick - 5]
                ]);
}

module mounting_holes() {
    for (y = [hole_inset, base_depth - hole_inset]) {
        translate([base_width * 0.6, y, -epsilon])
            cylinder(h = base_thick + 2 * epsilon, d = hole_d);
    }
}

// === Final Assembly ===
difference() {
    bracket_body();
    mounting_holes();
}
```
