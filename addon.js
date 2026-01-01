import pkg from "stremio-addon-sdk";
const { addonBuilder, serveHTTP } = pkg;

import fetch from "node-fetch";
import * as cheerio from "cheerio";

const PORT = process.env.PORT || 7000;

/*
  =============================
  CACHE (in-memory, 6 hodin)
  =============================
*/
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cache = {
  timestamp: 0,
  data: []
};

/*
  =============================
  SCRAPER – Kinobox trendy
  Zdroj: https://www.kinobox.cz/vod/trendy
  =============================
*/
async function fetchKinoboxTrends() {
  const now = Date.now();

  if (cache.data.length && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const response = await fetch("https://www.kinobox.cz/vod/trendy", {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
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
    const poster = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");

    if (!title || !link) return;

    items.push({
      id: "kinobox:" + link,
      type: "movie",
      name: title,
      poster: poster ? poster.startsWith("http") ? poster : "https://www.kinobox.cz" + poster : null,
      description: "Trendující titul dle Kinobox.cz",
      behaviorHints: { defaultVideoId: null }
    });
  });

  cache = {
    timestamp: now,
    data: items
  };

  return items;
}

/*
  =============================
  STREMIO ADDON
  =============================
*/
const builder = new addonBuilder({
  id: "cz.kinobox.trendy",
  version: "1.0.0",
  name: "Kinobox – VOD trendy",
  description: "Trendující filmy dle Kinobox.cz (bez streamů)",
  resources: ["catalog"],
  types: ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "kinobox_trendy_movies",
      name: "Kinobox – Trendy filmy"
    },
    {
      type: "series",
      id: "kinobox_trendy_series",
      name: "Kinobox – Trendy seriály"
    }
  ]
});

/*
  =============================
  CATALOG HANDLER
  =============================
*/
builder.defineCatalogHandler(async ({ id }) => {
  if (!id.startsWith("kinobox_trendy")) {
    return { metas: [] };
  }

  try {
    const metas = await fetchKinoboxTrends();
    return { metas };
  } catch (err) {
    return { metas: [] };
  }
});

/*
  =============================
  SERVER
  =============================
*/
const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });