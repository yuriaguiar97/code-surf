# CODE Web Push

The `code-push` Edge Function uses custom authentication: group PIN for device enrollment and preferences, a random per-device 256-bit token for device identity, and a distinct server-only secret for scheduled monitoring. JWT verification is disabled because the CODE group uses its existing PIN access model. All push tables deny direct anonymous/authenticated reads and writes; only the server service role accesses them. VAPID private keys and the scheduler secret are provisioned only in the protected server configuration table. Never commit them.

The service worker handles real encrypted Web Push and notification clicks; it does not cache requests. The manifest installs CODE in standalone mode. iPhone requires iOS 16.4+, Home Screen installation, and notification permission requested by tapping the activation button.

Monitoring runs hourly at :15, reads NOAA GFS-Wave/Open-Meteo Marine and GFS wind, evaluates the stored seed or joint conditions from sessions rated 8+, and selects daytime windows. The backend requests eight calendar days so that an exact 168-hour notice can be evaluated; the app still displays seven days. The wind remains the existing representative Ubatuba forecast. Tide and free-form seed notes are not automatically evaluated. This is forecast compatibility, not a guarantee of actual surf conditions.

Lead options are 168/120/72/48/24 hours. Existing 24/48-hour preferences remain selected. New devices default to every lead. Daily follow-up is separate, defaulting on, and reports changes including deterioration after an initial favorable window. Notifications are deduplicated per device, spot and target date, at most once per local day. Two expired endpoint statuses (404/410) deactivate the subscription. Temporary failures retry on a future hourly run without marking the event sent. Send acceptance does not prove delivery on a physical phone.

The test button sends an actual Web Push to the registered device, with a one-minute atomic cooldown. Validate physical delivery with this test before considering an individual phone ready. Changing preferences stores them locally and sends them to that device's server record; a synchronization failure is shown and permits activation retry.

Operational verification: inspect `code_push_runs` and `net._http_response`. `action:run` with the scheduler secret and `dryRun:true` evaluates the live forecast without sending notifications. Cron has a unique hourly execution bucket; a failed forecast run resumes the following hour. Retain recent run logs only as operationally needed.

Run evaluator checks with `node --test tests/push-engine.test.mjs`. `schema-push.sql` is the schema snapshot applied through the Supabase migration tool. `push-cron.sql` documents the production schedule. The production function imports `npm:web-push@3.6.7` and the runtime-provided `npm:@supabase/server` adapter matching the existing CODE backend.
