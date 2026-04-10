# AGENT 1 — Project Audit
**Data: 9 Aprile 2026** | **Versione: 0.9.16-alpha** | **Stack: Next.js 16 + React Flow + Zustand + SQLite**

---

## 1. LOGIN & SISTEMA MULTI-UTENTE

### Cosa è stato fatto

Il sistema di autenticazione è completo e funzionale con doppia modalità: database SQLite (`data/agent1.db`) come sistema primario e fallback su variabili d'ambiente (`AUTH_USERS=user1:pass1`). L'autenticazione usa JWT (libreria `jose`, HS256) con token a 7 giorni nel cookie `agent1_session`. Le password sono hashate con bcrypt (cost 12). Esiste un middleware Edge (`proxy.ts`) che protegge tutte le route tranne login, crediti e asset pubblici. Il rate limiting è in-memory: 5 tentativi falliti per IP ogni 15 minuti. Al primo avvio viene creato automaticamente un utente admin (default: admin/admin). La sessione utente (stato editor, workflow aperti) è persistita nel database con estrazione delle immagini base64 per ottimizzare lo storage.

La pagina di login ha un design elaborato: tunnel WebGL Three.js, particelle, fog, effetti mouse, audio, con rotazione automatica degli 11 skin ogni 18 secondi.

### Problemi identificati

| # | Problema | Severità | Dettaglio |
|---|---------|----------|-----------|
| 1 | Cookie `secure: false` | 🔴 Critico | Il cookie viene trasmesso anche su HTTP. In produzione (Azure IP pubblica) i token di sessione possono essere intercettati |
| 2 | Password in chiaro nel fallback ENV | 🔴 Critico | `AUTH_USERS=user1:pass1` memorizza password in plain text nel file `.env` |
| 3 | Credenziali admin di default | 🟡 Alto | `admin/admin` creato automaticamente senza obbligo di cambio password |
| 4 | Nessun endpoint di logout | 🟡 Alto | Il server non può invalidare sessioni. Token compromessi restano validi 7 giorni |
| 5 | Rate limiting in-memory | 🟡 Alto | Si resetta al riavvio del server; non funziona con load balancer |
| 6 | Nessuna gestione utenti via UI | 🟡 Medio | Non esiste un pannello admin per creare/eliminare/modificare utenti |
| 7 | Nessun meccanismo di refresh token | 🟡 Medio | Token a 7 giorni senza possibilità di rinnovo silenzioso |
| 8 | JWT secret auto-generato volatile | ⚪ Basso | Se `.env` non è scrivibile, il secret resta in memoria e cambia ad ogni riavvio |

---

## 2. PIATTAFORMA NODI PER CONTENUTI GENERATIVI AI

### Cosa è stato fatto

La piattaforma è un editor visuale a nodi basato su React Flow (`@xyflow/react` v12.9) dove l'utente trascina nodi su un canvas, li collega tramite handle tipizzati, e esegue pipeline che chiamano API di generazione AI.

**Nodi implementati (34 componenti):**

- **Input**: ImageInput, AudioInput, VideoInput, Annotation (disegno Konva), Prompt, GLBViewer (3D)
- **Generazione AI**: GenerateImage (nanoBanana/Gemini), GenerateVideo, Generate3D, GenerateAudio, LLMGenerate
- **Elaborazione Video**: VideoStitch, VideoTrim, VideoFrameGrab, EaseCurve
- **Routing/Flusso**: Router, Switch, ConditionalSwitch, Array, PromptConstructor
- **Output/Visualizzazione**: Output, OutputGallery, ImageCompare, PreviewImage, ShowAnything
- **Organizzazione**: GroupNode (raggruppamento visuale)
- **Custom (Neural Atelier)**: NASketchToPhoto, NAStylingDetail, NARecolor
- **Custom (Morpheus)**: MorpheusModelManagement (browsing modelli con auth Patreon)

**Provider AI integrati (7):**
Google Gemini, OpenAI, Replicate, FAL.ai, Kie.ai (Sora/Veo/Kling), WaveSpeed, Anthropic

