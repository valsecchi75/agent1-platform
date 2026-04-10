# Analisi: Isolamento Dati Multi-Utente

**Data:** 10 Aprile 2026
**Status:** Analysis — richiede design spec separata
**Decisione:** Implementare multi-utente vero con isolamento completo

---

## Stato attuale

Il sistema ha uno schema database predisposto per multi-utente (tabella `users`, colonne `user_id` con FK) ma **nessun isolamento reale**. Funziona come sistema mono-utente hardcoded sull'admin.

## Cosa funziona

- Login username/password con bcrypt (cost 12) e JWT (7 giorni)
- Tabella `users` con id, username, password_hash, display_name, role, created_at, last_login_at
- Rate limiting login (5 tentativi / 15 min per IP)
- Tabella `api_calls` traccia correttamente il user_id
- ON DELETE CASCADE sulle FK

## Cosa manca — Gap completi

### 1. Gestione utenti (CRUD)

| Funzione | Stato |
|----------|-------|
| `listUsers()` / `getAllUsers()` | ❌ Non esiste |
| `deleteUser()` | ❌ Non esiste |
| `updateUser()` | ❌ Non esiste |
| API endpoint creazione utenti | ❌ Non esiste |
| API endpoint lista utenti | ❌ Non esiste |
| Pannello admin UI | ❌ Non esiste |

Solo `createUser()` e `authenticateUser()` esistono in `db.ts`.

### 2. Isolamento generazioni

- `/api/db/generations` GET: **non filtra per user_id** — ritorna tutte le generazioni di tutti gli utenti
- `/api/agent1-save`: hardcoded su `getAdminUserId()` — tutte le generazioni attribuite all'admin
- Nessun indice su `generations.user_id` — query per utente sarebbe lenta
- File fisici in `storage/output/images/` senza subdirectory utente

### 3. Isolamento workflow

- `storage/workflows/__session/` è condiviso — nessuna separazione per utente
- Tab ID usato come chiave, non (user_id, tab_id) — utenti si sovrascrivono
- `sessionPersistence.ts` non usa user_id

### 4. Isolamento sessione

- `/api/db/session` GET/POST: hardcoded su `resolveAdminId()` — solo l'admin ha stato persistito
- La tabella `user_sessions` ha `user_id` FK ma non viene usato correttamente

### 5. API Keys

- Globali in `.env` — tutti condividono le stesse chiavi
- Nessuna tabella `user_api_keys(user_id, key_name, encrypted_value)`
- `/api/settings` PUT scrive su `.env` condiviso

### 6. Autorizzazione

- Campo `role` (`admin`/`user`) nella tabella users mai usato
- Nessun middleware di autorizzazione nelle API routes
- Nessun controllo role-based (RBAC)

### 7. File storage

- Path globale: `storage/output/{images,videos,audio}/`
- Naming sequenziale globale: `agent1_0001.jpg`, `agent1_0002.jpg`
- Nessun path per-utente tipo `storage/users/{userId}/output/`

## Tabelle database e stato user_id

| Tabella | Ha user_id? | Filtrato per utente? |
|---------|-------------|---------------------|
| `users` | N/A (è la tabella utenti) | ✅ |
| `generations` | ✅ FK | ❌ Query non filtra |
| `api_calls` | ✅ FK | ✅ Funziona |
| `daily_stats` | ❌ | ❌ Aggregati globali |
| `user_sessions` | ✅ FK | ❌ Hardcoded admin |

## File da modificare per multi-utente vero

### Backend (priorità alta)
- `src/lib/db.ts` — Aggiungere listUsers, deleteUser, updateUser, user_api_keys
- `src/app/api/db/generations/route.ts` — Filtrare per user_id dal JWT
- `src/app/api/db/session/route.ts` — Usare user_id dal JWT, non resolveAdminId()
- `src/app/api/agent1-save/route.ts` — Attribuire al vero utente, non admin
- `src/app/api/settings/route.ts` — API keys per-utente (nuova tabella)
- `src/app/api/workflow/route.ts` — Workflow per-utente
- `src/lib/sessionPersistence.ts` — Subdirectory per utente
- `src/lib/storage/fileNaming.ts` — Path per-utente

### Middleware (priorità alta)
- Creare `src/middleware/auth.ts` — Estratto JWT → user_id in ogni request
- Applicare a tutte le API routes che accedono a dati utente

### Frontend (priorità media)
- Pannello admin: lista utenti, crea, elimina, modifica ruolo
- Profilo utente: cambio password, display name
- Settings API keys: per-utente invece che globali

### Database (priorità alta)
- Aggiungere indice `idx_generations_user_id`
- Creare tabella `user_api_keys`
- Aggiungere `user_id` a `daily_stats` o creare `user_daily_stats`

## Rischi

- Migration dei dati esistenti: le generazioni attuali sono tutte dell'admin
- File fisici in storage non hanno user_id nel nome — serve una strategia di migrazione
- Performance: aggiungere filtro user_id a tutte le query
- Breaking change per workflow salvati senza user_id
