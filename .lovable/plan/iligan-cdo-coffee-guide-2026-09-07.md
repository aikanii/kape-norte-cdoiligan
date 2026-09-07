# Iligan & CDO Coffee Guide

## What will be added
- A new `/guide` page linked from the main navigation.
- Separate Iligan and CDO sections with top cafe picks selected from the live catalog, prioritizing review score, review count, complete hours, and available photos.
- A compact side-by-side comparison of each pick’s price, atmosphere tags, and current/today’s hours.
- A “must-try drinks” section framed as regional coffee suggestions to look for, without claiming a cafe serves an unverified menu item.
- Direct links from every recommendation to its cafe detail page.

## Page experience
- City tabs make it quick to switch between Iligan and CDO.
- Photo-led top-pick cards remain easy to scan on phones.
- Comparison rows stay readable on small screens and become a table on larger screens.
- Empty and partial-data states remain useful when a shop has no reviews, photo, tags, or hours.

## Technical details
- Add a public guide data function that safely combines published cafe details with public review aggregates.
- Reuse the existing signed/photo fallback flow and opening-hours calculations.
- Add unique page title, description, Open Graph, and Twitter metadata.
- Verify the guide, navigation, cafe links, and mobile layout in the running app.
