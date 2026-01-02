---
description: modularizer
auto_execution_mode: 3
---

# Modularization Quick Reference

## 🎯 Goal
Break large files into focused modules (150-170 lines each) while maintaining identical functionality. Supports both frontend (Angular) and backend (NestJS) modularization.

## 📋 Frontend (Angular) Modularization

### Angular Module Structure
```
src/
├── app/
│   ├── core/                    # Singleton services, guards, interceptors
│   ├── shared/                  # Shared components, directives, pipes
│   ├── features/                # Feature modules (lazy-loaded)
│   │   ├── feature1/
│   │   │   ├── components/     # Feature-specific components
│   │   │   ├── services/       # Feature-specific services
│   │   │   ├── models/         # Feature interfaces/types
│   │   │   ├── feature1.module.ts
│   │   │   └── feature1-routing.module.ts
```

### Angular Best Practices
- Use lazy loading for feature modules
- Keep components focused (max 3 files: .ts, .html, .scss)
- Follow Angular style guide naming conventions
- Use barrel files (index.ts) for cleaner imports
- Implement shared module for common components

## 📋 Backend (NestJS) Modularization

### NestJS Module Structure
```
src/
├── modules/
│   ├── module1/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── module1.controller.ts
│   │   ├── module1.service.ts
│   │   └── module1.module.ts
│  n├── shared/
│      ├── decorators/
│      ├── filters/
│      └── interceptors/
```

### NestJS Best Practices
- Follow Domain-Driven Design (DDD)
- Keep controllers thin (delegate to services)
- Use dependency injection
- Implement proper error handling
- Use DTOs for data transfer

## 📋 General 5-Step Process

### 0️⃣ Test Baseline
```bash
# Run tests or manual check
npm test -- [file-name]
# OR
node -e "const S = require('./service'); console.log('✅', S.getInstance());"
```

### 1️⃣ Backup
```bash
BACKUP_DIR="backups/modularization-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp service.js "$BACKUP_DIR/service.js.backup"
```

### 2️⃣ Extract Modules
```bash
# Analyze
wc -l service.js
grep -n "^class\|^  async" service.js

# Create structure
mkdir -p service-name/{providers,utils,strategies,handlers}

# Extract to modules (150-170 lines each)
# - providers/ → External APIs
# - utils/ → Helpers, formatters
# - strategies/ → Business logic
# - handlers/ → Request/response
```

### 3️⃣ Create Clean Version
```bash
cp service.js service.clean.js
# Edit service.clean.js:
# - Import modules
# - Delegate to modules
# - Keep public API identical
```

### 4️⃣ Replace Original
```bash
mv service.js "$BACKUP_DIR/service.js.original"
mv service.clean.js service.js
```

### 5️⃣ Test Again
```bash
# Same tests as Step 0
npm test -- [file-name]
# Should produce identical results ✅
```

## 🚨 Rollback
```bash
cp "$BACKUP_DIR/service.js.backup" service.js
```

## ✅ Success Criteria
- [ ] All files ≤ 170 lines
- [ ] Tests pass (same as baseline)
- [ ] Public API unchanged
- [ ] Backup verified

## 📁 Module Categories

### Frontend (Angular)
| Category | Purpose | Examples |
|----------|---------|----------|
| **core/** | Singleton services | Auth, API, interceptors |
| **shared/** | Reusable components | UI components, pipes, directives |
| **features/** | Feature modules | Lazy-loaded feature modules |
| **models/** | Type definitions | Interfaces, enums, types |
| **services/** | Data access | API services, state management |

### Backend (NestJS)
| Category | Purpose | Examples |
|----------|---------|----------|
| **modules/** | Feature modules | User, Auth, Products |
| **common/** | Shared utilities | Filters, guards, interceptors |
| **config/** | Configuration | App config, env vars |
| **providers/** | External services | Database, cache, queue |
| **interfaces/** | Type definitions | DTOs, entities, interfaces |

## 🔍 Quick Commands

```bash
# Count lines
wc -l *.js

# Find functions
grep -n "async\|function" service.js

# Check module size
find service-name -name "*.js" -exec wc -l {} +

# Test loading
node -e "require('./service')"