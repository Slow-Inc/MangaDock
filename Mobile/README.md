# MangaDock Mobile Shell

Android-first React Native CLI shell for the existing MangaDock `Frontend/` app.

## Scope

- Wraps the web app in a React Native WebView.
- Uses `http://10.0.2.2:4000` by default for Android emulator development.
- Keeps Supabase auth inside the web app.
- Does not add Mobile Hardware ID or `x-hardware-id` header injection yet.
- Does not include iOS artifacts.

## Commands

```sh
npm install
npm start
npm run android
npm test
npm run lint
```

## Verification Checklist

### Android Emulator

1. Start `Frontend/` on port `4000`.
2. Start Metro from `Mobile/` with `npm start`.
3. Run `npm run android`.
4. Verify the WebView loads the MangaDock web app from `http://10.0.2.2:4000`.
5. Verify login stays inside the web app.

### Physical Android Device

1. Start `Frontend/` on port `4000` and expose it on the LAN.
2. Override the Mobile Shell URL with the host machine LAN URL, for example `http://192.168.1.10:4000`.
3. Start Metro from `Mobile/` with `npm start`.
4. Run `npm run android`.
5. Verify the WebView loads MangaDock over the LAN and login stays inside the web app.

## Follow-up Issues

- Issue #91 adds persistent Mobile Hardware ID and Mobile Header Injection.
- Issue #92 verifies protected content flow from the Mobile Shell.
