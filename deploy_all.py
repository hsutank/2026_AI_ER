"""
Unified Deployment Script — Deploy to BOTH NAS and Google App Engine.
Builds frontend once, then deploys to both targets simultaneously.

Usage: python deploy_all.py [--nas-only] [--gae-only]
"""
import os
import sys
import subprocess
import shutil

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRATCH_DIR = os.path.dirname(SCRIPT_DIR) if os.path.basename(SCRIPT_DIR) in ('financial_backtester_gae', 'financial_backtester_dashboard') else SCRIPT_DIR

NAS_PROJECT = os.path.join(os.path.dirname(SCRIPT_DIR), "financial_backtester_dashboard")
GAE_PROJECT = os.path.join(os.path.dirname(SCRIPT_DIR), "financial_backtester_gae")

# Use whichever frontend is available (GAE project has the same frontend source)
FRONTEND_DIR = os.path.join(GAE_PROJECT, "frontend")
if not os.path.exists(FRONTEND_DIR):
    FRONTEND_DIR = os.path.join(NAS_PROJECT, "frontend")


def run(cmd, cwd=None, check=True):
    """Run a command and print output."""
    print(f"\n▶ {cmd}")
    result = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=False)
    if check and result.returncode != 0:
        print(f"✖ Command failed with exit code {result.returncode}")
        return False
    return True


def build_frontend():
    """Build the React frontend."""
    print("\n" + "=" * 60)
    print("  📦 Building Frontend (shared by both projects)")
    print("=" * 60)

    if not os.path.exists(os.path.join(FRONTEND_DIR, "node_modules")):
        print("   Installing npm dependencies...")
        if not run("npm install", cwd=FRONTEND_DIR):
            return False

    if not run("npm run build", cwd=FRONTEND_DIR):
        return False

    dist_src = os.path.join(FRONTEND_DIR, "dist")

    # Copy to NAS backend/dist
    nas_dist = os.path.join(NAS_PROJECT, "backend", "dist")
    if os.path.exists(NAS_PROJECT):
        if os.path.exists(nas_dist):
            shutil.rmtree(nas_dist)
        shutil.copytree(dist_src, nas_dist)
        print(f"   ✓ Copied dist → NAS backend/dist")

    # Copy to GAE backend/dist
    gae_dist = os.path.join(GAE_PROJECT, "backend", "dist")
    if os.path.exists(GAE_PROJECT):
        if os.path.exists(gae_dist):
            shutil.rmtree(gae_dist)
        shutil.copytree(dist_src, gae_dist)
        print(f"   ✓ Copied dist → GAE backend/dist")

    return True


def deploy_nas():
    """Deploy to Synology NAS via SSH/SFTP."""
    print("\n" + "=" * 60)
    print("  🏠 Deploying to Synology NAS (ds923-1)")
    print("=" * 60)

    deploy_script = os.path.join(NAS_PROJECT, "deploy.py")
    if not os.path.exists(deploy_script):
        print("   ✖ NAS deploy.py not found. Skipping NAS deployment.")
        return False

    # Use NAS project's venv
    venv_python = os.path.join(NAS_PROJECT, "backend", ".venv", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        venv_python = "python"

    return run(f'"{venv_python}" deploy.py', cwd=NAS_PROJECT)


def deploy_gae():
    """Deploy to Google App Engine."""
    print("\n" + "=" * 60)
    print("  ☁️  Deploying to Google App Engine")
    print("=" * 60)

    backend_dir = os.path.join(GAE_PROJECT, "backend")
    app_yaml = os.path.join(backend_dir, "app.yaml")
    if not os.path.exists(app_yaml):
        print("   ✖ app.yaml not found. Skipping GAE deployment.")
        return False

    if not run("gcloud app deploy app.yaml --quiet", cwd=backend_dir):
        return False

    print("\n   🌐 Opening deployed app...")
    run("gcloud app browse", cwd=backend_dir, check=False)
    return True


def main():
    args = sys.argv[1:]
    nas_only = "--nas-only" in args
    gae_only = "--gae-only" in args

    print("=" * 60)
    print("  Financial Backtester — Unified Deployer")
    print("  Targets: " + ("NAS only" if nas_only else "GAE only" if gae_only else "NAS + GAE"))
    print("=" * 60)

    # Step 1: Build frontend
    if not build_frontend():
        print("\n✖ Frontend build failed. Aborting.")
        sys.exit(1)

    results = {}

    # Step 2: Deploy NAS
    if not gae_only:
        results["NAS"] = deploy_nas()

    # Step 3: Deploy GAE
    if not nas_only:
        results["GAE"] = deploy_gae()

    # Summary
    print("\n" + "=" * 60)
    print("  Deployment Summary")
    print("=" * 60)
    for target, success in results.items():
        status = "✓ SUCCESS" if success else "✖ FAILED"
        print(f"   {target}: {status}")
    print("=" * 60)

    if all(results.values()):
        print("\n🎉 All deployments completed successfully!")
    else:
        print("\n⚠️  Some deployments failed. Check logs above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
