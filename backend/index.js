// Allow self-signed or invalid certs globally since axios-cookiejar-support
// doesn't allow custom https.Agent
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const app = express();
const PORT = process.env.PORT || 5000;

// In-memory cache with clear support
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function clearCache() {
    cache.clear();
}

// Clear cache on startup to ensure new data structure is used
clearCache();

function getFromCache(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}

function setInCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Prevent process from crashing on uncaught errors
process.on('uncaughtException', (err) => {
});

process.on('unhandledRejection', (reason, promise) => {
});

const MIRROR_HOSTS = [
    "moviebox.pk",
    "moviebox.ph",
    "movieboxapp.in",
    "h5.aoneroom.com"
];

let currentHostIndex = 0;
let SELECTED_HOST = MIRROR_HOSTS[currentHostIndex];
let HOST_URL = `https://${SELECTED_HOST}`;

function rotateHost() {
    currentHostIndex = (currentHostIndex + 1) % MIRROR_HOSTS.length;
    SELECTED_HOST = MIRROR_HOSTS[currentHostIndex];
    HOST_URL = `https://${SELECTED_HOST}`;
    cookiesInitialized = false; // Reset cookies for new host
}

// Language mapping
const LANG_MAP = {
    'en': 'en-US,en;q=0.5',
    'hi': 'hi-IN,hi;q=0.9',
    'es': 'es-ES,es;q=0.9',
    'fr': 'fr-FR,fr;q=0.9',
    'de': 'de-DE,de;q=0.9',
    'it': 'it-IT,it;q=0.9',
    'ja': 'ja-JP,ja;q=0.9',
    'ko': 'ko-KR,ko;q=0.9',
    'zh': 'zh-CN,zh;q=0.9',
    'ar': 'ar-SA,ar;q=0.9',
    'pt': 'pt-PT,pt;q=0.9',
    'ru': 'ru-RU,ru;q=0.9',
    'tr': 'tr-TR,tr;q=0.9',
    'vi': 'vi-VN,vi;q=0.9',
    'th': 'th-TH,th;q=0.9',
    'ta': 'ta-IN,ta;q=0.9',
    'te': 'te-IN,te;q=0.9'
};

// Updated headers based on mobile app traffic analysis from PCAP + region bypass
const getHeaders = (lang = 'en') => ({
    'X-Client-Info': '{"timezone":"Africa/Nairobi"}',
    'Accept-Language': LANG_MAP[lang] || LANG_MAP['en'],
    'Accept': 'application/json',
    'User-Agent': 'okhttp/4.12.0', // Mobile app user agent from PCAP
    'Referer': `https://${SELECTED_HOST}`,
    'Host': SELECTED_HOST,
    'Connection': 'keep-alive',
    // Add IP spoofing headers to bypass region restrictions
    'X-Forwarded-For': '1.1.1.1',
    'CF-Connecting-IP': '1.1.1.1',
    'X-Real-IP': '1.1.1.1'
});

const DEFAULT_HEADERS = getHeaders('en');

// Subject types
const SubjectType = {
    ALL: 0,
    MOVIES: 1,
    TV_SERIES: 2,
    MUSIC: 6
};

// Session management - using axios cookie jar for proper session handling
const jar = new CookieJar();
const axiosInstance = wrapper(axios.create({
    jar,
    withCredentials: true,
    timeout: 30000
}));

let movieboxAppInfo = null;
let cookiesInitialized = false;

// Helper functions
function processApiResponse(response) {
    if (response.data && response.data.data) {
        return response.data.data;
    }
    return response.data || response;
}

async function ensureCookiesAreAssigned() {
    if (!cookiesInitialized) {
        try {
            const response = await axiosInstance.get(`${HOST_URL}/wefeed-h5-bff/app/get-latest-app-pkgs?app_name=moviebox`, {
                headers: getHeaders('en')
            });
            
            movieboxAppInfo = processApiResponse(response);
            cookiesInitialized = true;
        } catch (error) {
            // If initialization fails, try rotating host immediately
            if (currentHostIndex < MIRROR_HOSTS.length - 1) {
                rotateHost();
                return ensureCookiesAreAssigned();
            }
            throw error;
        }
    }
    return cookiesInitialized;
}

async function makeApiRequest(url, options = {}, lang = 'en', retryCount = 0) {
    await ensureCookiesAreAssigned();
    
    const finalUrl = url.startsWith('http') ? url : `${HOST_URL}${url}`;
    
    const config = {
        url: finalUrl,
        headers: { ...getHeaders(lang), ...options.headers },
        withCredentials: true,
        ...options
    };
    
    try {
        const response = await axiosInstance(config);
        return response;
    } catch (error) {
        if ((error.response?.status === 403 || error.response?.status === 404 || error.response?.status === 405) && retryCount < MIRROR_HOSTS.length) {
            rotateHost();
            const relativeUrl = url.includes(MIRROR_HOSTS[currentHostIndex - 1 < 0 ? MIRROR_HOSTS.length - 1 : currentHostIndex - 1]) 
                ? url.split(MIRROR_HOSTS[currentHostIndex - 1 < 0 ? MIRROR_HOSTS.length - 1 : currentHostIndex - 1])[1] 
                : url;
            return makeApiRequest(relativeUrl, options, lang, retryCount + 1);
        }
        
        throw error;
    }
}

