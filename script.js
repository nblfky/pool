// Initialize camera feed
// Note: dynamically import OpenAI SDK to avoid breaking the whole app if CDN fails

// --- OpenAI Vision setup ---
let openaiClient = null;
let OpenAIConstructor = null;
async function getOpenAIClient() {
  if (!openaiApiKey) return null;
  if (openaiClient) return openaiClient;
  try {
    if (!OpenAIConstructor) {
      const mod = await import('https://esm.sh/openai?bundle');
      OpenAIConstructor = mod?.default || mod;
    }
    openaiClient = new OpenAIConstructor({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });
    return openaiClient;
  } catch (err) {
    console.warn('Failed to load OpenAI SDK', err);
    return null;
  }
}

// Analyse an image with GPT-4o Vision style prompt. Accepts a question and a data-URL or remote image URL.
async function askImageQuestion(question, imageUrl) {
  const client = await getOpenAIClient();
  if (!client) return null;
  try {
    const resp = await client.responses.create({
      model: 'gpt-4o',
      input: [
        { role: 'user', content: question },
        {
          role: 'user',
          content: [
            { type: 'input_image', image_url: imageUrl }
          ]
        }
      ]
    });
    return resp.output_text || '';
  } catch (err) {
    console.warn('OpenAI Vision request failed', err);
    return null;
  }
}

// Extract structured JSON directly from an image using GPT-4o Vision
async function extractInfoVision(imageUrl) {
  const client = await getOpenAIClient();
  if (!client) return null;
  try {
    const resp = await client.responses.create({
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content:
            'Extract JSON with keys: storeName, unitNumber, address, category. For category, choose the most appropriate from: Art, Attractions, Auto, Beauty Services, Commercial Building, Education, Essentials, Financial, Food and Beverage, General Merchandise, Government Building, Healthcare, Home Services, Hotel, Industrial, Local Services, Mass Media, Nightlife, Physical Feature, Professional Services, Religious Organization, Residential, Sports and Fitness, Travel. Use "Not Found" if unknown.'
        },
        {
          role: 'user',
          content: [{ type: 'input_image', image_url: imageUrl }]
        }
      ]
    });
    const txt = resp.output_text || '';
    const match = txt.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (err) {
    console.warn('Vision JSON extraction failed', err);
    return null;
  }
}
const video = document.getElementById('camera');
const statusDiv = document.getElementById('status');
const tableBody = document.querySelector('#resultsTable tbody');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
// --- NEW: Scanning overlay elements ---
const scanningOverlay = document.getElementById('scanningOverlay');
const scanningText = document.querySelector('.scanning-text');
// --- NEW: Image upload elements ---
const uploadBtn = document.getElementById('uploadBtn');
const imageInput = document.getElementById('imageInput');
const toggleCaptureEl = document.getElementById('toggleCapture');
const downloadImagesBtn = document.getElementById('downloadImagesBtn');
// --- NEW: Zoom control elements ---
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const zoomLevelSpan = document.getElementById('zoomLevel');

// Persistent scans storage
let scans = [];
// Note: openaiApiKey is defined later, but we need it before using getOpenAIClient().
// We will forward-declare it here and assign when loaded below.
let openaiApiKey;
let oneMapApiKey;
let captureImages = true;

// --- Scanning overlay helper functions ---
function showScanningOverlay(text = 'Scanning...') {
  if (scanningOverlay && scanningText) {
    scanningText.textContent = text;
    scanningOverlay.classList.add('show');
  }
}

function hideScanningOverlay() {
  if (scanningOverlay) {
    scanningOverlay.classList.remove('show');
  }
}

function showScanComplete() {
  if (scanningText) {
    scanningText.textContent = '✓ Done!';
    // Hide the spinner when done
    const spinner = document.querySelector('.spinner');
    if (spinner) {
      spinner.style.display = 'none';
    }
    // Hide overlay after 1.5 seconds
    setTimeout(() => {
      hideScanningOverlay();
      // Reset spinner visibility for next scan
      if (spinner) {
        spinner.style.display = 'block';
      }
    }, 1500);
  }
} // OneMap API key for authenticated endpoints
openaiApiKey = localStorage.getItem('openaiApiKey') || '';
oneMapApiKey = localStorage.getItem('oneMapApiKey') || '';
captureImages = (localStorage.getItem('captureImages') ?? 'true') === 'true';
if (toggleCaptureEl) {
  toggleCaptureEl.checked = captureImages;
  toggleCaptureEl.addEventListener('change', () => {
    captureImages = !!toggleCaptureEl.checked;
    localStorage.setItem('captureImages', String(captureImages));
  });
}
try {
  scans = JSON.parse(localStorage.getItem('scans') || '[]');
} catch (_) { scans = []; }

renderTable();

function saveScans() {
  localStorage.setItem('scans', JSON.stringify(scans));
}

function renderTable() {
  if (!tableBody) return;
  
  // Clear any existing search highlights when re-rendering
  clearSearchHighlights();
  
  tableBody.innerHTML = '';
  scans.forEach((scan, idx) => {
    // Create the main table row
    const tr = document.createElement('tr');
    tr.className = 'table-row';
    tr.dataset.index = idx;
    
    // Add table cells with data including remarks
    const remarksValue = scan.remarks || '';
    const imageCellHtml = scan.image
      ? `<a href="${scan.image}" target="_blank" rel="noopener"><img src="${scan.image}" alt="Scan" class="scan-thumb"></a>`
      : '';
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="image-cell">${imageCellHtml}</td>
      <td>${scan.storeName}</td>
      <td>${scan.unitNumber}</td>
      <td>${scan.address ?? 'Not Found'}</td>
      <td>${scan.lat ?? 'Not Found'}</td>
      <td>${scan.lng ?? 'Not Found'}</td>
      <td>${scan.category}</td>
      <td class="remarks-cell">
        <input type="text" class="remarks-input" value="${remarksValue}" 
               placeholder="Add remarks..." data-index="${idx}">
      </td>
      <td class="actions-cell">
        <button class="edit-btn" data-index="${idx}" title="Edit Row">
          ✏️ Edit
        </button>
        <button class="delete-btn" data-index="${idx}" title="Delete Row">
          🗑️ Delete
        </button>
      </td>`;
    
    // Append row to table
    tableBody.appendChild(tr);
    
    // Add event listeners for remarks input
    const remarksInput = tr.querySelector('.remarks-input');
    remarksInput.addEventListener('blur', (e) => {
      const index = parseInt(e.target.dataset.index);
      scans[index].remarks = e.target.value;
      saveScans();
    });
    
    remarksInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.target.blur(); // This will trigger the blur event above
      }
    });
    
    // Add event listeners for action buttons
    const editBtn = tr.querySelector('.edit-btn');
    const deleteBtn = tr.querySelector('.delete-btn');
    
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const index = parseInt(e.target.dataset.index);
      editRow(index);
    });
    
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const index = parseInt(e.target.dataset.index);
      deleteRow(index);
    });
  });
}

// Edit individual row
function editRow(index) {
  const scan = scans[index];
  if (!scan) return;
  
  // Create a simple modal for editing
  const modal = document.createElement('div');
  modal.className = 'edit-modal';
  modal.innerHTML = `
    <div class="edit-modal-content">
      <h3>Edit Scan #${index + 1}</h3>
      <div class="edit-form">
        <div class="edit-field">
          <label>Store Name:</label>
          <input type="text" id="edit-storeName" value="${scan.storeName}">
        </div>
        <div class="edit-field">
          <label>Unit Number:</label>
          <input type="text" id="edit-unitNumber" value="${scan.unitNumber}">
        </div>
        <div class="edit-field">
          <label>Address:</label>
          <input type="text" id="edit-address" value="${scan.address || ''}">
        </div>
        <div class="edit-field">
          <label>Latitude:</label>
          <input type="text" id="edit-lat" value="${scan.lat || ''}">
        </div>
        <div class="edit-field">
          <label>Longitude:</label>
          <input type="text" id="edit-lng" value="${scan.lng || ''}">
        </div>
        <div class="edit-field">
          <label>Category:</label>
          <input type="text" id="edit-category" value="${scan.category}">
        </div>
        <div class="edit-field">
          <label>Remarks:</label>
          <input type="text" id="edit-remarks" value="${scan.remarks || ''}">
        </div>
        <div class="edit-actions">
          <button class="btn save-btn">💾 Save</button>
          <button class="btn cancel-btn">❌ Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  const saveBtn = modal.querySelector('.save-btn');
  const cancelBtn = modal.querySelector('.cancel-btn');
  
  const closeModal = () => {
    document.body.removeChild(modal);
  };
  
  saveBtn.addEventListener('click', () => {
    // Update scan data
    scans[index] = {
      ...scan,
      storeName: document.getElementById('edit-storeName').value,
      unitNumber: document.getElementById('edit-unitNumber').value,
      address: document.getElementById('edit-address').value,
      lat: document.getElementById('edit-lat').value,
      lng: document.getElementById('edit-lng').value,
      category: document.getElementById('edit-category').value,
      remarks: document.getElementById('edit-remarks').value
    };
    
    saveScans();
    renderTable();
    closeModal();
  });
  
  cancelBtn.addEventListener('click', closeModal);
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Focus first input
  setTimeout(() => {
    document.getElementById('edit-storeName').focus();
  }, 100);
}

// Delete individual row
function deleteRow(index) {
  if (confirm(`Delete scan #${index + 1}?`)) {
    scans.splice(index, 1);
    saveScans();
    renderTable();
  }
}

// Removed old swipe functionality - now using buttons

// After renderTable definition add event listeners
// --- Toolbar actions ---
document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Clear all saved scans?')) {
    scans = [];
    saveScans();
    renderTable();
    if (video && video.srcObject) {
      video.play().catch(()=>{});
    }
  }
});

function triggerDownloadBlob(blob, filename) {
  // IE 10+
  if (window.navigator && typeof window.navigator.msSaveBlob === 'function') {
    window.navigator.msSaveBlob(blob, filename);
    return true;
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch (_) {
    return false;
  }
}

function triggerDownloadDataUrl(dataUrl, filename) {
  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (_) {
    return false;
  }
}

function exportCsv() {
  if (!scans.length) {
    alert('No data to export');
    return;
  }

  const headers = ['Store Name','Unit','Address','Lat','Lng','Category','Remarks'];
  const csvRows = [headers.join(',')];

  scans.forEach(s => {
    const row = [
      s.storeName,
      s.unitNumber,
      s.address,
      s.lat,
      s.lng,
      s.category,
      s.remarks || ''
    ]
      .map(v => '"' + (v || '').toString().replace(/"/g,'""') + '"').join(',');
    csvRows.push(row);
  });

  const csvContent = '\ufeff' + csvRows.join('\r\n'); // BOM + CRLF

  // Try Blob first
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    if (triggerDownloadBlob(blob, 'storefront_scans.csv')) return;
  } catch (err) {
    console.warn('Blob export failed, will try data URL', err);
  }

  // Fallback: data URL
  const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
  if (triggerDownloadDataUrl(dataUrl, 'storefront_scans.csv')) return;

  alert('CSV export failed. Please try a different browser.');
}

const exportBtnEl = document.getElementById('exportBtn');
if (exportBtnEl) {
  exportBtnEl.addEventListener('click', exportCsv);
} else {
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('exportBtn');
    if (el) el.addEventListener('click', exportCsv);
  });
}

// --- Manual store location search ---
const storeSearchInput = document.getElementById('storeSearchInput');
const searchLocationBtn = document.getElementById('searchLocationBtn');

function performTableSearch() {
  const searchQuery = storeSearchInput.value.trim();
  
  // Clear previous highlights
  clearSearchHighlights();
  
  if (!searchQuery) {
    statusDiv.textContent = '';
    return;
  }

  if (scans.length === 0) {
    statusDiv.textContent = 'No data to search through';
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 2000);
    return;
  }

  // Search through the scans data
  const foundIndices = [];
  const searchLower = searchQuery.toLowerCase();
  
  scans.forEach((scan, index) => {
    // Search in store name (primary field)
    if (scan.storeName && scan.storeName.toLowerCase().includes(searchLower)) {
      foundIndices.push(index);
      return;
    }
    
    // Also search in other fields for comprehensive results
    const searchableFields = [
      scan.unitNumber,
      scan.address,
      scan.category,
      scan.remarks
    ];
    
    for (const field of searchableFields) {
      if (field && field.toString().toLowerCase().includes(searchLower)) {
        foundIndices.push(index);
        break; // Don't add the same row multiple times
      }
    }
  });

  if (foundIndices.length > 0) {
    // Highlight found rows
    highlightSearchResults(foundIndices);
    
    // Update status
    const plural = foundIndices.length === 1 ? 'result' : 'results';
    statusDiv.textContent = `Found ${foundIndices.length} ${plural} for "${searchQuery}"`;
    
    // Scroll to first result
    scrollToSearchResult(foundIndices[0]);
    
    // Clear status after 5 seconds
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 5000);
  } else {
    statusDiv.textContent = `No results found for "${searchQuery}"`;
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 3000);
  }
}

function clearSearchHighlights() {
  // Remove highlight class from all rows
  const allRows = document.querySelectorAll('.table-row');
  allRows.forEach(row => {
    row.classList.remove('search-highlight');
  });
}

function highlightSearchResults(indices) {
  // Add highlight class to found rows
  const allRows = document.querySelectorAll('.table-row');
  indices.forEach(index => {
    if (allRows[index]) {
      allRows[index].classList.add('search-highlight');
    }
  });
}

function scrollToSearchResult(index) {
  // Scroll to the first found result
  const allRows = document.querySelectorAll('.table-row');
  if (allRows[index]) {
    allRows[index].scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}

searchLocationBtn.addEventListener('click', performTableSearch);

// Allow Enter key to trigger search
storeSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performTableSearch();
  }
});

// Clear search highlights when input is cleared
storeSearchInput.addEventListener('input', (e) => {
  if (e.target.value.trim() === '') {
    clearSearchHighlights();
    statusDiv.textContent = '';
  }
});

// ---------- Geolocation ----------
let currentLocation = { lat: '', lng: '' };

async function initLocation() {
  statusDiv.textContent = 'Requesting location…';
  currentLocation = await getCurrentLocation(true);
  if (!currentLocation.lat) {
    statusDiv.textContent = 'Location unavailable – scans will show N/A';
  } else {
    statusDiv.textContent = '';
  }
}

// call immediately
initLocation();

function getCurrentLocation(initial = false) {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ lat: '', lng: '' });

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        resolve({ lat: latitude.toFixed(6), lng: longitude.toFixed(6) });
      },
      err => {
        if (!initial) console.warn('Geolocation error', err.message);
        resolve({ lat: '', lng: '' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

// --- OneMap (Singapore) reverse-geocoding helper ---
// Note: OneMap's JSON schema has changed over time. Newer responses
// use a `results` array with camel-/snake-case keys (e.g. `BLK_NO`,
// `ROAD_NAME`, `POSTAL`). The original version of this file only
// handled the older `GeocodeInfo` shape, which is why it silently
// returned "" and the UI showed "Not Found".
//
// This implementation now:
// 1. Accepts either `GeocodeInfo` or `results`.
// 2. Normalises the field names so we can build a readable address
//    without having to worry about the exact schema version.
// 3. Falls back to the `ADDRESS` field when it is already formatted.
async function reverseGeocode(lat, lng) {
  try {
    // Newer API version expects separate lat & lon query params (see https://docs.onemap.sg/#revgeocode)
    const url = `https://developers.onemap.sg/commonapi/revgeocode?lat=${lat}&lon=${lng}&returnGeom=N&getAddrDetails=Y`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Handle both possible response shapes
    const result = (data.GeocodeInfo || data.results || data.ReverseGeocodeInfo)?.[0];
    if (!result) return '';

    // Normalise keys so we can treat both schemas uniformly
    const blk   = result.BLOCK      || result.BLK_NO      || result.block      || result.blk_no;
    const road  = result.ROAD       || result.ROAD_NAME   || result.road       || result.road_name;
    const bldg  = result.BUILDING   || result.BUILDINGNAME|| result.building   || result.buildingname;
    const postal= result.POSTAL     || result.POSTALCODE  || result.postal     || result.postalcode;
    const addr  = result.ADDRESS    || result.address;

    // Prefer a pre-formatted ADDRESS string if provided
    if (addr) return addr.trim();

    // Otherwise stitch together what we have
    const parts = [blk, road, bldg, 'SINGAPORE', postal].filter(Boolean);
    return parts.join(' ').trim();
  } catch (err) {
    console.warn('Reverse geocode failed', err);
    return '';
  }
}

// --- OneMap Search API for finding store locations ---
// Search for places by name using OneMap's search API
// Returns the best matching location with coordinates and address
async function searchStoreLocation(storeName, currentLat = null, currentLng = null) {
  if (!storeName || storeName === 'Not Found' || storeName === 'Unknown') {
    return null;
  }

  try {
    // Clean up store name for search
    const cleanStoreName = storeName.replace(/[^\w\s]/g, ' ').trim();
    if (!cleanStoreName) return null;

    // Use OneMap search API (public endpoint - no key required)
    const url = `https://developers.onemap.sg/commonapi/search?searchVal=${encodeURIComponent(cleanStoreName)}&returnGeom=Y&getAddrDetails=Y`;
    const headers = {};
    
    // If OneMap API key is available, could use authenticated endpoints for better performance
    // (Currently using free public endpoints which work fine)
    if (oneMapApiKey) {
      console.log('OneMap API key available for future authenticated endpoints');
    }
    
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Check if we have results
    if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
      console.log(`No search results found for: ${storeName}`);
      return null;
    }

    let bestMatch = data.results[0]; // Default to first result

    // If we have current location, find the closest match
    if (currentLat && currentLng && data.results.length > 1) {
      let closestDistance = Infinity;
      
      for (const result of data.results) {
        if (result.LATITUDE && result.LONGITUDE) {
          const distance = calculateDistance(
            parseFloat(currentLat),
            parseFloat(currentLng),
            parseFloat(result.LATITUDE),
            parseFloat(result.LONGITUDE)
          );
          
          if (distance < closestDistance) {
            closestDistance = distance;
            bestMatch = result;
          }
        }
      }
    }

    // Debug: Log the raw response to understand the structure
    console.log('OneMap search response for', storeName, ':', bestMatch);

    // Extract coordinates and address from the best match
    const lat = bestMatch.LATITUDE || bestMatch.lat;
    const lng = bestMatch.LONGITUDE || bestMatch.lng;
    
    // Try multiple ways to extract address
    let address = '';
    
    // Method 1: Check for pre-formatted address
    if (bestMatch.ADDRESS) {
      address = bestMatch.ADDRESS.trim();
    } else if (bestMatch.address) {
      address = bestMatch.address.trim();
    }
    
    // Method 2: Build address from components (more reliable)
    if (!address) {
      const addressParts = [
        bestMatch.BLK_NO || bestMatch.BLOCK,
        bestMatch.ROAD_NAME || bestMatch.ROAD,
        bestMatch.BUILDING || bestMatch.BUILDINGNAME,
        bestMatch.POSTAL || bestMatch.POSTALCODE
      ].filter(Boolean);
      
      if (addressParts.length) {
        address = addressParts.join(' ') + ', SINGAPORE';
      }
    }
    
    // Method 3: Use the search value as fallback with "Singapore" appended
    if (!address && bestMatch.SEARCHVAL) {
      address = bestMatch.SEARCHVAL + ', SINGAPORE';
    }

    if (!lat || !lng) {
      console.warn('No coordinates found in search result for', storeName);
      return null;
    }

    // Method 4: If still no address, try reverse geocoding the found coordinates
    if (!address || address === 'Address not found') {
      console.log(`No address from search, trying reverse geocoding for coordinates: ${lat}, ${lng}`);
      const reverseGeocodedAddress = await reverseGeocode(lat, lng);
      if (reverseGeocodedAddress) {
        address = reverseGeocodedAddress;
        console.log(`Got address from reverse geocoding: "${address}"`);
      }
    }

    console.log(`Final extracted address for ${storeName}: "${address}"`);

    return {
      lat: parseFloat(lat).toFixed(6),
      lng: parseFloat(lng).toFixed(6),
      address: address || 'Address not found'
    };

  } catch (err) {
    console.warn(`OneMap search failed for "${storeName}":`, err);
    return null;
  }
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}
// ----------- Dictionary + spell-correction setup -----------
let englishWords = [];
async function loadDictionary() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt');
    const text = await res.text();
    englishWords = text.split('\n');
    console.log(`Dictionary loaded: ${englishWords.length} words`);
  } catch (err) {
    console.warn('Failed to load dictionary – spell correction disabled', err);
  }
}

