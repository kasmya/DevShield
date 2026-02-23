// DevShield - Popup Script
// Handles UI interactions and displays analysis results

document.addEventListener('DOMContentLoaded', () => {
  const analyzeBtn = createAnalyzeButton();
  document.body.insertBefore(analyzeBtn, document.querySelector('.header').nextSibling);
  
  // Add analyze button at the bottom
  analyzeBtn.addEventListener('click', analyzePage);
  
  // Initialize theme
  initTheme();
  
  // Theme toggle button
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('click', toggleTheme);
  
  // Auto-analyze on popup open
  setTimeout(analyzePage, 500);
});

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('devshield-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('devshield-theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function createAnalyzeButton() {
  const btn = document.createElement('button');
  btn.className = 'analyze-btn';
  btn.id = 'analyzeBtn';
  btn.textContent = '🔍 Analyze Page';
  return btn;
}

async function analyzePage() {
  const btn = document.getElementById('analyzeBtn');
  const urlDisplay = document.getElementById('urlDisplay');
  const httpsBadge = document.getElementById('httpsBadge');
  const statusText = document.getElementById('statusText');
  
  btn.disabled = true;
  btn.textContent = '⏳ Analyzing...';
  statusText.textContent = 'Scanning page structure...';
  
  try {
    // Request analysis from background script
    const response = await chrome.runtime.sendMessage({ action: "analyzePage" });
    
    if (response.error) {
      showError(response.error);
      return;
    }
    
    displayResults(response);
    
  } catch (error) {
    showError('Failed to analyze page. Make sure you are on a web page.');
    console.error('DevShield Error:', error);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Re-analyze';
  }
}

function displayResults(data) {
  const urlDisplay = document.getElementById('urlDisplay');
  const httpsBadge = document.getElementById('httpsBadge');
  const statusText = document.getElementById('statusText');
  const overallScore = document.getElementById('overallScore');
  const riskLabel = document.getElementById('riskLabel');
  const structureScore = document.getElementById('structureScore');
  const securityScore = document.getElementById('securityScore');
  const issuesList = document.getElementById('issuesList');
  
  // URL and Protocol
  urlDisplay.textContent = truncateUrl(data.url);
  
  if (data.isHttps) {
    httpsBadge.className = 'https-badge secure';
    httpsBadge.innerHTML = '🔒 HTTPS';
  } else {
    httpsBadge.className = 'https-badge insecure';
    httpsBadge.innerHTML = '🔓 HTTP';
  }
  
  statusText.textContent = 'Analysis complete';
  
  // Overall Score
  const scores = data.scores;
  overallScore.className = `score-circle ${scores.category}`;
  overallScore.querySelector('span').textContent = scores.overall;
  
  // Risk Label
  riskLabel.className = `risk-label ${scores.category}`;
  const riskText = {
    'safe': '🟢 Safe',
    'moderate': '🟡 Moderate Risk',
    'high': '🔴 High Risk'
  };
  riskLabel.textContent = riskText[scores.category];
  
  // Score Breakdown
  structureScore.textContent = scores.structure;
  structureScore.className = `value ${getScoreClass(scores.structure)}`;
  
  securityScore.textContent = scores.security;
  securityScore.className = `value ${getScoreClass(scores.security)}`;
  
  // Issues List
  const issues = generateIssuesList(data);
  issuesList.innerHTML = issues.length > 0 
    ? issues.map(issue => `
        <div class="issue-item ${issue.type}">
          <span class="issue-icon">${issue.icon}</span>
          <span class="issue-text">${issue.text}</span>
        </div>
      `).join('')
    : `<div class="empty-state">
        <div class="icon">✅</div>
        <p>No issues detected! Great job.</p>
      </div>`;
}

function generateIssuesList(data) {
  const issues = [];
  const structure = data.structure;
  const security = data.security;
  
  // Structure Issues
  if (structure.imagesWithoutAlt > 0) {
    issues.push({
      type: 'structure',
      icon: '🖼️',
      text: `${structure.imagesWithoutAlt} image(s) missing alt attributes`
    });
  }
  
  if (!structure.hasMetaDescription) {
    issues.push({
      type: 'structure',
      icon: '📝',
      text: 'Missing meta description tag'
    });
  }
  
  if (!structure.hasViewport) {
    issues.push({
      type: 'structure',
      icon: '📱',
      text: 'Missing viewport meta tag (responsive issues)'
    });
  }
  
  if (structure.inlineScripts > 0) {
    issues.push({
      type: 'structure',
      icon: '📜',
      text: `${structure.inlineScripts} inline script(s) found (maintenance risk)`
    });
  }
  
  // Security Issues
  if (!data.isHttps) {
    issues.push({
      type: 'security',
      icon: '🔓',
      text: 'Page is not using HTTPS (insecure connection)'
    });
  }
  
  if (security.jwtInLocalStorage) {
    issues.push({
      type: 'security',
      icon: '🔑',
      text: 'JWT detected in localStorage (XSS vulnerability)'
    });
  }
  
  if (security.apiKeysFound.length > 0) {
    issues.push({
      type: 'security',
      icon: '🔐',
      text: `${security.apiKeysFound.length} potential API key(s) exposed in DOM`
    });
  }
  
  if (security.excessiveScripts) {
    issues.push({
      type: 'security',
      icon: '📦',
      text: 'Excessive external scripts (supply chain risk)'
    });
  }
  
  if (security.exposedTokens.length > 0) {
    issues.push({
      type: 'security',
      icon: '🎫',
      text: `${security.exposedTokens.length} exposed token(s) in HTML`
    });
  }
  
  return issues;
}

function getScoreClass(score) {
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'danger';
}

function truncateUrl(url) {
  if (url.length > 40) {
    return url.substring(0, 37) + '...';
  }
  return url;
}

function showError(message) {
  const statusText = document.getElementById('statusText');
  const issuesList = document.getElementById('issuesList');
  
  statusText.textContent = 'Error';
  issuesList.innerHTML = `
    <div class="empty-state">
      <div class="icon">⚠️</div>
      <p>${message}</p>
    </div>
  `;
}

