import { defineConfig } from "astro/config";
import react from "@astrojs/react";
export default defineConfig({
  site: "https://tools.pulse-studio.live",
  output: "static",
  integrations: [react()],
});
