// Initialize map centered on Oshawa
const map = L.map('map').setView([43.9, -78.86], 12);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Claim type colors
const typeColors = {
  'pothole': 'red',
  'property damage': 'orange',
  'slip and fall': 'blue',
  'trip and fall': 'green',
  'other': 'gray'
};

// Marker cluster group for clustering markers
const markerClusterGroup = L.markerClusterGroup({
  maxClusterRadius: 1,  // cluster only markers almost exactly overlapping on screen
  spiderfyDistanceMultiplier: 1
});
map.addLayer(markerClusterGroup);

let allData = [];
let currentYear = '2026'; // NEW: track current year

// Load Oshawa boundary GeoJSON and add to map
fetch('oshawa_boundary.geojson')
  .then(res => res.json())
  .then(data => {
    const oshawaOnly = {
      type: "FeatureCollection",
      features: data.features.filter(f => f.properties.NAME === "Oshawa")
    };

    L.geoJSON(oshawaOnly, {
      style: {
        color: "#0000ff",
        weight: 2,
        fillColor: "#0000ff",
        fillOpacity: 0.1
      }
    }).addTo(map);
  });

/* ===========================
   NEW: Load data by year
   =========================== */
function loadYearData(year) {
  currentYear = year;

  const csvPath = `claims_${year}.csv`; // <-- if stored in /data/, use: `data/claims_${year}.csv`

  // Optional: clear old markers + count immediately so user sees it changed
  markerClusterGroup.clearLayers();
  updateClaimCount(0);

  Papa.parse(csvPath, {
    header: true,
    download: true,
    skipEmptyLines: true,
    complete: (results) => {
      allData = results.data.filter(row => row.latitude && row.longitude);
      applyFilters(); // IMPORTANT: reuse your existing filter logic
    },
    error: (err) => {
      console.error(`Failed to load ${csvPath}`, err);
      alert(`Could not load ${csvPath}. Check the file path/name in the repo.`);
    }
  });
}

/* ===========================
   Update map markers based on filtered data
   =========================== */
function updateMap(data) {
  markerClusterGroup.clearLayers();

  data.forEach(row => {
    const lat = parseFloat(row.latitude);
    const lon = parseFloat(row.longitude);
    if (isNaN(lat) || isNaN(lon)) return;

    const typeKey = (row.type || '').trim().toLowerCase();
    const color = typeColors[typeKey] || typeColors.other;

    const marker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: 'custom-icon',
        html: `<div style="
          background:${color};
          border:1px solid black;
          border-radius:50%;
          width:16px;
          height:16px;
          opacity: 0.85;
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).bindPopup(`
      <div style="font-size: 13px; font-family: sans-serif;">
        <div style="background: #eee; padding: 6px; font-weight: bold; border-bottom: 1px solid #ccc;">
          Claim Details
        </div>
        <div style="padding: 6px;">
          <strong>Type:</strong> ${row.type || 'N/A'}<br>
          <strong>Date:</strong> ${row.date || 'N/A'}<br>
          <strong>Location:</strong><br>
          ${(row.location_desc || 'N/A')}
        </div>
      </div>
    `);

    markerClusterGroup.addLayer(marker);
  });

  updateClaimCount(data.length);
}

/* ===========================
   Apply filters from inputs and update map
   =========================== */
function applyFilters() {
  const startDateVal = document.getElementById('start-date').value;
  const endDateVal = document.getElementById('end-date').value;
  const selectedType = document.getElementById('type-select').value.trim().toLowerCase();

  const startDate = startDateVal ? new Date(startDateVal) : null;
  const endDate = endDateVal ? new Date(endDateVal) : null;

  const standardTypes = ['pothole', 'property damage', 'slip and fall', 'trip and fall'];

  const filtered = allData.filter(row => {
    const rowDate = new Date(row.date);
    const rowType = (row.type || '').trim().toLowerCase();

    const isStandardType = standardTypes.includes(rowType);
    const isOther = !isStandardType;

    const typeMatch =
      selectedType === '' ||
      (selectedType === 'other' && isOther) ||
      (selectedType === rowType);

    const startOk = !startDate || rowDate >= startDate;
    const endOk = !endDate || rowDate <= endDate;

    return typeMatch && startOk && endOk;
  });

  updateMap(filtered);
}

/* ===========================
   Events
   =========================== */

// Filter button event
document.getElementById('filter-button').addEventListener('click', applyFilters);

// NEW: year dropdown change
document.getElementById('year-select').addEventListener('change', (e) => {
  // Optional: wipe filters when switching years to avoid "empty" confusion
  document.getElementById('start-date').value = '';
  document.getElementById('end-date').value = '';
  document.getElementById('type-select').value = '';

  loadYearData(e.target.value);
});

function updateClaimCount(count) {
  const countDiv = document.getElementById('claim-count');
  countDiv.textContent = `Total Claims Shown: ${count}`;
}

// Add legend control
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'info legend');
  const types = Object.keys(typeColors);

  div.innerHTML = '<strong>Claim Types</strong><br>';
  types.forEach(type => {
    const color = typeColors[type];
    const label = type.replace(/\b\w/g, l => l.toUpperCase());
    div.innerHTML +=
      `<i style="background:${color}; width:12px; height:12px; display:inline-block; margin-right:6px; border:1px solid #000;"></i>${label}<br>`;
  });

  return div;
};

legend.addTo(map);

// NEW: initial load (default to whatever your dropdown is set to)
document.addEventListener('DOMContentLoaded', () => {
  const yearSelect = document.getElementById('year-select');
  loadYearData(yearSelect ? yearSelect.value : '2026');
});
