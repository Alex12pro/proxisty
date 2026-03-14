# Railway UV Browser

A browser-style Ultraviolet frontend with tabs, local history, bookmarks, and a Railway-ready server.

## Included
- Current Ultraviolet 3.x server layout
- Browser-style UI
- Multi-tab interface
- Local history and bookmarks
- Railway config

## Not included
- Stealth cloaking / about:blank hiding
- Guarantees that every site will work

## Local run
```bash
npm install
npm start
```
Then open `http://localhost:8080`.

## Railway setup
1. Create a new GitHub repo.
2. Upload all files from this folder to that repo.
3. In Railway, create a new project and choose **Deploy from GitHub repo**.
4. Select the repo.
5. Railway should detect Node automatically and use `npm start` from `railway.json`.
6. If Railway uses an older Node version, set an environment variable named `NIXPACKS_NODE_VERSION` to `24` and redeploy.
7. Generate a public domain in the Railway networking/settings area.
8. Open the generated domain.

## Notes
- Current official docs show a UV setup using `express`, `@mercuryworkshop/bare-mux`, `@mercuryworkshop/epoxy-transport`, and `wisp-server-node`.
- Ultraviolet routes through a service worker and transport layer, so some websites still block or break.
- Datacenter IPs are often what limit site compatibility, not only the proxy code.