loadDictionary();
// --- ChatGPT integration ---

function setOpenAIApiKey(key) {
  openaiApiKey = key;
  openaiClient = null; // reset so fresh client picks up new key
  if (key) {
    localStorage.setItem('openaiApiKey', key);
  } else {
    localStorage.removeItem('openaiApiKey');
  }
}

function setOneMapApiKey(key) {
  oneMapApiKey = key;
  if (key) {
    localStorage.setItem('oneMapApiKey', key);
  } else {
    localStorage.removeItem('oneMapApiKey');
  }
}

async function extractInfoGPT(rawText) {
  if (!openaiApiKey) return null;
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + openaiApiKey
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        temperature: 0,
        messages: [
          { role: 'system', content: 'You extract structured data from storefront OCR.' },
          { role: 'user', content: `Extract JSON with keys: storeName, unitNumber, address, category. For category, choose the most appropriate from: Art, Attractions, Auto, Beauty Services, Commercial Building, Education, Essentials, Financial, Food and Beverage, General Merchandise, Government Building, Healthcare, Home Services, Hotel, Industrial, Local Services, Mass Media, Nightlife, Physical Feature, Professional Services, Religious Organization, Residential, Sports and Fitness, Travel. Use "Not Found" if unknown. OCR: """${rawText}"""` }
        ]
      })
    });
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (err) {
    console.warn('ChatGPT parsing failed', err);
    return null;
  }
}

// Prompt user to set API key if not already stored
if (!openaiApiKey) {
  setTimeout(() => {
    if (confirm('Enter your OpenAI API key to enable ChatGPT parsing?')) {
      const key = prompt('OpenAI API key (sk-...)');
      if (key) setOpenAIApiKey(key.trim());
    }
  }, 500);
}

// OneMap API key is optional - the app works fine with public endpoints
// Uncomment below if you want to be prompted for OneMap API key
/*
if (!oneMapApiKey) {
  setTimeout(() => {
    if (confirm('Enter your OneMap API key for authenticated endpoints?\n(Optional - app works fine without it)')) {
      const key = prompt('OneMap API token');
      if (key) setOneMapApiKey(key.trim());
    }
  }, 1000);
}
*/

function correctStoreName(name) {
  if (!name || !englishWords.length || typeof didYouMean !== 'function') return name;

  // Break by whitespace / punctuation while preserving words
  const tokens = name.split(/(\s+)/); // keep spaces as tokens
  const corrected = tokens.map(tok => {
    if (/^\s+$/.test(tok)) return tok; // keep spaces
    const suggestion = didYouMean(tok.toLowerCase(), englishWords, { threshold: 0.4 });
    return suggestion ? capitalize(suggestion) : tok;
  });
  return corrected.join('');
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    video.srcObject = stream;
  } catch (err) {
    console.error(err);
    statusDiv.textContent = 'Camera access denied: ' + err.message;
  }
}

initCamera();

// --- Zoom functionality ---
let currentZoom = 1.0;
const minZoom = 1.0;
const maxZoom = 5.0;
const zoomStep = 0.2;

// Zoom state management
function updateZoomLevel(newZoom) {
  currentZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
  
  // Apply zoom transform to video
  video.style.transform = `scale(${currentZoom})`;
  video.style.transformOrigin = 'center center';
  
  // Update zoom level display
  zoomLevelSpan.textContent = `${currentZoom.toFixed(1)}x`;
  
  // Update button states
  zoomOutBtn.disabled = currentZoom <= minZoom;
  zoomInBtn.disabled = currentZoom >= maxZoom;
  
  // Show/hide reset button
  zoomResetBtn.style.opacity = currentZoom > minZoom ? '1' : '0.6';
}

// Zoom control event listeners
zoomInBtn.addEventListener('click', () => {
  updateZoomLevel(currentZoom + zoomStep);
});

zoomOutBtn.addEventListener('click', () => {
  updateZoomLevel(currentZoom - zoomStep);
});

zoomResetBtn.addEventListener('click', () => {
  updateZoomLevel(minZoom);
});

// Mouse wheel zoom for desktop
video.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
  updateZoomLevel(currentZoom + delta);
}, { passive: false });

// Touch gesture handling for mobile devices
let initialDistance = 0;
let initialZoom = 1.0;
let isZooming = false;

// Helper function to get distance between two touch points
function getDistance(touches) {
  if (touches.length < 2) return 0;
  const touch1 = touches[0];
  const touch2 = touches[1];
  return Math.sqrt(
    Math.pow(touch2.clientX - touch1.clientX, 2) + 
    Math.pow(touch2.clientY - touch1.clientY, 2)
  );
}

// Touch start - initialize pinch-to-zoom
video.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    isZooming = true;
    initialDistance = getDistance(e.touches);
    initialZoom = currentZoom;
  }
}, { passive: false });

// Touch move - handle pinch-to-zoom
video.addEventListener('touchmove', (e) => {
  if (isZooming && e.touches.length === 2) {
    e.preventDefault();
    const currentDistance = getDistance(e.touches);
    
    if (initialDistance > 0) {
      const scale = currentDistance / initialDistance;
      const newZoom = initialZoom * scale;
      updateZoomLevel(newZoom);
    }
  }
}, { passive: false });

// Touch end - cleanup pinch-to-zoom
video.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) {
    isZooming = false;
    initialDistance = 0;
  }
}, { passive: false });

// Keyboard shortcuts for zoom (optional enhancement)
document.addEventListener('keydown', (e) => {
  // Only handle zoom shortcuts when not typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    updateZoomLevel(currentZoom + zoomStep);
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault();
    updateZoomLevel(currentZoom - zoomStep);
  } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    updateZoomLevel(minZoom);
  }
});

// Initialize zoom controls
updateZoomLevel(currentZoom);

// --- Duplicate Detection Functions ---
function isDuplicateStore(newStore) {
  // Check if a store with the same name and address already exists
  return scans.some(existingStore => {
    // Normalize strings for comparison (trim whitespace, convert to lowercase)
    const existingName = (existingStore.storeName || '').trim().toLowerCase();
    const newName = (newStore.storeName || '').trim().toLowerCase();
    const existingAddress = (existingStore.address || '').trim().toLowerCase();
    const newAddress = (newStore.address || '').trim().toLowerCase();
    
    // Skip comparison if either name is "Not Found" or empty
    if (!existingName || !newName || existingName === 'not found' || newName === 'not found') {
      return false;
    }
    
    // Skip comparison if either address is "Not Found" or empty
    if (!existingAddress || !newAddress || existingAddress === 'not found' || newAddress === 'not found') {
      return false;
    }
    
    // Consider it a duplicate if both name and address match exactly
    const nameMatch = existingName === newName;
    const addressMatch = existingAddress === newAddress;
    
    return nameMatch && addressMatch;
  });
}

