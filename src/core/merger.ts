export const SENTINEL_START = "<!-- claude-scouter:start -->";
export const SENTINEL_END = "<!-- claude-scouter:end -->";
const SENTINEL_NOTICE =
  "<!-- 이 영역은 claude-scouter가 관리합니다. 수동 편집 시 update에서 덮어씁니다. -->";

/**
 * Wrap scouter-generated CLAUDE.md content with sentinels.
 */
export function wrapWithSentinels(scouterContent: string): string {
  return [SENTINEL_START, SENTINEL_NOTICE, scouterContent.trimEnd(), SENTINEL_END].join("\n") + "\n";
}

/**
 * Merge scouter block into existing CLAUDE.md content.
 * - If sentinels already exist: replace the content between them.
 * - If no sentinels: append the scouter block at the end.
 */
export function mergeClaudeMd(
  existing: string,
  scouterBlock: string,
  hasSentinels: boolean
): string {
  const wrappedBlock = wrapWithSentinels(scouterBlock);

  if (hasSentinels) {
    // Replace existing sentinel block
    const startIdx = existing.indexOf(SENTINEL_START);
    const endIdx = existing.indexOf(SENTINEL_END);
    if (startIdx !== -1 && endIdx !== -1) {
      const before = existing.slice(0, startIdx);
      const after = existing.slice(endIdx + SENTINEL_END.length);
      return before + wrappedBlock + after.replace(/^\n/, "");
    }
  }

  // Append: add two newlines before sentinel block
  const separator = existing.trimEnd().length > 0 ? "\n\n" : "";
  return existing.trimEnd() + separator + wrappedBlock;
}

/**
 * Deep-merge settings.json.
 * - permissions.allow/deny: union (deduplicated)
 * - hooks: merge by event key, then by matcher (existing wins on conflict)
 * - other keys: preserve existing, add new
 */
export function mergeSettings(
  existing: Record<string, unknown>,
  scouter: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...existing };

  // Merge permissions
  const existingPerms = (existing.permissions ?? {}) as Record<string, unknown>;
  const scouterPerms = (scouter.permissions ?? {}) as Record<string, unknown>;

  if (scouterPerms) {
    const mergedPerms = { ...existingPerms };

    // allow: union
    const existingAllow = Array.isArray(existingPerms.allow) ? existingPerms.allow : [];
    const scouterAllow = Array.isArray(scouterPerms.allow) ? scouterPerms.allow : [];
    mergedPerms.allow = [...new Set([...existingAllow, ...scouterAllow])];

    // deny: union
    const existingDeny = Array.isArray(existingPerms.deny) ? existingPerms.deny : [];
    const scouterDeny = Array.isArray(scouterPerms.deny) ? scouterPerms.deny : [];
    mergedPerms.deny = [...new Set([...existingDeny, ...scouterDeny])];

    result.permissions = mergedPerms;
  }

  // Merge hooks
  const existingHooks = (existing.hooks ?? {}) as Record<string, unknown>;
  const scouterHooks = (scouter.hooks ?? {}) as Record<string, unknown>;

  if (scouterHooks && Object.keys(scouterHooks).length > 0) {
    const mergedHooks = { ...existingHooks };

    for (const [eventKey, scouterEntries] of Object.entries(scouterHooks)) {
      if (!Array.isArray(scouterEntries)) continue;

      const existingEntries = Array.isArray(mergedHooks[eventKey])
        ? (mergedHooks[eventKey] as HookEntry[])
        : [];

      const existingMatchers = new Set(
        existingEntries.map((e) => (e as HookEntry).matcher).filter(Boolean)
      );

      // Add scouter entries whose matcher doesn't already exist
      const newEntries = scouterEntries.filter(
        (e) => !(e as HookEntry).matcher || !existingMatchers.has((e as HookEntry).matcher)
      );

      mergedHooks[eventKey] = [...existingEntries, ...newEntries];
    }

    result.hooks = mergedHooks;
  }

  // Preserve all other existing keys, add new scouter keys
  for (const key of Object.keys(scouter)) {
    if (key === "permissions" || key === "hooks") continue;
    if (!(key in result)) {
      result[key] = scouter[key];
    }
  }

  return result;
}

interface HookEntry {
  matcher?: string;
  hooks?: unknown[];
}
