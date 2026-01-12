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

// Marker cluster group
const markerClusterGroup = L.markerClusterGroup({
  maxClusterRadius: 1,
  spiderfyDistanceMultiplier: 1
});
map.addLayer(markerClusterGroup);

let allData = [];
let currentYear = '2026';

// Load Oshawa boundary
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
   Data last updated text
   =========================== */
function updateDataUpdatedFromCsv(results) {
  const div = document.getElementById('data-updated');
  if (!div) return;

  // Case 1: CSV has at least one row
  if (results.data && results.data.length > 0) {
    const rawDate = results.data[0].data_updated;
    if (rawDate) {
      const parsed = new Date(rawDate);
      const formatted = parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      div.textContent = `Data last updated: ${formatted}`;
      return;
    }
  }

  // Case 2: CSV exists but has no claim rows (early 2026 case)
  // We still expect data_updated to exist in the file header
  div.textContent = 'Data last updated: (no claims yet)';
}


/* ===========================
   Load data by year
   =========================== */
function loadYearData(year) {
  currentYear = year;

  const csvPath = `claims_${year}.csv`; // change to data/claims_${year}.csv if needed

  markerClusterGroup.clearLayers();
  updateClaimCount(0);

  Papa.parse(csvPath, {
    header: true,
    download: true,
    skipEmptyLines: true,
    complete: (results) => {
      allData = results.data.filter(r => r.latitude && r.longitude);

      updateDataUpdatedFromCsv(results);   // ✅ read from CSV

      applyFilters();
    },
    error: (err) => {
      console.error('CSV failed to load:', csvPath, err);
    }
  });
}

/* ===========================
   Update map markers
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
          opacity:0.85;
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).bindPopup(`
      <div style="font-size:13px;font-family:sans-serif;">
        <div style="background:#eee;padding:6px;font-weight:bold;border-bottom:1px solid #ccc;">
          Claim Details
        </div>
        <div style="padding:6px;">
          <strong>Type:</strong> ${row.type || 'N/A'}<br>
          <strong>Date:</strong> ${row.date || 'N/A'}<br>
          <strong>Location:</strong><br>
          ${row.location_desc || 'N/A'}
        </div>
      </div>
    `);

    markerClusterGroup.addLayer(marker);
  });

  updateClaimCount(data.length);
}

/* ===========================
   Apply filters
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
      selectedType === rowType;

    const startOk = !startDate || rowDate >= startDate;
    const endOk = !endDate || rowDate <= endDate;

    return typeMatch && startOk && endOk;
  });

  updateMap(filtered);
}

/* ===========================
   Events
   =========================== */
document.getElementById('filter-button').addEventListener('click', applyFilters);

document.getElementById('year-select').addEventListener('change', (e) => {
  document.getElementById('start-date').value = '';
  document.getElementById('end-date').value = '';
  document.getElementById('type-select').value = '';
  loadYearData(e.target.value);
});

function updateClaimCount(count) {
  document.getElementById('claim-count').textContent =
    `Total Claims Shown: ${count}`;
}

/* ===========================
   Legend
   =========================== */
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'info legend');
  div.innerHTML = '<strong>Claim Types</strong><br>';

  Object.keys(typeColors).forEach(type => {
    div.innerHTML +=
      `<i style="background:${typeColors[type]};
      width:12px;height:12px;display:inline-block;
      margin-right:6px;border:1px solid #000;"></i>
      ${type.replace(/\b\w/g, l => l.toUpperCase())}<br>`;
  });

  return div;
};

legend.addTo(map);

/* ===========================
   Initial load
   =========================== */
document.addEventListener('DOMContentLoaded', () => {
  const yearSelect = document.getElementById('year-select');
  loadYearData(yearSelect ? yearSelect.value : '2026');
});