function showDuplicateDetected(storeName, address) {
  // Hide the scanning overlay first
  hideScanningOverlay();
  
  // Show duplicate detection overlay with custom styling
  if (scanningOverlay && scanningText) {
    scanningText.textContent = '⚠️ Duplicate Detected';
    scanningOverlay.classList.add('show', 'duplicate-warning');
    
    // Hide the spinner for duplicate warning
    const spinner = document.querySelector('.spinner');
    if (spinner) {
      spinner.style.display = 'none';
    }
    
    // Create detailed message
    const duplicateMessage = document.createElement('div');
    duplicateMessage.className = 'duplicate-message';
    duplicateMessage.innerHTML = `
      <div class="duplicate-details">
        <strong>${storeName}</strong><br>
        <small>${address}</small><br>
        <em>Already exists in your data</em>
      </div>
    `;
    
    // Add message to scanning content
    const scanningContent = document.querySelector('.scanning-content');
    if (scanningContent) {
      scanningContent.appendChild(duplicateMessage);
    }
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      scanningOverlay.classList.remove('show', 'duplicate-warning');
      if (duplicateMessage && duplicateMessage.parentNode) {
        duplicateMessage.parentNode.removeChild(duplicateMessage);
      }
      // Restore spinner visibility for next scan
      if (spinner) {
        spinner.style.display = 'block';
      }
    }, 3000);
  }
  
  // Also show in status div as backup
  statusDiv.textContent = `Duplicate detected: "${storeName}" already exists`;
  statusDiv.style.color = '#ff6b35';
  setTimeout(() => {
    statusDiv.textContent = '';
    statusDiv.style.color = '';
  }, 3000);
  
  console.log(`Duplicate store detected and rejected: "${storeName}" at "${address}"`);
}

// --- Helper: run OCR + processing on any canvas source (camera or uploaded) ---
async function performScanFromCanvas(canvas) {
  showScanningOverlay('Scanning...');
  statusDiv.textContent = 'Scanning…';
  progressBar.style.display = 'block';
  progressFill.style.width = '0%';

  const imageDataUrl = captureImages ? canvas.toDataURL('image/jpeg', 0.8) : '';

  // Try Vision JSON extraction first
  let parsed = null;
  if (openaiApiKey) {
    showScanningOverlay('Analyzing...');
    statusDiv.textContent = 'Analyzing with GPT-4o…';
    parsed = await extractInfoVision(imageDataUrl);
    if (parsed) {
      console.log('Vision JSON:', parsed);
    }
  }

  let geo = currentLocation;
  if (!geo.lat) {
    geo = await getCurrentLocation();
  }

  if (!parsed) {
    // Vision failed → run OCR fallback
    const result = await Tesseract.recognize(canvas, 'eng', {
      logger: m => {
        if (m.progress !== undefined) {
          const percent = Math.floor(m.progress * 100);
          statusDiv.textContent = `Scanning… ${percent}%`;
          progressFill.style.width = percent + '%';
        }
      },
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:#&-.',
      tessedit_pageseg_mode: 6
    });

    const { text, confidence, lines } = result.data;
    console.log('OCR confidence', confidence);

    showScanningOverlay('Processing text...');
    statusDiv.textContent = 'Processing…';

    parsed = await extractInfoGPT(text);
    if (!parsed) parsed = extractInfo(text, lines);
  }

  // Map extracted business type to canonical category (applies to Vision or OCR)
  if (parsed && parsed.category) {
    parsed.category = await mapToCompanyCategory(parsed.category);
  }

  // Try to search for the store location using OneMap API
  let storeLocation = null;
  if (parsed && parsed.storeName && parsed.storeName !== 'Not Found') {
    showScanningOverlay('Finding location...');
    statusDiv.textContent = 'Finding store location…';
    storeLocation = await searchStoreLocation(parsed.storeName, geo.lat, geo.lng);
  }

  // Use store location if found, otherwise fallback to current device location
  let finalLat, finalLng, address;
  if (storeLocation) {
    finalLat = storeLocation.lat;
    finalLng = storeLocation.lng;
    address = storeLocation.address;
    console.log(`Found store location: ${parsed.storeName} at ${finalLat}, ${finalLng}`);
  } else {
    // Fallback to device location and reverse geocode
    finalLat = geo.lat || 'Not Found';
    finalLng = geo.lng || 'Not Found';
    
  if (geo.lat && geo.lng) {
    address = await reverseGeocode(geo.lat, geo.lng);
  }
    
    if (!address) {
      address = parsed.address || 'Not Found';
    }
  }

  const info = Object.assign(
    { lat: finalLat, lng: finalLng, address: address },
    parsed
  );
  if (captureImages && imageDataUrl) {
    info.image = imageDataUrl;
  }

  // Check for duplicates before adding
  if (isDuplicateStore(info)) {
    // Show duplicate detection message
    showDuplicateDetected(info.storeName, info.address);
    statusDiv.textContent = '';
    progressBar.style.display = 'none';
    return; // Don't add duplicate
  }

  scans.push(info);
  saveScans();
  renderTable();
  
  // Show completion message
  showScanComplete();
  
  statusDiv.textContent = '';
  progressBar.style.display = 'none';
}

// Scan button handler
document.getElementById('scanBtn').addEventListener('click', async () => {
  if (!video.videoWidth) {
    statusDiv.textContent = 'Camera not ready yet, please wait…';
    return;
  }

  showScanningOverlay('Capturing image...');
  statusDiv.textContent = 'Scanning…';
  progressBar.style.display = 'block';
  progressFill.style.width = '0%';

  // Capture current frame
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  await performScanFromCanvas(canvas);
});

// Upload image handler
if (uploadBtn && imageInput) {
  uploadBtn.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      await performScanFromCanvas(canvas);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    imageInput.value = '';
  });
}