**Sistema di esecuzione:**
Topological sort dei nodi → esecuzione per livelli → batch parallelo configurabile (1-10 chiamate concorrenti) → `Promise.allSettled()` per gestione errori. Supporta pause edges, bypass nodi (Ctrl+B), gruppi bloccati, e batch mode per Array node.

**64 API routes** coprono: autenticazione, generazione multi-provider, gestione workflow, database generazioni, file system, modelli, template, community workflows, Patreon OAuth, health check, aggiornamenti.

**UI/Design System:**
11 skin/temi (ignite, aurora, ember, matrix, sienna, sage, orchid, platinum, abyss, amber, ocean) con CSS custom properties. Dialog system unificato con effetto glow rotante. BaseNode supporta: minimizzazione, resize, settings panel espandibile, colori custom, bypass, aspect-fit.

**State Management:**
Zustand con pattern a slice composte: workflowStore (1793 righe) + uiSlice, snapshotSlice, providerSlice, commentSlice, costSlice, canvasNavSlice, dimmingSlice. Undo/redo con shallow capture. Auto-save ogni 90 secondi.

### Problemi identificati

| # | Problema | Severità | Dettaglio |
|---|---------|----------|-----------|
| 1 | `WorkflowCanvas.tsx` da 1856 righe | 🟡 Alto | Componente troppo grande, difficile da mantenere. Andrebbe suddiviso |
| 2 | `ControlPanel.tsx` da 1430 righe | 🟡 Alto | Stesso problema di dimensione |
| 3 | ~800 occorrenze di `any/unknown` | 🟡 Medio | Type safety ridotta nelle zone di input dinamico |
| 4 | GLBViewerNode caricato come caso speciale | ⚪ Basso | Lazy loading fuori dal registry standard, rompe l'astrazione |
| 5 | Solo 12/64 API routes hanno test | 🟡 Alto | Copertura test insufficiente sulle route API |
| 6 | 375 console.log nel codice | ⚪ Basso | La maggior parte è server-side e con prefissi, ma andrebbe migrato al logger strutturato |
| 7 | Nessun timeout su alcune operazioni async | 🟡 Medio | Solo generate e chat hanno timeout espliciti |

---

## 3. SISTEMA NODI CUSTOM E COME SVILUPPARLI

### Cosa è stato fatto

Il sistema custom node ha un'architettura a 3 livelli: i componenti React sono pre-compilati nel bundle dell'app (`COMPONENT_REGISTRY` in `nodeRegistry.ts`), mentre "installare" un pack significa scaricare il suo `manifest.json` + cartella `specs/` in `custom_nodes/{packId}/`. Al riavvio, i nodi si attivano leggendo i manifest installati.

**Pack installati (4):**

1. **agent1-foundation** — Core pack (26 nodi), non rimuovibile, `isCore: true`
2. **agent1_neural_atelier** — 3 nodi specializzati (Sketch-to-Photo, Styling Detail, Recolor)
3. **morpheus-model-management** — 1 nodo per browsing modelli con auth Patreon
4. **rayban-catalogue** — Solo configs, nessun manifest (incompleto)

**Struttura manifest:** ID, nome, versione, autore, categoria, `minAppVersion` (compatibilità semver), array nodi con `specFile` per ogni nodo, flag `isCore`/`removable`.

**Validazione:** Schema Zod in `validation.ts` verifica struttura manifest, compatibilità versione app, pattern nomi nodi.

**Come sviluppare un nodo custom (procedura dal CLAUDE.md):**
1. Definire interfaccia dati in `src/types/index.ts`
2. Aggiungere a `NodeType` union
3. Creare default data in `createDefaultNodeData()`
4. Aggiungere dimensioni in `defaultDimensions`
5. Creare componente React in `src/components/nodes/`
6. Esportare da `index.ts`
7. Registrare in `COMPONENT_REGISTRY`
8. Aggiungere entry nel manifest del pack
9. Aggiungere colore minimap
10. Aggiornare `getConnectedInputs()` se produce output
11. Aggiungere logica esecuzione in `executeWorkflow()`
12. Aggiornare `ConnectionDropMenu.tsx`

