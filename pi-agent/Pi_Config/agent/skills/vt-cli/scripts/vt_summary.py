#!/usr/bin/env python3
"""
VirusTotal Triage Summarizer for AI Agents
Executes vt-cli to query a file hash and returns a compact JSON summary.
Eliminates manual jq parsing and avoids token waste.
"""
import sys
import json
import subprocess
import shutil

def run_vt_command(args):
    vt_bin = shutil.which("vt")
    if not vt_bin:
        return None, "vt-cli binary ('vt') not found in PATH."
    try:
        res = subprocess.run([vt_bin] + args, capture_output=True, text=True, timeout=30)
        return res, None
    except Exception as e:
        return None, str(e)

def summarize_hash(target_hash):
    clean_hash = target_hash.strip().lower()
    
    # 1. Query file metadata
    res, err = run_vt_command(["file", clean_hash, "--format", "json"])
    if err:
        return {"status": "ERROR", "message": err}
    if res.returncode != 0:
        err_msg = res.stderr.strip() or res.stdout.strip()
        if "NotFoundError" in err_msg or "not found" in err_msg.lower():
            return {"status": "NOT_FOUND", "hash": clean_hash, "action": "STOP_DO_NOT_UPLOAD"}
        return {"status": "ERROR", "code": res.returncode, "message": err_msg}

    try:
        data = json.loads(res.stdout)
        item = data[0] if isinstance(data, list) and len(data) > 0 else data
    except Exception as e:
        return {"status": "ERROR", "message": f"Failed to parse VT JSON: {e}"}

    stats = item.get("last_analysis_stats", {})
    malicious = stats.get("malicious", 0)
    total = sum(stats.values()) if stats else 0

    popular = item.get("popular_threat_classification", {})
    threat_label = popular.get("suggested_threat_label", "Unknown")

    pe_info = item.get("pe_info", {})
    imphash = pe_info.get("imphash", "None")

    summary = {
        "status": "MALICIOUS" if malicious > 0 else "CLEAN_OR_UNKNOWN",
        "hash": clean_hash,
        "name": item.get("meaningful_name", "Unknown"),
        "type": item.get("type_description", "Unknown"),
        "score": f"{malicious}/{total}",
        "threat_label": threat_label,
        "imphash": imphash,
        "first_seen": item.get("first_submission_date", "Unknown"),
        "contacted_ips": [],
        "contacted_domains": []
    }

    # If malicious, query first 5 contacted IPs and domains
    if malicious > 0:
        ip_res, _ = run_vt_command(["file", "contact_ips", clean_hash, "-I", "--limit", "5"])
        if ip_res and ip_res.returncode == 0:
            summary["contacted_ips"] = [line.strip() for line in ip_res.stdout.splitlines() if line.strip()]

        domain_res, _ = run_vt_command(["file", "contact_domains", clean_hash, "-I", "--limit", "5"])
        if domain_res and domain_res.returncode == 0:
            summary["contacted_domains"] = [line.strip() for line in domain_res.stdout.splitlines() if line.strip()]

    return summary

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python vt_summary.py <SHA256|MD5>"}))
        sys.exit(1)
        
    result = summarize_hash(sys.argv[1])
    print(json.dumps(result, indent=2))
    if result.get("status") == "MALICIOUS":
        sys.exit(2)
    elif result.get("status") == "NOT_FOUND":
        sys.exit(3)
    sys.exit(0)

if __name__ == "__main__":
    main()