// Download all captured images as a zip
async function downloadAllImages() {
  try {
    const images = scans
      .map((s, i) => ({ idx: i + 1, name: (s.storeName || 'Store').toString().trim(), dataUrl: s.image }))
      .filter(x => x.dataUrl && /^data:image\//.test(x.dataUrl));

    if (!images.length) {
      alert('No images to download');
      return;
    }

    // Detect iOS/iPadOS (including iPadOS masquerading as Mac)
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // If iOS supports Web Share with files, offer Save to Photos via Share Sheet
    if (isiOS && navigator.canShare && navigator.share) {
      // Helper to convert data URL to Blob
      const dataUrlToBlob = (dataUrl) => {
        const [meta, b64] = dataUrl.split(',');
        const contentType = (meta.match(/data:(.*?);base64/) || [])[1] || 'image/jpeg';
        const byteChars = atob(b64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: contentType });
      };

      const files = images.map(img => {
        const safeName = (img.name || 'Store').replace(/[^a-z0-9\- _\.]/gi, '_').slice(0, 80) || 'Store';
        const fileName = String(img.idx).padStart(3, '0') + ' - ' + safeName + '.jpg';
        const blob = dataUrlToBlob(img.dataUrl);
        return new File([blob], fileName, { type: 'image/jpeg' });
      });

      // iOS may fail on too many/large files. Share in small batches.
      const chunk = (arr, size) => arr.reduce((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
      const batches = chunk(files, 10); // 10 files per share as a safe default

      for (const batch of batches) {
        if (navigator.canShare({ files: batch })) {
          try {
            await navigator.share({ files: batch, title: 'Storefront Images', text: 'Save images to Photos' });
          } catch (err) {
            if (err && err.name === 'AbortError') {
              // User cancelled share sheet; stop further batches
              return;
            }
            console.warn('Share failed, falling back to ZIP for this batch:', err);
            // Fall back to ZIP for this batch
            await downloadImagesAsZip(batch);
          }
        } else {
          // Device cannot share this batch; fall back to ZIP
          await downloadImagesAsZip(batch);
        }
      }
      return; // iOS handled via share
    }

    // Non-iOS or missing Web Share: zip and download
    await downloadImagesAsZip(images);
  } catch (err) {
    console.error('Failed to download images:', err);
    alert('Failed to download images. Check console for details.');
  }
}

if (downloadImagesBtn) {
  downloadImagesBtn.addEventListener('click', downloadAllImages);
}

// Helper: ZIP a set of images and download
async function downloadImagesAsZip(items) {
  // Normalize items: could be array of File or our {idx,name,dataUrl}
  const isFile = items.length && items[0] instanceof File;

  if (typeof JSZip === 'undefined') {
    alert('ZIP library not loaded. Please check your connection and try again.');
    return;
  }

  const zip = new JSZip();

  if (isFile) {
    items.forEach((file, index) => {
      const name = file.name || `image_${index + 1}.jpg`;
      zip.file(name, file);
    });
  } else {
    const dataUrlToUint8Array = (dataUrl) => {
      const parts = dataUrl.split(',');
      const base64 = parts[1];
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    };

    items.forEach((img) => {
      const safeName = (img.name || 'Store').replace(/[^a-z0-9\- _\.]/gi, '_').slice(0, 80) || 'Store';
      const fileName = String(img.idx).padStart(3, '0') + ' - ' + safeName + '.jpg';
      const bytes = dataUrlToUint8Array(img.dataUrl);
      zip.file(fileName, bytes);
    });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownloadBlob(blob, 'storefront_images.zip');
}

// Extract structured information from raw OCR text
function extractInfo(rawText, ocrLines = []) {
  // Normalise whitespace
  const text = rawText.replace(/\n+/g, '\n').trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // ----- Patterns based on rules provided -----
  // Pick store name using multiple heuristics
  let storeName = '';
  if (ocrLines.length) {
    // Step 1: Filter lines with mostly letters (reduce gibberish)
    const letterLines = ocrLines.filter(l => {
      const txt = l.text.trim();
      const letters = txt.replace(/[^A-Za-z]/g, '');
      const ratio = letters.length / (txt.length || 1);
      return letters.length >= 3 && ratio > 0.6; // at least 60% letters
    });

    // Step 2: Choose line with highest confidence ( then longest length )
    letterLines.sort((a, b) => (b.confidence || b.conf || 0) - (a.confidence || a.conf || 0));
    if (letterLines.length) {
      storeName = letterLines[0].text.trim();
    }
  }

  // 2) Fallback: first line that is mostly uppercase (e.g., "SCAN ME")
  if (!storeName) {
    const upperCandidate = lines.find(l => {
      const letters = l.replace(/[^A-Za-z]/g, '');
      return letters.length >= 3 && letters === letters.toUpperCase();
    });
    if (upperCandidate) storeName = upperCandidate;
  }

  // 3) Ultimate fallback: first line
  if (!storeName) storeName = lines[0] || '';

  storeName = correctStoreName(storeName);

  // Unit number must be in the form #XX-XXX
  const unitMatch = text.match(/#\d{2}-\d{3}/);
  let unitNumber = unitMatch ? unitMatch[0] : '';

  // Singapore phone number: 65 XXXX XXXX, with optional '+' and optional spaces
  const phoneMatch = text.match(/\+?65\s?\d{4}\s?\d{4}/);
  let phone = phoneMatch ? phoneMatch[0] : '';
  if (phone) {
    phone = phone.replace(/\s+/g, ' '); // normalise spacing
  }

  // Website: detect domain like example.com (with or without protocol)
  const websiteMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  let website = websiteMatch ? websiteMatch[0].replace(/^[^A-Za-z]+/, '') : '';

  // Opening hours: XX:XX - XX:XX (24-hour) with optional spaces
  const openingHoursMatch = text.match(/(?:[01]?\d|2[0-3]):[0-5]\d\s*[-–]\s*(?:[01]?\d|2[0-3]):[0-5]\d/);
  let openingHours = openingHoursMatch ? openingHoursMatch[0].replace(/\s+/g, ' ') : '';

  // Guess business category based on keywords using the official categories
  const categories = {
    // Food and Beverage
    'restaurant|cafe|café|bakery|food|dining|kitchen|bistro|eatery|bar|pub|fast food|takeaway|delivery': 'Food and Beverage',
    
    // Beauty Services
    'salon|spa|hair|beauty|nail|barber|massage|facial|cosmetic|makeup': 'Beauty Services',
    
    // Healthcare
    'clinic|medical|dental|pharmacy|hospital|doctor|dentist|physiotherapy|optometry': 'Healthcare',
    
    // General Merchandise / Retail
    'shop|store|retail|mart|supermarket|grocery|convenience|book|stationery|gift|toy|clothing|fashion': 'General Merchandise',
    
    // Sports and Fitness
    'gym|fitness|yoga|sport|exercise|training|martial arts|pilates|swimming': 'Sports and Fitness',
    
    // Auto
    'car|auto|mechanic|garage|petrol|gas|workshop|tire|automotive|vehicle': 'Auto',
    
    // Financial
    'bank|atm|insurance|finance|loan|money|exchange|investment|accounting': 'Financial',
    
    // Education
    'school|education|tuition|learning|academy|institute|college|university|kindergarten': 'Education',
    
    // Hotel
    'hotel|motel|inn|lodge|accommodation|hostel|resort|guesthouse': 'Hotel',
    
    // Professional Services
    'law|lawyer|legal|consultant|office|service|agency|firm|real estate': 'Professional Services',
    
    // Home Services
    'plumber|electrician|cleaning|repair|maintenance|contractor|handyman|renovation': 'Home Services',
    
    // Local Services
    'laundry|dry clean|tailor|key|locksmith|photo|printing|courier|postal': 'Local Services',
    
    // Art
    'art|gallery|studio|craft|design|creative|painting|sculpture|exhibition': 'Art',
    
    // Attractions
    'museum|zoo|park|attraction|tourist|sightseeing|entertainment|cinema|theater': 'Attractions',
    
    // Essentials
    'pharmacy|convenience|grocery|supermarket|essential|daily|necessities': 'Essentials',
    
    // Government Building
    'government|municipal|council|office|public|administration|ministry|department': 'Government Building',
    
    // Mass Media
    'media|newspaper|radio|tv|broadcasting|news|publication|printing press': 'Mass Media',
    
    // Nightlife
    'club|nightclub|lounge|disco|karaoke|ktv|night|entertainment|party': 'Nightlife',
    
    // Religious Organization
    'church|temple|mosque|synagogue|religious|worship|prayer|spiritual': 'Religious Organization',
    
    // Travel
    'travel|tour|airline|booking|ticket|vacation|holiday|cruise|flight': 'Travel',
    
    // Commercial Building
    'office|building|commercial|business|corporate|headquarters|plaza|center': 'Commercial Building',
    
    // Industrial
    'factory|warehouse|industrial|manufacturing|production|plant|facility': 'Industrial',
    
    // Residential
    'apartment|condo|residential|housing|home|villa|townhouse|flat': 'Residential'
  };

  let category = 'Unknown';
  for (const pattern in categories) {
    if (new RegExp(pattern, 'i').test(text)) {
      category = categories[pattern];
      break;
    }
  }

  // Use "Not Found" when a field could not be extracted to match strict rules
  if (!storeName) storeName = 'Not Found';
  if (!unitNumber) unitNumber = 'Not Found';
  if (!openingHours) openingHours = 'Not Found'; // kept for future reference
  if (!phone) phone = 'Not Found';              // kept for future reference
  if (!website) website = 'Not Found';          // kept for future reference

  // Placeholder – address extraction will be implemented later or via geocoding
  let address = '';

  if (!address) address = 'Not Found';

  return {
    storeName,
    unitNumber,
    address,
    category,
    rawText: text
  };
}

// --- Company category mapping ---
let companyCategories = [];

async function loadCompanyCategories() {
  if (companyCategories.length) return companyCategories;
  try {
    // First try pre-generated JSON (faster)
    const jsonRes = await fetch('categories.json');
    if (jsonRes.ok) {
      companyCategories = (await jsonRes.json()).map(cat => ({
        key: cat.key,
        name: (cat.name || '').toLowerCase(),
        last: (cat.key.split('::').filter(Boolean).pop() || '').toLowerCase()
      }));
      console.log(`Loaded ${companyCategories.length} categories from JSON`);
      return companyCategories;
    }
  } catch (_) {
    /* fallthrough to CSV */
  }

  try {
    // Fallback to CSV shipped alongside the app if JSON unavailable
    const csvPath = encodeURI('Geo Places - Final POI Category Tree - Q2 2024 - 2. Category Tree.csv');
    const res = await fetch(csvPath);
    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/);
    lines.shift(); // drop header
    const splitter = /,(?=(?:[^"]*\"[^"]*\")*[^\"]*$)/;
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split(splitter);
      const name = (cols[3] || '').replace(/^"|"$/g, '').trim();
      const keyRaw = (cols[5] || '').replace(/^"|"$/g, '').trim();
      if (!keyRaw) continue;
      const key = keyRaw.replace(/:+$/, '');
      const lastSegment = key.split('::').filter(Boolean).pop() || '';
      companyCategories.push({ key, name: name.toLowerCase(), last: lastSegment.toLowerCase() });
    }
    console.log(`Parsed ${companyCategories.length} categories from CSV`);
  } catch (err) {
    console.warn('Failed to load categories from CSV', err);
  }
  return companyCategories;
}

async function mapToCompanyCategory(inputCategory = '') {
  if (!inputCategory || inputCategory === 'Unknown' || inputCategory === 'Not Found') {
    return inputCategory;
  }

  // Define the official business categories
  const officialCategories = [
    'Art', 'Attractions', 'Auto', 'Beauty Services', 'Commercial Building',
    'Education', 'Essentials', 'Financial', 'Food and Beverage', 'General Merchandise',
    'Government Building', 'Healthcare', 'Home Services', 'Hotel', 'Industrial',
    'Local Services', 'Mass Media', 'Nightlife', 'Physical Feature',
    'Professional Services', 'Religious Organization', 'Residential',
    'Sports and Fitness', 'Travel'
  ];

  const query = inputCategory.toLowerCase().trim();
  
  // Direct match first (case-insensitive)
  let directMatch = officialCategories.find(cat => cat.toLowerCase() === query);
  if (directMatch) {
    console.log(`Direct match: ${inputCategory} → ${directMatch}`);
    return directMatch;
  }

  // Mapping for common variations and synonyms
  const categoryMappings = {
    // Food and Beverage variations
    'f&b': 'Food and Beverage',
    'food': 'Food and Beverage',
    'restaurant': 'Food and Beverage',
    'dining': 'Food and Beverage',
    'cafe': 'Food and Beverage',
    'bakery': 'Food and Beverage',
    'eatery': 'Food and Beverage',
    
    // Beauty variations
    'beauty': 'Beauty Services',
    'salon': 'Beauty Services',
    'spa': 'Beauty Services',
    'barber': 'Beauty Services',
    
    // Retail variations
    'retail': 'General Merchandise',
    'shop': 'General Merchandise',
    'store': 'General Merchandise',
    'merchandise': 'General Merchandise',
    'mart': 'General Merchandise',
    
    // Fitness variations
    'fitness': 'Sports and Fitness',
    'gym': 'Sports and Fitness',
    'sport': 'Sports and Fitness',
    'exercise': 'Sports and Fitness',
    
    // Medical variations
    'medical': 'Healthcare',
    'clinic': 'Healthcare',
    'hospital': 'Healthcare',
    'pharmacy': 'Healthcare',
    
    // Other common variations
    'automotive': 'Auto',
    'car': 'Auto',
    'vehicle': 'Auto',
    'finance': 'Financial',
    'bank': 'Financial',
    'school': 'Education',
    'learning': 'Education',
    'accommodation': 'Hotel',
    'lodging': 'Hotel',
    'office': 'Commercial Building',
    'building': 'Commercial Building'
  };

  // Check for mapping variations
  let mappedCategory = categoryMappings[query];
  if (mappedCategory) {
    console.log(`Mapped variation: ${inputCategory} → ${mappedCategory}`);
    return mappedCategory;
  }

  // Partial matching - if input contains any official category name
  for (const category of officialCategories) {
    if (query.includes(category.toLowerCase()) || category.toLowerCase().includes(query)) {
      console.log(`Partial match: ${inputCategory} → ${category}`);
      return category;
    }
  }

  console.log(`No match found for: ${inputCategory}, keeping original`);
  return inputCategory;
}

// ===== MAP FUNCTIONALITY =====
let miniMap = null;
let fullMap = null;
let userLocationMarker = null;
let userAccuracyCircle = null;
let routePoints = [];
let routeLine = null;
let teamMarkers = [];
let followUserLocation = true;
let lastUserLocation = null;

// Initialize maps with fallback tile sources
function initializeMaps() {
  console.log('Initializing maps...');
  
  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded');
    setTimeout(initializeMaps, 2000); // Retry after 2 seconds
    return;
  }
  
  // Check if map containers exist
  const miniMapContainer = document.getElementById('miniMap');
  const fullMapContainer = document.getElementById('fullMap');
  
  if (!miniMapContainer) {
    console.error('Mini map container not found');
    return;
  }
  
  if (!fullMapContainer) {
    console.error('Full map container not found');
    return;
  }
  
  console.log('Map containers found, Leaflet loaded');
  
  // Initialize mini map
  if (!miniMap) {
    try {
      miniMap = L.map('miniMap', {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false
      }).setView([1.3521, 103.8198], 12); // Singapore center

      // Add tile layers with fallback
      addTileLayersToMap(miniMap);
      console.log('Mini map initialized successfully');
      
    } catch (error) {
      console.error('Error initializing mini map:', error);
      // Show error in UI
      const mapStatus = document.getElementById('mapStatus');
      if (mapStatus) mapStatus.textContent = '🗺️ Map loading error';
    }
  }

  // Initialize full map
  if (!fullMap) {
    try {
      fullMap = L.map('fullMap', {
        zoomControl: true,
        attributionControl: true
      }).setView([1.3521, 103.8198], 12);

      // Add tile layers with fallback
      addTileLayersToMap(fullMap);
      console.log('Full map initialized successfully');

      // Add click handler for route planning
      fullMap.on('click', function(e) {
        addRoutePoint(e.latlng);
      });
      
    } catch (error) {
      console.error('Error initializing full map:', error);
    }
  }
  
  // Add interaction handlers after both maps are initialized
  setTimeout(() => {
    addMapInteractionHandlers();
  }, 500);
}

// Add tile layers with multiple fallback sources
function addTileLayersToMap(map) {
  // Primary: OneMap Singapore (most accurate for Singapore)
  const oneMapLayer = L.tileLayer('https://maps-{s}.onemap.sg/v3/Default/{z}/{x}/{y}.png', {
    subdomains: ['a', 'b', 'c', 'd'],
    attribution: '&copy; <a href="https://www.onemap.sg/">OneMap</a>',
    maxZoom: 18,
    errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  });

  // Fallback 1: OpenStreetMap (reliable worldwide)
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  });

  // Fallback 2: CartoDB (clean, reliable)
  const cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19
  });

  // Try OneMap first, fallback to OSM if it fails
  let currentLayer = oneMapLayer;
  currentLayer.addTo(map);

  // Mark map as loaded when tiles load successfully
  currentLayer.on('load', function() {
    console.log('Map tiles loaded successfully');
    const mapContainer = map.getContainer();
    if (mapContainer) {
      mapContainer.classList.add('loaded');
    }
  });

  // Handle tile load errors
  currentLayer.on('tileerror', function(error) {
    console.log('OneMap tiles failed, switching to OpenStreetMap');
    map.removeLayer(currentLayer);
    currentLayer = osmLayer;
    currentLayer.addTo(map);
    
    // Mark as loaded when fallback works
    currentLayer.on('load', function() {
      console.log('OpenStreetMap tiles loaded successfully');
      const mapContainer = map.getContainer();
      if (mapContainer) {
        mapContainer.classList.add('loaded');
      }
    });
    
    // If OSM also fails, try CartoDB
    currentLayer.on('tileerror', function(error) {
      console.log('OpenStreetMap tiles failed, switching to CartoDB');
      map.removeLayer(currentLayer);
      currentLayer = cartoLayer;
      currentLayer.addTo(map);
      
      // Mark as loaded when final fallback works
      currentLayer.on('load', function() {
        console.log('CartoDB tiles loaded successfully');
        const mapContainer = map.getContainer();
        if (mapContainer) {
          mapContainer.classList.add('loaded');
        }
      });
    });
  });

  // Force map to refresh and invalidate size multiple times
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
  
  setTimeout(() => {
    map.invalidateSize();
  }, 500);
  
  setTimeout(() => {
    map.invalidateSize();
  }, 1000);
}

