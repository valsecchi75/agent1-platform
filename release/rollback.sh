#!/bin/bash
cd "$(dirname "$0")/.."

echo ""
echo "  ========================================"
echo "   AGENT 1 — Release Rollback"
echo "  ========================================"
echo ""
echo "  Questo script sposta il flag \"latest\""
echo "  su una release precedente di GitHub."
echo "  Nessuna release viene cancellata."
echo ""
echo "  ========================================"
echo ""

# ================================================================
#  STEP 0 — Prerequisiti
# ================================================================

command -v gh >/dev/null 2>&1 || { echo "  [ERRORE] GitHub CLI non trovato. Installa: brew install gh"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "  [ERRORE] GitHub CLI non autenticato. Lancia: gh auth login"; exit 1; }

REPO="valsecchi75/agent1-platform"

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "  [ERRORE] Impossibile accedere al repo $REPO."
  echo "  Verifica di avere i permessi corretti."
  exit 1
fi

echo "  Repository: $REPO [OK]"
echo ""

# ================================================================
#  STEP 1 — Lista release disponibili
# ================================================================

echo "  ----------------------------------------"
echo "   Release disponibili"
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
  echo "  Nessuna release trovata."
  exit 0
fi

if [ "$RELEASE_COUNT" -le 1 ]; then
  echo ""
  echo "  C'e' solo una release. Non c'e' niente a cui tornare."
  exit 0
fi

echo ""
echo "  ----------------------------------------"
echo ""

# ================================================================
#  STEP 2 — Selezione versione target
# ================================================================

read -p "  Scegli il numero della release da promuovere a latest: " CHOICE

TARGET_TAG="${REL_TAGS[$CHOICE]}"

if [ -z "$TARGET_TAG" ]; then
  echo "  [ERRORE] Scelta non valida."
  exit 1
fi

if [ "$TARGET_TAG" = "$CURRENT_LATEST" ]; then
  echo "  [INFO] $TARGET_TAG e' gia la release latest."
  exit 0
fi

echo ""
echo "  Hai scelto: $TARGET_TAG"
echo ""

# Show release details
echo "  Dettagli release:"
echo "  ----------------------------------------"
gh release view "$TARGET_TAG" --repo "$REPO" --json body --jq ".body" 2>/dev/null | head -5 | sed 's/^/  /'
echo "  ----------------------------------------"
echo ""

# ================================================================
#  STEP 3 — Conferma
# ================================================================

echo "  ========================================"
echo "   ATTENZIONE"
echo "  ========================================"
echo ""
echo "  Stai per rendere $TARGET_TAG la release \"latest\"."
echo "  La release corrente $CURRENT_LATEST NON verra' cancellata."
echo "  I client riceveranno $TARGET_TAG al prossimo check aggiornamenti."
echo ""
echo "  NOTA: Questo NON modifica i file locali. Per allineare il tuo"
echo "  ambiente, usa il sistema di auto-update dalla UI dopo il rollback."
echo ""
echo "  ========================================"
echo ""

read -p "  Confermi? (s/n): " CONFIRM
if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
  echo "  Annullato."
  exit 0
fi

# ================================================================
#  STEP 4 — Esecuzione
# ================================================================

echo ""
echo "  Rimuovo flag latest da $CURRENT_LATEST..."
if ! gh release edit "$CURRENT_LATEST" --latest=false --repo "$REPO"; then
  echo "  [ERRORE] Impossibile modificare $CURRENT_LATEST."
  echo "  Nessuna modifica effettuata."
  exit 1
fi

echo "  Imposto $TARGET_TAG come latest..."
if ! gh release edit "$TARGET_TAG" --latest=true --repo "$REPO"; then
  echo ""
  echo "  [ATTENZIONE] Il flag latest potrebbe essere in uno stato indefinito."
  echo "  Verifica con: gh release list --repo $REPO"
  exit 1
fi

# ================================================================
#  STEP 5 — Verifica
# ================================================================

echo ""
echo "  Verifico..."
VERIFIED_TAG=$(gh release view --repo "$REPO" --json tagName --jq ".tagName" 2>/dev/null)

if [ -z "$VERIFIED_TAG" ]; then
  echo "  [ATTENZIONE] Impossibile verificare la release latest (errore di rete o auth)."
  echo "  Verifica manualmente: gh release list --repo $REPO"
elif [ "$VERIFIED_TAG" = "$TARGET_TAG" ]; then
  echo "  [OK] Rollback completato!"
  echo ""
  echo "  La release latest e' ora: $TARGET_TAG"
else
  echo "  [ATTENZIONE] La verifica mostra: $VERIFIED_TAG (atteso: $TARGET_TAG)"
  echo "  Verifica manualmente: gh release list --repo $REPO"
fi

echo ""
