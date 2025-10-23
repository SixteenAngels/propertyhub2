# Project TODOs and Dependencies

Status: ✅ Completed, 🔜 Backlog/Optional

## ✅ Completed
- App scaffold (Expo SDK 54) and navigation (tabs + stacks)
- Firebase init (Auth, Firestore, Storage), config via app.json extra
- Map screen with Firestore markers, preview card (glass), clustering
- Places autocomplete (debounced) + Near Me
- Listing flow with map picker, validation, amenities
- Multi-photo upload (progress), pre-upload remove, drag-to-reorder
- Manager Approvals (approve/reject with reason), property status pipeline
- Property detail (dates for Stay/Rent), Chat with owner, Book/Request
- Deep-link: propertyapp://booking/<id> auto-verifies and routes to BookingDetail
- Booking detail: verify/resume actions, status hints
- Functions: createBooking (dates + overlap), verifyBooking/Admin+User, resumePayment, release/refund escrow
- Chat: list + thread; send via callable (rate limited); typing indicators; read scaffold; lastMessage updates
- Moderation: screen + flag/mute/block callables; flags stored
- Escrow console screen (admin/manager)
- Admin Roles screen (role assignment) + Host approval gate (canHost)
- Role gating in UI; Profile quick links (Approvals, Roles, Escrow, Moderation, MyBookings)
- Auth: anonymous bootstrap + email/phone (reCAPTCHA) + Google sign-in (account linking)
- Notifications: FCM token store, background handler, Android channel, invalid-token pruning
- Firestore/Storage rules hardened (pending-only owner edits, chat write limits, image-only <5MB)
- Geohash on property create; geobox querying for map viewport

## 🔜 Backlog / Optional
- Provide real keys (Firebase, Paystack, Maps/Places, Google OAuth, FCM) in .env/app.json
- Auto-verify UI variants (success/failure) and cancel flow persistence
- Persist photo storage paths for server-side cleanup on delete
- Amenity metadata, richer validation, post-approval edit restrictions (UI)
- Read receipts per message (rules update), typing UI polish
- Moderation audit filters and resolutions; sender identity surfacing in UI list
- Rate limiting for listing/booking creation in Functions
- Testing/ops: emulator seed scripts, EAS builds/credentials, analytics/crash/perf, CI secrets

## Dependencies (for reference)

App (Expo)
- Core: expo, react, react-native
- Navigation: @react-navigation/native, @react-navigation/native-stack, @react-navigation/bottom-tabs
- Required peers: react-native-gesture-handler, react-native-reanimated, react-native-screens, react-native-safe-area-context
- Firebase SDK: firebase
- Storage & caching: @react-native-async-storage/async-storage
- Notifications: expo-notifications, expo-device, expo-constants
- Maps: react-native-maps, react-native-map-clustering, react-native-svg
- Geo: geofire-common
- Auth/Browser/Location: expo-auth-session, expo-firebase-recaptcha, expo-web-browser, expo-location
- Places: react-native-google-places-autocomplete
- Dates: @react-native-community/datetimepicker
- Media: expo-image-picker
- Lists: react-native-draggable-flatlist

App (dev)
- typescript, @types/react (optionally @types/react-native, @types/react-native-maps)

Functions (Node 20)
- firebase-functions, firebase-admin, geofire-common

Functions (dev)
- typescript, @types/node

## Environment
- See `.env.example` for all required keys (no secrets committed)
- Mirror values into `app/app.json` -> `expo.extra` and platform map keys
