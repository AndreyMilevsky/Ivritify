const HEBREW_MAP = {
  'a': 'א', 'A': 'א',
  'b': 'ב', 'B': 'ב',
  'g': 'ג', 'G': 'ג',
  'd': 'ד', 'D': 'ד',
  'h': 'ה', 'H': 'ה',
  'v': 'ו', 'V': 'ו',
  'w': 'ו', 'W': 'ו',
  'z': 'ז', 'Z': 'ז',
  'y': 'י', 'Y': 'י',
  'k': 'כ', 'K': 'כ',
  'c': 'כ', 'C': 'כ',
  'l': 'ל', 'L': 'ל',
  'm': 'מ', 'M': 'מ',
  'n': 'נ', 'N': 'נ',
  's': 'ש', 'S': 'ש',
  'p': 'פ', 'P': 'פ',
  'f': 'פ', 'F': 'פ',
  'r': 'ר', 'R': 'ר',
  't': 'ט', 'T': 'ט',
  'q': 'ק', 'Q': 'ק',
  'x': 'צ', 'X': 'צ',
};

const DEFAULT_FREQUENCY = 7;

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT',
  'CODE', 'PRE', 'NOSCRIPT', 'BUTTON'
]);

let wordCounter = 0;
let frequency = DEFAULT_FREQUENCY;
let enabled = true;
let observerInstance = null;

let processedNodes = new WeakSet();

const originalValues = new Map();

chrome.storage.sync.get(['frequency', 'enabled'], (data) => {
  if (data.frequency) frequency = data.frequency;
  if (data.enabled !== undefined) enabled = data.enabled;
  if (enabled) {
    processPage();
    startObserver();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (!('frequency' in changes) && !('enabled' in changes)) return;

  if ('frequency' in changes) frequency = changes.frequency.newValue;
  if ('enabled' in changes) enabled = changes.enabled.newValue;

  restoreAll();

  if (enabled) {
    processPage();
    if (!observerInstance) startObserver();
  } else {
    stopObserver();
  }
});

function replaceFirstLetter(word) {
  if (word.length === 0) return word;
  const first = word[0];
  const hebrew = HEBREW_MAP[first];
  if (!hebrew) return word;
  return hebrew + word.slice(1);
}

function shouldProcessNode(node) {
  if (processedNodes.has(node)) return false;
  if (!node.nodeValue || !node.nodeValue.trim()) return false;

  const parent = node.parentElement;
  if (!parent) return false;

  if (parent.isContentEditable) return false;

  let el = parent;
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return false;
    el = el.parentElement;
  }
  return true;
}

function processTextNode(node) {
  if (processedNodes.has(node)) return;
  processedNodes.add(node);

  const text = node.nodeValue;
  const parts = text.split(/(\s+)/);
  let modified = false;

  const result = parts.map(part => {
    if (/^\s+$/.test(part) || part === '') return part;
    wordCounter++;
    if (wordCounter % frequency === 0) {
      const replaced = replaceFirstLetter(part);
      if (replaced !== part) modified = true;
      return replaced;
    }
    return part;
  });

  if (modified) {
    originalValues.set(node, text);
    node.nodeValue = result.join('');
  }
}

function processNode(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return shouldProcessNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(processTextNode);
}

function processPage() {
  processNode(document.body);
}

function restoreAll() {
  for (const [node, original] of originalValues) {
    try {
      node.nodeValue = original;
    } catch (e) {
    }
  }
  originalValues.clear();
  processedNodes = new WeakSet();
  wordCounter = 0;
}

function stopObserver() {
  if (observerInstance) {
    observerInstance.disconnect();
    observerInstance = null;
  }
}

function startObserver() {
  let debounceTimer = null;

  const observer = new MutationObserver((mutations) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processNode(node);
          } else if (node.nodeType === Node.TEXT_NODE) {
            if (shouldProcessNode(node)) processTextNode(node);
          }
        }
      }
    }, 100);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  observerInstance = observer;

  document.addEventListener('yt-navigate-finish', () => {
    setTimeout(() => processPage(), 500);
  });
}
