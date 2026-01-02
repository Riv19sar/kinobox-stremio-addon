const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const puppeteer = require('puppeteer');

// Funkce pro scraping seznamu filmů z kinobox.cz pomocí Puppeteer
async function scrapeKinobox() {
    try {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true
        });
        const page = await browser.newPage();
        await page.goto('https://www.kinobox.cz/vod/trendy', { waitUntil: 'networkidle2' });

        const movies = await page.evaluate(() => {
            const items = document.querySelectorAll('a[href^="/film/"]');
            const result = [];
            items.forEach((elem, i) => {
                if (result.length >= 20) return;

                const link = elem.getAttribute('href');
                const title = elem.querySelector('.title') ? elem.querySelector('.title').textContent.trim() : elem.textContent.trim() || 'N/A';
                const ratingElem = elem.querySelector('.rating');
                const rating = ratingElem ? ratingElem.textContent.trim() : 'N/A';
                const genresElem = elem.querySelector('.genres');
                const genres = genresElem ? genresElem.textContent.trim() : 'N/A';
                const posterElem = elem.querySelector('img');
                const poster = posterElem ? posterElem.getAttribute('src') : 'https://default-poster.jpg';

                const idMatch = link.match(/\/film\/(\d+)-/);
                const id = idMatch ? idMatch[1] : `kinobox-${i}`;

                result.push({
                    id: id,
                    type: 'movie',
                    name: title,
                    genres: genres.split(', '),
                    poster: poster.startsWith('http') ? poster : `https://www.kinobox.cz${poster}`,
                    rating: parseFloat(rating.replace('%', '')) / 10 || undefined,
                    background: poster,
                    description: `Rating: ${rating}, Žánry: ${genres}`,
                    imdbRating: parseFloat(rating.replace('%', '')) / 10 || undefined,
                    releaseInfo: 'N/A'
                });
            });
            return result;
        });

        await browser.close();
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
            extra: []
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
serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });