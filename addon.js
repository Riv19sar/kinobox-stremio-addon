import pkg from "stremio-addon-sdk";
const { addonBuilder, serveHTTP } = pkg;

import fetch from "node-fetch";
import * as cheerio from "cheerio";

// Cache - 6 hodin
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cache = {
  timestamp: 0,
  data: []
};

// Scraper Kinobox trendy filmy
async function fetchKinoboxTrends() {
  const now = Date.now();

  if (cache.data.length && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const response = await fetch("https://www.kinobox.cz/vod/trendy", {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  if (!response.ok) {
    throw new Error("Kinobox request failed");
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const items = [];

  $(".vod-item").each((i, el) => {
    const title = $(el).find(".vod-item__title").text().trim();
    const link = $(el).find("a").attr("href");
    const posterSrc = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");

    if (!title || !link) return;

    // Parsování ID z URL, např. /film/12345
    const idMatch = link.match(/\/film\/(\d+)/);
    const id = idMatch ? "kinobox-" + idMatch[1] : "kinobox-" + i;

    // Upravená URL na poster
    const poster = posterSrc
      ? posterSrc.startsWith("http")
        ? posterSrc
        : "https://www.kinobox.cz" + posterSrc
      : null;

    items.push({
      id,
      type: "movie",
      name: title,
      poster,
      description: "Trendující titul dle Kinobox.cz",
      behaviorHints: { defaultVideoId: null }
      // year můžeš přidat, pokud umíš získat
    });
  });

  cache = { timestamp: now, data: items };
  console.log("Kinobox trendy filmy načteno:", items.length);

  return items;
}

// Stremio addon builder
const builder = new addonBuilder({
  id: "cz.kinobox.trendy",
  version: "1.0.0",
  name: "Kinobox – VOD trendy",
  description: "Trendující filmy dle Kinobox.cz (bez streamů)",
  resources: ["catalog"],
  types: ["movie"],
  catalogs: [
    {
      type: "movie",
      id: "kinobox_trendy_movies",
      name: "Kinobox – Trendy filmy"
    }
  ]
});

// Handler pro katalog
builder.defineCatalogHandler(async ({ id }) => {
  if (id !== "kinobox_trendy_movies") {
    return { metas: [] };
  }

  try {
    const metas = await fetchKinoboxTrends();
    return { metas };
  } catch (e) {
    console.error("Chyba při načítání Kinobox dat:", e);
    return { metas: [] };
  }
});

// Server
const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });