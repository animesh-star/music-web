import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Echoa Music",
    short_name: "Echoa",
    description: "Immersive nostalgia music experience featuring interactive vinyl player, lofi beats, and radio.",
    start_url: "/",
    display: "standalone",
    background_color: "#050508",
    theme_color: "#f43f5e",
    icons: [
      {
        src: "/echoa-logo.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/echoa-logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
