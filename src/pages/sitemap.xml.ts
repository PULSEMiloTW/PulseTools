import type { APIRoute } from "astro";
import { tools } from "../lib/tools";
export const GET: APIRoute = () =>
  new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      ["", ...tools.map((t) => t.slug), "about", "privacy"]
        .map(
          (path) =>
            `<url><loc>https://tools.pulse-studio.live/${path}</loc></url>`,
        )
        .join("") +
      "</urlset>",
    { headers: { "Content-Type": "application/xml" } },
  );
