import subprocess
import json

def run_az_command(command: list[str]) -> dict | list:
    """Run an az cli command and return the parsed JSON output."""
    try:
        full_command = ["az"] + command + ["-o", "json"]
        
        # Windows requires shell=True for 'az' which is often a .cmd wrapper
        result = subprocess.run(
            full_command,
            capture_output=True,
            text=True,
            check=True,
            shell=True 
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.lower() if e.stderr else ""
        if "not recognized" in error_msg or "not found" in error_msg:
            raise RuntimeError("Azure CLI is not installed or not in PATH.")
        elif "please run 'az login'" in error_msg:
            raise RuntimeError("Azure CLI is not logged in. Please run 'az login'.")
        elif "could not be found" in error_msg or "resource group" in error_msg:
            raise ValueError(f"Invalid resource group or Azure CLI error: {e.stderr}")
        else:
            raise RuntimeError(f"Azure CLI command failed: {e.stderr}")
    except json.JSONDecodeError:
        raise RuntimeError("Failed to parse Azure CLI output as JSON.")
    except Exception as e:
        raise RuntimeError(f"Unexpected error running Azure CLI: {str(e)}")

def get_resource_groups() -> list[dict]:
    """Get a list of all resource groups."""
    groups = run_az_command(["group", "list"])
    return [
        {
            "name": g.get("name"),
            "location": g.get("location"),
        }
        for g in groups
    ]

def get_resources_in_group(resource_group: str) -> list[dict]:
    """Get a list of resources in a specific resource group."""
    resources = run_az_command(["resource", "list", "--resource-group", resource_group])
    
    parsed_resources = []
    for r in resources:
        parsed_resources.append({
            "name": r.get("name"),
            "type": r.get("type"),
            "location": r.get("location"),
            "sku": r.get("sku", {}).get("name") if isinstance(r.get("sku"), dict) else r.get("sku"),
            "tags": r.get("tags") or {}
        })
        
    return parsed_resources
