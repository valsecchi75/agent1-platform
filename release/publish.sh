#!/bin/bash
cd "$(dirname "$0")/.."

echo ""
echo "  ========================================"
echo "   AGENT 1 — Release Publisher (Delta)"
echo "  ========================================"
echo ""

# ================================================================
#  LOG SETUP
# ================================================================
mkdir -p "release/logs"
LOG_TS=$(date +"%Y-%m-%d-%H%M%S")
LOG_FILE="release/logs/publish-${LOG_TS}.log"
echo "[$(date)] Publish started" > "$LOG_FILE"

log() {
  echo "  $1"
  echo "[$(date)] $1" >> "$LOG_FILE" 2>/dev/null
}

# ================================================================
#  STEP 1 — Prerequisiti + Info versione
# ================================================================

command -v node >/dev/null 2>&1 || { log "[ERROR] Node.js not found."; exit 1; }
command -v git >/dev/null 2>&1 || { log "[ERROR] Git not found."; exit 1; }
command -v gh >/dev/null 2>&1 || { log "[ERROR] GitHub CLI not found. Install: brew install gh"; exit 1; }
gh auth status >/dev/null 2>&1 || { log "[ERROR] GitHub CLI not authenticated. Run: gh auth login"; exit 1; }

CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
log "Versione corrente: $CURRENT_VERSION"
echo ""

# Flags
DRY_RUN=0
FORCE_FULL=0
for arg in "$@"; do
  [ "$arg" = "--dry-run" ] && DRY_RUN=1
  [ "$arg" = "--full" ] && FORCE_FULL=1
done

if [ "$DRY_RUN" = "1" ]; then
  log "========================================="
  log " DRY RUN — no real actions"
  log "========================================="
  echo ""
fi

if [ "$FORCE_FULL" = "1" ]; then
  log "[INFO] FULL mode forced (--full)"
  echo ""
fi

# Detect phase
if echo "$CURRENT_VERSION" | grep -q "\-alpha"; then
  PHASE="alpha"
elif echo "$CURRENT_VERSION" | grep -q "\-beta"; then
  PHASE="beta"
else
  PHASE="stable"
fi

# ================================================================
#  STEP 2 — Choose bump type
# ================================================================

if [ "$PHASE" = "alpha" ]; then
  echo "  Phase: ALPHA"
  echo ""
  echo "  Choose release type:"
  echo "    [a] Alpha patch    0.9.x-alpha > 0.9.y-alpha"
  echo "    [b] Promote to Beta          > 1.0.0-beta"
  echo "    [r] Final release            > 1.0.0"
  echo ""
  read -p "  Choice: " BUMP
elif [ "$PHASE" = "beta" ]; then
  echo "  Phase: BETA"
  echo ""
  echo "  Choose release type:"
  echo "    [b] Beta patch     1.0.0-beta.x > 1.0.0-beta.y"
  echo "    [r] Final release              > 1.0.0"
  echo ""
  read -p "  Choice: " BUMP
else
  echo "  Phase: STABLE"
  echo ""
  echo "  Choose release type:"
  echo "    [p] Patch   (bug fix)"
  echo "    [m] Minor   (new features)"
  echo "    [M] Major   (breaking changes)"
  echo ""
  read -p "  Choice: " BUMP
fi