async function makeApiRequestWithCookies(url, options = {}, lang = 'en', retryCount = 0) {
    await ensureCookiesAreAssigned();
    
    // Construct the URL with the current HOST_URL if it's relative
    const finalUrl = url.startsWith('http') ? url : `${HOST_URL}${url}`;
    
    const config = {
        url: finalUrl,
        headers: { ...getHeaders(lang), ...options.headers },
        withCredentials: true,
        ...options
    };
    
    try {
        const response = await axiosInstance(config);
        return response;
    } catch (error) {
        // If we get a 403 or 404, maybe the host is blocked or the endpoint changed
        if ((error.response?.status === 403 || error.response?.status === 404 || error.response?.status === 405) && retryCount < MIRROR_HOSTS.length) {
            rotateHost();
            const relativeUrl = url.includes(MIRROR_HOSTS[currentHostIndex - 1 < 0 ? MIRROR_HOSTS.length - 1 : currentHostIndex - 1]) 
                ? url.split(MIRROR_HOSTS[currentHostIndex - 1 < 0 ? MIRROR_HOSTS.length - 1 : currentHostIndex - 1])[1] 
                : url;
            return makeApiRequestWithCookies(relativeUrl, options, lang, retryCount + 1);
        }
        
        throw error;
    }
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
        <p>Endpoints: /api/trending, /api/homepage, /api/search, /api/info, /api/sources</p>
    </div>
</body>
</html>`;
    res.send(html);
});

// Helper to detect Hindi from title and enhance item metadata
function enhanceItemMetadata(item) {
    const title = (item.title || '').toLowerCase();
    const langs = [];
    
    // Language detection
    if (title.includes('hindi') || title.includes('हिन्दी') || title.includes('[hindi]') || title.includes('(hindi)') || title.includes('hin')) {
        if (!langs.includes('HINDI')) langs.push('HINDI');
    }
    // Also check for 'dub' as it often implies Hindi dub for Hollywood movies
    if (title.includes('dubbed') || title.includes('dub')) {
        // If it's a Hollywood-looking title and has 'dub', it's likely Hindi
        if (!langs.includes('HINDI')) langs.push('HINDI');
    }
    // Check if the item has language information from the API
    if (item.language && item.language.toLowerCase().includes('hi')) {
        if (!langs.includes('HINDI')) langs.push('HINDI');
    }
    if (item.audio_lang && item.audio_lang.toLowerCase().includes('hi')) {
        if (!langs.includes('HINDI')) langs.push('HINDI');
    }
    if (title.includes('tamil') || title.includes('tam')) {
        if (!langs.includes('TAMIL')) langs.push('TAMIL');
    }
    if (title.includes('telugu') || title.includes('tel')) {
        if (!langs.includes('TELUGU')) langs.push('TELUGU');
    }
    if (title.includes('kannada') || title.includes('kan')) {
        if (!langs.includes('KANNADA')) langs.push('KANNADA');
    }
    if (title.includes('malayalam') || title.includes('mal')) {
        if (!langs.includes('MALAYALAM')) langs.push('MALAYALAM');
    }
    if (title.includes('punjabi') || title.includes('pun')) {
        if (!langs.includes('PUNJABI')) langs.push('PUNJABI');
    }
    if (title.includes('bengali') || title.includes('ben')) {
        if (!langs.includes('BENGALI')) langs.push('BENGALI');
    }
    if (title.includes('marathi') || title.includes('mar')) {
        if (!langs.includes('MARATHI')) langs.push('MARATHI');
    }
    
    // Final language fallback
    if (langs.length === 0) {
        // Default to English if no other language is detected
        langs.push('ENGLISH');
    }
    
    item.languages = langs;
    
    // Duration extraction (if available in API)
    // Some API versions use runtime (minutes), some use duration (seconds or string)
    let finalDuration = '';
    
    if (item.runtime) {
        const mins = parseInt(item.runtime);
        if (!isNaN(mins)) {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            finalDuration = h > 0 ? `${h}:${m.toString().padStart(2, '0')}:00` : `${m}:00`;
        }
    } else if (item.duration) {
        const durationValue = parseInt(item.duration);
        // If duration is a number and larger than 0, assume it's seconds and format it
        if (!isNaN(durationValue) && durationValue > 0 && !item.duration.toString().includes(':')) {
            const h = Math.floor(durationValue / 3600);
            const m = Math.floor((durationValue % 3600) / 60);
            const s = durationValue % 60;
            
            if (h > 0) {
                finalDuration = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            } else {
                finalDuration = `${m}:${s.toString().padStart(2, '0')}`;
            }
        } else {
            // It's already formatted or not a number
            finalDuration = item.duration;
        }
    }

    // Mock duration if still not available to make it look like YouTube
    if (!finalDuration) {
        finalDuration = '';
    }

    item.duration = finalDuration;

    // Quality extraction
    // MovieBox often has qualityTag or resolution
    item.quality = item.qualityTag || item.resolution || 'HD';
    if (title.includes('4k') || title.includes('2160p')) item.quality = '4K';
    else if (title.includes('8k')) item.quality = '8K';
    else if (title.includes('1080p') || title.includes('fhd')) item.quality = 'FHD';
    else if (title.includes('720p')) item.quality = 'HD';

    return item;
}

// Homepage content
app.get('/api/homepage', async (req, res) => {
    const lang = (req.query.lang || 'RANDOM').toUpperCase();
    const cacheKey = `homepage_${lang}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
        // Map frontend language to MovieBox Accept-Language
        let apiLang = 'en';
        if (lang === 'HINDI') apiLang = 'hi';
        
        const response = await makeApiRequest('/wefeed-h5-bff/web/home', {}, apiLang);
        const content = processApiResponse(response);
        
        // Normalize the new API structure to 'sections'
        if (!content.sections) {
            content.sections = [];
            
            if (content.topPickList && content.topPickList.length > 0) {
                content.sections.push({
                    title: 'Top Picks',
                    items: content.topPickList
                });
            }
            
            if (content.homeList && content.homeList.length > 0) {
                content.homeList.forEach(list => {
                    content.sections.push({
                        title: list.name || 'Featured',
                        items: list.items || list.subjectList || []
                    });
                });
            }
        }
        
        // Detect languages and enhance items
        if (content.sections) {
            content.sections.forEach(section => {
                const items = section.items || section.subjects || (section.customData && section.customData.items) || [];
                section.items = items;
                
                if (section.items) {
                    section.items.forEach(item => {
                        enhanceItemMetadata(item);
                        if (!item.subjectId && item.id) item.subjectId = item.id;
                    });

                    // Filter section items if a specific language is selected
                    // We only apply strict filtering if the API provides reliable language tags,
                    // otherwise we trust the API's localized response for the selected language.
                    if (lang !== 'RANDOM') {
                        // Removed local filtering to prevent empty screens.
                        // The API's 'hi' or 'en' lang parameter already handles localization.
                    }
                }
            });

            // Remove empty sections after filtering
            if (lang !== 'RANDOM') {
                content.sections = content.sections.filter(section => section.items && section.items.length > 0);
            }
        }
        
        const result = {
            status: 'success',
            data: content
        };
        setInCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch homepage content',
            error: error.message
        });
    }
});

