# AGENT 1 Release System — Debug Report

**Data:** 2026-04-08
**Analisi:** Systematic debugging completo di `publish.bat`, `publish.sh`, candidate release, e sistema auto-update

---

## RIEPILOGO PROBLEMI TROVATI

| # | Severita | Problema | File |
|---|----------|----------|------|
| 1 | CRITICO | Token GitHub PAT in chiaro su disco | `release/Token.txt` |
| 2 | CRITICO | Version bump avviene PRIMA del build — cascata di versioni fantasma | `publish.bat` L162-169 |
| 3 | CRITICO | `shouldNeverInclude()` non definita nel path FULL — crash silenzioso | `publish.bat` L257 (node inline) |
| 4 | ALTO | Delta detection fallisce ripetutamente — errori soppressi da `2>nul` | `publish.bat` L257 |
| 5 | ALTO | publish.sh manca lo STEP 8 (Candidate Release) | `publish.sh` |
| 6 | ALTO | Push hardcoded su `main` ma CLAUDE.md dice di usare `develop` | `publish.bat` L355 |
| 7 | MEDIO | Token XOR obfuscation con salt hardcoded nel codice distribuito | `token.ts` + `encode-token.js` |
| 8 | MEDIO | setup-first-release.bat usa `git add -A` — rischia di includere segreti | `setup-first-release.bat` L192 |
| 9 | MEDIO | Candidate Release non include manifest.json | `publish.bat` STEP 8 |
| 10 | BASSO | .gitignore manca `release/Token.txt` pattern per subdir | `.gitignore` |
| 11 | BASSO | Log pruning non copre errori di encoding su Windows | `publish.bat` L557 |
| 12 | BASSO | Cartella Candidate Release vuota (solo `old/`) — nessuna release candidate creata | Directory |

---

## DETTAGLIO PROBLEMI

### 1. CRITICO — Token GitHub PAT in chiaro

**File:** `release/Token.txt`
**Evidenza:** Il file contiene un GitHub PAT (`github_pat_11AKAMO6I...`) in formato testo.

Anche se e' nel `.gitignore`, il file:
- E' presente sul disco senza crittografia
- Qualsiasi tool di backup, cloud sync, o antivirus potrebbe leggerlo
- Non viene usato da nessuno script (il sistema usa `encode-token.js` + `token.ts`)

**Raccomandazione:** Eliminare `Token.txt` e usare SOLO il token obfuscato in `token.ts`. Se serve riferimento, salvarlo in un password manager.

---

### 2. CRITICO — Cascata di version bump

**File:** `publish.bat` linee 162-169 (e publish.sh equivalente)
**Evidenza dai log:**

```
publish-2026-04-08-062352.log: 0.9.8  -> 0.9.9   [ERRORE Build + Delta]
publish-2026-04-08-063251.log: 0.9.10 -> 0.9.11  [ERRORE Build + Delta]
publish-2026-04-08-063403.log: 0.9.11 -> 0.9.12  [ERRORE Build + Delta]
publish-2026-04-08-064301.log: 0.9.12 -> 0.9.13  [ERRORE Build + Delta]
...
publish-2026-04-08-083154.log: 0.9.18 -> 0.9.19  [ERRORE Delta]
```

**Root cause:** Lo script aggiorna `package.json`, `start.bat`, `start.sh`, e i badge UI **prima** di eseguire il build e il delta detection. Quando questi step falliscono, il version bump e' gia stato scritto su disco. Al prossimo lancio, il version bump parte dalla versione gia incrementata.

**Risultato:** 11 version bump fantasma in un giorno. L'ultimo tag pubblicato e' `v0.9.7-alpha` ma `package.json` dice `0.9.19-alpha`.

