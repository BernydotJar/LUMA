/** Protected receipt-only advance shared by both v2 and v3 release paths. */
import { invariant } from './policy.mjs';
const SHA = /^[a-f0-9]{40}$/;

/** A signed approval may be imported via ONE strictly receipt-only commit.
 * Never treat an arbitrary descendant, a docs/catalog change, or a new source
 * tree as an already reviewed and approved SHA. `compare` comes from GitHub's
 * authenticated REST API, not candidate source or Graph/PR JSON.
 */
export function assertReceiptOnlyHeadAdvance(reviewedHead, currentHead, compare) {
  invariant(SHA.test(reviewedHead ?? '') && SHA.test(currentHead ?? ''),
    'Receipt-only head policy requires full source commit SHAs');
  if (reviewedHead === currentHead) return 'EXACT_REVIEWED_HEAD';
  const changed = compare?.files;
  const later = compare?.commits;
  invariant(compare?.status === 'ahead' && compare.ahead_by === 1 &&
    compare.behind_by === 0 && compare.base_commit?.sha === reviewedHead &&
    Array.isArray(later) && later.length === 1 &&
    later[0]?.sha === currentHead &&
    later[0]?.parents?.length === 1 && later[0].parents[0].sha === reviewedHead &&
    Array.isArray(changed) && changed.length === 1 &&
    changed[0]?.filename === 'evidence/cicd-enterprise/release-approval.json' &&
    changed[0]?.status === 'modified',
    'Unreviewed source or non-receipt changes after signed approval');
  return 'SINGLE_SIGNED_RECEIPT_IMPORT';
}