// Trending content
app.get('/api/trending', async (req, res) => {
    const page = parseInt(req.query.page) || 0;
    const perPage = parseInt(req.query.perPage) || 18;
    const lang = (req.query.lang || 'RANDOM').toUpperCase();
    const cacheKey = `trending_${lang}_${page}_${perPage}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
        let apiLang = 'en';
        if (lang === 'HINDI') apiLang = 'hi';

        const params = {
            page: page,
            perPage: perPage,
            uid: '5591179548772780352'
        };
        
        const response = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/trending', {
            method: 'GET',
            params: params
        }, apiLang);
        
        const content = processApiResponse(response);
        
        // Enhance items with metadata
        const items = content.items || content.subjectList || [];
        items.forEach(item => {
            enhanceItemMetadata(item);
        });
        
        // Filter trending items if a specific language is selected
        // Removed local filtering to prevent empty screens.
        // The API's 'hi' or 'en' lang parameter already handles localization.
        let filteredItems = items;
        
        // Update the items array for consistent processing
        content.items = filteredItems;
        
        const result = {
            status: 'success',
            data: content
        };
        setInCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch trending content',
            error: error.message
        });
    }
});

// Search movies and TV series
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const lang = req.query.lang || 'en';
        const page = parseInt(req.query.page) || 1;
        const perPage = parseInt(req.query.perPage) || 24;
        const subjectType = parseInt(req.query.type) || SubjectType.ALL;
        const filterLang = (req.query.filterLang || 'RANDOM').toUpperCase();
        
        // Function to perform search
        const performSearch = async (q, l) => {
            const payload = {
                keyword: q,
                page,
                perPage,
                subjectType
            };
            try {
                const response = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/search', {
                    method: 'POST',
                    data: payload
                }, l);
                return processApiResponse(response);
            } catch (err) {
                return { items: [] };
            }
        };

        const queryLower = String(query || '').toLowerCase();
        const normalizedQuery = queryLower
            .replace(/\bhindi\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const queryForSearch = normalizedQuery || queryLower;
        const queryTokens = queryForSearch
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t && t !== 'hindi' && t.length >= 3);

        const levenshteinDistance = (a, b) => {
            if (a === b) return 0;
            if (!a) return b.length;
            if (!b) return a.length;
            const m = a.length;
            const n = b.length;
            const dp = new Array(n + 1);
            for (let j = 0; j <= n; j++) dp[j] = j;
            for (let i = 1; i <= m; i++) {
                let prev = dp[0];
                dp[0] = i;
                for (let j = 1; j <= n; j++) {
                    const temp = dp[j];
                    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                    dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
                    prev = temp;
                }
            }
            return dp[n];
        };

        const isApproxTokenMatch = (titleCandidate, token) => {
            if (!token) return false;
            if (titleCandidate.includes(token)) return true;
            const words = titleCandidate
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter(Boolean);
            let best = Infinity;
            for (const w of words) {
                if (Math.abs(w.length - token.length) > 3) continue;
                const d = levenshteinDistance(w, token);
                if (d < best) best = d;
                if (best <= 1) break;
            }
            if (best === Infinity) return false;
            if (token.length >= 8) return best <= 2;
            if (token.length >= 5) return best <= 1;
            return false;
        };

        const isRelevantToQuery = (item) => {
            if (queryTokens.length === 0) return true;
            const titleCandidate = String(item?.title || item?.name || item?.originalTitle || '').toLowerCase();
            if (!titleCandidate) return false;

            let matched = 0;
            for (const token of queryTokens) {
                if (isApproxTokenMatch(titleCandidate, token)) matched += 1;
            }

            if (queryTokens.length === 1) return matched >= 1;
            return matched >= Math.min(2, queryTokens.length);
        };

        const shouldFetchHindiVariants = filterLang !== 'ENGLISH';

        // We fetch Hindi variants even when the keyword doesn't contain "hindi"
        // because MovieBox can return Hindi-available items when Accept-Language is hi.
        const [originalResults, hindiLangResults, hindiKeywordResults] = await Promise.all([
            performSearch(queryForSearch, lang),
            shouldFetchHindiVariants ? performSearch(queryForSearch, 'hi') : Promise.resolve({ items: [] }),
            shouldFetchHindiVariants ? performSearch(`${queryForSearch} hindi`, 'hi') : Promise.resolve({ items: [] })
        ]);
        
        let content = originalResults;
        const mergedItems = [...(originalResults.items || originalResults.subjectList || [])];
        const seenIds = new Set(mergedItems.map(item => item.subjectId));
        
        // Add hindi results that aren't already in the list.
        // If the same subjectId already exists (from an English search), still tag it as Hindi-available.
        const addHindiBatch = (batch, sourceLabel) => {
            (batch || []).forEach(item => {
                if (!isRelevantToQuery(item)) return;

                const subjectId = item?.subjectId;
                if (!subjectId) return;

                if (seenIds.has(subjectId)) {
                    const existing = mergedItems.find(x => x?.subjectId === subjectId);
                    if (existing) {
                        existing._isFromHindiSearch = true;
                        existing._hindiSource = existing._hindiSource ? `${existing._hindiSource},${sourceLabel}` : sourceLabel;
                    }
                    return;
                }

                // Tag them as Hindi explicitly because they were found via a Hindi-oriented search
                item._isFromHindiSearch = true;
                item._hindiSource = sourceLabel;
                mergedItems.push(item);
                seenIds.add(subjectId);
            });
        };

        addHindiBatch(hindiLangResults.items || hindiLangResults.subjectList || [], 'lang_hi');
        addHindiBatch(hindiKeywordResults.items || hindiKeywordResults.subjectList || [], 'keyword_hindi');
        
        content.items = mergedItems;
        
        // Filter results by subject type if specified
        if (subjectType !== SubjectType.ALL && content.items) {
            content.items = content.items.filter(item => item.subjectType === subjectType);
        }
        
        // Enhance each item with easily accessible thumbnail and metadata
        if (content.items) {
            content.items.forEach(item => {
                if (item.cover && item.cover.url) {
                    item.thumbnail = item.cover.url;
                }
                if (item.stills && item.stills.url && !item.thumbnail) {
                    item.thumbnail = item.stills.url;
                }
                enhanceItemMetadata(item);
                
                // If it was from Hindi search but title didn't catch it, add HINDI tag
                if (item._isFromHindiSearch && item.languages && !item.languages.includes('HINDI')) {
                    item.languages.unshift('HINDI');
                    // Remove ENGLISH if it's there
                    const engIndex = item.languages.indexOf('ENGLISH');
                    if (engIndex > -1) item.languages.splice(engIndex, 1);
                }
            });

            // Apply strict language filter if set to HINDI or ENGLISH
            if (filterLang === 'HINDI') {
                content.items = content.items.filter(item => item.languages && item.languages.includes('HINDI'));
            } else if (filterLang === 'ENGLISH') {
                content.items = content.items.filter(item => item.languages && item.languages.includes('ENGLISH'));
            }

            // Sort results to prioritize Hindi if filter is RANDOM
            if (filterLang === 'RANDOM') {
                content.items.sort((a, b) => {
                    const aIsHindi = a.languages && a.languages.includes('HINDI');
                    const bIsHindi = b.languages && b.languages.includes('HINDI');
                    
                    if (aIsHindi && !bIsHindi) return -1;
                    if (!aIsHindi && bIsHindi) return 1;
                    
                    // Secondary sort: if both are hindi, prefer title matches with 'hindi'
                    if (aIsHindi && bIsHindi) {
                        const aTitle = (a.title || '').toLowerCase();
                        const bTitle = (b.title || '').toLowerCase();
                        const aHasHindiTitle = aTitle.includes('hindi') || aTitle.includes('dub') || aTitle.includes('हिन्दी');
                        const bHasHindiTitle = bTitle.includes('hindi') || bTitle.includes('dub') || bTitle.includes('हिन्दी');
                        if (aHasHindiTitle && !bHasHindiTitle) return -1;
                        if (!aHasHindiTitle && bHasHindiTitle) return 1;
                    }
                    
                    return 0;
                });
            }
        }
        
        res.json({
            status: 'success',
            data: content
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to search content',
            error: error.message
        });
    }
});

// Get movie/series detailed information
app.get('/api/info/:movieId', async (req, res) => {
    const { movieId } = req.params;
    const lang = req.query.lang || 'en';
    const cacheKey = `info_${lang}_${movieId}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
        const response = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/detail', {
            method: 'GET',
            params: { subjectId: movieId }
        }, lang);
        
        if (!response.data || response.data.code === 429) {
            throw new Error('Rate limit exceeded or invalid response from API');
        }
        
        const content = processApiResponse(response);
        
        // Add easily accessible thumbnail URLs
        if (content.subject) {
            if (content.subject.cover && content.subject.cover.url) {
                content.subject.thumbnail = content.subject.cover.url;
            }
            if (content.subject.stills && content.subject.stills.url && !content.subject.thumbnail) {
                content.subject.thumbnail = content.subject.stills.url;
            }
            
            // Synthetic episode list for series if not present but resource.seasons is
            if (content.subject.subjectType === 2 && !content.subject.episodeList && content.resource?.seasons) {
                const syntheticList = [];
                content.resource.seasons.forEach(s => {
                    const seasonNum = s.se;
                    const maxEp = s.maxEp || 0;
                    for (let e = 1; e <= maxEp; e++) {
                        syntheticList.push({
                            episodeId: `${movieId}_${seasonNum}_${e}`,
                            season: seasonNum,
                            episode: e,
                            title: `Part ${e}`
                        });
                    }
                });
                content.subject.episodeList = syntheticList;
            }
        }
        
        const result = {
            status: 'success',
            data: content
        };
        setInCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch movie/series info',
            error: error.message
        });
    }
});

