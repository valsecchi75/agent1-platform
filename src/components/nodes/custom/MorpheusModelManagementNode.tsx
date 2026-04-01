"use client";

/**
 * Morpheus Model Management Node
 *
 * A browsable talent catalog node that lets users select digital models
 * filtered by gender, age, ethnicity and tags. Outputs talent image,
 * description, and metadata for downstream workflow nodes.
 *
 * Layout: Fixed 4-column grid, 560px node width, locked dimensions.
 * Patreon authentication via Supabase Edge Functions (zero local config required).
 * Ported from the ComfyUI comfyui_morpheus_model_management custom node.
 */

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { Loader2, RefreshCw, UserCircle2 } from "lucide-react";
import { BaseNode } from "../BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import type {
  MorpheusModelManagementData,
  MorpheusTalent,
  MorpheusFilters,
} from "@/types/customNodes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MorpheusNodeType = Node<MorpheusModelManagementData, "morpheusModelManagement">;

// ── Constants ──
const PACK_ID = "comfyui_morpheus_model_management";
const CONFIG_DIR = "morpheus_model_management";
const COLS = 4;
const ROWS = 2;
const PAGE_SIZE = COLS * ROWS; // 8 per page

// Supabase endpoints (zero local config — all auth handled server-side)
const SUPABASE_BASE = "https://hrlwqnqqgcxxezagyfah.supabase.co";
const SUPABASE_FUNCTIONS = `${SUPABASE_BASE}/functions/v1`;
const REMOTE_CATALOG_URL = `${SUPABASE_BASE}/storage/v1/object/public/morpheus-catalog/catalog.json`;
const REMOTE_IMAGES_BASE = `${SUPABASE_BASE}/storage/v1/object/public/morpheus-catalog`;

// Card dimensions — derived from node inner width (~530px with padding)
// 530px / 4 cols - 8px gaps = ~125px per card
const CARD_IMG_H = 150; // px — portrait image height
const CARD_INFO_H = 44; // px — name + tags fixed height

// ── Output handles ──
const OUTPUT_HANDLES = [
  { id: "image", label: "Image", type: "image" as const, top: 25 },
  { id: "description", label: "Description", type: "text" as const, top: 50 },
  { id: "metadata", label: "Metadata", type: "text" as const, top: 75 },
];

// ── Filter option constants ──
const GENDER_OPTIONS = [
  { value: "", label: "All" },
  { value: "male", label: "M" },
  { value: "female", label: "F" },
  { value: "non_binary", label: "NB" },
];
const AGE_OPTIONS = [
  { value: "", label: "All" },
  { value: "teen", label: "Teen" },
  { value: "young_adult", label: "Y.A." },
  { value: "adult", label: "Adult" },
  { value: "mature", label: "Mature" },
  { value: "senior", label: "Senior" },
];
const ETHNICITY_OPTIONS = [
  { value: "", label: "All" },
  { value: "caucasian", label: "Caucasian" },
  { value: "african", label: "African" },
  { value: "asian", label: "Asian" },
  { value: "hispanic", label: "Hispanic" },
  { value: "mixed", label: "Mixed" },
  { value: "middle_eastern", label: "M. Eastern" },
];

// ── Helper: filter talents locally ──
function filterTalents(talents: MorpheusTalent[], filters: MorpheusFilters): MorpheusTalent[] {
  return talents.filter((t) => {
    if (filters.name && !t.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.gender && t.gender !== filters.gender) return false;
    if (filters.age_group && t.age_group !== filters.age_group) return false;
    if (filters.ethnicity && t.ethnicity !== filters.ethnicity) return false;
    if (filters.favoritesOnly && !t.is_favorite) return false;
    if (filters.tags) {
      const tagArr = filters.tags.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (tagArr.length > 0) {
        const talentTags = t.tags.map((tt) => tt.toLowerCase());
        if (filters.tagLogic === "AND") {
          if (!tagArr.every((tag) => talentTags.includes(tag))) return false;
        } else {
          if (!tagArr.some((tag) => talentTags.includes(tag))) return false;
        }
      }
    }
    return true;
  });
}

