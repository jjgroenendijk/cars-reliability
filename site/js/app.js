// Data loaded from JSON files
let brandData = [];
let modelData = [];
let metadata = {};

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
        metadata = {
            generated_at: brandJson.generated_at,
            sample_percent: brandJson.sample_percent || 100,
            total_vehicles: brandJson.total_vehicles,
            total_inspections: brandJson.total_inspections
        };
        
        // Update the generated date in the page
        const dateEl = document.getElementById('generated-date');
        if (dateEl && metadata.generated_at) {
            dateEl.textContent = metadata.generated_at.substring(0, 10);
        }
        
        // Update summary stats if element exists
        const statsEl = document.getElementById('summary-stats');
        if (statsEl && metadata.total_vehicles) {
            let statsText = `Based on ${formatNumber(metadata.total_vehicles)} vehicles and ${formatNumber(metadata.total_inspections)} inspections`;
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
            <td>${b.avg_defect_types_per_inspection}</td>
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
            <td>${m.avg_defect_types_per_inspection}</td>
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
        renderBrandTable();
        renderModelTable();
    }
}

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', init);