// Update user location on both maps with smooth tracking
function updateUserLocation(lat, lng, heading = null, accuracy = null) {
  const location = [lat, lng];
  const isFirstLocation = !lastUserLocation;
  lastUserLocation = { lat, lng };

  // Create Google Maps style blue dot with accuracy circle
  if (userLocationMarker) {
    // Smooth animation to new position
    userLocationMarker.setLatLng(location);
    
    // Update heading if available
    if (heading !== null) {
      const markerElement = userLocationMarker.getElement();
      if (markerElement) {
        const dot = markerElement.querySelector('.user-dot');
        if (dot) {
          dot.style.transform = `rotate(${heading}deg)`;
        }
      }
    }
  } else {
    // Create blue location dot similar to Google Maps
    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div class="user-location-container">
          <div class="user-dot-pulse"></div>
          <div class="user-dot" style="transform: rotate(${heading || 0}deg);">
            <div class="user-dot-inner"></div>
            <div class="user-dot-direction"></div>
          </div>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    userLocationMarker = L.marker(location, { icon: userIcon });
    
    // Add to mini map
    if (miniMap) {
      userLocationMarker.addTo(miniMap);
    }
    
    // Add to full map only if it exists and is currently visible
    if (fullMap) {
      userLocationMarker.addTo(fullMap);
    }
  }

  // Update accuracy circle
  if (accuracy && accuracy < 100) { // Only show if accuracy is reasonable
    if (userAccuracyCircle) {
      userAccuracyCircle.setLatLng(location);
      userAccuracyCircle.setRadius(accuracy);
    } else {
      userAccuracyCircle = L.circle(location, {
        radius: accuracy,
        color: '#4285f4',
        fillColor: '#4285f4',
        fillOpacity: 0.1,
        weight: 1,
        opacity: 0.3
      });
      
      // Add to mini map
      if (miniMap) {
        userAccuracyCircle.addTo(miniMap);
      }
      
      // Add to full map if it exists
      if (fullMap) {
        userAccuracyCircle.addTo(fullMap);
      }
    }
  }

  // Follow user location (like Google Maps)
  if (followUserLocation) {
    const zoomLevel = isFirstLocation ? 16 : null; // Zoom in on first location, maintain zoom after
    
    // Smooth pan to user location on mini map
    if (miniMap) {
      if (zoomLevel) {
        miniMap.setView(location, zoomLevel, { animate: true, duration: 1.0 });
      } else {
        miniMap.panTo(location, { animate: true, duration: 0.5 });
      }
    }
    
    // Also update full map if it's open
    if (fullMap && !document.getElementById('fullMapOverlay').classList.contains('hidden')) {
      if (zoomLevel) {
        fullMap.setView(location, zoomLevel, { animate: true, duration: 1.0 });
      } else {
        fullMap.panTo(location, { animate: true, duration: 0.5 });
      }
    }
  }

  // Update status
  const mapStatus = document.getElementById('mapStatus');
  if (mapStatus) {
    const accuracyText = accuracy ? ` (±${Math.round(accuracy)}m)` : '';
    mapStatus.textContent = `📍 Location tracking${accuracyText}`;
  }
}

