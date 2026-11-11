# Coordinate Finder V1

A small installable mobile-web prototype for testing direct coordinate-difference navigation.

## Features
- Live phone location using browser Geolocation API
- Manually entered target coordinates
- Save current position or target as a named destination
- Local East/North coordinate differences (metres)
- Haversine distance and initial bearing
- GPS accuracy display and basic quality warning
- Experiment logging and CSV export
- Local destination storage and offline app-shell caching

## Run it on a phone

Browser geolocation requires a secure context: HTTPS (or localhost).

### Quickest option
1. Put this folder in a GitHub repository.
2. Enable GitHub Pages, or deploy the folder to Netlify/Vercel.
3. Open the resulting HTTPS URL in Chrome on Android.
4. Allow location permission and press **Start GPS**.
5. Use Chrome's menu → **Add to Home screen** to install it like an app.

You can also run a local development server on your computer and open it from the phone, but the page must be served over HTTPS for geolocation on a phone. `localhost` is the main exception and refers to the device itself.

## Coordinate model
For a local neighbourhood, the app uses a local tangent-plane approximation:
- East = R cos(latitude_origin) × longitude difference in radians
- North = R × latitude difference in radians

The current position is used as the origin for each target-relative calculation. Haversine distance is calculated independently and used as the displayed distance.

## Important limitations
- This is direct-to-coordinate guidance, not street/footpath routing.
- GPS accuracy varies; the displayed accuracy is the operating system/browser estimate, not a guarantee.
- A phone compass is not used. Bearing is relative to geographic north, not the direction the phone is pointing.
- A saved coordinate marks where the phone was when saved. For house testing, stand at a consistent outdoor point near the entrance and record how you chose the reference point.
- Keep the page open during logging. Background browser execution may be suspended by the operating system.
- CSV data is stored only in the current browser session until exported. Saved destinations are stored in local browser storage.

## Suggested first test
1. Save a known outdoor point as `Test Point A`.
2. Walk 30–100 m away.
3. Select the saved point and start an experiment.
4. Walk toward it while observing distance, bearing and signed East/North differences.
5. Stand still for 3–5 minutes and observe GPS drift.
6. Export CSV and compare stationary coordinate variation and distance fluctuation.

## Privacy
Location is processed in the browser and is not sent to a server by this app. Saved locations and experiment data remain in local browser storage until you export or clear browser data.
