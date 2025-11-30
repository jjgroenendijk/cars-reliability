// Data loaded from JSON files
let brandData = [];
let modelData = [];
let metadata = {};
let top10ReliableModels = [];
let top10UnreliableModels = [];
let top10ReliableBrands = [];
let top10UnreliableBrands = [];

// State
let brandSortCol = 'avg_defects_per_inspection';
let brandSortDir = 'asc';
let modelSortCol = 'avg_defects_per_inspection';
let modelSortDir = 'asc';
let brandFilter = '';
let modelFilter = '';

// Load data from JSON files
async function loadData() {
    try {
        const [brandResponse, modelResponse] = await Promise.all([
            fetch('data/brand_reliability.json'),
            fetch('data/model_reliability.json')
        ]);
        
        if (!brandResponse.ok || !modelResponse.ok) {
            throw new Error('Failed to load data files');
        }
        
        const brandJson = await brandResponse.json();
        const modelJson = await modelResponse.json();
        
        brandData = brandJson.brands || [];
        modelData = modelJson.most_reliable || [];
        top10ReliableModels = modelJson.top_10_reliable || [];
        top10UnreliableModels = modelJson.top_10_unreliable || [];
        top10ReliableBrands = brandJson.top_10_reliable || [];
        top10UnreliableBrands = brandJson.top_10_unreliable || [];
        metadata = {
            generated_at: brandJson.generated_at,
            sample_percent: brandJson.sample_percent || 100,
            total_vehicles: brandJson.total_vehicles,
            total_inspections: brandJson.total_inspections
        };
        
        // Update the generated date in the page (About section and footer)
        const dateStr = metadata.generated_at ? metadata.generated_at.substring(0, 10) : null;
        const dateEl = document.getElementById('generated-date');
        if (dateEl && dateStr) {
            dateEl.textContent = dateStr;
        }
        const footerDateEl = document.getElementById('footer-date');
        if (footerDateEl && dateStr) {
            footerDateEl.textContent = dateStr;
        }
        
        // Update summary stats if element exists
        const statsEl = document.getElementById('summary-stats');
        if (statsEl && metadata.total_vehicles) {
            let statsText = `Based on ${formatNumber(metadata.total_vehicles)} vehicles and ${formatNumber(metadata.total_inspections)} inspections from RDW Open Data`;
            if (metadata.sample_percent < 100) {
                statsText += ` (${metadata.sample_percent}% sample)`;
            }
            statsEl.textContent = statsText;
        }
        
        // Show sample warning banner if not full dataset
        if (metadata.sample_percent < 100) {
            const banner = document.getElementById('sample-banner');
            if (banner) {
                banner.style.display = 'block';
                banner.textContent = `Note: This is a ${metadata.sample_percent}% sample of the full dataset. Results may not be fully representative.`;
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error loading data:', error);
        document.body.innerHTML = '<div class="card" style="margin:50px auto;max-width:600px;text-align:center;"><h2>Error Loading Data</h2><p>Could not load reliability data. Please try refreshing the page.</p></div>';
        return false;
    }
}

// Format number with commas
function formatNumber(num) {
    return num.toLocaleString();
}

// Format value with fallback for null/undefined
function formatValue(val, decimals = 2) {
    if (val === null || val === undefined || isNaN(val)) {
        return '-';
    }
    return typeof val === 'number' ? val.toFixed(decimals) : val;
}

// Render top 10 tables
function renderTop10Tables() {
    // Top 10 Most Reliable Models
    const reliableTbody = document.getElementById('top10-reliable-tbody');
    if (reliableTbody) {
        reliableTbody.innerHTML = top10ReliableModels.map((m, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${m.merk}</td>
                <td>${m.handelsbenaming}</td>
                <td>${formatValue(m.avg_defects_per_inspection)}</td>
                <td>${formatValue(m.defects_per_year, 3)}</td>
                <td>${formatValue(m.avg_age_years, 1)}</td>
            </tr>
        `).join('');
    }
    
    // Top 10 Least Reliable Models
    const unreliableTbody = document.getElementById('top10-unreliable-tbody');
    if (unreliableTbody) {
        unreliableTbody.innerHTML = top10UnreliableModels.map((m, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${m.merk}</td>
                <td>${m.handelsbenaming}</td>
                <td>${formatValue(m.avg_defects_per_inspection)}</td>
                <td>${formatValue(m.defects_per_year, 3)}</td>
                <td>${formatValue(m.avg_age_years, 1)}</td>
            </tr>
        `).join('');
    }
    
    // Top 10 Most Reliable Brands
    const reliableBrandsTbody = document.getElementById('top10-reliable-brands-tbody');
    if (reliableBrandsTbody) {
        reliableBrandsTbody.innerHTML = top10ReliableBrands.map((b, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${b.merk}</td>
                <td>${formatValue(b.avg_defects_per_inspection)}</td>
                <td>${formatValue(b.defects_per_year, 3)}</td>
                <td>${formatValue(b.avg_age_years, 1)}</td>
            </tr>
        `).join('');
    }
    
    // Top 10 Least Reliable Brands
    const unreliableBrandsTbody = document.getElementById('top10-unreliable-brands-tbody');
    if (unreliableBrandsTbody) {
        unreliableBrandsTbody.innerHTML = top10UnreliableBrands.map((b, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${b.merk}</td>
                <td>${formatValue(b.avg_defects_per_inspection)}</td>
                <td>${formatValue(b.defects_per_year, 3)}</td>
                <td>${formatValue(b.avg_age_years, 1)}</td>
            </tr>
        `).join('');
    }
}

// Render brand table
function renderBrandTable() {
    const tbody = document.getElementById('brand-tbody');
    const countEl = document.getElementById('brand-count');
    
    if (!tbody || !countEl) return;
    
    // Filter
    let filtered = brandData.filter(b => 
        b.merk.toLowerCase().includes(brandFilter.toLowerCase())
    );
    
    // Sort
    filtered.sort((a, b) => {
        let valA = a[brandSortCol];
        let valB = b[brandSortCol];
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        if (valA < valB) return brandSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return brandSortDir === 'asc' ? 1 : -1;
        return 0;
    });
    
    countEl.textContent = `Showing ${filtered.length} of ${brandData.length} brands`;
    
    tbody.innerHTML = filtered.map(b => `
        <tr>
            <td>${b.merk}</td>
            <td>${formatNumber(b.vehicle_count)}</td>
            <td>${formatNumber(b.total_inspections)}</td>
            <td>${b.avg_defects_per_inspection}</td>
            <td>${formatValue(b.defects_per_year, 3)}</td>
            <td>${formatValue(b.avg_age_years, 1)}</td>
        </tr>
    `).join('');
    
    updateSortIndicators('brand-table', brandSortCol, brandSortDir);
}

// Render model table
function renderModelTable() {
    const tbody = document.getElementById('model-tbody');
    const countEl = document.getElementById('model-count');
    
    if (!tbody || !countEl) return;
    
    // Filter
    let filtered = modelData.filter(m => 
        m.merk.toLowerCase().includes(modelFilter.toLowerCase()) ||
        m.handelsbenaming.toLowerCase().includes(modelFilter.toLowerCase())
    );
    
    // Sort
    filtered.sort((a, b) => {
        let valA = a[modelSortCol];
        let valB = b[modelSortCol];
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        if (valA < valB) return modelSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return modelSortDir === 'asc' ? 1 : -1;
        return 0;
    });
    
    countEl.textContent = `Showing ${filtered.length} of ${modelData.length} models`;
    
    tbody.innerHTML = filtered.map(m => `
        <tr>
            <td>${m.merk}</td>
            <td>${m.handelsbenaming}</td>
            <td>${formatNumber(m.vehicle_count)}</td>
            <td>${formatNumber(m.total_inspections)}</td>
            <td>${m.avg_defects_per_inspection}</td>
            <td>${formatValue(m.defects_per_year, 3)}</td>
            <td>${formatValue(m.avg_age_years, 1)}</td>
        </tr>
    `).join('');
    
    updateSortIndicators('model-table', modelSortCol, modelSortDir);
}

// Update sort indicators in table headers
function updateSortIndicators(tableId, sortCol, sortDir) {
    const table = document.getElementById(tableId);
    table.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.col === sortCol) {
            th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    });
}

// Initialize event listeners
function initEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            
            // Update nav buttons
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show/hide sections
            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            document.getElementById('view-' + view).classList.add('active');
        });
    });
    
    // Brand table sorting
    document.querySelectorAll('#brand-table th').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (brandSortCol === col) {
                brandSortDir = brandSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                brandSortCol = col;
                brandSortDir = 'asc';
            }
            renderBrandTable();
        });
    });
    
    // Model table sorting
    document.querySelectorAll('#model-table th').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (modelSortCol === col) {
                modelSortDir = modelSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                modelSortCol = col;
                modelSortDir = 'asc';
            }
            renderModelTable();
        });
    });
    
    // Filters
    const brandFilterEl = document.getElementById('brand-filter');
    if (brandFilterEl) {
        brandFilterEl.addEventListener('input', (e) => {
            brandFilter = e.target.value;
            renderBrandTable();
        });
    }
    
    const modelFilterEl = document.getElementById('model-filter');
    if (modelFilterEl) {
        modelFilterEl.addEventListener('input', (e) => {
            modelFilter = e.target.value;
            renderModelTable();
        });
    }
}

// Initialize app
async function init() {
    const loaded = await loadData();
    if (loaded) {
        initEventListeners();
        renderTop10Tables();
        renderBrandTable();
        renderModelTable();
    }
}

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', init);
