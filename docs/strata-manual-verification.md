# Strata Manual Verification Checklist

1. Open `/sandbox/prototypes/strata` and create two new Strata pages.
2. Confirm both pages appear in browser list with updated timestamps.
3. Open first page and input text in Raw Text, then click `Save Raw Text`.
4. While Raw/Refined sections are in view, confirm sticky glass button is visible.
5. Click `Create Sections`; verify Refined Text and Elaborated become populated.
6. Refresh the page; confirm all five section values persist from Supabase.
7. Edit Design Instructions and AI Instructions, save each, refresh, and verify persistence.
8. Re-run generation in `Update Sections` mode with `Overwrite Elaborated` unchecked:
   - Refined Text should update.
   - Existing Elaborated should remain unchanged.
9. Re-run with `Overwrite Elaborated` checked:
   - Elaborated should update.
10. Switch to second page from browser list and confirm first page content remains isolated.