// Get related movies/series
app.get('/api/related/:movieId', async (req, res) => {
    const { movieId } = req.params;
    const lang = req.query.lang || 'en';
    const cacheKey = `related_${lang}_${movieId}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) return res.json(cachedData);

    try {
        // Try common recommendation endpoints
        let response;
        try {
            response = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/recommend', {
                method: 'GET',
                params: { subjectId: movieId }
            }, lang);
        } catch (e) {
            // If recommend fails, we'll fallback to search
        }
        
        let content = response ? processApiResponse(response) : null;
        
        // If recommendation endpoint doesn't return items, fallback to search with movie title
        if (!content || (!content.items && !content.subjectList) || (content.items?.length === 0 && content.subjectList?.length === 0)) {
            // Get movie info first to get the title
            const infoResponse = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/detail', {
                method: 'GET',
                params: { subjectId: movieId }
            }, lang);
            const movieInfo = processApiResponse(infoResponse);
            const title = movieInfo?.subject?.title;
            
            if (title) {
                // Search for the title to get similar items
                const searchResponse = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/search', {
                    method: 'POST',
                    data: {
                        keyword: title,
                        page: 1,
                        perPage: 12,
                        subjectType: 0
                    }
                }, lang);
                content = processApiResponse(searchResponse);
            }
        }

        // Enhance items with metadata
        const items = content?.items || content?.subjectList || [];
        // Filter out the current movie itself
        const filteredItems = items.filter(item => (item.subjectId || item.id) !== movieId);
        
        filteredItems.forEach(item => {
            enhanceItemMetadata(item);
            if (!item.subjectId && item.id) item.subjectId = item.id;
            if (item.cover && item.cover.url) item.thumbnail = item.cover.url;
        });

        const result = {
            status: 'success',
            data: { items: filteredItems }
        };
        setInCache(cacheKey, result);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch related content',
            error: error.message
        });
    }
});

// Get streaming sources/download links
app.get('/api/sources/:movieId', async (req, res) => {
    try {
        const { movieId } = req.params;
        const season = parseInt(req.query.season) || 0; // Movies use 0 for season
        const episode = parseInt(req.query.episode) || 0; // Movies use 0 for episode
        
        const infoResponse = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/detail', {
            method: 'GET',
            params: { subjectId: movieId }
        });
        
        if (!infoResponse.data || infoResponse.data.code === 429) {
            throw new Error('Rate limit exceeded (429) - could not fetch movie details');
        }
        
        const movieInfo = processApiResponse(infoResponse);
        const detailPath = movieInfo?.subject?.detailPath;
        const subjectType = movieInfo?.subject?.subjectType;
        
        if (!detailPath) {
            throw new Error('Could not get movie detail path for referer header');
        }
        
        // If it's a TV series and no season/episode provided, try to find the first episode
        let effectiveSeason = season;
        let effectiveEpisode = episode;
        
        if (subjectType === 2 && season === 0 && episode === 0) {
            // In MovieBox, episode list is often in movieInfo.subject.episodeList
            const episodeList = movieInfo?.subject?.episodeList || [];
            if (episodeList.length > 0) {
                // Find first available episode
                const firstEp = episodeList[0];
                effectiveSeason = firstEp.season || 1;
                effectiveEpisode = firstEp.episode || 1;
            } else {
                // Fallback to S1E1
                effectiveSeason = 1;
                effectiveEpisode = 1;
            }
        }
        
        // Create the proper referer header - try fmovies domain based on user's working link
        const refererUrl = `https://fmoviesunblocked.net/spa/videoPlayPage/movies/${detailPath}?id=${movieId}&type=/movie/detail`;
        
        const params = {
            subjectId: movieId,
            se: effectiveSeason,
            ep: effectiveEpisode
        };
        
        // Fetch sources for both English and Hindi in parallel
        // We wrap them in individual try-catch blocks so if one fails (e.g. Hindi not available), the other still works
        const fetchLangSources = async (l) => {
            try {
                const res = await makeApiRequestWithCookies('/wefeed-h5-bff/web/subject/download', {
                    method: 'GET',
                    params,
                    headers: {
                        'Referer': refererUrl,
                        'Origin': 'https://fmoviesunblocked.net',
                        'X-Forwarded-For': '1.1.1.1',
                        'CF-Connecting-IP': '1.1.1.1',
                        'X-Real-IP': '1.1.1.1'
                    }
                }, l);
                return processApiResponse(res);
            } catch (err) {
                return null;
            }
        };

        const [enContent, hiContent] = await Promise.all([
            fetchLangSources('en'),
            fetchLangSources('hi')
        ]);
        
        if (!enContent && !hiContent) {
            throw new Error('Failed to fetch sources from all language endpoints');
        }
        
        // Merge downloads from both responses, avoiding duplicates by URL
        const allDownloads = [];
        const enUrls = new Set();
        
        if (enContent?.downloads) {
            enContent.downloads.forEach(d => {
                allDownloads.push({ ...d, _requestedLang: 'en' });
                enUrls.add(d.url);
            });
        }
        
        if (hiContent?.downloads) {
            hiContent.downloads.forEach(d => {
                // If it's from the 'hi' endpoint, we tag it as Hindi immediately
                // unless it clearly has 'English' in the name
                const item = { ...d, _requestedLang: 'hi' };
                if (!enUrls.has(d.url)) {
                    allDownloads.push(item);
                    enUrls.add(d.url);
                }
            });
        }

        const content = enContent || hiContent;
        content.downloads = allDownloads;
        
        // Extract subtitles if available
        const allSubtitles = [];
        const subUrls = new Set();
        
        const processSubtitles = (subs) => {
            if (!subs || !Array.isArray(subs)) return;
            subs.forEach(s => {
                if (!subUrls.has(s.url)) {
                    allSubtitles.push({
                        lang: s.lang || s.language || 'Unknown',
                        language: s.language || s.lang || 'Unknown',
                        url: s.url,
                        label: s.label || s.lang || s.language || 'Unknown'
                    });
                    subUrls.add(s.url);
                }
            });
        };

        processSubtitles(enContent?.subtitles);
        processSubtitles(hiContent?.subtitles);
        
        content.subtitles = allSubtitles;
        
        // Process the sources to extract direct download links with proxy URLs and stream URLs
        if (allDownloads.length > 0) {
            // Extract title information
            const title = movieInfo?.subject?.title || 'video';
            const lowerTitle = title.toLowerCase();
            const isEpisode = effectiveSeason > 0 && effectiveEpisode > 0;
            
            // Detect proper protocol (handle reverse proxies like Koyeb)
            const protocol = req.get('x-forwarded-proto') || req.protocol;
            const baseUrl = `${protocol}://${req.get('host')}`;
            
            const sources = allDownloads.map((file, idx) => {
                // Build download URL with metadata for proper filename
                const downloadParams = new URLSearchParams({
                    url: file.url,
                    title: title,
                    quality: file.resolution || 'Unknown'
                });
                
                // Add season/episode info if it's a TV show
                if (isEpisode) {
                    downloadParams.append('season', effectiveSeason);
                    downloadParams.append('episode', effectiveEpisode);
                }
                
                // Detect audio language from file properties
                // MovieBox often includes language in file labels, tags, or names
                let audioLang = file.language || file.lang || file.audio_lang || file.audio_track;
                
                const lowerUrl = String(file.url || '').toLowerCase();
                const lowerRes = String(file.resolution || '').toLowerCase();
                const lowerName = String(file.name || file.label || file.title || '').toLowerCase();
                
                // Combine them for searching
                const searchStr = `${lowerUrl} ${lowerRes} ${lowerName}`; // Exclude title from initial keyword search to avoid false positives
                
                // 1. Check for explicit Japanese/Original audio keywords (common in anime)
                const hasJapaneseKeywords = searchStr.includes('japanese') || searchStr.includes('jap') || searchStr.includes('jpn') || 
                                            searchStr.includes('original') || searchStr.includes('raw') || searchStr.includes('sub');
                
                // 2. Check for explicit Hindi keywords
                const hasHindiKeywords = searchStr.includes('hindi') || searchStr.includes('hin') || searchStr.includes('हिन्दी') || 
                                         searchStr.includes('[hindi]') || searchStr.includes('(hindi)') || searchStr.includes('bolly') ||
                                         searchStr.includes('desi') || searchStr.includes('indian');

                // 3. Check for English keywords
                const hasEnglishKeywords = searchStr.includes('english') || searchStr.includes('eng') || searchStr.includes('[eng]') || searchStr.includes('(eng)');

                // Determination Logic
                if (hasHindiKeywords) {
                    if (hasEnglishKeywords) audioLang = 'Hindi + English';
                    else audioLang = 'Hindi';
                } else if (hasJapaneseKeywords) {
                    audioLang = 'Japanese';
                } else if (hasEnglishKeywords) {
                    audioLang = 'English';
                } else if (file._requestedLang === 'hi' && !hasEnglishKeywords && !hasJapaneseKeywords) {
                    // Only force Hindi if it came from Hindi endpoint and NO OTHER language was detected
                    audioLang = 'Hindi';
                } else if (!audioLang) {
                    // Default fallback
                    audioLang = 'English';
                }
                
                // Secondary check for other languages if still English/Unknown
                if (audioLang === 'English') {
                    if (searchStr.includes('punjabi') || searchStr.includes('pun')) audioLang = 'Punjabi';
                    else if (searchStr.includes('bengali') || searchStr.includes('ben')) audioLang = 'Bengali';
                    else if (searchStr.includes('marathi') || searchStr.includes('mar')) audioLang = 'Marathi';
                    else if (searchStr.includes('kannada') || searchStr.includes('kan')) audioLang = 'Kannada';
                    else if (searchStr.includes('malayalam') || searchStr.includes('mal')) audioLang = 'Malayalam';
                    else if (searchStr.includes('tamil') || searchStr.includes('tam')) audioLang = 'Tamil';
                    else if (searchStr.includes('telugu') || searchStr.includes('tel')) audioLang = 'Telugu';
                    else if (searchStr.includes('spanish') || searchStr.includes('spa') || searchStr.includes('esp')) audioLang = 'Spanish';
                    else if (searchStr.includes('french') || searchStr.includes('fre') || searchStr.includes('fra')) audioLang = 'French';
                    else if (searchStr.includes('korean') || searchStr.includes('kor')) audioLang = 'Korean';
                    else if (searchStr.includes('chinese') || searchStr.includes('chi') || searchStr.includes('zho')) audioLang = 'Chinese';
                    else if (searchStr.includes('german') || searchStr.includes('ger') || searchStr.includes('deu')) audioLang = 'German';
                }
                
                // Capitalize first letter if it was detected as lowercase or just English
                if (audioLang && typeof audioLang === 'string') {
                    audioLang = audioLang.charAt(0).toUpperCase() + audioLang.slice(1);
                }
                
                // Final ID should be unique even if IDs overlap between language requests
                const uniqueId = `${file.id || idx}_${audioLang.replace(/\s+/g, '_')}_${file.resolution || 'unknown'}`;

                return {
                    id: uniqueId,
                    quality: file.resolution || 'Unknown',
                    language: audioLang,
                    directUrl: file.url, // Original URL (blocked in browser)
                    downloadUrl: `${baseUrl}/api/download?${downloadParams.toString()}`, // Proxied download URL with metadata
                    streamUrl: `${baseUrl}/api/stream?url=${encodeURIComponent(file.url)}`, // Streaming URL with range support
                    size: file.size,
                    format: 'mp4'
                };
            });
            
            content.processedSources = sources;
        }

        // Final processed subtitles for frontend
        const processedSubtitles = allSubtitles.map((sub, idx) => {
            const protocol = req.get('x-forwarded-proto') || req.protocol;
            const baseUrl = `${protocol}://${req.get('host')}`;
            return {
                id: `sub_${idx}`,
                lang: sub.lang,
                language: sub.language,
                label: sub.label,
                url: `${baseUrl}/api/subtitle?url=${encodeURIComponent(sub.url)}`
            };
        });
        
        res.json({
            status: 'success',
            data: {
                ...content,
                processedSubtitles
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch streaming sources',
            error: error.message
        });
    }
});

