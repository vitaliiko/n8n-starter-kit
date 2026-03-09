const express = require("express");
const path = require("path");
const fs = require("fs");
const {chromium} = require("playwright");

const app = express();
app.use(express.json({limit: "2mb"}));

const PORT = Number(process.env.PORT || 3000);
const PROFILE_DIR = process.env.PLAYWRIGHT_PROFILE_DIR || path.join(__dirname, ".pw-profile");
const DEFAULT_TIMEOUT_MS = Number(process.env.DEFAULT_TIMEOUT_MS || 45000);
const BROWSER_CHANNEL = process.env.PLAYWRIGHT_CHANNEL || "chromium";
const HEADLESS = process.env.HEADLESS !== "false";

if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, {recursive: true});
}

let contextPromise = null;

/**
 * Default realistic desktop headers.
 * These are only defaults. Caller can override them via extraHeaders.
 */
function buildDefaultHeaders() {
    return {
        "Accept-Language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Upgrade-Insecure-Requests": "1",
    };
}

function buildDefaultUserAgent() {
    return (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/144.0.0.0 Safari/537.36"
    );
}

/**
 * Very lightweight challenge detection.
 * This is heuristic, not perfect.
 */
function detectChallengeSignals({title, html, text, finalUrl}) {
    const checks = [
        /just a moment/i.test(title || ""),
        /enable javascript and cookies to continue/i.test(text || ""),
        /cdn-cgi\/challenge-platform/i.test(html || ""),
        /cf-chl|__cf_chl|cf_clearance|challenge-error-text/i.test(html || ""),
        /attention required/i.test(title || ""),
        /captcha/i.test(text || ""),
        /cloudflare/i.test(html || ""),
        /\/cdn-cgi\//i.test(finalUrl || ""),
    ];

    return checks.some(Boolean);
}

/**
 * Optional cookie header parser:
 * "a=1; b=2"
 * ->
 * [{ name: "a", value: "1" }, { name: "b", value: "2" }]
 */
function parseCookieHeader(cookieHeader, url) {
    if (!cookieHeader || typeof cookieHeader !== "string") return [];
    const target = new URL(url);

    return cookieHeader
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const eq = part.indexOf("=");
            if (eq === -1) return null;
            const name = part.slice(0, eq).trim();
            const value = part.slice(eq + 1).trim();
            if (!name) return null;

            return {
                name,
                value,
                domain: target.hostname,
                path: "/",
            };
        })
        .filter(Boolean);
}

async function getContext(options = {}) {
    if (contextPromise) {
        return contextPromise;
    }

    const {
        userAgent = buildDefaultUserAgent(),
        extraHTTPHeaders = buildDefaultHeaders(),
        locale = "uk-UA",
        timezoneId = "Europe/Kiev",
        viewport = {width: 1440, height: 900},
        args = [],
    } = options;

    contextPromise = chromium.launchPersistentContext(PROFILE_DIR, {
        headless: HEADLESS,
        channel: BROWSER_CHANNEL,
        userAgent,
        extraHTTPHeaders,
        locale,
        timezoneId,
        viewport,
        ignoreHTTPSErrors: true,
        args: [
            "--disable-blink-features=AutomationControlled",
            "--no-default-browser-check",
            "--disable-dev-shm-usage",
            "--disable-features=IsolateOrigins,site-per-process",
            ...args,
        ],
    });

    try {
        const context = await contextPromise;

        context.setDefaultTimeout(DEFAULT_TIMEOUT_MS);
        context.setDefaultNavigationTimeout(DEFAULT_TIMEOUT_MS);

        context.on("page", (page) => {
            page.on("dialog", async (dialog) => {
                try {
                    await dialog.dismiss();
                } catch {
                    // ignore
                }
            });
        });

        return context;
    } catch (err) {
        contextPromise = null;
        throw err;
    }
}

async function resetContext() {
    if (!contextPromise) return;

    try {
        const context = await contextPromise;
        await context.close();
    } catch {
        // ignore
    } finally {
        contextPromise = null;
    }
}

