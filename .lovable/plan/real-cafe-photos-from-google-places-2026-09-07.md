# Real cafe photos from Google Places

## What will change
- Extend the existing Google Places sync to retrieve one current photo for each imported Iligan and CDO cafe.
- Store only the temporary Google-hosted photo URL and required photographer attribution; keep owner-uploaded photos as the first choice when available.
- Show the real cover photo on directory cards and inside map pop-ups, with lazy loading and a clean no-photo state.
- Refresh Google photo URLs through the existing protected sync flow rather than exposing an open photo proxy.

## Verification
- Run the protected photo refresh once for the existing cafe catalog.
- Confirm directory cards and map pop-ups display cafe-specific images.
- Test the directory at a mobile viewport and confirm images load without overflow or page errors.

## Technical details
- Add nullable Google photo URL and attribution fields to cafe records with a database migration and existing access policies.
- Request `places.photos` in the bounded Places search, then resolve at most one media URL per unique cafe with capped concurrency.
- Preserve existing uploaded gallery photos and use them ahead of Google imagery.
