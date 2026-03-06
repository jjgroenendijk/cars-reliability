## 2024-03-06 - Tooltip & ARIA labels for Search Clear Buttons
**Learning:** Icon-only clear buttons (like the X to clear search queries) in complex filtering dropdowns are easily missed by screen readers and can be ambiguous to mouse users without a title attribute.
**Action:** When implementing or modifying custom search/filter inputs with embedded clear controls, always ensure the clear button has both `aria-label` and `title` attributes that explicitly describe its function (e.g., "Clear search or selection").
