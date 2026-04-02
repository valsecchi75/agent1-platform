/** Schema for node-packs.json — the remote registry index */
export interface NodePackRegistry {
  registryVersion: string;
  updatedAt: string;
  baseUrl: string;
  packs: NodePackEntry[];
}

/** Single entry in the registry index */
export interface NodePackEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  nodeCount: number;
  minAppVersion: string;
  manifestPath: string;
  previewPath: string;
  createdAt: string;
  updatedAt: string;
  changelog: string;
}

/** Registry entry enriched with local install status */
export interface NodePackEntryWithStatus extends NodePackEntry {
  status: 'available' | 'installed' | 'update-available';
  installedVersion: string | null;
}

/** Manifest stored inside each pack folder (custom_nodes/{packId}/manifest.json) */
export interface NodePackManifest {
  id: string;
  name: string;
  displayName?: string;
  version: string;
  author: string;
  description: string;
  category: string;
  minAppVersion?: string;
  license?: string;
  repository?: string;
  isCore: boolean;
  removable: boolean;
  nodes: NodePackManifestNode[];
  hasSpecs?: boolean;
  dependencies: string[];
}

/** Single node declared inside a pack manifest */
export interface NodePackManifestNode {
  type: string;
  name: string;
  category: string;
  specFile?: string;
}