// Add route point for planning
function addRoutePoint(latlng) {
  const point = {
    lat: latlng.lat,
    lng: latlng.lng,
    id: Date.now(),
    marker: null
  };

  // Create marker
  const marker = L.marker([point.lat, point.lng], {
    draggable: true
  }).addTo(fullMap);

  marker.bindPopup(`Point ${routePoints.length + 1}<br><button onclick="removeRoutePoint(${point.id})">Remove</button>`);
  
  // Update marker position when dragged
  marker.on('dragend', function() {
    const pos = marker.getLatLng();
    point.lat = pos.lat;
    point.lng = pos.lng;
    updateRouteDisplay();
  });

  point.marker = marker;
  routePoints.push(point);
  
  updateRouteDisplay();
}

// Remove route point
function removeRoutePoint(pointId) {
  const index = routePoints.findIndex(p => p.id === pointId);
  if (index !== -1) {
    const point = routePoints[index];
    if (point.marker) {
      fullMap.removeLayer(point.marker);
    }
    routePoints.splice(index, 1);
    updateRouteDisplay();
  }
}

// Update route line and stats
function updateRouteDisplay() {
  // Remove existing route line
  if (routeLine) {
    fullMap.removeLayer(routeLine);
    routeLine = null;
  }

  if (routePoints.length > 1) {
    // Create route line
    const latlngs = routePoints.map(p => [p.lat, p.lng]);
    routeLine = L.polyline(latlngs, {
      color: '#00b14f',
      weight: 4,
      opacity: 0.7
    }).addTo(fullMap);

    // Calculate route statistics
    let totalDistance = 0;
    for (let i = 0; i < routePoints.length - 1; i++) {
      const p1 = routePoints[i];
      const p2 = routePoints[i + 1];
      totalDistance += getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    }

    // Update UI
    const routeDistance = document.getElementById('routeDistance');
    const routeTime = document.getElementById('routeTime');
    const routePointsEl = document.getElementById('routePoints');

    if (routeDistance) routeDistance.textContent = `Distance: ${totalDistance.toFixed(1)} km`;
    if (routeTime) routeTime.textContent = `Time: ${Math.ceil(totalDistance * 12)} min`; // 5 km/h walking speed
    if (routePointsEl) routePointsEl.textContent = `Points: ${routePoints.length}`;

    // Update route progress
    const routeProgress = document.getElementById('routeProgress');
    if (routeProgress) {
      routeProgress.textContent = `${routePoints.length} stops planned`;
    }
  } else {
    // Clear stats
    const routeDistance = document.getElementById('routeDistance');
    const routeTime = document.getElementById('routeTime');
    const routePointsEl = document.getElementById('routePoints');
    const routeProgress = document.getElementById('routeProgress');

    if (routeDistance) routeDistance.textContent = 'Distance: 0 km';
    if (routeTime) routeTime.textContent = 'Time: 0 min';
    if (routePointsEl) routePointsEl.textContent = 'Points: 0';
    if (routeProgress) routeProgress.textContent = '';
  }
}

// Optimize route using nearest neighbor algorithm
function optimizeRoute() {
  if (routePoints.length < 3) return;

  // Get user location as starting point
  let currentLat = currentLocation.lat;
  let currentLng = currentLocation.lng;

  if (!currentLat || !currentLng) {
    alert('Current location not available for optimization');
    return;
  }

  const optimized = [];
  const remaining = [...routePoints];

  // Start from current location
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    // Find nearest unvisited point
    for (let i = 0; i < remaining.length; i++) {
      const distance = getDistance(currentLat, currentLng, remaining[i].lat, remaining[i].lng);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    // Move to optimized array
    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    currentLat = nearest.lat;
    currentLng = nearest.lng;
  }

  // Update route points array
  routePoints = optimized;
  
  // Update markers popup text
  routePoints.forEach((point, index) => {
    if (point.marker) {
      point.marker.bindPopup(`Point ${index + 1}<br><button onclick="removeRoutePoint(${point.id})">Remove</button>`);
    }
  });

  updateRouteDisplay();
  
  alert(`Route optimized! Total distance: ${document.getElementById('routeDistance').textContent.split(': ')[1]}`);
}

// Clear all route points
function clearRoute() {
  routePoints.forEach(point => {
    if (point.marker) {
      fullMap.removeLayer(point.marker);
    }
  });
  routePoints = [];
  updateRouteDisplay();
}

// Map UI event handlers
document.addEventListener('DOMContentLoaded', function() {
  // Show loading indicator
  const mapStatus = document.getElementById('mapStatus');
  if (mapStatus) mapStatus.textContent = '🗺️ Loading maps...';
  
  // Initialize maps when page loads with longer delay for mobile
  setTimeout(initializeMaps, 1000);
  
  // Also try to initialize after Leaflet is fully loaded
  if (typeof L !== 'undefined') {
    setTimeout(initializeMaps, 1500);
  }

  // Map expand button
  const mapExpandBtn = document.getElementById('mapExpandBtn');
  const fullMapOverlay = document.getElementById('fullMapOverlay');
  const mapCloseBtn = document.getElementById('mapCloseBtn');
  const requestLocationBtn = document.getElementById('requestLocationBtn');
  const followLocationBtn = document.getElementById('followLocationBtn');

  if (mapExpandBtn && fullMapOverlay) {
    mapExpandBtn.addEventListener('click', function() {
      console.log('Opening full map overlay');
      fullMapOverlay.classList.remove('hidden');
      
      // Force scroll to top and lock body scrolling
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Invalidate size after animation
      setTimeout(() => {
        if (fullMap) {
          fullMap.invalidateSize();
          // Ensure user location is visible on full map
          syncUserLocationToFullMap();
        }
        
        // Debug: Check if close button is visible
        const closeBtn = document.getElementById('mapCloseBtn');
        if (closeBtn) {
          const rect = closeBtn.getBoundingClientRect();
          console.log('Close button position:', {
            top: rect.top,
            right: rect.right,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0
          });
        }
      }, 300);
    });
  }

  if (mapCloseBtn && fullMapOverlay) {
    mapCloseBtn.addEventListener('click', function(e) {
      console.log('Close button clicked');
      e.preventDefault();
      e.stopPropagation();
      fullMapOverlay.classList.add('hidden');
      
      // Restore body scrolling
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    });
    
    // Also add touch event for mobile
    mapCloseBtn.addEventListener('touchend', function(e) {
      console.log('Close button touched');
      e.preventDefault();
      e.stopPropagation();
      fullMapOverlay.classList.add('hidden');
      
      // Restore body scrolling
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    });
    
    console.log('Map close button event listeners added');
  } else {
    console.error('Map close button or overlay not found:', { mapCloseBtn, fullMapOverlay });
  }

  // Add backup close methods
  if (fullMapOverlay) {
    // Close on overlay background click
    fullMapOverlay.addEventListener('click', function(e) {
      if (e.target === fullMapOverlay) {
        console.log('Overlay background clicked');
        fullMapOverlay.classList.add('hidden');
      }
    });
    
    // Close on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !fullMapOverlay.classList.contains('hidden')) {
        console.log('Escape key pressed');
        fullMapOverlay.classList.add('hidden');
      }
    });
  }

  // Route control buttons
  const clearRouteBtn = document.getElementById('clearRouteBtn');
  const optimizeRouteBtn = document.getElementById('optimizeRouteBtn');
  const centerOnUserBtn = document.getElementById('centerOnUserBtn');

  if (clearRouteBtn) {
    clearRouteBtn.addEventListener('click', clearRoute);
  }

  if (optimizeRouteBtn) {
    optimizeRouteBtn.addEventListener('click', optimizeRoute);
  }

  if (centerOnUserBtn) {
    centerOnUserBtn.addEventListener('click', function() {
      if (lastUserLocation && fullMap) {
        // Ensure user location markers are on the full map
        syncUserLocationToFullMap();
        
        // Center on user location with appropriate zoom
        const currentZoom = fullMap.getZoom();
        const targetZoom = currentZoom < 16 ? 16 : currentZoom;
        fullMap.setView([lastUserLocation.lat, lastUserLocation.lng], targetZoom, { animate: true });
        
        // Enable follow mode
        followUserLocation = true;
        updateFollowButtonState();
        
        console.log('Centered full map on user location');
      } else {
        alert('User location not available. Please ensure location services are enabled.');
      }
    });
  }

  // Manual location request button
  if (requestLocationBtn) {
    requestLocationBtn.addEventListener('click', function() {
      requestLocationPermission();
    });
  }

  // Follow location toggle button
  if (followLocationBtn) {
    // Set initial state
    updateFollowButtonState();
    
    followLocationBtn.addEventListener('click', function() {
      followUserLocation = !followUserLocation;
      updateFollowButtonState();
      
      // If enabling follow mode and we have a location, center on it
      if (followUserLocation && lastUserLocation) {
        if (miniMap) {
          miniMap.setView([lastUserLocation.lat, lastUserLocation.lng], miniMap.getZoom(), { animate: true });
        }
        if (fullMap && !fullMapOverlay.classList.contains('hidden')) {
          fullMap.setView([lastUserLocation.lat, lastUserLocation.lng], fullMap.getZoom(), { animate: true });
        }
      }
    });
  }

  // iOS Safari location fix - request permission first
  requestLocationPermission();
});