# Calculate new version
NEW_VERSION=$(node -e "
const v = '$CURRENT_VERSION';
const b = '$BUMP';
const phase = '$PHASE';
let nv;
if (phase === 'alpha') {
  if (b === 'a') {
    const p = v.match(/^(\d+)\.(\d+)\.(\d+)/);
    nv = p[1] + '.' + p[2] + '.' + (parseInt(p[3]) + 1) + '-alpha';
  } else if (b === 'b') { nv = '1.0.0-beta'; }
  else if (b === 'r') { nv = '1.0.0'; }
  else { nv = null; }
} else if (phase === 'beta') {
  if (b === 'b') {
    const m = v.match(/beta\.?(\d*)/);
    const n = m && m[1] ? parseInt(m[1]) + 1 : 1;
    nv = '1.0.0-beta.' + n;
  } else if (b === 'r') { nv = '1.0.0'; }
  else { nv = null; }
} else {
  const p = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  const ma = parseInt(p[1]), mi = parseInt(p[2]), pa = parseInt(p[3]);
  if (b === 'p') nv = ma + '.' + mi + '.' + (pa + 1);
  else if (b === 'm') nv = ma + '.' + (mi + 1) + '.0';
  else if (b === 'M') nv = (ma + 1) + '.0.0';
  else nv = null;
}
console.log(nv || 'ERROR');
")

if [ "$NEW_VERSION" = "ERROR" ] || [ -z "$NEW_VERSION" ]; then
  log "[ERROR] Invalid choice."
  exit 1
fi

echo ""
log "New version: $NEW_VERSION"
echo ""
read -p "  Confirm this version? (y/n): " CONFIRM_VER
if [ "$CONFIRM_VER" != "y" ] && [ "$CONFIRM_VER" != "Y" ] && [ "$CONFIRM_VER" != "s" ] && [ "$CONFIRM_VER" != "S" ]; then
  echo "  Cancelled."
  exit 0
fi

# Update package.json + start scripts
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='$NEW_VERSION';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
log "[OK] package.json updated to v$NEW_VERSION"

for STARTER in start.sh start.bat; do
  if [ -f "$STARTER" ]; then
    node -e "const fs=require('fs');const f='$STARTER';let c=fs.readFileSync(f,'utf8');c=c.replace(/v\d+\.\d+\.\d+[^\s]*/,'v$NEW_VERSION');fs.writeFileSync(f,c)"
    log "[OK] $STARTER updated"
  fi
done

ZIP_NAME="agent1-v${NEW_VERSION}.zip"

# Dry run skips steps 3-6
if [ "$DRY_RUN" = "1" ]; then
  echo ""
  echo "  ========================================"
  echo "   PUBLICATION SUMMARY"
  echo "  ========================================"
  echo ""
  echo "  Version:        v$NEW_VERSION"
  echo "  Repository:     valsecchi75/agent1-platform"
  echo "  Tag:            v$NEW_VERSION"
  echo "  Zip:            [not created — dry run]"
  echo ""
  log "[DRY RUN] No publication performed."
  echo "  Command that would be executed:"
  echo "  gh release create \"v$NEW_VERSION\" \"$ZIP_NAME\" --title \"AGENT 1 v$NEW_VERSION\" --notes-file \"release/release-notes.tmp\" --repo valsecchi75/agent1-platform"
  echo ""
  exit 0
fi

# Helper: cleanup on abort
abort_cleanup() {
  echo ""
  log "Operation cancelled."
  rm -f "release/release-notes.tmp" 2>/dev/null
  rm -f "$ZIP_NAME" 2>/dev/null
  rm -rf ".release-staging" 2>/dev/null
  echo "  [INFO] package.json has already been updated to v$NEW_VERSION."
  echo "  [INFO] If you want to cancel the bump too: git checkout package.json start.bat start.sh"
  echo ""
  exit 0
}

# ================================================================
#  STEP 2b — Auto-commit pending changes (GR-007)
# ================================================================
echo ""
echo "  ----------------------------------------"
echo "   STEP 2b: Check uncommitted changes"
echo "  ----------------------------------------"
echo ""

HAS_CHANGES=0
if ! git diff --quiet --exit-code 2>/dev/null; then HAS_CHANGES=1; fi
if ! git diff --quiet --cached --exit-code 2>/dev/null; then HAS_CHANGES=1; fi
UNTRACKED=$(git ls-files --others --exclude-standard | wc -l)
if [ "$UNTRACKED" -gt 0 ]; then HAS_CHANGES=1; fi

if [ "$HAS_CHANGES" -eq 0 ]; then
  echo "  [OK] No pending changes."
  log "[OK] Clean working tree"
else
  echo "  Found uncommitted changes:"
  git status --short
  echo ""
  read -p "  Auto-commit before release? (y/n): " AUTO_COMMIT
  if [ "$AUTO_COMMIT" = "y" ] || [ "$AUTO_COMMIT" = "Y" ] || [ "$AUTO_COMMIT" = "s" ] || [ "$AUTO_COMMIT" = "S" ]; then
    git add -A
    if git commit -m "chore: pre-release changes for v${NEW_VERSION}"; then
      echo "  [OK] Changes auto-committed."
      log "[OK] Auto-commit pre-release"
    else
      echo "  [WARNING] Commit failed. Proceeding anyway."
      log "[WARN] Auto-commit failed"
    fi
  else
    echo "  [WARNING] Proceeding without commit. Delta may not include latest changes."
    log "[WARN] User chose not to commit"
  fi
fi

# ================================================================
#  STEP 3 — Build di verifica
# ================================================================
echo ""
echo "  ----------------------------------------"
echo "   STEP 3: Verification build"
echo "  ----------------------------------------"
echo ""

if npm run build; then
  log "[OK] Build succeeded"
else
  log "[ERROR] Build failed."
  read -p "  Do you want to abort or continue anyway? (a/c): " BUILD_CHOICE
  if [ "$BUILD_CHOICE" != "c" ] && [ "$BUILD_CHOICE" != "C" ]; then
    abort_cleanup
  fi
  log "[WARNING] Continuing despite build failure."
fi

echo ""
read -p "  Continue with zip creation? (y/n): " CONFIRM_ZIP
if [ "$CONFIRM_ZIP" != "y" ] && [ "$CONFIRM_ZIP" != "Y" ] && [ "$CONFIRM_ZIP" != "s" ] && [ "$CONFIRM_ZIP" != "S" ]; then
  abort_cleanup
fi

# ================================================================
#  STEP 4 — Delta detection + Creazione zip
# ================================================================
echo ""
echo "  ----------------------------------------"
echo "   STEP 4: Delta detection + Zip creation"
echo "  ----------------------------------------"
echo ""

rm -f "$ZIP_NAME"

if [ ! -f "release/.releaseinclude" ]; then
  log "[ERROR] File release/.releaseinclude not found."
  exit 1
fi

# Detect last release tag
LAST_TAG=""
RELEASE_TYPE="full"

if [ "$FORCE_FULL" = "0" ]; then
  LAST_TAG=$(git tag --list "v*" --sort=-version:refname 2>/dev/null | head -1)
fi

if [ -z "$LAST_TAG" ]; then
  log "[INFO] No previous tag found. Creating FULL release."
  RELEASE_TYPE="full"
  PREVIOUS_VERSION="none"
else
  log "[INFO] Last tag: $LAST_TAG - Creating DELTA release."
  RELEASE_TYPE="delta"
  PREVIOUS_VERSION="${LAST_TAG#v}"
fi

TEMP_DIR=".release-staging"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

if [ "$RELEASE_TYPE" = "full" ]; then
  # ================================================================
  #  FULL release: include everything from .releaseinclude
  # ================================================================
  log "Creating FULL ZIP (all files from whitelist)..."

  while IFS= read -r line; do
    line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -z "$line" ] && continue
    [[ "$line" == \#* ]] && continue
    item="${line%/}"
    if [ -e "$item" ]; then
      parent=$(dirname "$TEMP_DIR/$item")
      mkdir -p "$parent"
      cp -r "$item" "$TEMP_DIR/$item"
    fi
  done < release/.releaseinclude

  # Generate manifest
  node -e "var fs=require('fs');var m={version:'$NEW_VERSION',previousVersion:'$PREVIOUS_VERSION',type:'full',files:[],deleted:[],timestamp:new Date().toISOString()};fs.writeFileSync('.release-staging/manifest.json',JSON.stringify(m,null,2)+'\n')"
  log "[OK] manifest.json generato (type: full)"

else
  # ================================================================
  #  DELTA release: include only changed files
  # ================================================================
  log "Computing diff between $LAST_TAG and HEAD..."

  CHANGED_FILES=$(git diff --name-only "$LAST_TAG" HEAD 2>/dev/null)
  DELETED_FILES=$(git diff --diff-filter=D --name-only "$LAST_TAG" HEAD 2>/dev/null)

  # Use Node.js to filter against whitelist and populate staging
  DELTA_RESULT=$(node -e "
var fs = require('fs');
var path = require('path');
var changed = \`$CHANGED_FILES\`.split('\n').map(l => l.trim()).filter(Boolean);
var deleted = \`$DELETED_FILES\`.split('\n').map(l => l.trim()).filter(Boolean);
var wl = fs.readFileSync('release/.releaseinclude', 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
function matchWl(f) {
  return wl.some(w => {
    var w2 = w.endsWith('/') ? w.slice(0, -1) : w;
    return w.endsWith('/') ? f.startsWith(w2 + '/') : f === w2;
  });
}
var included = changed.filter(matchWl);
var deletedIncl = deleted.filter(matchWl);
if (included.length === 0) { console.log('NO_CHANGES'); process.exit(0); }
var td = '.release-staging';
var copied = 0;
for (var f of included) {
  if (!fs.existsSync(f)) continue;
  var dest = path.join(td, f);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    var st = fs.statSync(f);
    if (st.isDirectory()) { fs.cpSync(f, dest, { recursive: true }); }
    else { fs.copyFileSync(f, dest); }
    copied++;
  } catch (e) { console.error('WARN: skip ' + f + ': ' + e.message); }
}
var manifest = {
  version: '$NEW_VERSION',
  previousVersion: '$PREVIOUS_VERSION',
  type: 'delta',
  files: included,
  deleted: deletedIncl,
  timestamp: new Date().toISOString()
};
fs.writeFileSync(path.join(td, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('DELTA_OK:' + copied + ':' + deletedIncl.length);
" 2>>"$LOG_FILE")

  if [ "$DELTA_RESULT" = "NO_CHANGES" ]; then
    log "[ERROR] No files changed since $LAST_TAG. Nothing to release."
    abort_cleanup
  fi

  DELTA_FILES=$(echo "$DELTA_RESULT" | grep "DELTA_OK:" | cut -d: -f2)
  DELTA_DELETED=$(echo "$DELTA_RESULT" | grep "DELTA_OK:" | cut -d: -f3)

  log "[OK] Delta: $DELTA_FILES files changed, $DELTA_DELETED files deleted"
  log "[OK] manifest.json generated (type: delta)"

  # Ensure package.json is in delta for version verification
  if [ ! -f "$TEMP_DIR/package.json" ] && [ -f "package.json" ]; then
    cp "package.json" "$TEMP_DIR/package.json"
    log "[OK] package.json included in delta"
  fi
fi

# Create ZIP
FILE_COUNT=$(find "$TEMP_DIR" -type f | wc -l | tr -d ' ')
(cd "$TEMP_DIR" && zip -r -q "../$ZIP_NAME" .)
rm -rf "$TEMP_DIR"

if [ ! -f "$ZIP_NAME" ]; then
  log "[ERROR] Zip creation failed."
  exit 1
fi

SIZE=$(du -h "$ZIP_NAME" | cut -f1)
log "[OK] ZIP created: $ZIP_NAME - $SIZE - $FILE_COUNT files ($RELEASE_TYPE)"

echo ""
read -p "  Continue with git commit? (y/n): " CONFIRM_GIT
if [ "$CONFIRM_GIT" != "y" ] && [ "$CONFIRM_GIT" != "Y" ] && [ "$CONFIRM_GIT" != "s" ] && [ "$CONFIRM_GIT" != "S" ]; then
  abort_cleanup
fi

# ================================================================
#  STEP 5 — Git commit + tag + push
# ================================================================
echo ""
echo "  ----------------------------------------"
echo "   STEP 5: Git commit + tag + push"
echo "  ----------------------------------------"
echo ""
echo "  File modificati:"
git status --short
echo ""

read -p "  Confirm commit and push? (y/n): " CONFIRM_COMMIT
if [ "$CONFIRM_COMMIT" != "y" ] && [ "$CONFIRM_COMMIT" != "Y" ] && [ "$CONFIRM_COMMIT" != "s" ] && [ "$CONFIRM_COMMIT" != "S" ]; then
  abort_cleanup
fi

git add package.json start.bat start.sh 2>/dev/null || true
git commit -m "release: v$NEW_VERSION" || log "[INFO] No commit needed."

# Create git tag
git tag "v$NEW_VERSION" 2>/dev/null
if [ $? -ne 0 ]; then
  log "[WARNING] Tag v$NEW_VERSION already exists."
  read -p "  Do you want to overwrite the tag? (y/n): " TAG_CHOICE
  if [ "$TAG_CHOICE" = "y" ] || [ "$TAG_CHOICE" = "Y" ] || [ "$TAG_CHOICE" = "s" ] || [ "$TAG_CHOICE" = "S" ]; then
    git tag -d "v$NEW_VERSION" 2>/dev/null
    git tag "v$NEW_VERSION"
  fi
fi
log "[OK] Tag v$NEW_VERSION created"

if ! git push --set-upstream origin main 2>/dev/null; then
  if ! git push 2>/dev/null; then
    log "[WARNING] Push failed."
    read -p "  Do you want to do force push? (y/n): " FORCE_PUSH_CHOICE
    if [ "$FORCE_PUSH_CHOICE" = "y" ] || [ "$FORCE_PUSH_CHOICE" = "Y" ] || [ "$FORCE_PUSH_CHOICE" = "s" ] || [ "$FORCE_PUSH_CHOICE" = "S" ]; then
      git push --set-upstream origin main --force
    else
      echo "  Push skipped. You can do it manually later."
    fi
  fi
fi

# Push tag
git push origin "v$NEW_VERSION" 2>/dev/null
log "[OK] Commit, tag and push completed"
echo ""

# ================================================================
#  STEP 6 — Release notes
# ================================================================
echo "  ----------------------------------------"
echo "   STEP 6: Release notes"
echo "  ----------------------------------------"
echo ""
echo "  Genero release notes..."

node -e "const fs=require('fs');try{const c=fs.readFileSync('CHANGELOG.md','utf8');const m=c.match(/## \[Unreleased\]\s*\n([\s\S]*?)(?=\n## \[|\$)/);fs.writeFileSync('release/release-notes.tmp',m?m[1].trim():'Release v$NEW_VERSION')}catch{fs.writeFileSync('release/release-notes.tmp','Release v$NEW_VERSION')}"

echo "  Opening editor to modify release notes..."
echo ""

while true; do
  ${EDITOR:-nano} "release/release-notes.tmp"

  echo "  Release notes preview:"
  echo "  ----------------------------------------"
  head -5 "release/release-notes.tmp" | sed 's/^/  /'
  echo "  ----------------------------------------"
  echo ""

  read -p "  Release notes OK? (y/n): " NOTES_OK
  if [ "$NOTES_OK" = "y" ] || [ "$NOTES_OK" = "Y" ] || [ "$NOTES_OK" = "s" ] || [ "$NOTES_OK" = "S" ]; then
    break
  fi
done

# ================================================================
#  STEP 7 — Pubblicazione su GitHub
# ================================================================
echo ""
echo "  ========================================"
echo "   PUBLICATION SUMMARY"
echo "  ========================================"
echo ""
echo "  Version:        v$NEW_VERSION"
echo "  Type:           $RELEASE_TYPE"
echo "  Repository:     valsecchi75/agent1-platform"
echo "  Tag:            v$NEW_VERSION"
echo "  Zip:            $ZIP_NAME ($SIZE)"
echo ""
echo "  Release notes:"
echo "  ----------------------------------------"
head -3 "release/release-notes.tmp" | sed 's/^/  /'
echo "  ----------------------------------------"
echo ""
echo "  ========================================"
echo ""

read -p "  Publish the release? This action cannot be undone. (y/n): " CONFIRM_PUBLISH
if [ "$CONFIRM_PUBLISH" != "y" ] && [ "$CONFIRM_PUBLISH" != "Y" ] && [ "$CONFIRM_PUBLISH" != "s" ] && [ "$CONFIRM_PUBLISH" != "S" ]; then
  echo ""
  echo "  Publication cancelled."
  rm -f "release/release-notes.tmp" 2>/dev/null
  rm -f "$ZIP_NAME" 2>/dev/null
  exit 0
fi

echo ""
log "Publishing on GitHub..."
if ! gh release create "v$NEW_VERSION" "$ZIP_NAME" --title "AGENT 1 v$NEW_VERSION" --notes-file "release/release-notes.tmp" --repo valsecchi75/agent1-platform; then
  log "[ERROR] Publication failed (gh release create)."
  log "Check: gh auth status, ZIP size, internet connection."
  echo ""
  echo "  You can retry with: release/publish.sh"
  echo "  The ZIP is still present: $ZIP_NAME"
  exit 1
fi

log "[OK] Release v$NEW_VERSION published successfully!"
echo ""
echo "  ========================================"
echo "   Release v$NEW_VERSION completed!"
echo "  ========================================"
echo ""
echo "  URL: https://github.com/valsecchi75/agent1-platform/releases/tag/v$NEW_VERSION"
echo ""

# Cleanup
rm -f "release/release-notes.tmp" 2>/dev/null
rm -f "$ZIP_NAME" 2>/dev/null
rm -rf ".release-staging" 2>/dev/null

# Prune old logs (keep last 20)
node -e "var fs=require('fs');var p=require('path');var d='release/logs';try{var ls=fs.readdirSync(d).filter(f=>f.startsWith('publish-')&&f.endsWith('.log')).sort().reverse();for(var i=20;i<ls.length;i++){try{fs.unlinkSync(p.join(d,ls[i]))}catch(e){}}}catch(e){}" 2>/dev/null

log "Cleanup completed."
