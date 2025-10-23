# Property Marketplace MVP (Expo + Firebase)

Mobile-first property marketplace supporting Stay/Rent/Lease/Sell with map discovery, chat, bookings with Paystack escrow, role-gated approvals, notifications, and deep links.

## Features
- Unified user role (browse, book, list); host permission gate (`canHost`)
- Map search with clustering, Near Me, Places autocomplete, filters
- Listings with multi-photo upload (progress), amenities, manager approvals (with rejection reason)
- Property detail: date pickers (Stay/Rent), Chat with owner, Book/Request (escrow)
- Real-time chat with push notifications, typing, last-read scaffolding
- Bookings: deep-link return, verify/resume, detail screen
- Admin/Manager: Approvals, Escrow console, Role assignment, Moderation actions
- Notifications: FCM tokens stored, background handler, Android channel

## Monorepo layout
- `app/` Expo React Native app (SDK 54)
- `functions/` Firebase Cloud Functions (TypeScript, v2)
- Firestore/Storage rules and indexes at repo root

## Setup
1) Prereqs: Node 20, npm, Expo CLI, Firebase CLI
2) Install deps
```
cd app && npm i
cd ../functions && npm i && npm run build
```
3) Configure environment
- Copy `.env.example` to `.env` (do not commit secrets)
- Mirror values into `app/app.json` `expo.extra` (Expo reads from static config)
- Platform keys: add Google Maps keys to `app.json` (`ios.config.googleMapsApiKey`, `android.config.googleMaps.apiKey`)

Required keys (no values committed): see `.env.example`
- Firebase: API key, projectId, etc.
- Maps: Geocoding + Places; platform map keys
- Google OAuth: web/android/ios/expo client IDs
- Paystack: secret, webhook secret, callback URL (use `propertyapp://booking/{bookingId}`)

4) Firebase config
```
firebase emulators:start  # or deploy functions/rules as needed
```

5) Run the app
```
cd app
npm start
```

## Roles & permissions
- Users need `canHost: true` to create listings (admin/manager can grant in Admin Roles)
- Approvals screen allows approve/reject (with reason) to control map visibility
- Escrow console lets admin/manager release/refund funds

## Deep links & payments
- App scheme: `propertyapp`
- `PAYSTACK_CALLBACK_URL` should be set to `propertyapp://booking/{bookingId}`
- On return the app auto-verifies and updates Booking detail; Resume/Cancel supported

## Notes
- Keys are intentionally omitted. Provide your own values in `.env` and `app.json`.
- For production: add analytics, crash/perf, CI/CD (EAS), and stricter validations.