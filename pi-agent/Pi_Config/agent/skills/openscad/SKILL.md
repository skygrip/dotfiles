---
name: openscad
description: OpenSCAD workflow, best practices, and anti-patterns. Load before writing OpenSCAD code.
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

OpenSCAD is **declarative and functional**, not imperative. If you're trained on Python/JS/C++, you must adjust.

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

**Loop accumulation does not work:**
```openscad
// WRONG
total = 0;
for (h = [10, 20, 30]) {
    total = total + h; // Does NOT accumulate — each iteration shadows, not mutates
}

// CORRECT — use recursion
function sum_list(lst, i = 0) =
    i >= len(lst) ? 0 : lst[i] + sum_list(lst, i + 1);

total = sum_list([10, 20, 30]); // = 60
```

### Modules Generate Geometry, Functions Return Values
- **`module`**: Produces 2D/3D shapes. Cannot return values. No `return` keyword.
- **`function`**: Computes and returns numbers, vectors, strings. Cannot produce geometry.

Do not confuse these — they are not interchangeable.

### `use` vs `include`
```openscad
use <file.scad>      // Imports modules and functions ONLY. Does NOT run top-level code.
include <file.scad>  // Runs EVERYTHING in the file, including top-level geometry.
```

Use `include` for BOSL2 (`include <BOSL2/std.scad>`). Use `use` for your own library files where you only want the modules/functions.

---

## Syntax Traps

These are the mistakes LLMs make most frequently. Internalise these before writing any code.

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

**The rule:**
- **Semicolon AFTER**: primitives (`cube();`), variable declarations (`x = 5;`), module calls (`my_part();`)
- **No semicolon AFTER**: transforms (`translate() { }`), booleans (`difference() { }`), module definitions (`module foo() { }`)

### Trap 2: Transformation Order Is Inside-Out
Transformations apply from the **innermost** (closest to geometry) **outward**. Read them bottom-up.

```openscad
// This ROTATES first, THEN translates:
translate([10, 0, 0])
    rotate([0, 0, 45])
        cube([5, 5, 5]);

// This TRANSLATES first, THEN rotates (different result!):
rotate([0, 0, 45])
    translate([10, 0, 0])
        cube([5, 5, 5]);
```

### Trap 3: Forgetting `$fn` (Low-Poly Curves)
Without setting `$fn`, spheres and cylinders render with very few facets — ugly and dimensionally inaccurate.

```openscad
$fn = 64; // Set near the top of the file

// Or per-shape:
cylinder(h = 10, r = 5, $fn = 32);
```

Use `$fn = 32` to `64` for most parts. Higher values (100+) slow rendering significantly on complex models. For draft previews, `$fn = 16` is fine.

### Trap 4: `center` Parameter Defaults
These are inconsistent across primitives — don't assume:

| Primitive    | Default `center` | Meaning when `false`                    |
|-------------|-------------------|------------------------------------------|
| `cube()`     | `false`           | Corner at origin, extends into +X/+Y/+Z |
| `cylinder()` | `false`           | Base on Z=0, extends upward              |
| `sphere()`   | Always centered   | No `center` parameter                   |

### Trap 5: `rotate_extrude` Y-Axis Crossing
The 2D profile **must not cross the Y axis** (all X values ≥ 0). OpenSCAD silently produces garbage geometry if it does.

```openscad
// WRONG — circle centered at origin crosses Y axis
rotate_extrude($fn = 64)
    circle(r = 10);

// CORRECT — translate profile into positive X
rotate_extrude($fn = 64)
    translate([20, 0, 0])
        circle(r = 5);
```

### Trap 6: Named vs Positional Parameters
Always prefer named parameters. Positional ordering varies by primitive and is easy to get wrong. You cannot mix named-then-positional.

```openscad
// GOOD — clear and unambiguous
cylinder(h = 10, r1 = 5, r2 = 3, center = true);

// BAD — what does cylinder(10, 5, 3) mean? (h, r1, r2 positionally)
cylinder(10, 5, 3);

// INVALID — cannot put positional after named
cylinder(h = 10, 5);
```

---

## 3D Printing Rules

### The Z-Fighting / Epsilon Rule
When subtracting shapes, if faces are coplanar, you get visual glitches and non-manifold STLs. Always pad cutting geometry.

```openscad
epsilon = 0.01;

difference() {
    cube([10, 10, 10], center = true);
    // Extended by epsilon on both ends to fully pierce
    cylinder(h = 10 + 2 * epsilon, r = 2, center = true);
}
```

**Declare `epsilon = 0.01;` at the top of every file.** Use it in every `difference()` cut.

### Non-Manifold Geometry (Overlap Rule)
Two shapes sharing only a point or edge (not volume) produce non-manifold, unprintable meshes. Always overlap slightly.

```openscad
// WRONG — shares a single edge
union() {
    cube([10, 10, 10]);
    translate([10, 10, 0]) cube([10, 10, 10]);
}

// CORRECT — 0.1mm overlap creates solid joint
overlap = 0.1;
union() {
    cube([10, 10, 10]);
    translate([10 - overlap, 10 - overlap, 0]) cube([10, 10, 10]);
}
```

### Clearance Tolerances
| Fit Type     | Gap            | Example                              |
|-------------|----------------|---------------------------------------|
| Slide fit    | 0.2 to 0.4mm   | Lid on a box                         |
| Press fit    | 0.1 to 0.15mm  | Snap-fit joints                      |
| Bolt hole    | +0.2mm         | 3.2mm hole for M3 screw              |

---

## Best Practices