// Subtitle proxy endpoint - handles SRT to VTT conversion if needed
app.get('/api/subtitle', async (req, res) => {
    try {
        const subtitleUrl = req.query.url || '';
        
        if (!subtitleUrl) {
            return res.status(400).json({ status: 'error', message: 'No subtitle URL provided' });
        }
        
        const response = await axios({
            method: 'GET',
            url: subtitleUrl,
            responseType: 'text',
            headers: {
                'User-Agent': 'okhttp/4.12.0',
                'Referer': 'https://fmoviesunblocked.net/',
                'Origin': 'https://fmoviesunblocked.net'
            }
        });
        
        let content = response.data;
        
        // Simple SRT to VTT conversion if needed
        if (!content.trim().startsWith('WEBVTT')) {
            // SRT format uses comma for decimal, VTT uses dot
            // SRT uses 1, 2, 3... for numbering, VTT doesn't require it but it's okay
            content = 'WEBVTT\n\n' + content
                .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n');
        }
        
        res.set({
            'Content-Type': 'text/vtt',
            'Access-Control-Allow-Origin': '*'
        });
        
        res.send(content);
        
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to proxy subtitle',
            error: error.message
        });
    }
});

// Cache for file sizes to avoid re-requesting HEAD
const fileSizeCache = new Map();

