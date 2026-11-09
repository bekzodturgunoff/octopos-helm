import path from "path";
import {defineConfig, type Plugin} from "vite";
import react from "@vitejs/plugin-react";
import {tanstackRouter} from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

/**
 * Development only: a stand-in for the geo stack's tile and font servers, so `npm run dev` draws
 * maps without running kdsx-api/docker-compose-geo.yml. It serves the same OpenMapTiles schema
 * from OpenFreeMap's public OpenStreetMap tiles at /__map/…, and only when VITE_MAP_TILES_URL is
 * unset. Builds never include it: production uses our own tile server.
 */
function devMapTiles(): Plugin {
  let template: Promise<string> | undefined;
  return {
    name: "helm-dev-map-tiles",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        let url = req.url ?? "";
        let tile = url.match(/\/__map\/[^/]+\/(\d+)\/(\d+)\/(\d+)\.mvt/);
        let font = url.match(/\/__map\/font\/([^/]+)\/([^/?]+)/);
        if (!tile && !font) return next();
        try {
          // The tile path carries the data's build date, so it is read once from the TileJSON.
          template ??= fetch("https://tiles.openfreemap.org/planet")
            .then((r) => r.json() as Promise<{tiles: string[]}>)
            .then((meta) => meta.tiles[0]);
          // Martin takes a font stack ("Bold,Regular"); OpenFreeMap takes one font.
          let upstream = tile
            ? (await template).replace("{z}", tile[1]).replace("{x}", tile[2]).replace("{y}", tile[3])
            : `https://tiles.openfreemap.org/fonts/${decodeURIComponent(font![1]).split(",")[0]}/${font![2]}.pbf`;
          let response = await fetch(upstream);
          res.statusCode = response.status;
          res.setHeader("Content-Type", "application/x-protobuf");
          res.setHeader("Cache-Control", "public, max-age=86400");
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          template = undefined;
          res.statusCode = 502;
          res.end(String(err));
        }
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the app from /octopos-helm/; locally and on a real domain it is /.
  // The Pages workflow sets BASE_PATH, everything else leaves it alone.
  base: process.env.BASE_PATH || "/",
  server: {
    // The dash takes 5173; running both side by side is the normal way to work on a client.
    port: 5180,
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    devMapTiles(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
