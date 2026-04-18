const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const app = express();
const PORT = process.env.PORT || 6789;

// In-memory cache with clear support
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const SOURCES_CACHE_TTL = 1 * 60 * 1000; // 1 minute for sources to ensure links don't expire before playback
const fileSizeCache = new Map();
const metadataInProgress = new Map();

function clearCache() {
    cache.clear();
    fileSizeCache.clear();
    metadataInProgress.clear();
}

// Clear cache on startup
clearCache();

function getFromCache(key, isSources = false) {
    const cached = cache.get(key);
    const ttl = isSources ? SOURCES_CACHE_TTL : CACHE_TTL;
    if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
    }
    return null;
}

function setInCache(key, data) {
    // Basic cache eviction if too large
    if (cache.size > 1000) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
    cache.set(key, { data, timestamp: Date.now() });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MovieBox API Configuration
const MIRROR_HOSTS = [
    "h5.aoneroom.com",
    "movieboxapp.in", 
    "moviebox.pk",
    "moviebox.ph",
    "moviebox.id",
    "v.moviebox.ph",
    "netnaija.video"
];

const SELECTED_HOST = "h5.aoneroom.com";
const HOST_URL = `https://${SELECTED_HOST}`;

// Initialize cookie jar and axios wrapper
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

// Helper to ensure we have fresh cookies
async function ensureCookiesAreAssigned() {
    try {
        // Just calling a simple endpoint to get the initial cookies
        await client.get(`${HOST_URL}/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`, {
            headers: {
                'User-Agent': 'okhttp/4.12.0',
                'X-Client-Info': '{"timezone":"Africa/Nairobi"}'
            }
        });
        return true;
    } catch (error) {
        console.error('Error fetching cookies:', error.message);
        return false;
    }
}

// Centralized request handler
async function makeApiRequestWithCookies(path, options = {}, lang = 'en') {
    await ensureCookiesAreAssigned();
    
    const url = `${HOST_URL}${path}`;
    const headers = {
        'User-Agent': 'okhttp/4.12.0',
        'Referer': HOST_URL,
        'Accept-Language': lang === 'hi' ? 'hi-IN,hi;q=0.9,en-US;q=0.8,en;q=0.7' : 'en-US,en;q=0.9',
        'X-Client-Info': '{"timezone":"Africa/Nairobi"}',
        ...options.headers
    };
    
    return client({
        ...options,
        url,
        headers
    });
}

function processApiResponse(response) {
    console.log('Processing API Response, keys:', response.data ? Object.keys(response.data) : 'no data');
    if (response.data && response.data.data) {
        return response.data.data;
    }
    return response.data;
}

function mapVideoItem(item, resource = null) {
    if (!item) return null;
    const mapped = { ...item };
    if (!mapped.subjectId && mapped.id) mapped.subjectId = mapped.id;
    if (mapped.cover && mapped.cover.url) mapped.thumbnail = mapped.cover.url;
    if (mapped.stills && mapped.stills.url && !mapped.thumbnail) mapped.thumbnail = mapped.stills.url;
    
    // Normalize episodeList from resource.seasons if missing or empty
    if ((!mapped.episodeList || mapped.episodeList.length === 0) && resource && Array.isArray(resource.seasons)) {
        mapped.episodeList = [];
        resource.seasons.forEach(s => {
            const maxEp = s.maxEp || s.episodeNum || 0;
            for (let i = 1; i <= maxEp; i++) {
                mapped.episodeList.push({
                    season: s.se,
                    episode: i,
                    episodeId: `${mapped.subjectId}_s${s.se}_e${i}`,
                    title: `Episode ${i}`
                });
            }
        });
    }
    return mapped;
}

// API Routes

// Health check
app.get('/', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MovieBox API Status</title>
    <style>
        body { font-family: sans-serif; background: #0f0f0f; color: white; padding: 40px; }
        .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; padding: 30px; border-radius: 20px; border: 1px solid #333; }
        h1 { color: #ff0000; margin-bottom: 20px; }
        .status { padding: 10px 15px; border-radius: 10px; font-weight: bold; margin-bottom: 20px; display: inline-block; }
        .online { background: #008000; color: white; }
        .host { color: #888; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Glitch Movies API</h1>
        <div class="status online">SYSTEM ONLINE</div>
        <p class="host">Current Mirror: <strong>${SELECTED_HOST}</strong></p>
        <p>Endpoints: /api/trending, /api/homepage, /api/search, /api/info, /api/sources, /api/stream</p>
    </div>
</body>
</html>`;
    res.send(html);
});

// Homepage content
app.get('/api/homepage', async (req, res) => {
    try {
        const lang = req.query.lang || 'en';
        const cacheKey = `homepage_${lang}`;
        const cached = getFromCache(cacheKey);
        
        if (cached) return res.json({ status: 'success', data: cached });
        
        const response = await makeApiRequestWithCookies('/wefeed-h5-bff/web/home', {}, lang);
        const rawData = processApiResponse(response);
        
        // Format for frontend
        const sections = [];
        
        // Add Top Picks if available
        if (Array.isArray(rawData.topPickList) && rawData.topPickList.length > 0) {
            sections.push({
                title: 'Top Picks',
                items: rawData.topPickList.map(mapVideoItem)
            });
        }

        if (rawData.homeList) {
            rawData.homeList.forEach(section => {
                let items = [];
                if (Array.isArray(section.subjects) && section.subjects.length > 0) {
                    items = section.subjects.map(mapVideoItem);
                } else if (section.customData && Array.isArray(section.customData.items) && section.customData.items.length > 0) {
                    items = section.customData.items.map(mapVideoItem);
                }
                
                if (items.length > 0) {
                    sections.push({
                        title: section.title || 'Recommended',
                        items: items
                    });
                }
            });
        }
        
        const data = { sections };
        setInCache(cacheKey, data);
        res.json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Trending content
app.get('/api/trending', async (req, res) => {
    try {
        const page = req.query.page || 0;
        const perPage = req.query.perPage || 18;
        const lang = req.query.lang || 'en';
        
        const cacheKey = `trending_${page}_${perPage}_${lang}`;
        const cached = getFromCache(cacheKey);
        
        if (cached) return res.json({ status: 'success', data: cached });
        
        const response = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/trending', {
            params: { page, perPage, uid: '5591179548772780352' }
        }, lang);
        
        const rawData = processApiResponse(response);
        const items = (rawData.subjectList || []).map(mapVideoItem);
        
        const data = { items };
        setInCache(cacheKey, data);
        res.json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Search
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { page = 1, perPage = 24, filterLang = 'en' } = req.query;
        
        const cacheKey = `search_${query}_${page}_${perPage}_${filterLang}`;
        const cached = getFromCache(cacheKey);
        if (cached) return res.json({ status: 'success', data: cached });
        
        const response = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/search', {
            method: 'POST',
            data: { keyword: query, page, perPage, subjectType: 0 }
        }, filterLang);
        
        const rawData = processApiResponse(response);
        const items = (rawData.items || rawData.subjectList || []).map(mapVideoItem);
        
        const data = { items };
        setInCache(cacheKey, data);
        res.json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Movie/Series Info
app.get('/api/info/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;
        const lang = req.query.lang || 'en';
        
        const cacheKey = `info_${movieId}_${lang}`;
        const cached = getFromCache(cacheKey);
        if (cached) return res.json({ status: 'success', data: cached });
        
        const response = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/detail', {
            params: { subjectId: movieId }
        }, lang);
        
        const rawData = processApiResponse(response);
        if (rawData.subject) {
            rawData.subject = mapVideoItem(rawData.subject, rawData.resource);
        }
        
        setInCache(cacheKey, rawData);
        res.json({ status: 'success', data: rawData });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Related/Recommendations
app.get('/api/related/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;
        const lang = req.query.lang || 'en';
        
        const cacheKey = `related_${movieId}_${lang}`;
        const cached = getFromCache(cacheKey);
        
        // If we have cached results and they are NOT empty, return them
        if (cached && cached.items && cached.items.length > 0) {
            return res.json({ status: 'success', data: cached });
        }
        
        try {
            console.log(`Fetching recommendations for ${movieId}...`);
            const response = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/recommend', {
                params: { subjectId: movieId }
            }, lang);
            
            const rawData = processApiResponse(response);
            let items = (rawData.items || rawData.subjectList || []).map(mapVideoItem);
            
            // Fallback to trending if no recommendations found or API returned empty
            if (items.length === 0) {
                console.log(`No recommendations for ${movieId}, loading trending instead...`);
                const trendingRes = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/trending', {
                    params: { page: 0, perPage: 24, uid: '5591179548772780352' }
                }, lang);
                const trendingData = processApiResponse(trendingRes);
                items = (trendingData.subjectList || []).map(mapVideoItem);
                
                // Shuffle for variety
                items = items.sort(() => Math.random() - 0.5);
            }
            
            const result = { items };
            setInCache(cacheKey, result);
            res.json({ status: 'success', data: result });
        } catch (apiError) {
            console.error(`Recommendations failed for ${movieId}, trying trending fallback...`, apiError.message);
            try {
                const trendingRes = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/trending', {
                    params: { page: 0, perPage: 24, uid: '5591179548772780352' }
                }, lang);
                const trendingData = processApiResponse(trendingRes);
                const items = (trendingData.subjectList || []).map(mapVideoItem).sort(() => Math.random() - 0.5);
                res.json({ status: 'success', data: { items } });
            } catch (innerError) {
                res.json({ status: 'success', data: { items: [] } });
            }
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Get streaming sources
app.get('/api/sources/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;
        const season = parseInt(req.query.season) || 0;
        const episode = parseInt(req.query.episode) || 0;
        
        const cacheKey = `sources_raw_${movieId}_${season}_${episode}`;
        let cachedData = getFromCache(cacheKey, true);
        
        let movieInfo, allDownloads, allSubtitles, effectiveSeason, effectiveEpisode;
        
        if (cachedData) {
            ({ movieInfo, allDownloads, allSubtitles, effectiveSeason, effectiveEpisode } = cachedData);
        } else {
            const infoResponse = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/detail', {
                params: { subjectId: movieId }
            });
            
            movieInfo = processApiResponse(infoResponse);
            if (movieInfo.subject) {
                movieInfo.subject = mapVideoItem(movieInfo.subject, movieInfo.resource);
            }
            const detailPath = movieInfo?.subject?.detailPath;
            const subjectType = movieInfo?.subject?.subjectType;
            
            effectiveSeason = season;
            effectiveEpisode = episode;
            
            if (subjectType === 2 && season === 0 && episode === 0) {
                const episodeList = movieInfo?.subject?.episodeList || [];
                if (episodeList.length > 0) {
                    const firstEp = episodeList[0];
                    effectiveSeason = firstEp.season || 1;
                    effectiveEpisode = firstEp.episode || 1;
                } else {
                    effectiveSeason = 1;
                    effectiveEpisode = 1;
                }
            }
            
            const refererUrl = `https://fmoviesunblocked.net/spa/videoPlayPage/movies/${detailPath}?id=${movieId}&type=/movie/detail`;
            const params = { subjectId: movieId, se: effectiveSeason, ep: effectiveEpisode };
            
            const fetchLangSources = async (l) => {
                try {
                    const res = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/download', {
                        params,
                        headers: { 'Referer': refererUrl }
                    }, l);
                    return processApiResponse(res);
                } catch (err) { return null; }
            };

            const [enContent, hiContent] = await Promise.all([
                fetchLangSources('en'),
                fetchLangSources('hi')
            ]);
            
            allDownloads = [];
            const urls = new Set();
            [enContent, hiContent].forEach((c, idx) => {
                if (c?.downloads) {
                    c.downloads.forEach(d => {
                        if (!urls.has(d.url)) {
                            allDownloads.push({ ...d, _requestedLang: idx === 0 ? 'en' : 'hi' });
                            urls.add(d.url);
                        }
                    });
                }
            });

            allSubtitles = [];
            const subUrls = new Set();
            [enContent, hiContent].forEach(c => {
                if (c?.subtitles) {
                    c.subtitles.forEach(s => {
                        if (!subUrls.has(s.url)) {
                            allSubtitles.push({
                                lang: s.lang || s.language || 'Unknown',
                                label: s.label || s.lang || 'Unknown',
                                url: s.url
                            });
                            subUrls.add(s.url);
                        }
                    });
                }
            });
            
            setInCache(cacheKey, { movieInfo, allDownloads, allSubtitles, effectiveSeason, effectiveEpisode });
        }
        
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const baseUrl = `${protocol}://${req.get('host')}`;
        
        const processedSources = allDownloads.map((file, idx) => {
            const streamParams = new URLSearchParams({ url: file.url });
            return {
                id: `${file.id || idx}`,
                quality: file.resolution || 'Unknown',
                language: file.language || (file._requestedLang === 'hi' ? 'Hindi' : 'English'),
                streamUrl: `${baseUrl}/api/stream?${streamParams.toString()}`,
                directUrl: file.url,
                size: file.size,
                downloadUrl: file.url
            };
        });

        const processedSubtitles = allSubtitles.map((sub, idx) => ({
            id: `sub_${idx}`,
            label: sub.label,
            url: `${baseUrl}/api/subtitle?url=${encodeURIComponent(sub.url)}`,
            lang: sub.lang,
            language: sub.label
        }));
        
        res.json({ status: 'success', data: { processedSources, processedSubtitles } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Streaming proxy with range support
app.get('/api/stream', async (req, res) => {
    try {
        const streamUrl = req.query.url;
        if (!streamUrl) return res.status(400).send('No URL provided');
        
        const range = req.headers.range;
        
        // Use a more browser-like User-Agent
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        
        // Comprehensive list of possible referers and user agents
        const REFERER_LIST = [
            HOST_URL,
            'https://movieboxapp.in/',
            'https://h5.aoneroom.com/',
            'https://v.moviebox.ph/',
            'https://fmoviesunblocked.net/'
        ];

        // Metadata caching
        let metadata = fileSizeCache.get(streamUrl);
        if (!metadata) {
            if (metadataInProgress.has(streamUrl)) {
                await metadataInProgress.get(streamUrl);
                metadata = fileSizeCache.get(streamUrl);
            } else {
                const fetchMetadata = (async () => {
                    const configs = [];
                    REFERER_LIST.forEach(ref => {
                        configs.push({ headers: { 'User-Agent': 'okhttp/4.12.0', 'Referer': ref } });
                        configs.push({ headers: { 'User-Agent': userAgent, 'Referer': ref } });
                    });
                    configs.push({ headers: { 'User-Agent': userAgent } });

                    for (const config of configs) {
                        try {
                            const head = await axios.head(streamUrl, { timeout: 5000, ...config });
                            console.log(`Stream metadata fetch successful with Referer: ${config.headers.Referer || 'None'}`);
                            const meta = { 
                                size: parseInt(head.headers['content-length']), 
                                type: head.headers['content-type'] || 'video/mp4',
                                config // Save working config
                            };
                            fileSizeCache.set(streamUrl, meta);
                            return meta;
                        } catch (e) { continue; }
                    }

                    // Fallback to GET 0-1
                    for (const config of configs) {
                        try {
                            const getRes = await axios.get(streamUrl, { 
                                timeout: 5000, 
                                headers: { ...config.headers, 'Range': 'bytes=0-1' } 
                            });
                            console.log(`Stream metadata fetch (GET 0-1) successful with Referer: ${config.headers.Referer || 'None'}`);
                            const contentRange = getRes.headers['content-range'];
                            const size = contentRange ? parseInt(contentRange.split('/')[1]) : 0;
                            const meta = { 
                                size: size || 0, 
                                type: getRes.headers['content-type'] || 'video/mp4',
                                config
                            };
                            fileSizeCache.set(streamUrl, meta);
                            return meta;
                        } catch (e) { continue; }
                    }

                    return { size: 0, type: 'video/mp4', config: configs[0] };
                })();
                metadataInProgress.set(streamUrl, fetchMetadata);
                metadata = await fetchMetadata;
                metadataInProgress.delete(streamUrl);
            }
        }
        
        if (!metadata) {
            metadata = { size: 0, type: 'video/mp4', config: { headers: { 'User-Agent': 'okhttp/4.12.0' } } };
        }
        
        const { size: fileSize, type: contentType, config: workingConfig } = metadata;
        const headers = workingConfig?.headers || { 'User-Agent': 'okhttp/4.12.0' };

        if (range && fileSize > 0) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            
            const response = await axios({
                method: 'get',
                url: streamUrl,
                responseType: 'stream',
                headers: { ...headers, 'Range': `bytes=${start}-${end}` }
            });
            
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            response.data.pipe(res);
            res.on('close', () => response.data.destroy());
        } else {
            const response = await axios({
                method: 'get',
                url: streamUrl,
                responseType: 'stream',
                headers: headers
            });
            
            const resHeaders = {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Accept-Ranges': 'bytes'
            };
            if (fileSize > 0) resHeaders['Content-Length'] = fileSize;
            
            res.writeHead(200, resHeaders);
            response.data.pipe(res);
            res.on('close', () => response.data.destroy());
        }
    } catch (error) {
        console.error('Stream Error for URL:', req.query.url, 'Error:', error.message);
        if (!res.headersSent) res.status(500).send(error.message);
    }
});

// Subtitle proxy
app.get('/api/subtitle', async (req, res) => {
    try {
        const url = req.query.url;
        const response = await axios.get(url, { responseType: 'text' });
        res.header('Content-Type', 'text/vtt');
        res.header('Access-Control-Allow-Origin', '*');
        res.send(response.data);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    ensureCookiesAreAssigned();
});