const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/crawl", async (req, res) => {
    const {
        url,
        waitUntil = "domcontentloaded",
        timeoutMs = 30000,
        userAgent,
        extraHeaders,
        blockResources = ["image", "font", "media"], // faster for crawling
    } = req.body || {};

    if (!url) return res.status(400).json({ error: "Missing 'url'" });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: userAgent || undefined,
        extraHTTPHeaders: extraHeaders || undefined,
    });

    const page = await context.newPage();

    // Optional: block heavy resources
    if (blockResources?.length) {
        await page.route("**/*", (route) => {
            const rt = route.request().resourceType();
            if (blockResources.includes(rt)) return route.abort();
            return route.continue();
        });
    }

    try {
        await page.goto(url, { waitUntil, timeout: timeoutMs });

        // You can also return text-only or extracted links
        const html = await page.content();
        const title = await page.title();
        const text = await page.evaluate(() => document.body?.innerText || "");
        const links = await page.$$eval("a[href]", as => as.map(a => a.href));

        res.json({ url, title, html, text, links });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    } finally {
        await context.close();
        await browser.close();
    }
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(3000, () => console.log("Playwright crawler API listening on :3000"));