// Streaming proxy endpoint - handles range requests for video playback with seeking support
app.get('/api/stream', async (req, res) => {
    try {
        const streamUrl = req.query.url || '';
        
        if (!streamUrl) {
            return res.status(400).json({ status: 'error', message: 'No stream URL provided' });
        }
        
        // Allowed hosts check
        const allowedHosts = ['hakunaymatata.com', 'aoneroom.com', 'moviebox', 'valiw', 'bcdnw'];
        if (!allowedHosts.some(host => streamUrl.includes(host)) && !streamUrl.startsWith('http')) {
            return res.status(400).json({ status: 'error', message: 'Invalid stream URL' });
        }
        
        const range = req.headers.range;
        
        // 1. Get file metadata (size and type)
        let fileSize = fileSizeCache.get(streamUrl)?.size;
        let contentType = fileSizeCache.get(streamUrl)?.type || 'video/mp4';
        
        if (!fileSize) {
            try {
                // Try HEAD first
                const headResponse = await axios({
                    method: 'HEAD',
                    url: streamUrl,
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'okhttp/4.12.0',
                        'Referer': 'https://fmoviesunblocked.net/',
                        'Origin': 'https://fmoviesunblocked.net'
                    }
                });
                fileSize = parseInt(headResponse.headers['content-length']);
                contentType = headResponse.headers['content-type'] || contentType;
            } catch (headError) {
                // Fallback to GET with small range
                const testResponse = await axios({
                    method: 'GET',
                    url: streamUrl,
                    headers: {
                        'User-Agent': 'okhttp/4.12.0',
                        'Referer': 'https://fmoviesunblocked.net/',
                        'Origin': 'https://fmoviesunblocked.net',
                        'Range': 'bytes=0-0'
                    }
                });
                testResponse.data.destroy();
                const contentRange = testResponse.headers['content-range'];
                if (contentRange) {
                    const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
                    if (match) fileSize = parseInt(match[1]);
                }
                contentType = testResponse.headers['content-type'] || contentType;
            }
            
            if (fileSize) {
                fileSizeCache.set(streamUrl, { size: fileSize, type: contentType });
                // Limit cache size
                if (fileSizeCache.size > 100) {
                    const firstKey = fileSizeCache.keys().next().value;
                    fileSizeCache.delete(firstKey);
                }
            }
        }
        
        if (!fileSize || isNaN(fileSize)) {
            throw new Error('Could not determine file size');
        }
        
        // 2. Handle Range or Full Stream
        const headers = {
            'User-Agent': 'okhttp/4.12.0',
            'Referer': 'https://fmoviesunblocked.net/',
            'Origin': 'https://fmoviesunblocked.net'
        };

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            let start = parseInt(parts[0], 10);
            let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            
            if (isNaN(start) && !isNaN(end)) {
                start = fileSize - end;
                end = fileSize - 1;
            }
            
            if (isNaN(start) || isNaN(end) || start < 0 || end >= fileSize || start > end) {
                return res.status(416).set({ 'Content-Range': `bytes */${fileSize}` }).end();
            }
            
            const chunkSize = (end - start) + 1;
            headers['Range'] = `bytes=${start}-${end}`;
            
            const response = await axios({
                method: 'GET',
                url: streamUrl,
                responseType: 'stream',
                timeout: 0, // No timeout for streams
                headers,
                validateStatus: (status) => status < 500 // Allow 4xx errors
            });

            if (response.status >= 400) {
                if (!res.headersSent) {
                    return res.status(response.status).json({
                        status: 'error',
                        message: `Upstream server returned ${response.status}`,
                        url: streamUrl
                    });
                }
                return;
            }
            
            res.status(206).set({
                'Content-Type': contentType,
                'Content-Length': chunkSize,
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*',
                'X-Content-Type-Options': 'nosniff'
            });
            
            response.data.pipe(res);
            res.on('close', () => response.data.destroy());
            response.data.on('error', (e) => {
                res.end();
            });
        } else {
            const response = await axios({
                method: 'GET',
                url: streamUrl,
                responseType: 'stream',
                timeout: 0,
                headers,
                validateStatus: (status) => status < 500 // Allow 4xx errors
            });

            if (response.status >= 400) {
                if (!res.headersSent) {
                    return res.status(response.status).json({
                        status: 'error',
                        message: `Upstream server returned ${response.status}`,
                        url: streamUrl
                    });
                }
                return;
            }
            
            res.status(200).set({
                'Content-Type': contentType,
                'Content-Length': fileSize,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*',
                'X-Content-Type-Options': 'nosniff'
            });
            
            response.data.pipe(res);
            res.on('close', () => response.data.destroy());
            response.data.on('error', (e) => {
                res.end();
            });
        }
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Failed to stream video', error: error.message });
        }
    }
});

