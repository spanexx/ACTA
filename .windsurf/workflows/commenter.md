---
description: commenter
auto_execution_mode: 3
---

# Commenter Quick Reference

## 🎯 Goal
Add structured, searchable comments to a single target file without changing behavior.

Deliverables inside the target file:
- A short **Code Map** section.
- A stable **Comment ID (CID)** for every meaningful functionality block.
- Each CID comment includes: what it does, what it uses, and where it’s used.

## 📋 Comment ID (CID) Format
Use a stable, human-readable format so lookups are easy:
- `CID:<file-stem>-<NNN>`
Example: `CID:runtime-ws-ipc-core-001`

Rules:
- IDs are unique within the file.
- IDs are stable: do not renumber existing IDs.

## 📋 General 5-Step Process

### 0️⃣ Baseline
```bash
# Prefer the smallest relevant check for the area you touched
npm run type-check
npm test -- [file-or-suite]
```

### 1️⃣ Capture Full Context (Dependencies + Dependers)
```bash
# Count lines / get a quick feel
wc -l path/to/file.ts

# See imports and exports
rg -n "^import " path/to/file.ts
rg -n "^export " path/to/file.ts

# If the file is imported elsewhere (depender search)
# Use the real path and/or barrel export path as needed
rg -n "from '.*path/to/file'" .

# If it exports symbols, find usage by symbol name (best-effort)
# (Repeat per exported symbol)
rg -n "\\bExportedSymbolName\\b" .
```

### 2️⃣ Build a Code Map (Top of File)
Add a short header comment at the top of the file with:
- List of main responsibilities (1-5 bullets)
- CID index: `CID -> short name`
- Quick lookup hints: `rg -n "CID:<file-stem>-" path/to/file.ts`

### 3️⃣ Assign CIDs to Functionality Blocks
Identify blocks that deserve a CID:
- Top-level exported functions/classes
- Key private helpers that implement distinct behavior
- Non-trivial branches/state machines/message routing sections

Create (or reuse) IDs:
- Start at `CID:<file-stem>-001` and increment for new blocks only.
- If a block already has a CID, keep it.

### 4️⃣ Add Structured Comments Per Block
For each CID block, add a concise comment immediately above it:
- `CID` + short title
- **Purpose**: what it does
- **Uses**: key dependencies (imports, injected services, important helpers)
- **Used by**: key dependers (call sites, router cases, public entrypoints)

Constraints:
- Do not change runtime behavior.
- Do not add or remove exports.
- Do not reformat unrelated code.

### 5️⃣ Verify + Demonstrate Lookup
```bash
npm run type-check
npm test -- [file-or-suite]

# CID lookup
rg -n "CID:<file-stem>-" path/to/file.ts

# Jump from a CID to its dependers (paste symbol names as needed)
rg -n "\\b<ClassOrFunctionName>\\b" .
```

## 🚨 Rollback
```bash
# If you created a backup copy
cp path/to/file.ts.backup path/to/file.ts

# Or revert via git
git checkout -- path/to/file.ts
```

## ✅ Success Criteria
- [ ] No behavior changes (type-check + tests pass)
- [ ] File contains a short Code Map at the top
- [ ] Every meaningful functionality block has a CID comment
- [ ] Each CID comment states purpose, uses, and used-by (best-effort)
- [ ] `rg -n "CID:<file-stem>-" path/to/file.ts` provides a complete index

## 🔍 Quick Commands
```bash
# Show structure
rg -n "^(export )?(class|function)|^export (const|type|interface)" path/to/file.ts

# Imports (dependencies)
rg -n "^import " path/to/file.ts

# Dependers (who imports this file)
rg -n "from '.*path/to/file'" .

# CID audit
rg -n "CID:" path/to/file.ts
```