### File Structure Template
```openscad
// === Parameters ===
/* [Main Dimensions] */
width = 40;        // [20:100]
height = 30;       // [10:80]
wall = 2;          // [1:0.5:5]

/* [Hidden] */
epsilon = 0.01;
$fn = 64;

// === Modules ===
module main_body() {
    difference() {
        cube([width, height, wall * 2], center = true);
        // cuts go here, always using epsilon
    }
}

// === Assembly ===
main_body();
```

### Customizer Annotations
Place parameters at the top with bracket comments for UI generation:
```openscad
box_width = 40;       // [20:100] Slider 20–100
step_val = 5;         // [0:5:50] Slider with step of 5
material = "PLA";     // [PLA, ABS, PETG] Dropdown
wall_type = 2;        // [1:Thin, 2:Standard, 4:Reinforced] Labeled dropdown
```

Use `/* [Tab Name] */` to group parameters and `/* [Hidden] */` to hide internal variables.

### Conditional Geometry
`if` in geometry context conditionally includes/excludes shapes from the CSG tree — it does not work like imperative if-statements:

```openscad
// Assumes epsilon = 0.01 declared at file top
module bracket(with_holes = true) {
    difference() {
        cube([20, 10, 5]);
        if (with_holes) {
            translate([10, 5, -epsilon])
                cylinder(h = 5 + 2 * epsilon, r = 2);
        }
    }
}
```

### Debugging Tools
```openscad
echo("Computed height:", box_height * 2.5);                     // Print to console
assert(wall > 0, "Wall thickness must be greater than zero!");  // Stop if invalid

// Geometry prefix modifiers:
*cube([10,10,10]);  // Disable — won't render
!cube([10,10,10]);  // Show Only — hides everything else
#cube([10,10,10]);  // Highlight — transparent pink (great for seeing cuts)
%cube([10,10,10]);  // Background — transparent gray reference, excluded from export
```

The `#` modifier is especially useful: place it on shapes inside `difference()` to visually verify cut positions.

---

## MCP Workflow

Use the [openscad-mcp](https://github.com/quellant/openscad-mcp) server tools to validate and render models. **Never rely solely on code review — always visually verify.**

### Design Loop
1. **Write/edit** the `.scad` code following the rules in this document
2. **Validate syntax** → `validate_scad` (catches compile errors before rendering)
3. **Render previews** → `render_perspectives` for multi-angle views, or `render_single` for a specific view
4. **Visually inspect** the rendered images — check for:
   - Symmetry and alignment
   - Missing or misplaced cuts (use `#` modifier if unclear)
   - Floating/disconnected geometry
   - Unexpected holes or artifacts
5. **Iterate** if anything looks wrong — fix code, re-render, re-inspect
6. **Export** → `export_model` to generate STL/3MF once verified

### Key MCP Tools

| Tool | Purpose |
|------|---------|
| `validate_scad` | Check syntax and compilation without rendering |
| `render_single` | Render from a specific view (`front`, `top`, `isometric`, etc.) |
| `render_perspectives` | Render from multiple angles at once |
| `compare_renders` | Side-by-side comparison of two versions |
| `export_model` | Generate STL/3MF for printing or sharing |
| `create_model` / `update_model` | Manage `.scad` files through the MCP |
| `analyze_model` | Get bounding box and geometry metadata |
| `get_libraries` | Check which libraries (e.g. BOSL2) are available |

### Using BOSL2
Check availability with `get_libraries` before writing BOSL2 code. If available:
```openscad
include <BOSL2/std.scad>
```
Consult the [BOSL2 Wiki](https://github.com/revarbat/BOSL2/wiki) and [Cheat Sheet](https://github.com/revarbat/BOSL2/wiki/CheatSheet) for the full API — it provides rounded primitives, anchor/attachment positioning, path sweeps, and duplication helpers that eliminate most manual coordinate math.

---

## Complete Example

A parametric mounting bracket demonstrating file structure, customizer params, epsilon usage, boolean operations, and idiomatic style:

```openscad
// Parametric Mounting Bracket

/* [Bracket Dimensions] */
base_width = 30;       // [20:60]
base_depth = 20;       // [10:40]
base_thick = 4;        // [2:0.5:8]
wall_height = 25;      // [15:50]
wall_thick = 3;        // [2:0.5:6]

/* [Mounting Holes] */
hole_diameter = 3.2;   // [2.5:0.1:6] M3 = 3.2, M4 = 4.2, M5 = 5.2
hole_inset = 8;        // [5:20]

/* [Style] */
fillet_r = 2;          // [0:0.5:5]

/* [Hidden] */
epsilon = 0.01;
$fn = 48;

module base_plate() {
    cube([base_width, base_depth, base_thick]);
}

module upright_wall() {
    translate([0, 0, base_thick - epsilon])
        cube([wall_thick, base_depth, wall_height]);
}

module fillet_support() {
    if (fillet_r > 0) {
        translate([wall_thick, 0, base_thick])
            rotate([-90, 0, 0])
                linear_extrude(height = base_depth)
                    difference() {
                        square([fillet_r, fillet_r]);
                        translate([fillet_r, fillet_r])
                            circle(r = fillet_r);
                    }
    }
}

module mounting_holes() {
    for (y_pos = [hole_inset, base_depth - hole_inset]) {
        translate([base_width / 2, y_pos, -epsilon])
            cylinder(h = base_thick + 2 * epsilon, d = hole_diameter);
    }
}

// === Assembly ===
difference() {
    union() {
        base_plate();
        upright_wall();
        fillet_support();
    }
    mounting_holes();
}
```