// Helper function to sanitize filename
function sanitizeFilename(filename) {
    // Remove or replace invalid filename characters
    return filename
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .trim();
}

// Download proxy endpoint - adds proper headers to bypass CDN restrictions
app.get('/api/download', async (req, res) => {
    try {
        const downloadUrl = req.query.url || '';
        const title = req.query.title || 'video';
        const season = req.query.season;
        const episode = req.query.episode;
        const quality = req.query.quality || '';
        
        if (!downloadUrl) {
            return res.status(400).json({
                status: 'error',
                message: 'No download URL provided'
            });
        }
        
        // Allow common MovieBox CDN hosts
        const allowedHosts = [
            'hakunaymatata.com',
            'aoneroom.com',
            'moviebox',
            'valiw',
            'bcdnw'
        ];
        
        const isAllowed = allowedHosts.some(host => downloadUrl.includes(host)) || downloadUrl.startsWith('http');
        
        if (!isAllowed) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid download URL'
            });
        }
        
        // Build filename from metadata
        let filename = sanitizeFilename(title);
        
        // Add season and episode if available (TV shows)
        if (season && episode) {
            filename += `_S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
        }
        
        // Add quality if available
        if (quality) {
            filename += `_${quality}`;
        }
        
        // Add file extension
        filename += '.mp4';
        
        // Make request with proper headers that allow CDN access
        // No timeout for large file downloads
        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            timeout: 0, // Disable timeout for large files
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'User-Agent': 'okhttp/4.12.0',
                'Referer': 'https://fmoviesunblocked.net/',
                'Origin': 'https://fmoviesunblocked.net'
            }
        });
        
        // Forward the content-type and other relevant headers with custom filename
        res.set({
            'Content-Type': response.headers['content-type'],
            'Content-Length': response.headers['content-length'],
            'Content-Disposition': `attachment; filename="${filename}"`
        });
        
        // Pipe the video stream to the response with error handling
        response.data.on('error', (error) => {
            if (!res.headersSent) {
                res.status(500).json({
                    status: 'error',
                    message: 'Download stream failed',
                    error: error.message
                });
            }
        });
        
        res.on('close', () => {
            response.data.destroy();
        });
        
        response.data.pipe(res);
        
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to proxy download',
            error: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: err.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint not found',
        availableEndpoints: [
            'GET /api/homepage',
            'GET /api/trending',
            'GET /api/search/:query',
            'GET /api/info/:movieId',
            'GET /api/sources/:movieId'
        ]
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

module.exports = app;
