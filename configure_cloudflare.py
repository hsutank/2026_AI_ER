import os
import sys
import ssl
import requests
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager

# Suppress SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Custom TLS Adapter to force TLS 1.2
class TLS12Adapter(HTTPAdapter):
    def init_poolmanager(self, connections, maxsize, block=False):
        self.poolmanager = PoolManager(
            num_pools=connections,
            maxsize=maxsize,
            block=block,
            ssl_minimum_version=ssl.TLSVersion.TLSv1_2,
            ssl_maximum_version=ssl.TLSVersion.TLSv1_2
        )

# Determine CNAME target (default to GAE, override with argument if provided)
cname_target = "ghs.googlehosted.com"
if len(sys.argv) > 1:
    cname_target = sys.argv[1].replace("https://", "").replace("http://", "").split("/")[0]

print(f"Target CNAME set to: {cname_target}")


# Load env variables from C:\Users\User\.env
env_path = r"C:\Users\User\.env"
token = None
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("CLOUDFLARE_API_TOKEN="):
                token = line.strip().split("=", 1)[1]
                break

if not token:
    print("Error: CLOUDFLARE_API_TOKEN not found in C:\\Users\\User\\.env")
    sys.exit(1)

session = requests.Session()
session.mount("https://", TLS12Adapter())

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "Connection": "close"
}

# 1. Find Zone ID for tyhsu.com
print("Searching for Cloudflare zone for 'tyhsu.com'...")
url = "https://api.cloudflare.com/client/v4/zones"
params = {"name": "tyhsu.com"}
r = session.get(url, headers=headers, params=params, verify=False)
res = r.json()

if not res.get("success") or not res.get("result"):
    print("Error: Failed to find zone 'tyhsu.com' or token lacks permission.")
    print(res)
    sys.exit(1)

zone_id = res["result"][0]["id"]
print(f"Found Zone ID: {zone_id}")

# 2. Check if ssana.tyhsu.com CNAME already exists
print("Checking for existing DNS records for 'ssana.tyhsu.com'...")
url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records"
params = {"name": "ssana.tyhsu.com", "type": "CNAME"}
r = session.get(url, headers=headers, params=params, verify=False)
res = r.json()

record_exists = False
record_id = None
if res.get("success") and res.get("result"):
    record_exists = True
    record_id = res["result"][0]["id"]
    print(f"Found existing CNAME record: {record_id}")

# 3. Create or Update CNAME record
dns_data = {
    "type": "CNAME",
    "name": "ssana.tyhsu.com",
    "content": cname_target,
    "ttl": 1,  # Auto TTL
    "proxied": False  # DNS Only
}

if record_exists:
    print(f"Updating existing CNAME record to point to {cname_target}...")
    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{record_id}"
    r = session.put(url, headers=headers, json=dns_data, verify=False)
else:
    print(f"Creating new CNAME record pointing to {cname_target}...")
    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records"
    r = session.post(url, headers=headers, json=dns_data, verify=False)

res = r.json()
if res.get("success"):
    print("SUCCESS: DNS Configuration completed successfully!")
    print(f"ssana.tyhsu.com CNAME -> {cname_target} (DNS Only)")
else:
    print("Error: Failed to configure DNS record.")
    print(res)
    sys.exit(1)
