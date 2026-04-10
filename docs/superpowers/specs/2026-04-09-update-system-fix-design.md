# Design Spec: Fix Update System — Protezione Dati Utente

**Data:** 9 Aprile 2026
**Status:** Proposed
**Versione corrente:** 0.9.16-alpha
**Problema:** agent1-candidate-v0.9.7-alpha non riesce ad aggiornarsi alla versione attuale

---

## Contesto

Il sistema di auto-update ha tre bug che impediscono l'aggiornamento:

1. **Manifest type non riconosciuto**: `build-candidate.js` genera `"type": "candidate"` ma l'update engine accetta solo `"full"` o `"delta"`
2. **Campo files vuoto**: Il manifest dichiara `"files": []` — l'engine non sa cosa c'è nel pacchetto
3. **NEVER_OVERWRITE incompleto**: Protegge solo `token.txt` e `.env`, non i dati utente (database, generazioni, workflow, storage)

La v0.9.7-alpha non è recuperabile automaticamente (richiede reinstallazione manuale). L'obiettivo è che dalla prossima release in poi ogni versione possa aggiornarsi a qualsiasi versione futura senza perdere dati utente.

## Decisione

Approccio "fix minimo chirurgico" — correggere i 3 bug esistenti e aggiungere protezione esplicita dei dati utente. Nessuna riscrittura dell'update engine.

## Requisiti

- L'aggiornamento deve toccare SOLO i file della piattaforma
- I dati utente devono essere preservati: database, generazioni, workflow, immagini, configurazioni
- I custom node pack installati dall'utente dal registry devono restare intatti
- Solo `agent1-foundation` (core pack) viene aggiornato con la piattaforma

## Dati utente protetti (NEVER_OVERWRITE)

| Path | Contenuto |
|------|-----------|
| `data/` | Database SQLite (utenti, generazioni, sessioni, API calls) |
| `storage/` | Immagini, workflow salvati, output, template installati |
| `.env`, `.env.local`, `.env.production` | Chiavi API, JWT secret, configurazione |
| `Token.txt` | GitHub PAT |
| `logs/` | Log sessione |
| `custom_nodes/*` (tranne `agent1-foundation/`) | Pack installati dall'utente |

## File da modificare (3)

### 1. `release/build-candidate.js`

- Cambiare `"type": "candidate"` → `"type": "full"`
- Popolare `"files"` con la lista reale dei file inclusi nello staging
- Lo script già scansiona i file — raccoglierli in un array e scriverli nel manifest

### 2. `release/build-staging.js`

- Assicurarsi che `"files"` sia sempre popolato, sia in modo FULL che DELTA
- In modo DELTA: i file sono già raccolti dal git diff
- In modo FULL: scansionare la directory staging e listarli

### 3. `src/lib/update/updateEngine.ts`

- Espandere `NEVER_OVERWRITE` in una costante `PROTECTED_PATHS` con tutti i path della tabella sopra
- Nella funzione di replace (step 4), prima di copiare un file: controllare se il path cade dentro una delle PROTECTED_PATHS
- Eccezione: `custom_nodes/agent1-foundation/` NON è protetto (viene aggiornato)
- Aggiungere log esplicito: "Skipped protected path: {path}" per debug

## File NON modificati

- Flow di esecuzione (check → download → extract → backup → replace → rebuild)
- Struttura del manifest (solo fix del valore type e files)
- `.releaseinclude` (rimane la whitelist di cosa includere nel pacchetto)
- `publish.bat` / `publish.sh` (non serve toccarli per questo fix)

## Risultato atteso

L'update scarica il pacchetto full, sovrascrive `src/`, `public/`, `server.js`, `package.json`, configs, e `custom_nodes/agent1-foundation/`. Non tocca `data/`, `storage/`, `.env`, custom pack utente. Poi fa `npm install` + `npm run build` + restart. L'utente ritrova tutto il suo storico, workflow, generazioni, e configurazioni intatti.

## Rischi

- Se un aggiornamento futuro richiede una migrazione del database (nuove colonne/tabelle), serve un migration script separato — non coperto da questo fix
- Se l'utente ha modificato manualmente file in `src/`, le modifiche verranno sovrascritte

## Test plan

1. Verificare che build-candidate genera manifest con `"type": "full"` e `"files"` popolato
2. Verificare che updateEngine salta tutti i PROTECTED_PATHS
3. Verificare che `custom_nodes/agent1-foundation/` viene aggiornato
4. Verificare che `custom_nodes/morpheus-model-management/` NON viene toccato
5. Simulare update e verificare che `data/agent1.db` sopravvive intatto
6. Verificare rebuild post-update (npm install + build) completa con successo