async function fetchPage({
                             url,
                             waitUntil = "load",
                             timeoutMs = DEFAULT_TIMEOUT_MS,
                             userAgent,
                             extraHeaders,
                             cookies,
                             blockResources = [],
                             waitForSelector,
                             waitForSelectorTimeoutMs = 10000,
                             returnLinks = true,
                             returnHtml = true,
                             returnText = true,
                             screenshot = false,
                             browserArgs = [],
                         }) {
    if (!url) {
        throw new Error("Missing 'url'");
    }

    const mergedHeaders = {
        ...buildDefaultHeaders(),
        ...(extraHeaders || {}),
    };

    const context = await getContext({
        userAgent: userAgent || buildDefaultUserAgent(),
        extraHTTPHeaders: mergedHeaders,
        args: Array.isArray(browserArgs) ? browserArgs : [],
    });

    if (cookies) {
        const parsedCookies = Array.isArray(cookies)
            ? cookies
            : parseCookieHeader(cookies, url);

        if (parsedCookies.length > 0) {
            await context.addCookies(parsedCookies);
        }
    }

    const page = await context.newPage();

    let routeHandler = null;
    if (Array.isArray(blockResources) && blockResources.length > 0) {
        routeHandler = async (route) => {
            const type = route.request().resourceType();
            if (blockResources.includes(type)) {
                return route.abort();
            }
            return route.continue();
        };

        await page.route("**/*", routeHandler);
    }

    const requests = [];
    const responses = [];
    const failedRequests = [];

    page.on("request", (req) => {
        requests.push({
            method: req.method(),
            url: req.url(),
            resourceType: req.resourceType(),
        });
    });

    page.on("response", async (res) => {
        responses.push({
            url: res.url(),
            status: res.status(),
            ok: res.ok(),
        });
    });

    page.on("requestfailed", (req) => {
        failedRequests.push({
            url: req.url(),
            method: req.method(),
            resourceType: req.resourceType(),
            failure: req.failure(),
        });
    });

    try {
        await page.goto(url, {
            waitUntil,
            timeout: timeoutMs,
        });

        if (waitForSelector) {
            await page.waitForSelector(waitForSelector, {
                timeout: waitForSelectorTimeoutMs,
            });
        } else {
            // Best-effort extra waiting.
            await page.waitForLoadState("load", {timeout: 10000}).catch(() => {
            });
            await page.waitForLoadState("networkidle", {timeout: 5000}).catch(() => {
            });
            await page.waitForTimeout(1500).catch(() => {
            });
        }

        const finalUrl = page.url();
        const title = await page.title();
        const html = returnHtml ? await page.content() : undefined;
        const text = returnText
            ? await page.evaluate(() => document.body?.innerText || "")
            : undefined;
        const links = returnLinks
            ? await page.$$eval("a[href]", (anchors) =>
                anchors.map((a) => ({
                    href: a.href,
                    text: (a.textContent || "").trim(),
                }))
            )
            : undefined;

        const challengeDetected = detectChallengeSignals({
            title,
            html,
            text,
            finalUrl,
        });

        let screenshotBase64;
        if (screenshot) {
            const shot = await page.screenshot({
                fullPage: true,
                type: "png",
            });
            screenshotBase64 = shot.toString("base64");
        }

        const currentCookies = await context.cookies();

        return {
            ok: !challengeDetected,
            challenged: challengeDetected,
            url,
            finalUrl,
            title,
            html,
            text,
            links,
            cookies: currentCookies,
            requestCount: requests.length,
            responseCount: responses.length,
            failedRequestCount: failedRequests.length,
            responsesSample: responses.slice(0, 30),
            failedRequestsSample: failedRequests.slice(0, 30),
            screenshotBase64,
        };
    } finally {
        if (routeHandler) {
            await page.unroute("**/*", routeHandler).catch(() => {
            });
        }
        await page.close().catch(() => {
        });
    }
}

app.post("/crawl", async (req, res) => {
    try {
        const result = await fetchPage(req.body || {});
        res.json(result);
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
});

/**
 * Closes the persistent browser context and launches a fresh browser profile on the next request.
 */
app.post("/reset-browser", async (_req, res) => {
    try {
        await resetContext();
        res.json({ok: true, message: "Browser context reset"});
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

/**
 * Returns all cookies currently stored in the browser profile.
 */
app.get("/cookies", async (_req, res) => {
    try {
        const context = await getContext();
        const cookies = await context.cookies();
        res.json({ok: true, cookies});
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

app.get("/health", async (_req, res) => {
    try {
        const context = await getContext();
        const pages = context.pages().length;
        res.json({
            ok: true,
            headless: HEADLESS,
            profileDir: PROFILE_DIR,
            browserChannel: BROWSER_CHANNEL,
            pages,
        });
    } catch (error) {
        res.status(500).json({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

async function shutdown() {
    try {
        await resetContext();
    } finally {
        process.exit(0);
    }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(PORT, () => {
    console.log(`Playwright crawler API listening on :${PORT}`);
});
