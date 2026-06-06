import type {
  ClientFinderMessage,
  FilterStateResponse
} from "../shared/types";

const STORAGE_KEYS = {
  filterEnabled: "clientFinder.filterEnabled"
} as const;

const MESSAGE_TYPES = {
  setFilterEnabled: "CLIENT_FINDER_SET_FILTER_ENABLED",
  getFilterState: "CLIENT_FINDER_GET_FILTER_STATE"
} as const;

const HIDDEN_ATTRIBUTE = "data-client-finder-hidden";
const SCANNED_ATTRIBUTE = "data-client-finder-scanned";

let observer: MutationObserver | null = null;
let filterEnabled = false;
let scanTimer: number | null = null;

const GOOGLE_HOST_PATTERN = /(^|\.)google\./i;
const IGNORED_HOSTS = new Set([
  "g.co",
  "goo.gl",
  "maps.google.com",
  "www.google.com"
]);

function scheduleScan() {
  if (!filterEnabled || scanTimer !== null) {
    return;
  }

  scanTimer = window.setTimeout(() => {
    scanTimer = null;
    filterVisibleResultCards();
  }, 150);
}

function findResultsRoot(): HTMLElement {
  return (
    document.querySelector<HTMLElement>('[role="feed"]') ??
    document.querySelector<HTMLElement>('[aria-label][role="main"]') ??
    document.body
  );
}

function isGoogleOwnedUrl(url: URL): boolean {
  return GOOGLE_HOST_PATTERN.test(url.hostname) || IGNORED_HOSTS.has(url.hostname);
}

function isExternalBusinessLink(anchor: HTMLAnchorElement): boolean {
  const href = anchor.href;

  if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) {
    return false;
  }

  try {
    const url = new URL(href);
    return ["http:", "https:"].includes(url.protocol) && !isGoogleOwnedUrl(url);
  } catch {
    return false;
  }
}

function hasWebsiteLabel(element: Element): boolean {
  const textSignals = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.textContent
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\bwebsite\b|\bweb site\b/.test(textSignals);
}

function cardHasWebsite(card: HTMLElement): boolean {
  const anchors = Array.from(card.querySelectorAll<HTMLAnchorElement>("a[href]"));

  if (anchors.some(isExternalBusinessLink)) {
    return true;
  }

  const clickableElements = Array.from(
    card.querySelectorAll("a, button, [role='button']")
  );

  return clickableElements.some(hasWebsiteLabel);
}

function looksLikeResultCard(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.hasAttribute(HIDDEN_ATTRIBUTE)) {
    return true;
  }

  const links = element.querySelectorAll("a[href]");
  const buttons = element.querySelectorAll("button, [role='button']");
  const hasPlaceLink = Array.from(links).some((link) =>
    /\/maps\/place\//.test(link.getAttribute("href") ?? "")
  );

  return hasPlaceLink && buttons.length > 0;
}

function getCandidateCards(): HTMLElement[] {
  const root = findResultsRoot();
  const feedItems = Array.from(
    root.querySelectorAll<HTMLElement>('[role="article"], [role="listitem"]')
  ).filter(looksLikeResultCard);

  if (feedItems.length > 0) {
    return feedItems;
  }

  const placeLinks = Array.from(
    root.querySelectorAll<HTMLAnchorElement>('a[href*="/maps/place/"]')
  );

  const candidates = placeLinks
    .map((link) => link.closest<HTMLElement>("[data-result-index], div"))
    .filter((card): card is HTMLElement => Boolean(card))
    .filter(looksLikeResultCard);

  return Array.from(new Set(candidates));
}

function hideCard(card: HTMLElement) {
  card.setAttribute(HIDDEN_ATTRIBUTE, "true");
  card.style.setProperty("display", "none", "important");
}

function showCard(card: HTMLElement) {
  card.removeAttribute(HIDDEN_ATTRIBUTE);
  card.removeAttribute(SCANNED_ATTRIBUTE);
  card.style.removeProperty("display");
}

function filterVisibleResultCards() {
  for (const card of getCandidateCards()) {
    if (card.getAttribute(SCANNED_ATTRIBUTE) === "true") {
      continue;
    }

    card.setAttribute(SCANNED_ATTRIBUTE, "true");

    if (cardHasWebsite(card)) {
      hideCard(card);
    }
  }
}

function restoreHiddenCards() {
  document
    .querySelectorAll<HTMLElement>(`[${HIDDEN_ATTRIBUTE}="true"]`)
    .forEach(showCard);

  document
    .querySelectorAll<HTMLElement>(`[${SCANNED_ATTRIBUTE}="true"]`)
    .forEach((card) => card.removeAttribute(SCANNED_ATTRIBUTE));
}

function startObserver() {
  if (observer) {
    return;
  }

  observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  scheduleScan();
}

function stopObserver() {
  observer?.disconnect();
  observer = null;

  if (scanTimer !== null) {
    window.clearTimeout(scanTimer);
    scanTimer = null;
  }

  restoreHiddenCards();
}

function setFilterEnabled(enabled: boolean) {
  filterEnabled = enabled;

  if (enabled) {
    startObserver();
    return;
  }

  stopObserver();
}

chrome.runtime.onMessage.addListener(
  (
    message: ClientFinderMessage,
    _sender,
    sendResponse: (response?: FilterStateResponse) => void
  ) => {
    if (message.type === MESSAGE_TYPES.setFilterEnabled) {
      setFilterEnabled(message.enabled);
      sendResponse({ enabled: filterEnabled });
      return false;
    }

    if (message.type === MESSAGE_TYPES.getFilterState) {
      sendResponse({ enabled: filterEnabled });
      return false;
    }

    return false;
  }
);

chrome.storage.sync
  .get(STORAGE_KEYS.filterEnabled)
  .then((result) => setFilterEnabled(Boolean(result[STORAGE_KEYS.filterEnabled])));
