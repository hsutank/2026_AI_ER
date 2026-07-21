import requests
import sys

if len(sys.argv) < 2:
    print("Usage: python query_render.py <RENDER_API_KEY>")
    sys.exit(1)

api_key = sys.argv[1]
headers = {
    "Accept": "application/json",
    "Authorization": f"Bearer {api_key}"
}

print("Fetching services...")
r = requests.get("https://api.render.com/v1/services?limit=20", headers=headers)
if r.status_code != 200:
    print(f"Failed to fetch services: {r.status_code} - {r.text}")
    sys.exit(1)

services = r.json()
target_service = None
for s in services:
    service_details = s.get("service", {})
    name = service_details.get("name")
    service_id = service_details.get("id")
    print(f"Service: {name} (ID: {service_id})")
    if name == "ssana-backtester":
        target_service = service_id

if not target_service:
    print("Could not find service named 'ssana-backtester'")
    sys.exit(0)

print(f"\nFetching environment variables for ssana-backtester (ID: {target_service})...")
r = requests.get(f"https://api.render.com/v1/services/{target_service}/env-vars", headers=headers)
if r.status_code != 200:
    print(f"Failed to fetch env vars: {r.status_code} - {r.text}")
    sys.exit(1)

env_vars = r.json()
for ev in env_vars:
    env_var = ev.get("envVar", {})
    key = env_var.get("key")
    val = env_var.get("value")
    # Mask value for display
    masked_val = val[:20] + "..." if val else "None"
    print(f"Env Var: {key} = {masked_val} (Length: {len(val) if val else 0})")
    if key == "GOOGLE_CREDENTIALS_JSON":
        print(f"  First 100 chars: {val[:100]}")
        print(f"  Last 100 chars: {val[-100:] if len(val) >= 100 else val}")
        
        # Check characters
        spaces = val.count(' ')
        newlines = val.count('\n')
        r_chars = val.count('\r')
        tabs = val.count('\t')
        nbsps = val.count('\xa0')
        print(f"  Whitespace diagnostics: spaces={spaces}, newlines={newlines}, r_chars={r_chars}, tabs={tabs}, NBSPs={nbsps}")
