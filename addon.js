const { addonBuilder } = require('stremio-addon-sdk');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

// Funkce pro scraping seznamu filmů z kinobox.cz
async function scrapeKinobox() {
    try {
        const response = await axios.get('https://www.kinobox.cz/vod/trendy');
        const $ = cheerio.load(response.data);
        const movies = [];

        // Předpokládáme, že filmy jsou v elementech s třídou 'item' nebo podobné – uprav podle aktuálního HTML
        // Z tvého popisu: Hledejme v <a> s třídami obsahujícími filmy
        $('a[href^="/film/"]').each((i, elem) => {
            if (movies.length >= 20) return; // Limit na 20

            const link = $(elem).attr('href');
            const title = $(elem).find('.title').text().trim() || $(elem).text().trim(); // Český titul
            const ratingElem = $(elem).find('.rating'); // Příklad: hledej rating
            const rating = ratingElem.text().trim() || 'N/A';
            const genresElem = $(elem).find('.genres'); // Příklad: žánry
            const genres = genresElem.text().trim() || 'N/A';
            const poster = $(elem).find('img').attr('src') || 'https://default-poster.jpg'; // Default obrázek, uprav na reálný

            // Extrakce ID z linku (např. /film/12345-nazev -> id: 12345)
            const idMatch = link.match(/\/film\/(\d+)-/);
            const id = idMatch ? idMatch[1] : `kinobox-${i}`;

            movies.push({
                id: id,
                type: 'movie',
                name: title,
                genres: genres.split(', '),
                poster: poster.startsWith('http') ? poster : `https://www.kinobox.cz${poster}`,
                rating: parseFloat(rating.replace('%', '')) / 10 || undefined, // Převeď na IMDB-style rating
                background: poster, // Použij stejný jako poster
                description: `Rating: ${rating}, Žánry: ${genres}`, // Krátký popis z dat
                imdbRating: parseFloat(rating.replace('%', '')) / 10 || undefined,
                releaseInfo: 'N/A' // Rok, pokud extrahuješ
            });
        });

        return movies;
    } catch (error) {
        console.error('Scraping error:', error);
        return [];
    }
}

// Definice addonu
const builder = new addonBuilder({
    id: 'cz.kinobox.trendy',
    version: '1.0.0',
    name: 'Kinobox Trendy',
    description: 'Addon pro trendy filmy z Kinobox.cz',
    resources: ['catalog'],
    types: ['movie'],
    idPrefixes: ['kinobox-'],
    catalogs: [
        {
            type: 'movie',
            id: 'kinobox-trendy',
            name: 'Trendy VOD na Kinobox.cz',
            extra: [] // Žádné extra filtry
        }
    ]
});

// Implementace katalogu
builder.defineCatalogHandler(async ({ type, id }) => {
    if (type === 'movie' && id === 'kinobox-trendy') {
        const metas = await scrapeKinobox();
        return { metas };
    }
    return { metas: [] };
});

// Spuštění serveru
const app = express();
app.use('/manifest.json', (req, res) => res.json(builder.getManifest()));
app.use('/', builder.getRouter());

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
    console.log(`Addon běží na http://localhost:${PORT}/manifest.json`);
});