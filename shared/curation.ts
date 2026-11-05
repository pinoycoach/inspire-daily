// Curator rules shared by the curator page and its tests.

export interface BulkCandidate {
  status: 'pending' | 'approved' | 'rejected';
  flags: string[];
  labels?: unknown;
  needsSourceCheck: boolean;
  sourceChecked?: boolean;
}

/** Safe for "Approve all": labeled, nothing flagged, and a named quote's source checked by a person. */
export const cleanForBulk = (p: BulkCandidate) =>
  p.status === 'pending' && p.flags.length === 0 && !!p.labels && (!p.needsSourceCheck || !!p.sourceChecked);