**Raccomandazione:** Spostare il version bump DOPO il build e il delta detection con successo. Oppure implementare un rollback automatico del bump in caso di errore (l'`abort_cleanup` mostra il messaggio ma non fa il rollback automatico).

---

### 3. CRITICO — `shouldNeverInclude()` non definita nel path FULL

**File:** `publish.bat` linea 257, script Node inline
**Root cause:** La funzione `shouldNeverInclude()` e' definita SOLO all'interno del blocco `else` (path DELTA), ma viene chiamata anche nel blocco `if` (path FULL):

```javascript
if(RELEASE_TYPE==='full'){
    wl.forEach(function(item){
        if(shouldNeverInclude(clean))return;  // ReferenceError!
        ...
    });
} else {
    function shouldNeverInclude(f){...}  // Definita qui
    ...
}
```

In Node.js, le function declaration in blocchi condizionali hanno un comportamento ambiguo. In sloppy mode, la dichiarazione viene hoisted come `undefined` al top dello scope, quindi la chiamata nel branch FULL causa un `TypeError: shouldNeverInclude is not a function`.

**Risultato:** Le release FULL non possono funzionare — crashano silenziosamente (errore soppresso da `2>nul`).

**Nota:** Il path FULL della `publish.sh` NON ha questo problema perche' non ha la funzione `shouldNeverInclude`.

---

### 4. ALTO — Delta detection fallisce ripetutamente

**File:** `publish.bat` linea 257
**Evidenza:** I log del 8 aprile mostrano "Delta detection fallita" in 9 su 11 tentativi.

**Root cause probabile:** Lo script Node inline e' lungo ~2500 caratteri su una singola riga, passato come argomento a `node -e "..."`. Su Windows, la lunghezza massima della command line e' ~8191 caratteri. Lo script potrebbe:
1. Avere problemi di escape dei caratteri speciali nel batch
2. Fallire silenziosamente perche' `2>nul` sopprime stderr
3. Non scrivere `release/.tmp/a1_build_result.txt` quando crasha

In un caso (log `072848`) il delta ha funzionato (45 file) ma poi la creazione ZIP e' fallita, suggerendo che il problema e' intermittente e potrebbe dipendere da race condition con i file temp.

**Raccomandazione:** 
- Estrarre lo script Node inline in un file separato (es. `release/build-delta.js`)
- Rimuovere `2>nul` durante il debug
- Aggiungere logging esplicito degli errori

---

### 5. ALTO — publish.sh manca STEP 8 (Candidate Release)

**File:** `publish.sh` — manca completamente
**Evidenza:** `publish.bat` ha STEP 8 (linee 496-534) che crea una Candidate Release ZIP pulita. `publish.sh` termina dopo STEP 7 (pubblicazione GitHub) senza creare la candidate.

**Risultato:** Su macOS/Linux la candidate release non viene mai generata.

---

### 6. ALTO — Push hardcoded su `main`

**File:** `publish.bat` linea 355, `publish.sh` linea 392
**Contraddizione:** Il `CLAUDE.md` dice:
> The primary development branch is `develop`, NOT `main` or `master`

Ma `publish.bat` fa:
```batch
git push --set-upstream origin main
```

**Rischio:** Se il workflow prevede PRs verso `develop`, pushare direttamente su `main` bypassa tutto il processo di review.

---

### 7. MEDIO — XOR obfuscation con salt hardcoded

**File:** `encode-token.js` + `src/lib/update/token.ts`

Il salt `'agent1-from-vision-to-form::agent1-update-salt::2026'` e' identico in entrambi i file e distribuito nell'app. Chiunque abbia il codice sorgente puo' decodificare il token con:
```javascript
xorDecode(OBFUSCATED_TOKEN, deriveKey(SALT))
```

Il commento in `token.ts` dice correttamente "It does NOT prevent: intentional reverse engineering" ma il rischio rimane. Se il token ha permessi ampi, un utente malintenzionato potrebbe accedere al repo.

**Raccomandazione:** Assicurarsi che il token abbia scope MINIMI (solo `contents:read` sul repo specifico).

---

### 8. MEDIO — `git add -A` in setup-first-release.bat

**File:** `setup-first-release.bat` linea 192
```batch
git add -A
```

Questo aggiunge TUTTI i file, inclusi potenzialmente `.env.local`, database, file di storage, etc. Il `.gitignore` dovrebbe proteggere, ma se e' stato creato nello step precedente dello stesso script (linea 152), potrebbe non coprire tutti i casi.

---

### 9. MEDIO — Candidate Release senza manifest.json

**File:** `publish.bat` STEP 8 (linee 496-534)

Lo script crea la candidate release ZIP ma il node inline del STEP 8 NON genera un `manifest.json`. Questo significa che la candidate ZIP:
- Non ha informazioni sulla versione
- Non ha la lista dei file inclusi/esclusi
- Non e' utilizzabile dal sistema auto-update (che richiede `manifest.json`)

---

### 10. BASSO — Candidate Release directory vuota

**Evidenza:** `ls` della directory "Candidate Release" mostra solo una cartella `old/` — nessun ZIP candidate.

Questo conferma che lo STEP 8 non ha mai prodotto output con successo (coerente con il fatto che il processo fallisce prima, allo STEP 4).

---

## PIANO DI FIX RACCOMANDATO

### Priorita 1 — Stabilizzare il processo di release

1. **Estrarre gli script Node inline** in file separati (`release/build-staging.js`, `release/build-candidate.js`)
2. **Spostare il version bump** dopo il build + delta detection
3. **Fixare `shouldNeverInclude`** — definirla prima di entrambi i branch
4. **Rimuovere `2>nul`** dallo script Node o redirigere stderr al log

### Priorita 2 — Sicurezza

5. **Eliminare `Token.txt`** dalla directory release
6. **Verificare scope del token** — deve avere solo `contents:read`
7. **Allineare branch** — decidere se pushare su `main` o `develop`

### Priorita 3 — Completezza

8. **Aggiungere STEP 8** a `publish.sh`
9. **Generare manifest.json** per la candidate release
10. **Implementare rollback automatico** del version bump in caso di errore
