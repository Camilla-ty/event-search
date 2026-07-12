## Summary

<!-- What changed and why (1–3 bullets) -->

## Test plan

- [ ] <!-- How you verified -->

## Navigation & data fetching

If this PR touches client navigation, filters, tabs, lists, or post-mutation refresh:

- [ ] Same-pathname UI state uses History API (`useUrlSyncedState` / tab pattern), not `router.push` / `router.replace`
- [ ] New list data uses targeted fetch, not full-page soft navigation
- [ ] Mutations update local state from the response; any `router.refresh` is explained below
- [ ] Cold-load URLs still render correct server HTML
- [ ] `popstate` handled for URL-synced state

See [docs/architecture/navigation-and-data-fetching.md](../docs/architecture/navigation-and-data-fetching.md).

<!-- Optional: run `bash scripts/audit-soft-navigation.sh` and note any intentional exceptions -->
