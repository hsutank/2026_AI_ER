"""
Deploy to Google App Engine.
Builds the frontend, copies dist to backend, and deploys via gcloud CLI.
"""
import os
import sys
import subprocess
import shutil

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(SCRIPT_DIR, "frontend")
BACKEND_DIR = os.path.join(SCRIPT_DIR, "backend")
FRONTEND_DIST = os.path.join(FRONTEND_DIR, "dist")
BACKEND_DIST = os.path.join(BACKEND_DIR, "dist")


def run(cmd, cwd=None, check=True):
    """Run a command and print output."""
    print(f"\n▶ Running: {cmd}")
    result = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=False)
    if check and result.returncode != 0:
        print(f"✖ Command failed with exit code {result.returncode}")
        sys.exit(1)
    return result


def main():
    print("=" * 60)
    print("  Financial Backtester — Google App Engine Deployer")
    print("=" * 60)

    # 1. Build frontend
    print("\n📦 Step 1: Building frontend...")
    if os.path.exists(os.path.join(FRONTEND_DIR, "node_modules")):
        run("npm run build", cwd=FRONTEND_DIR)
    else:
        print("   node_modules not found. Installing dependencies first...")
        run("npm install", cwd=FRONTEND_DIR)
        run("npm run build", cwd=FRONTEND_DIR)

    # 2. Copy dist to backend
    print("\n📁 Step 2: Copying frontend build to backend/dist/...")
    if os.path.exists(BACKEND_DIST):
        shutil.rmtree(BACKEND_DIST)
    shutil.copytree(FRONTEND_DIST, BACKEND_DIST)
    print(f"   ✓ Copied {FRONTEND_DIST} → {BACKEND_DIST}")

    # 3. Deploy to GAE
    print("\n🚀 Step 3: Deploying to Google App Engine...")
    run("gcloud app deploy app.yaml --quiet", cwd=BACKEND_DIR)

    # 4. Show URL
    print("\n" + "=" * 60)
    print("  ✓ Deployment Complete!")
    print("=" * 60)
    run("gcloud app browse", cwd=BACKEND_DIR, check=False)


if __name__ == "__main__":
    main()
