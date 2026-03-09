# Playwright Crawler API

A small Express-based HTTP service that uses Playwright to fetch web pages with a persistent browser session.

This service is useful when a simple HTTP client is not enough because the target website:
- renders content with JavaScript
- depends on cookies or browser storage
- behaves differently for browser-like clients than for plain HTTP libraries

The server keeps a persistent Playwright browser context, which allows cookies and other session state to survive between requests.

---

## Features

- Crawl pages through a real browser engine
- Persistent browser profile between requests
- Optional custom headers and user agent
- Optional request cookie injection
- Optional resource blocking for faster crawling
- Basic anti-bot / challenge page detection
- Screenshot capture support
- Browser reset endpoint for session recovery
- Cookies inspection endpoint for debugging

---

## How it works

The server exposes an HTTP API.

Main flow:
1. A client sends a request to `POST /crawl`
2. The server opens the page in Playwright
3. It waits for the page to load
4. It returns extracted page data such as:
    - final URL
    - title
    - HTML
    - visible text
    - links
    - cookies
    - debug information

The browser context is persistent, so the service can reuse cookies and other browser state across multiple crawl requests.

---

# Endpoints

## `POST /crawl`

### Description

Loads a webpage using Playwright and returns its rendered content and metadata.

The request is executed in a **persistent browser session**, allowing cookies, local storage, and other browser state to persist across multiple crawls.

This endpoint is intended for retrieving the **fully rendered HTML of modern websites**, including sites that rely heavily on JavaScript.

---

### Request body

```json
{
  "url": "https://example.com",
  "waitUntil": "load",
  "timeoutMs": 45000,
  "userAgent": "optional custom UA",
  "extraHeaders": {
    "Header-Name": "value"
  },
  "cookies": "name=value; name2=value2",
  "blockResources": ["image", "font", "media"],
  "waitForSelector": ".product",
  "waitForSelectorTimeoutMs": 10000,
  "returnLinks": true,
  "returnHtml": true,
  "returnText": true,
  "screenshot": false,
  "browserArgs": []
}
```

---

### Request fields

| Field                      | Type            | Description                                                                |
| -------------------------- | --------------- | -------------------------------------------------------------------------- |
| `url`                      | string          | Target webpage URL. **Required**                                           |
| `waitUntil`                | string          | Navigation readiness condition (`load`, `domcontentloaded`, `networkidle`) |
| `timeoutMs`                | number          | Navigation timeout in milliseconds                                         |
| `userAgent`                | string          | Optional custom browser User-Agent                                         |
| `extraHeaders`             | object          | Additional HTTP headers to send with the request                           |
| `cookies`                  | string or array | Cookies to inject into the browser session                                 |
| `blockResources`           | array           | Resource types to block (`image`, `font`, `media`) to speed up crawling    |
| `waitForSelector`          | string          | CSS selector to wait for before extracting content                         |
| `waitForSelectorTimeoutMs` | number          | Timeout for selector wait                                                  |
| `returnLinks`              | boolean         | Include extracted links                                                    |
| `returnHtml`               | boolean         | Include full HTML content                                                  |
| `returnText`               | boolean         | Include extracted visible text                                             |
| `screenshot`               | boolean         | Capture page screenshot                                                    |
| `browserArgs`              | array           | Additional Chromium launch arguments                                       |

---

### Response

```json
{
  "ok": true,
  "challenged": false,
  "url": "https://example.com",
  "finalUrl": "https://example.com/page",
  "title": "Example page",
  "html": "<html>...</html>",
  "text": "Visible page text...",
  "links": [
    {
      "href": "https://example.com/link",
      "text": "Link text"
    }
  ],
  "cookies": [],
  "requestCount": 45,
  "responseCount": 45,
  "failedRequestCount": 0
}
```

---

### Response fields

| Field                | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `ok`                 | Indicates if page was successfully fetched             |
| `challenged`         | Indicates detection of bot protection / challenge page |
| `url`                | Original requested URL                                 |
| `finalUrl`           | Final URL after redirects                              |
| `title`              | Page title                                             |
| `html`               | Rendered HTML                                          |
| `text`               | Extracted visible text                                 |
| `links`              | Extracted page links                                   |
| `cookies`            | Current browser session cookies                        |
| `requestCount`       | Total network requests triggered                       |
| `responseCount`      | Total responses received                               |
| `failedRequestCount` | Failed network requests                                |

---

### Typical usage

Retrieve rendered content:

```bash
curl -X POST http://localhost:3000/crawl \
-H "Content-Type: application/json" \
-d '{
  "url": "https://example.com"
}'
```

Wait for specific element before extracting content:

```json
{
  "url": "https://shop.com/product/123",
  "waitForSelector": ".product-title"
}
```

---

# `POST /reset-browser`

### Description

Resets the Playwright browser context.

This endpoint closes the current persistent browser session and clears all browser state including:

* cookies
* local storage
* session storage
* cache
* service workers

A new browser context will be created automatically on the next `/crawl` request.

---

### When to use

Call this endpoint when:

* crawler repeatedly receives **bot protection pages**
* a site behaves incorrectly due to **stale session state**
* login sessions expire
* cookies become invalid
* memory usage grows after many crawls
* you want to simulate a **fresh browser session**

---

### Example

```bash
curl -X POST http://localhost:3000/reset-browser
```

Response:

```json
{
  "ok": true,
  "message": "Browser context reset"
}
```

---

# `GET /cookies`

### Description

Returns all cookies currently stored in the persistent browser session.

Cookies include session identifiers, authentication tokens, and bot-management cookies issued by visited sites.

---

### Use cases

This endpoint is useful for:

#### Debugging bot protection

Inspect cookies such as:

```
__cf_bm
cf_clearance
```

These indicate Cloudflare bot management state.

#### Inspecting login sessions

When automating login flows, this endpoint allows you to verify session cookies.

#### Exporting cookies to other clients

Cookies retrieved here can be reused by HTTP clients (such as Axios or n8n HTTP nodes) for follow-up requests.

---

### Example

```bash
curl http://localhost:3000/cookies
```

Response:

```json
{
  "ok": true,
  "cookies": [
    {
      "name": "__cf_bm",
      "value": "abc123",
      "domain": ".example.com",
      "path": "/"
    }
  ]
}
```

---

# Health endpoint

## `GET /health`

Returns crawler service status.

Example response:

```json
{
  "ok": true,
  "headless": true,
  "profileDir": "./.pw-profile",
  "browserChannel": "chromium",
  "pages": 1
}
```

---

# Recommended workflow

### Normal operation

```
POST /crawl
POST /crawl
POST /crawl
```

Browser session persists between requests.

---

### If crawling begins failing

```
POST /reset-browser
POST /crawl
```

---

### Debugging a site

```
POST /crawl
GET /cookies
```

Inspect cookies and session state.

---

# Notes

* This service uses a **persistent Playwright context**, which improves reliability by maintaining session state across requests.
* Some websites use advanced bot protection mechanisms that may still block automated browsers.
* If the response contains `challenged: true`, the returned page likely contains a bot-protection or challenge page instead of the real content.