### Problemi identificati

| # | Problema | Severità | Dettaglio |
|---|---------|----------|-----------|
| 1 | TODO: component availability check mancante | 🟡 Alto | L'install non verifica che i node type nel manifest abbiano componenti React corrispondenti. Si possono installare pack che crashano a runtime |
| 2 | Pack rayban-catalogue incompleto | 🟡 Medio | Solo cartella configs/, nessun manifest.json. Non verrà riconosciuto dal NodePackManager |
| 3 | Morpheus manifest non standard | 🟡 Medio | Usa `configDir` invece di `specFile`, manca campo `category`. Schema potenzialmente incompatibile con validazione |
| 4 | Nessuna risoluzione dipendenze tra pack | 🟡 Medio | Il campo `dependencies: string[]` nel manifest esiste ma non viene validato/risolto |
| 5 | 12 passi per aggiungere un nodo | ⚪ Info | Procedura complessa ma documentata. Un generatore/scaffold automatico sarebbe utile |

---

## 4. AGENT1-REGISTRY — PUBBLICAZIONE SU GITHUB

### Cosa è stato fatto

Il registry è un sistema di distribuzione pack basato su GitHub. Lo script `generate-node-packs-index.js` scansiona tutti i `manifest.json` nel repo `agent1-registry`, genera un file `node-packs.json` con metadati (versione, conteggio nodi, preview, changelog), e pubblica via `PUSH_TO_GITHUB.bat`.

**Flusso pubblicazione:**
1. Sviluppare pack in `app/custom_nodes/{packId}/`
2. Copiare in `agent1-registry/custom_nodes/{packId}/`
3. Eseguire `PUSH_TO_GITHUB.bat` → genera index → commit + push
4. L'app legge `node-packs.json` da `https://raw.githubusercontent.com/valsecchi75/agent1-registry/main/`

**API backend (6 endpoint):**
- `/api/node-packs/registry` — Fetch registry con stato installazione locale (timeout 10s)
- `/api/node-packs/install` — Download atomico manifest + specs
- `/api/node-packs/uninstall` — Rimozione con protezione core pack
- `/api/node-registry/active-types` — Lista tipi nodo attivi
- `/api/restart` — Riavvio graceful (supervisor rileva exit code 0)
- `/api/health` — Health check per polling post-riavvio

**UI frontend:**
- `NodePackManager` — Dialog con tab Available/Installed
- `NodePackCard` — Card per ogni pack
- `NodePackChecker` — Badge notifica nuovi pack al caricamento

**Template system** aggiuntivo con registry separato, slug-based, con preview images e install API.

### Problemi identificati

| # | Problema | Severità | Dettaglio |
|---|---------|----------|-----------|
| 1 | Nessun versioning/changelog automatico | 🟡 Medio | Il changelog è manuale nel manifest, non generato da commit history |
| 2 | Nessuna firma/verifica integrità pack | 🟡 Medio | I pack scaricati dal registry non hanno checksum o firma digitale |
| 3 | Single point of failure GitHub | ⚪ Basso | Se il raw.githubusercontent.com è down, il registry non funziona |

---

## 5. GENERATORE DI RELEASE

### Cosa è stato fatto

Il sistema di release è in `release/` con script batch/bash che orchestrano un workflow a 8 step: calcolo version bump → verifica build → delta detection (git diff) → creazione ZIP → aggiornamento versione → commit/tag/push Git → editing note di rilascio → creazione GitHub release → generazione candidate ZIP.

**Script principali:**