// Request location permission and handle iOS Safari issues
async function requestLocationPermission() {
  const mapStatus = document.getElementById('mapStatus');
  
  if (!navigator.geolocation) {
    if (mapStatus) mapStatus.textContent = '📍 Geolocation not supported';
    console.log('Geolocation not supported');
    return;
  }

  // Update status to show we're requesting location
  if (mapStatus) mapStatus.textContent = '📍 Requesting location...';

  // iOS Safari requires HTTPS and user interaction for location
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
  
  if (isIOS && !isSecure) {
    if (mapStatus) mapStatus.textContent = '📍 HTTPS required for location on iOS';
    console.log('iOS requires HTTPS for geolocation');
    return;
  }

  // First try to get current position once to test permissions
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: false, // Start with less accurate for faster response
          maximumAge: 60000, // Accept cached position up to 1 minute
          timeout: 15000 // Longer timeout for iOS
        }
      );
    });

    // Success! Update location immediately
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const heading = position.coords.heading;
    const accuracy = position.coords.accuracy;
    
    updateUserLocation(lat, lng, heading, accuracy);
    currentLocation.lat = lat;
    currentLocation.lng = lng;

    if (mapStatus) mapStatus.textContent = '📍 Location found';
    console.log('Initial location obtained:', lat, lng);

    // Now start watching position with better accuracy
    startLocationWatching();

  } catch (error) {
    console.log('Geolocation error:', error);
    handleLocationError(error);
  }
}

// Start continuous location watching after initial success
function startLocationWatching() {
  const watchId = navigator.geolocation.watchPosition(
    function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const heading = position.coords.heading;
      const accuracy = position.coords.accuracy;
      
      updateUserLocation(lat, lng, heading, accuracy);
      currentLocation.lat = lat;
      currentLocation.lng = lng;
    },
    function(error) {
      console.log('Watch position error:', error);
      handleLocationError(error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 20000 // Longer timeout for iOS
    }
  );

  // Store watch ID for potential cleanup
  window.locationWatchId = watchId;
}

// Handle different types of location errors
function handleLocationError(error) {
  const mapStatus = document.getElementById('mapStatus');
  const requestLocationBtn = document.getElementById('requestLocationBtn');
  let message = '📍 Location unavailable';

  switch(error.code) {
    case error.PERMISSION_DENIED:
      message = '📍 Tap 📍 to enable location';
      console.log('Location permission denied');
      // Show manual request button
      if (requestLocationBtn) requestLocationBtn.style.display = 'flex';
      // Show instructions for enabling location
      showLocationInstructions();
      break;
    case error.POSITION_UNAVAILABLE:
      message = '📍 Location unavailable';
      console.log('Location information unavailable');
      if (requestLocationBtn) requestLocationBtn.style.display = 'flex';
      break;
    case error.TIMEOUT:
      message = '📍 Location timeout - tap 📍 to retry';
      console.log('Location request timed out');
      if (requestLocationBtn) requestLocationBtn.style.display = 'flex';
      // Retry with less accuracy
      retryLocationWithLowerAccuracy();
      break;
    default:
      message = '📍 Location error - tap 📍 to retry';
      console.log('Unknown location error:', error);
      if (requestLocationBtn) requestLocationBtn.style.display = 'flex';
      break;
  }

  if (mapStatus) mapStatus.textContent = message;
}

// Retry location with lower accuracy settings
function retryLocationWithLowerAccuracy() {
  console.log('Retrying location with lower accuracy...');
  
  navigator.geolocation.getCurrentPosition(
    function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const heading = position.coords.heading;
      const accuracy = position.coords.accuracy;
      
      updateUserLocation(lat, lng, heading, accuracy);
      currentLocation.lat = lat;
      currentLocation.lng = lng;
      
      const mapStatus = document.getElementById('mapStatus');
      if (mapStatus) mapStatus.textContent = '📍 Location found (low accuracy)';
      
      // Start watching with lower accuracy
      startLocationWatching();
    },
    function(error) {
      console.log('Retry also failed:', error);
      const mapStatus = document.getElementById('mapStatus');
      if (mapStatus) mapStatus.textContent = '📍 Unable to get location';
    },
    {
      enableHighAccuracy: false,
      maximumAge: 300000, // 5 minutes
      timeout: 30000
    }
  );
}

// Show instructions for enabling location on iOS
function showLocationInstructions() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    // Create a temporary alert for iOS users
    setTimeout(() => {
      alert('To enable location:\n\n1. Go to Settings > Privacy & Security > Location Services\n2. Turn on Location Services\n3. Find Safari in the list\n4. Select "While Using App"\n5. Refresh this page');
    }, 1000);
  }
}

// Update follow button visual state
function updateFollowButtonState() {
  const followLocationBtn = document.getElementById('followLocationBtn');
  if (followLocationBtn) {
    if (followUserLocation) {
      followLocationBtn.classList.add('active');
      followLocationBtn.title = 'Following Location (Click to disable)';
    } else {
      followLocationBtn.classList.remove('active');
      followLocationBtn.title = 'Follow Location (Click to enable)';
    }
  }
}

// Sync user location to full map when it's opened
function syncUserLocationToFullMap() {
  console.log('syncUserLocationToFullMap called', { 
    fullMap: !!fullMap, 
    lastUserLocation: !!lastUserLocation,
    userLocationMarker: !!userLocationMarker 
  });
  
  if (!fullMap) {
    console.error('Full map not available');
    return;
  }
  
  if (!lastUserLocation) {
    console.warn('No user location available to sync');
    return;
  }
  
  try {
    // Force recreate user location marker for full map if needed
    if (lastUserLocation) {
      const location = [lastUserLocation.lat, lastUserLocation.lng];
      
      // Create a new marker specifically for full map to avoid conflicts
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
          <div class="user-location-container">
            <div class="user-dot-pulse"></div>
            <div class="user-dot">
              <div class="user-dot-inner"></div>
              <div class="user-dot-direction"></div>
            </div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      
      // Remove existing marker if it exists
      fullMap.eachLayer(function(layer) {
        if (layer.options && layer.options.className === 'user-location-marker') {
          fullMap.removeLayer(layer);
        }
      });
      
      // Add new marker
      const fullMapUserMarker = L.marker(location, { icon: userIcon });
      fullMapUserMarker.addTo(fullMap);
      console.log('Added user location marker to full map at:', location);
      
      // Center the full map on user location
      const currentZoom = fullMap.getZoom();
      const targetZoom = currentZoom < 14 ? 16 : currentZoom;
      fullMap.setView(location, targetZoom, { animate: true });
      console.log('Centered full map on user location');
      
      // Enable follow mode
      followUserLocation = true;
      updateFollowButtonState();
    }
    
  } catch (error) {
    console.error('Error syncing user location to full map:', error);
  }
}

// Add map interaction handlers to disable following when user manually moves map
function addMapInteractionHandlers() {
  if (miniMap) {
    miniMap.on('dragstart', function() {
      // User is manually panning, disable follow mode
      if (followUserLocation) {
        followUserLocation = false;
        updateFollowButtonState();
      }
    });
  }
  
  if (fullMap) {
    fullMap.on('dragstart', function() {
      // User is manually panning, disable follow mode
      if (followUserLocation) {
        followUserLocation = false;
        updateFollowButtonState();
      }
    });
  }
}

// Make functions globally available
window.removeRoutePoint = removeRoutePoint; 

const players = [
  { name: 'A', rating: 1000 },
  { name: 'B', rating: 1000 },
  { name: 'C', rating: 1000 },
  { name: 'D', rating: 1000 }
];

const K = 32;

function updateRankings(winningTeam, losingTeam) {
  const winningAvg = (players[winningTeam[0]].rating + players[winningTeam[1]].rating) / 2;
  const losingAvg = (players[losingTeam[0]].rating + players[losingTeam[1]].rating) / 2;

  const expectedWin = 1 / (1 + Math.pow(10, (losingAvg - winningAvg) / 400));
  const expectedLose = 1 - expectedWin;

  players[winningTeam[0]].rating += K * (1 - expectedWin);
  players[winningTeam[1]].rating += K * (1 - expectedWin);
  players[losingTeam[0]].rating -= K * expectedLose;
  players[losingTeam[1]].rating -= K * expectedLose;

  logGame(winningTeam, losingTeam);
  renderRankings();
}

function logGame(winningTeam, losingTeam) {
  const logList = document.getElementById('logList');
  const logEntry = document.createElement('li');
  logEntry.textContent = `Game: ${players[winningTeam[0]].name} & ${players[winningTeam[1]].name} defeated ${players[losingTeam[0]].name} & ${players[losingTeam[1]].name}`;
  logList.appendChild(logEntry);
}

function renderRankings() {
  const rankingTable = document.getElementById('rankingTable').getElementsByTagName('tbody')[0];
  rankingTable.innerHTML = '';
  players.sort((a, b) => b.rating - a.rating);
  players.forEach(player => {
    const row = rankingTable.insertRow();
    const nameCell = row.insertCell(0);
    const ratingCell = row.insertCell(1);
    nameCell.textContent = player.name;
    ratingCell.textContent = player.rating.toFixed(0);
  });
}

// Example game updates
updateRankings([0, 1], [2, 3]); // A & B win against C & D
updateRankings([2, 3], [0, 1]); // C & D win against A & B
