// DevShield - Content Script
// Performs DOM inspection and security analysis on the webpage

(function() {
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze") {
      const analysisResult = analyzePage();
      sendResponse(analysisResult);
    }
    return true;
  });

  // Main analysis function
  function analyzePage() {
    const analysis = {
      url: window.location.href,
      protocol: window.location.protocol,
      isHttps: window.location.protocol === 'https:',
      structure: getStructureAnalysis(),
      security: getSecurityAnalysis(),
      scores: calculateScores()
    };
    return analysis;
  }

  // ==================== STRUCTURE ANALYSIS ====================
  function getStructureAnalysis() {
    const structure = {
      forms: document.querySelectorAll('form').length,
      inputs: document.querySelectorAll('input').length,
      scripts: document.querySelectorAll('script').length,
      externalCSS: document.querySelectorAll('link[rel="stylesheet"]').length,
      images: document.querySelectorAll('img').length,
      imagesWithoutAlt: 0,
      hasMetaDescription: false,
      hasViewport: false
    };

    // Check images without alt attribute
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (!img.hasAttribute('alt') || img.alt === '') {
        structure.imagesWithoutAlt++;
      }
    });

    // Check meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    structure.hasMetaDescription = !!metaDesc;

    // Check viewport meta tag
    const viewport = document.querySelector('meta[name="viewport"]');
    structure.hasViewport = !!viewport;

    return structure;
  }

  // ==================== SECURITY ANALYSIS ====================
  function getSecurityAnalysis() {
    const security = {
      httpOnly: !window.location.protocol.includes('https'),
      inlineScripts: 0,
      jwtInLocalStorage: false,
      apiKeysFound: [],
      excessiveScripts: false,
      exposedTokens: [],
      consoleErrors: 0,
      cspHeader: false
    };

    // Check inline scripts
    const scripts = document.querySelectorAll('script:not([src])');
    security.inlineScripts = scripts.length;

    // Check for JWT in localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        // Check for JWT pattern (header.payload.signature)
        if (value && /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(value)) {
          security.jwtInLocalStorage = true;
          security.exposedTokens.push(`JWT in localStorage (${key})`);
        }
      }
    } catch (e) {
      // localStorage access denied
    }

    // Check for API key patterns in DOM
    const apiKeyPatterns = [
      { pattern: /api[_-]?key["']?\s*[:=]\s*["']?([a-zA-Z0-9_-]{20,})/gi, name: 'API Key' },
      { pattern: /secret["']?\s*[:=]\s*["']?([a-zA-Z0-9_-]{20,})/gi, name: 'Secret' },
      { pattern: /bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi, name: 'Bearer Token' },
      { pattern: /token["']?\s*[:=]\s*["']?([a-zA-Z0-9_-]{20,})/gi, name: 'Token' }
    ];

    // Search in HTML
    const htmlContent = document.documentElement.outerHTML;
    apiKeyPatterns.forEach(({ pattern, name }) => {
      const matches = htmlContent.match(pattern);
      if (matches) {
        security.apiKeysFound.push(...matches.map(m => `${name}: ${m.substring(0, 30)}...`));
      }
    });

    // Check for excessive external scripts (more than 10 is concerning)
    const externalScripts = document.querySelectorAll('script[src]');
    security.excessiveScripts = externalScripts.length > 10;

    // Check for exposed tokens in HTML attributes
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const attrs = el.attributes;
      for (let i = 0; i < attrs.length; i++) {
        const attrValue = attrs[i].value;
        if (attrValue && /^[a-zA-Z0-9_-]{30,}$/.test(attrValue) && 
            !attrValue.includes('http') && !attrValue.includes('/')) {
          security.exposedTokens.push(`Potential token in ${attrs[i].name}`);
        }
      }
    });

    // Check CSP header (via performance API)
    try {
      const resources = performance.getEntriesByType('resource');
      security.cspHeader = resources.length > 0; // Simplified check
    } catch (e) {
      security.cspHeader = false;
    }

    return security;
  }

  // ==================== SCORING SYSTEM ====================
  function calculateScores() {
    const structure = getStructureAnalysis();
    const security = getSecurityAnalysis();

    // Structure Score (starts at 100)
    let structureScore = 100;
    structureScore -= structure.imagesWithoutAlt * 5;
    structureScore -= structure.inlineScripts * 3;
    if (!structure.hasMetaDescription) structureScore -= 10;
    if (!structure.hasViewport) structureScore -= 5;
    structureScore = Math.max(0, Math.min(100, structureScore));

    // Security Score (starts at 100)
    let securityScore = 100;
    if (!security.isHttps) securityScore -= 30;
    if (security.jwtInLocalStorage) securityScore -= 25;
    if (security.apiKeysFound.length > 0) securityScore -= 20;
    if (security.excessiveScripts) securityScore -= 15;
    if (security.inlineScripts > 0) securityScore -= security.inlineScripts * 2;
    if (security.exposedTokens.length > 0) securityScore -= 15;
    securityScore = Math.max(0, Math.min(100, securityScore));

    // Overall Health Score
    const overallScore = Math.round((structureScore + securityScore) / 2);

    // Risk Category
    let riskCategory;
    if (overallScore >= 80) {
      riskCategory = 'safe';
    } else if (overallScore >= 50) {
      riskCategory = 'moderate';
    } else {
      riskCategory = 'high';
    }

    return {
      structure: structureScore,
      security: securityScore,
      overall: overallScore,
      category: riskCategory
    };
  }
})();

