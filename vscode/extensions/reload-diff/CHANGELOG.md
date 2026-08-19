# Change Log

All notable changes to the "Reload Diff" extension will be documented in this file.

## [1.0.0] - 2026-08-19

### Initial Release
- **Silent Reload Detection**: Automatic tracking and diff computation when open files are modified externally.
- **Visual Decorations**:
  - Soft green line wash and 4px left-edge bar for additions.
  - Soft blue line wash and 4px left-edge bar for modifications.
  - High-contrast per-word / intra-line character highlight boxes for modified tokens.
  - Red overview ruler markers for deletions.
- **Interactive Features**:
  - Native Markdown Hover Provider for inline before/after code inspection.
  - Live Status Bar badge displaying change counts (`+X ~Y -Z`) with 1-click inline diff launch.
  - Automatic 30-second fade out timer (customizable via settings).
- **Offline & Zero Dependencies**:
  - Optimized Myers diff algorithm with common prefix/suffix trimming.
  - Full support for workspaces without Git repositories.
