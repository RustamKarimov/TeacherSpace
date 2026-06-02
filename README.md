# TeacherDesk

TeacherDesk is a local-first Windows desktop application for a Cambridge AS/A Level Physics teacher. The first implementation milestone is the reusable component system and component gallery, followed by the Electron, React, TypeScript, and local SQLite foundation required for MCQ authoring.

## Stack

- Electron desktop shell
- React + TypeScript + Vite renderer
- SQL.js-backed local SQLite database file
- TipTap editor foundation
- KaTeX equation rendering
- PDF generation support through `pdf-lib`
- Lucide icons throughout the UI
- Floating UI for tooltips and popovers
- Vitest and Playwright dependencies for verification

## Local Workspace

On first desktop launch, TeacherDesk creates:

```text
TeacherDesk_Workspace/
  database/
    teacherdesk.sqlite
  mcq/
    assets/
      question_images/
      option_images/
      table_cell_images/
    generated_exams/
    exports/
    imports/
  source_papers/
  question_bank/
  generated_exams/
  backups/
  logs/
```

Paths stored for workspace-local assets should be relative to the workspace root whenever possible.

## Start

Double-click `Start TeacherDesk.bat`, or run:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run electron:dev
```

## Verify

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run test
& 'C:\Program Files\nodejs\npm.cmd' run build
```

## Current Scope

Implemented first:

- Project scaffold and dependency setup
- Electron shell and secure preload IPC
- Local workspace folder creation
- Local SQLite migration foundation
- Light and dark themes
- Shared component system
- Component gallery as the first screen

MCQ module pages should be built only after new shared components are added to the component system and represented in the gallery.