- **`publish.bat`** / **`publish.sh`** — Orchestratore principale. Supporta release delta (solo file modificati) e full. Include rilevamento fase (alpha/beta/stable) e selezione interattiva versione.
- **`build-staging.js`** — Crea `.release-staging/` per distribuzione. Modo FULL (whitelist da `.releaseinclude`) e DELTA (git diff dall'ultimo tag). Genera `manifest.json` con metadati versione/file/deleted.
- **`build-candidate.js`** — ZIP candidato per deploy Azure. Esclude storage, .db, .env, Token.txt, node_modules, .next.
- **`.releaseinclude`** — Whitelist file da includere nella distribuzione.
- **`encode-token.js`** — Offuscamento XOR del GitHub PAT (salt hardcoded).

**Auto-update integrato:**
- `/api/update-check` — Controlla nuove versioni
- `/api/update-apply` — Applica aggiornamento
- `/api/admin/rotate-update-token` — Gestione token GitHub per update

### Problemi identificati (da DEBUG-REPORT.md + analisi)

| # | Problema | Severità | Dettaglio |
|---|---------|----------|-----------|
| 1 | Version bump a cascata | 🔴 Critico | 11 versioni in 1 giorno perché il bump viene scritto su disco PRIMA della verifica build/delta. Se fallisce dopo, il prossimo tentativo bumpa ancora |
| 2 | `shouldNeverInclude()` undefined nel path FULL | 🔴 Critico | Le release FULL crashano silenziosamente per funzione mancante |
| 3 | Token.txt con GitHub PAT in plaintext | 🔴 Critico | PAT presente su disco nonostante offuscamento XOR nel codice. Il salt è hardcoded e distribuito nel sorgente |
| 4 | Delta detection fallisce 9/11 volte | 🔴 Critico | Script inline lungo supera il limite CLI di Windows; errori soppressi da `2>nul` |
| 5 | `publish.sh` manca STEP 8 | 🟡 Alto | La versione macOS/Linux non genera il candidate ZIP |
| 6 | Push hardcoded su `main` | 🟡 Alto | Contraddice il workflow Git documentato (develop come branch primario) |
| 7 | Offuscamento XOR con salt hardcoded | 🟡 Medio | Qualsiasi utente con accesso al sorgente può decodificare il token |
| 8 | `git add -A` in setup-first-release.bat | 🟡 Medio | Rischio di committare .env, database, file storage |
| 9 | Candidate release senza manifest.json | 🟡 Medio | ZIP incompatibile con sistema auto-update |

---

## 6. DOPPIA VERSIONE: SERVER IP vs STANDALONE

### Cosa è stato fatto

L'app supporta due modalità di deployment tramite script separati:

**Standalone locale:**
- `start.bat` (Windows) / `start.sh` (macOS/Linux)
- Binding: `localhost:3000` (solo accesso locale)
- Controlla Node.js 18+, installa dipendenze, build, crea cartelle storage, auto-genera JWT_SECRET
- Esecuzione: `NODE_ENV=production node server.js`

**Azure VM (remoto):**
- `start-azure.bat`
- Binding: `0.0.0.0:3000` (accesso esterno)
- URL: `http://72.146.168.162:3000`
- Configura firewall Windows per porta 3000
- Skip rebuild se `.next` esiste
- Auto-start via Windows Task Scheduler (`schtasks /tn "Agent1"`)

**Architettura server.js (Supervisor + Worker):**
- Modalità supervisor: fork del processo worker, rileva exit code, ri-spawn su crash o riavvio
- Post-update build: rileva marker `.update-pending`, esegue `npm run build` prima di avviare il worker
- Modalità worker (`AGENT1_WORKER=1`): server HTTP Next.js con timeout 10 min per generazione video
- WebSocket upgrade per HMR in dev (Next.js 16+)

### Problemi identificati

| # | Problema | Severità | Dettaglio |
|---|---------|----------|-----------|
| 1 | Azure su HTTP (no HTTPS) | 🔴 Critico | `http://72.146.168.162:3000` trasmette token JWT e credenziali in chiaro su internet |
| 2 | `run-service.bat` referenziato ma non esiste | 🟡 Medio | CLAUDE.md lo menziona per Azure ma il file non è presente nel progetto |
| 3 | Nessun reverse proxy / certificato SSL | 🟡 Alto | Manca nginx/caddy davanti a Node.js per HTTPS, rate limiting, e header di sicurezza |
| 4 | Skip rebuild basato su esistenza `.next` | ⚪ Basso | Potrebbe servire una build stale se i sorgenti sono stati aggiornati senza cancellare `.next` |
| 5 | Nessun monitoring/logging centralizzato su Azure | ⚪ Basso | Solo Task Scheduler, nessun health monitoring o alerting |

---

## 7. RIEPILOGO ARCHITETTURALE

### Punti di forza

Il progetto ha raggiunto un livello di funzionalità notevole per una versione 0.9.x alpha. Lo state management con Zustand a slice è ben organizzato. Il sistema di tipi è domain-driven con 13 file e nessuna dipendenza circolare. Ci sono 89 file di test che coprono store, routes, hooks e componenti. Il sistema di skin/temi con 11 varianti e CSS custom properties è flessibile e ben implementato. L'architettura custom node con manifest JSON, registry GitHub e validazione Zod è scalabile. Il server supervisor con auto-restart e post-update build è robusto per il deployment.

### Carenze principali per priorità

**🔴 Critiche (da risolvere prima del rilascio):**

1. **HTTPS mancante su Azure** — Token e credenziali viaggiano in chiaro
2. **Cookie secure: false** — Collegato al punto sopra
3. **Release system instabile** — Version bump cascading + delta detection rotta
4. **Token GitHub in plaintext** — Rischio di compromissione del PAT

**🟡 Alte (da pianificare nel breve termine):**

5. **Copertura test API routes** — Solo 12/64 routes testate
6. **Component availability check** al pack install
7. **Endpoint logout** e invalidazione sessione server-side
8. **Componenti oversized** — WorkflowCanvas (1856), ControlPanel (1430), workflowStore (1793)
9. **publish.sh allineamento** con publish.bat (manca STEP 8)
10. **Push su `develop`** invece che `main` nel release script

**🟡 Medie (miglioramenti di qualità):**

11. **Pannello admin utenti** — Creare/eliminare/modificare utenti
12. **Password policy** — Obbligo cambio password default, complessità minima
13. **Pack rayban-catalogue** — Completare o archiviare
14. **Standardizzare manifest morpheus** — Allineare allo schema agent1-foundation
15. **Ridurre any/unknown** — ~800 occorrenze
16. **Verifica integrità pack** — Checksum per download dal registry

---

## 8. MAPPA COMPLETA FILE CHIAVE

| Area | File principali |
|------|----------------|
| **Login/Auth** | `src/app/login/` (8 file), `src/app/api/auth/login/route.ts`, `src/lib/auth/jwt.ts`, `src/lib/auth/jwt-edge.ts`, `src/lib/db.ts`, `src/proxy.ts` |
| **Canvas/Editor** | `src/components/WorkflowCanvas.tsx`, `src/components/nodes/BaseNode.tsx`, `src/components/nodes/` (34 componenti) |
| **Store** | `src/store/workflowStore.ts`, `src/store/slices/` (7 slice), `src/store/execution/` (11 executor) |
| **Tipi** | `src/types/` (13 file, 1466 righe totali) |
| **API Routes** | `src/app/api/` (64 route) |
| **Custom Nodes** | `custom_nodes/` (4 pack), `src/lib/nodePacks/` (registry, validation, version) |
| **Node Pack UI** | `src/components/node-packs/` (4 componenti) |
| **Utility** | `src/utils/` (19 file), `src/hooks/` (23 hook) |
| **UI System** | `src/components/ui/` (10 componenti Radix-based) |
| **Release** | `release/` (publish.bat/sh, build-staging.js, build-candidate.js, .releaseinclude) |
| **Deploy** | `server.js`, `start.bat`, `start.sh`, `start-azure.bat` |
| **Scripts** | `scripts/` (generate-node-packs-index.js, export-templates.js, migrate-templates.ts) |
| **Test** | `src/test/`, `**/__tests__/` (89 file test, Vitest) |
