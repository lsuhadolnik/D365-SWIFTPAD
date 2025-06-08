# Developing Commands

Commands shown in the spotlight are defined in `app/commands.json`. Each entry contains a unique `id`, a category and the text displayed to the user.

When spotlight executes a command it sends a message with this `id` to the background script. The background script or injected scripts implement the behaviour.

To add a new command:

1. Add an object to `app/commands.json` with a new `id`, `category` and `title`.
2. Handle the command in the appropriate script. Most UI related logic lives in `app/scripts/inject` while navigation and background tasks are handled in `app/scripts/background.ts`.
3. Rebuild the extension with `npm run build`.

The TypeScript sources are organised under `app/scripts`. Spotlight related code is in `app/scripts/spotlight`.

## Debug builds

Vite removes `debugger` statements when minifying. To keep them during a build,
set the environment variable `KEEP_DEBUG=true`:

```bash
KEEP_DEBUG=true npm run build
```

The resulting code will retain `debugger` statements and include source maps.
