"""
Generate static HTML site for GitHub Pages.
"""

import json
from pathlib import Path

DOCS_DIR = Path(__file__).parent.parent / "docs"
DATA_DIR = DOCS_DIR / "data"


def generate_html():
    """Generate the main index.html page."""
    
    # Load the processed data
    with open(DATA_DIR / "brand_reliability.json") as f:
        brand_data = json.load(f)
    
    with open(DATA_DIR / "model_reliability.json") as f:
        model_data = json.load(f)
    
    # Generate brand table rows
    brand_rows = ""
    for brand in brand_data["brands"]:
        brand_rows += f"""
        <tr>
            <td>{brand['merk']}</td>
            <td>{brand['vehicle_count']:,}</td>
            <td>{brand['total_inspections']:,}</td>
            <td>{brand['avg_defects_per_vehicle']}</td>
            <td>{brand['avg_defects_per_inspection']}</td>
        </tr>"""
    
    # Generate most reliable models rows
    best_model_rows = ""
    for model in model_data["most_reliable"][:20]:
        best_model_rows += f"""
        <tr>
            <td>{model['merk']}</td>
            <td>{model['handelsbenaming']}</td>
            <td>{model['vehicle_count']:,}</td>
            <td>{model['avg_defects_per_vehicle']}</td>
        </tr>"""
    
    # Generate least reliable models rows
    worst_model_rows = ""
    for model in reversed(model_data["least_reliable"][-20:]):
        worst_model_rows += f"""
        <tr>
            <td>{model['merk']}</td>
            <td>{model['handelsbenaming']}</td>
            <td>{model['vehicle_count']:,}</td>
            <td>{model['avg_defects_per_vehicle']}</td>
        </tr>"""
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dutch Car Reliability - RDW Analysis</title>
    <style>
        * {{
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 40px;
        }}
        .subtitle {{
            color: #7f8c8d;
            font-size: 0.9em;
            margin-top: -10px;
        }}
        .card {{
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #3498db;
            color: white;
        }}
        tr:hover {{
            background-color: #f1f1f1;
        }}
        .good {{
            color: #27ae60;
        }}
        .bad {{
            color: #e74c3c;
        }}
        .methodology {{
            background-color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }}
        footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #7f8c8d;
            font-size: 0.85em;
        }}
        .updated {{
            font-style: italic;
            color: #95a5a6;
        }}
    </style>
</head>
<body>
    <h1>🚗 Dutch Car Reliability Analysis</h1>
    <p class="subtitle">Based on APK (MOT) inspection data from RDW Open Data</p>
    
    <div class="methodology card">
        <h3>📊 Methodology</h3>
        <p>This analysis uses official Dutch vehicle inspection (APK) data from the 
        <a href="https://opendata.rdw.nl/">RDW Open Data</a> portal. We measure reliability 
        by analyzing defects found during mandatory safety inspections.</p>
        <p><strong>Lower values = more reliable</strong> (fewer defects found during inspections)</p>
        <p class="updated">Data generated: {brand_data['generated_at'][:10]}</p>
    </div>
    
    <h2>🏆 Reliability by Brand</h2>
    <div class="card">
        <table>
            <thead>
                <tr>
                    <th>Brand</th>
                    <th>Vehicles</th>
                    <th>Inspections</th>
                    <th>Avg Defects/Vehicle</th>
                    <th>Avg Defects/Inspection</th>
                </tr>
            </thead>
            <tbody>
                {brand_rows}
            </tbody>
        </table>
    </div>
    
    <h2>✅ Most Reliable Models (Top 20)</h2>
    <div class="card">
        <table>
            <thead>
                <tr>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Vehicles</th>
                    <th>Avg Defects/Vehicle</th>
                </tr>
            </thead>
            <tbody>
                {best_model_rows}
            </tbody>
        </table>
    </div>
    
    <h2>⚠️ Least Reliable Models (Bottom 20)</h2>
    <div class="card">
        <table>
            <thead>
                <tr>
                    <th>Brand</th>
                    <th>Model</th>
                    <th>Vehicles</th>
                    <th>Avg Defects/Vehicle</th>
                </tr>
            </thead>
            <tbody>
                {worst_model_rows}
            </tbody>
        </table>
    </div>
    
    <footer>
        <p>Data source: <a href="https://opendata.rdw.nl/">RDW Open Data</a> (CC0 License)</p>
        <p>View source on <a href="https://github.com/">GitHub</a></p>
    </footer>
</body>
</html>
"""
    
    with open(DOCS_DIR / "index.html", "w") as f:
        f.write(html)
    
    print(f"Generated {DOCS_DIR / 'index.html'}")


def main():
    """Generate the static site."""
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    generate_html()


if __name__ == "__main__":
    main()