// ── Helper: get device ID ──
function getOrCreateDeviceId(): string {
  const KEY = "morpheus_device_id";
  let id = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
  if (!id) {
    id = crypto.randomUUID();
    if (typeof window !== "undefined") localStorage.setItem(KEY, id);
  }
  return id;
}

// ── Helper: resolve image URL (handles both local config and remote Supabase storage) ──
function resolveImgUrl(talent: MorpheusTalent, isRemote: boolean): string {
  const raw = talent.thumbnail_url || talent.full_image_url || talent.image_path;
  if (!raw) return "";
  if (raw.startsWith("http") || raw.startsWith("data:")) return raw;
  // Remote catalog: prefix with Supabase storage base; local: use config API
  if (isRemote) return `${REMOTE_IMAGES_BASE}/${raw}`;
  return `/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/${raw}`;
}

// ── Styles ──
const S = {
  input: "w-full text-[11px] bg-neutral-800/60 border border-neutral-700/40 rounded px-2 py-1 text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500",
  select: "flex-1 text-[11px] bg-neutral-800/60 border border-neutral-700/40 rounded px-2 py-1.5 text-neutral-200 focus:outline-none focus:border-neutral-500",
  btn: "text-[11px] px-2 py-1 rounded border transition-colors cursor-pointer",
  tag: "text-[8px] leading-none bg-blue-900/60 text-blue-200 px-1 py-0.5 rounded whitespace-nowrap",
  tagCyan: "text-[9px] leading-none bg-cyan-800/60 text-cyan-200 px-1.5 py-0.5 rounded",
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// ── Main component ──
// ══════════════════════════════════════════════════════════════════════════════
export function MorpheusModelManagementNode({ id, data, selected }: NodeProps<MorpheusNodeType>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const isLoading = data.status === "loading";
  const hasError = data.status === "error";

  // Local UI state
  const [catalog, setCatalog] = useState<MorpheusTalent[]>([]);
  const [catalogIsRemote, setCatalogIsRemote] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [localFilters, setLocalFilters] = useState<MorpheusFilters>(
    data.filters || { name: "", tags: "", tagLogic: "OR", gender: "", age_group: "", ethnicity: "", favoritesOnly: false }
  );
  const [currentPage, setCurrentPage] = useState(data.currentPage || 1);
  const [patreonAuth, setPatreonAuth] = useState({
    authenticated: data.patreonAuthenticated || false,
    userName: data.patreonUserName || null as string | null,
  });
  const [connectingPatreon, setConnectingPatreon] = useState(false);
  const [patreonError, setPatreonError] = useState<string | null>(null);
  const deviceIdRef = useRef(data.patreonDeviceId || getOrCreateDeviceId());

  // ── Load catalog (demo when logged out, online when authenticated) ──
  // Stores raw talent data WITHOUT pre-resolving image URLs.
  // resolveImgUrl() resolves URLs lazily at render time, so only visible
  // page images are ever requested by the browser (via loading="lazy").
  const loadCatalog = useCallback(async (isAuthenticated?: boolean) => {
    try {
      if (isAuthenticated) {
        try {
          const remoteRes = await fetch(REMOTE_CATALOG_URL);
          if (remoteRes.ok) {
            const json = await remoteRes.json();
            setCatalog(json.talents || []);
            setCatalogIsRemote(true);
            setCatalogLoaded(true);
            return;
          }
        } catch { /* remote unavailable — fall through to local */ }
      }
      const res = await fetch(`/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/catalog.json`);
      if (!res.ok) throw new Error(`Catalog ${res.status}`);
      const json = await res.json();
      setCatalog(json.talents || []);
      setCatalogIsRemote(false);
      setCatalogLoaded(true);
    } catch {
      setCatalog([]);
      setCatalogLoaded(true);
    }
  }, []);

  // ── Patreon status (via Supabase Edge Function — no local config) ──
  const checkPatreonStatus = useCallback(async () => {
    try {
      const deviceId = deviceIdRef.current;
      const res = await fetch(`${SUPABASE_FUNCTIONS}/patreon-status?device_id=${deviceId}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const status = await res.json();
      const isAuth = !!status.authenticated && !!status.is_patron;
      const userName = status.user_name || status.user_email || null;
      setPatreonAuth({ authenticated: isAuth, userName });
      updateNodeData(id, { patreonAuthenticated: isAuth, patreonUserName: userName, patreonDeviceId: deviceId });
      return isAuth;
    } catch {
      // Supabase unreachable — keep current state
      return patreonAuth.authenticated;
    }
  }, [id, updateNodeData, patreonAuth.authenticated]);

  // ── Init ──
  useEffect(() => {
    checkPatreonStatus().then((isAuth) => loadCatalog(isAuth));
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "patreon_oauth_complete" || event.data?.type === "patreon-auth-complete") {
        oauthDoneRef.current = true;
        if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
        if (event.data.success) {
          checkPatreonStatus().then((isAuth) => loadCatalog(isAuth));
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    };
  }, [loadCatalog, checkPatreonStatus]);

  // ── Filtered + paginated ──
  const filteredTalents = useMemo(() => filterTalents(catalog, localFilters), [catalog, localFilters]);
  const totalPages = Math.max(1, Math.ceil(filteredTalents.length / PAGE_SIZE));
  const pageTalents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTalents.slice(start, start + PAGE_SIZE);
  }, [filteredTalents, currentPage]);

  // ── Select talent ──
  const selectTalent = useCallback((talent: MorpheusTalent) => {
    const imageUrl = resolveImgUrl(talent, catalogIsRemote);
    const varName = talent.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    updateNodeData(id, {
      selectedTalentId: talent.id, selectedTalentName: talent.name, selectedTalentImage: imageUrl,
      selectedTalentDescription: talent.description, selectedTalentTags: talent.tags,
      variableName: varName, filters: localFilters, currentPage,
    });
  }, [id, updateNodeData, localFilters, currentPage, catalogIsRemote]);

  // ── Auth actions (Supabase Edge Functions — zero local config) ──
  const oauthDoneRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connectPatreon = useCallback(async () => {
    oauthDoneRef.current = false;
    setPatreonError(null);
    setConnectingPatreon(true);

    const deviceId = deviceIdRef.current;

    // Wake-up ping: hit patreon-status first to ensure Replit is awake
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const wakeRes = await fetch(
        `${SUPABASE_FUNCTIONS}/patreon-status?device_id=${deviceId}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      // If response is HTML (Replit sleeping page), treat as unavailable
      const contentType = wakeRes.headers.get("content-type") || "";
      if (!wakeRes.ok || contentType.includes("text/html")) {
        throw new Error("Server sleeping");
      }
    } catch {
      setConnectingPatreon(false);
      setPatreonError("Server unavailable — Replit may be sleeping. Try again in a moment.");
      return;
    }

    // Server is awake — open OAuth popup
    setConnectingPatreon(false);
    const authUrl = `${SUPABASE_FUNCTIONS}/patreon-authorize?device_id=${deviceId}`;
    const popup = window.open(authUrl, "_blank", "width=600,height=700");

    // Fallback: poll for popup close in case postMessage doesn't fire
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      if (popup && popup.closed) {
        if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
        if (!oauthDoneRef.current) {
          // Popup closed without postMessage — check status anyway
          setTimeout(() => checkPatreonStatus().then((isAuth) => loadCatalog(isAuth)), 500);
        }
      }
    }, 500);
    // Safety: clear poll after 5 min
    setTimeout(() => { if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; } }, 300000);
  }, [checkPatreonStatus, loadCatalog]);

  const logoutPatreon = useCallback(async () => {
    try {
      const deviceId = deviceIdRef.current;
      await fetch(`${SUPABASE_FUNCTIONS}/patreon-logout?device_id=${deviceId}`);
    } catch { /* ignore */ }
    setPatreonAuth({ authenticated: false, userName: null });
    updateNodeData(id, { patreonAuthenticated: false, patreonUserName: null });
    loadCatalog(false);
  }, [id, updateNodeData, loadCatalog]);

  // ── Filter change ──
  const updateFilter = useCallback(<K extends keyof MorpheusFilters>(key: K, value: MorpheusFilters[K]) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <BaseNode id={id} selected={selected} isExecuting={isLoading} hasError={hasError} resizable={false}>
      {/* Output handles */}
      {OUTPUT_HANDLES.map((output) => (
        <div key={output.id}>
          <Handle type="source" position={Position.Right} id={output.id}
            style={{ top: `${output.top}%`, zIndex: 10 }} data-handletype={output.type} />
          <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
            style={{ left: "calc(100% + 8px)", top: `calc(${output.top}% - 7px)`,
              color: output.type === "image" ? "var(--handle-color-image)" : "var(--handle-color-text)", zIndex: 10 }}>
            {output.label}
          </div>
        </div>
      ))}

      {/* ── Content ── */}
      <div className="flex flex-col gap-2 p-3" style={{ width: 530 }}>

        {/* ▸ Selected talent preview */}
        <div className="flex items-center gap-3 bg-neutral-900/60 rounded-lg p-2.5">
          {data.selectedTalentImage ? (
            <img src={data.selectedTalentImage} alt={data.selectedTalentName || ""}
              className="rounded-lg object-cover flex-shrink-0" style={{ width: 64, height: 64 }} />
          ) : (
            <div className="rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0" style={{ width: 64, height: 64 }}>
              <UserCircle2 className="w-8 h-8 text-neutral-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-neutral-100 truncate">
              {data.selectedTalentName || "No talent selected"}
            </div>
            {data.selectedTalentTags && data.selectedTalentTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {data.selectedTalentTags.map((tag) => (
                  <span key={tag} className={S.tagCyan}>{tag}</span>
                ))}
              </div>
            )}
            {data.selectedTalentDescription && (
              <div className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">{data.selectedTalentDescription}</div>
            )}
            {data.variableName && (
              <div className="text-[10px] text-emerald-400 mt-0.5 font-mono">@{data.variableName}</div>
            )}
          </div>
        </div>

        {/* ▸ Patreon auth bar */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 border"
            style={{
              background: patreonAuth.authenticated
                ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
                : "linear-gradient(135deg, #2e1a1a 0%, #3e1616 100%)",
              borderColor: patreonAuth.authenticated ? "#00ff88" : "#f96854",
            }}>
            <span className="text-sm">🅿️</span>
            <span className="flex-1 text-[11px] font-medium truncate"
              style={{ color: patreonAuth.authenticated ? "#00ff88" : "#f96854" }}>
              {connectingPatreon
                ? "Waking up server..."
                : patreonAuth.authenticated
                  ? `Connected as ${patreonAuth.userName || "Patron"}`
                  : "Connect Patreon for full catalog"}
            </span>
            {connectingPatreon ? (
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400 flex-shrink-0" />
            ) : !patreonAuth.authenticated ? (
              <button onClick={connectPatreon} className="text-[10px] font-bold px-2 py-1 rounded text-white flex-shrink-0"
                style={{ background: "#f96854" }}>Connect</button>
            ) : (
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => checkPatreonStatus()}
                  className="text-[10px] px-2 py-1 rounded bg-neutral-700 text-neutral-200 border border-neutral-600">Status</button>
                <button onClick={logoutPatreon}
                  className="text-[10px] px-2 py-1 rounded bg-neutral-700 text-neutral-200 border border-neutral-600">Logout</button>
              </div>
            )}
          </div>
          {patreonError && (
            <div className="text-[10px] text-red-400 bg-red-900/30 border border-red-800/40 rounded px-2 py-1">
              {patreonError}
              <button onClick={() => setPatreonError(null)} className="ml-2 text-red-500 hover:text-red-300">✕</button>
            </div>
          )}
        </div>

        {/* ▸ Filters — compact two rows */}
        <div className="flex flex-col gap-1">
          {/* Row 1: Search + Tags */}
          <div className="flex gap-1.5 items-center">
            <input type="text" value={localFilters.name} onChange={(e) => updateFilter("name", e.target.value)}
              placeholder="Search name..." className={S.input} style={{ width: 160 }} />
            <input type="text" value={localFilters.tags} onChange={(e) => updateFilter("tags", e.target.value)}
              placeholder="Tags..." className={S.input} style={{ flex: 1 }} />
            <button onClick={() => updateFilter("tagLogic", localFilters.tagLogic === "OR" ? "AND" : "OR")}
              className={`${S.btn} bg-neutral-700 border-neutral-600 text-neutral-200 hover:bg-neutral-600`}
              style={{ width: 34 }}>{localFilters.tagLogic}</button>
          </div>
          {/* Row 2: Dropdowns + Refresh */}
          <div className="flex gap-1.5 items-center">
            <select value={localFilters.gender} onChange={(e) => updateFilter("gender", e.target.value)} className={S.select}>
              {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={localFilters.age_group} onChange={(e) => updateFilter("age_group", e.target.value)} className={S.select}>
              {AGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={localFilters.ethnicity} onChange={(e) => updateFilter("ethnicity", e.target.value)} className={S.select}>
              {ETHNICITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => { loadCatalog(patreonAuth.authenticated); setCurrentPage(1); }}
              className={`${S.btn} bg-neutral-700 border-neutral-600 text-neutral-200 hover:bg-neutral-600 flex items-center gap-1 flex-shrink-0`}>
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ▸ Catalog source indicator */}
        {catalogLoaded && catalog.length > 0 && (
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[9px] text-neutral-500">
              {patreonAuth.authenticated ? "Online" : "Demo"} — {filteredTalents.length} talent{filteredTalents.length !== 1 ? "s" : ""}
            </span>
            {!patreonAuth.authenticated && (
              <span className="text-[8px] bg-amber-800/60 text-amber-200 px-1.5 py-0.5 rounded font-medium">DEMO</span>
            )}
          </div>
        )}

        {/* ▸ Talent grid — FIXED 4 columns */}
        <div className="rounded-lg bg-neutral-900/40 p-1.5">
          {!catalogLoaded ? (
            <div className="flex items-center justify-center py-10 text-neutral-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading talents...
            </div>
          ) : pageTalents.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-neutral-500 text-xs">
              {catalog.length === 0 ? "No catalog available" : "No talents match your filters"}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {pageTalents.map((talent) => {
                const isSelected = data.selectedTalentId === talent.id;
                const imgUrl = resolveImgUrl(talent, catalogIsRemote);
                return (
                  <div key={talent.id} onClick={() => selectTalent(talent)}
                    className={`cursor-pointer rounded-lg overflow-hidden transition-all border-2 ${
                      isSelected ? "border-cyan-400 shadow-[0_0_8px_rgba(0,255,201,0.4)]" : "border-transparent hover:border-neutral-600"
                    }`} style={{ background: "var(--comfy-input-bg, #1a1a1a)" }}>
                    {/* Image — fixed height */}
                    <div className="relative w-full bg-neutral-800 overflow-hidden" style={{ height: CARD_IMG_H }}>
                      {imgUrl ? (
                        <img src={imgUrl} alt={talent.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserCircle2 className="w-8 h-8 text-neutral-600" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center text-[10px] font-bold">✓</div>
                      )}
                      {talent.is_favorite && (
                        <div className="absolute bottom-1 left-1 text-[10px]">★</div>
                      )}
                    </div>
                    {/* Info — fixed height */}
                    <div className="overflow-hidden px-1 py-1" style={{ height: CARD_INFO_H }}>
                      <div className="text-[10px] font-bold text-neutral-200 text-center truncate">{talent.name}</div>
                      <div className="flex gap-0.5 mt-0.5 justify-center overflow-hidden" style={{ maxHeight: 18 }}>
                        {talent.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className={S.tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ▸ Pagination with editable page number */}
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}
            className={`${S.btn} bg-neutral-800 border-neutral-700 text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-700`}>
            ←
          </button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              onBlur={(e) => {
                const val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < 1) setCurrentPage(1);
                else if (val > totalPages) setCurrentPage(totalPages);
              }}
              className="nodrag nopan w-10 text-center text-[11px] bg-neutral-800 border border-neutral-700 rounded py-0.5 text-neutral-200 focus:outline-none focus:border-neutral-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[11px] text-neutral-500">/ {totalPages}</span>
          </div>
          <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
            className={`${S.btn} bg-neutral-800 border-neutral-700 text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-700`}>
            →
          </button>
        </div>
      </div>
    </BaseNode>
  );
}
