#!/bin/bash
cd "$(dirname "$0")/.."

echo ""
echo "  ========================================"
echo "   AGENT 1 — Release Rollback"
echo "  ========================================"
echo ""
echo "  This script moves the \"latest\" flag"
echo "  to a previous GitHub release."
echo "  No releases are deleted."
echo ""
echo "  ========================================"
echo ""

# ================================================================
#  STEP 0 — Prerequisiti
# ================================================================

command -v gh >/dev/null 2>&1 || { echo "  [ERROR] GitHub CLI not found. Install: brew install gh"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "  [ERROR] GitHub CLI not authenticated. Run: gh auth login"; exit 1; }

REPO="valsecchi75/agent1-platform"

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "  [ERROR] Unable to access repo $REPO."
  echo "  Verify you have correct permissions."
  exit 1
fi

echo "  Repository: $REPO [OK]"
echo ""

# ================================================================
#  STEP 1 — Lista release disponibili
# ================================================================

echo "  ----------------------------------------"
echo "   Available releases"
echo "  ----------------------------------------"
echo ""

RELEASE_COUNT=0
CURRENT_LATEST=""
declare -a REL_TAGS

while IFS=$'\t' read -r tag status date_info; do
  RELEASE_COUNT=$((RELEASE_COUNT + 1))
  REL_TAGS[$RELEASE_COUNT]="$tag"

  if [ "$status" = "Latest" ]; then
    CURRENT_LATEST="$tag"
    echo "    $RELEASE_COUNT. $tag  ($date_info)  [LATEST]"
  else
    echo "    $RELEASE_COUNT. $tag  ($date_info)"
  fi
done < <(gh release list --repo "$REPO" --limit 10 2>/dev/null)

if [ "$RELEASE_COUNT" -eq 0 ]; then
  echo "  No releases found."
  exit 0
fi

if [ "$RELEASE_COUNT" -le 1 ]; then
  echo ""
  echo "  There is only one release. Nothing to roll back to."
  exit 0
fi

echo ""
echo "  ----------------------------------------"
echo ""

# ================================================================
#  STEP 2 — Selezione versione target
# ================================================================

read -p "  Choose the release number to promote to latest: " CHOICE

TARGET_TAG="${REL_TAGS[$CHOICE]}"

if [ -z "$TARGET_TAG" ]; then
  echo "  [ERROR] Invalid choice."
  exit 1
fi

if [ "$TARGET_TAG" = "$CURRENT_LATEST" ]; then
  echo "  [INFO] $TARGET_TAG is already the latest release."
  exit 0
fi

echo ""
echo "  You selected: $TARGET_TAG"
echo ""

# Show release details
echo "  Release details:"
echo "  ----------------------------------------"
gh release view "$TARGET_TAG" --repo "$REPO" --json body --jq ".body" 2>/dev/null | head -5 | sed 's/^/  /'
echo "  ----------------------------------------"
echo ""

# ================================================================
#  STEP 3 — Conferma
# ================================================================

echo "  ========================================"
echo "   WARNING"
echo "  ========================================"
echo ""
echo "  You are about to make $TARGET_TAG the \"latest\" release."
echo "  The current release $CURRENT_LATEST will NOT be deleted."
echo "  Clients will receive $TARGET_TAG at the next update check."
echo ""
echo "  NOTE: This does NOT modify local files. To align your"
echo "  environment, use the auto-update system from UI after rollback."
echo ""
echo "  ========================================"
echo ""

read -p "  Confirm? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ] && [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
  echo "  Cancelled."
  exit 0
fi

# ================================================================
#  STEP 4 — Esecuzione
# ================================================================

echo ""
echo "  Removing latest flag from $CURRENT_LATEST..."
if ! gh release edit "$CURRENT_LATEST" --latest=false --repo "$REPO"; then
  echo "  [ERROR] Unable to modify $CURRENT_LATEST."
  echo "  No changes made."
  exit 1
fi

echo "  Setting $TARGET_TAG as latest..."
if ! gh release edit "$TARGET_TAG" --latest=true --repo "$REPO"; then
  echo ""
  echo "  [WARNING] Latest flag may be in an undefined state."
  echo "  Check with: gh release list --repo $REPO"
  exit 1
fi

# ================================================================
#  STEP 5 — Verifica
# ================================================================

echo ""
echo "  Verifying..."
VERIFIED_TAG=$(gh release view --repo "$REPO" --json tagName --jq ".tagName" 2>/dev/null)

if [ -z "$VERIFIED_TAG" ]; then
  echo "  [WARNING] Unable to verify latest release (network or auth error)."
  echo "  Check manually: gh release list --repo $REPO"
elif [ "$VERIFIED_TAG" = "$TARGET_TAG" ]; then
  echo "  [OK] Rollback completed!"
  echo ""
  echo "  Latest release is now: $TARGET_TAG"
else
  echo "  [WARNING] Verification shows: $VERIFIED_TAG (expected: $TARGET_TAG)"
  echo "  Check manually: gh release list --repo $REPO"
fi

echo ""
