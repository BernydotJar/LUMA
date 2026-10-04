# Glass Material Adversarial Review

## Review posture

Attempt to falsify the claim that LUMA uses glass as a governed material system across three themes.

## Automated matrix

- 3 themes;
- 5 routes;
- 2 viewports;
- reduced-motion mode;
- WCAG A/AA scan;
- overflow, clipping, nested glass and fixed overlap checks.

## Findings repaired

### Active-state contrast

The initial institutional and Liquid Light active controls used white text on bright blue. Small labels did not satisfy WCAG AA. Active-control ink was changed to a deep blue-black while retaining the institutional/light accent.

### Superuser and iconography mobile width

Min-content sizing in large editorial headings and asset rows produced mobile overflow. Grid children now use explicit `min-width: 0`, wrapping and responsive stacking.

### Progress card clipping

The first card-stack implementation clipped transformed content because decorative overflow and semantic content shared one clipping boundary. The glow was moved inside the card and semantic content now fits without clipping.

### Audit implementation

The first audit over-counted backdrop-filter surfaces because empty computed values were treated as active filters. The detector now counts only explicit non-`none` filters.

## Passing material invariants

- zero nested `.glass` surfaces;
- zero overflow;
- zero clipped text;
- zero semantic out-of-bounds findings;
- zero long-running animation in reduced-motion mode;
- reduced-transparency fallback present;
- no overlapping fixed glass surfaces;
- glass-surface budget below blocking thresholds;
- WCAG A/AA pass across the matrix.

## Verdict

PASS.
