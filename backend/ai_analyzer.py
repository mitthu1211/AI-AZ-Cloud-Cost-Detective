import os
import json
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

def get_openai_api_key():
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        return api_key

    root_key_file = Path(__file__).resolve().parent.parent / ".env.txt"
    if not root_key_file.exists():
        return None

    for line in root_key_file.read_text(encoding="utf-8").splitlines():
        value = line.strip()
        if not value or value.startswith("#"):
            continue
        if value.startswith("OPENAI_API_KEY="):
            return value.split("=", 1)[1].strip().strip('"').strip("'")
        if value.startswith("sk-"):
            return value

    return None

def get_openai_client():
    api_key = get_openai_api_key()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")
    return OpenAI(api_key=api_key)

def analyze_resources(resources: list[dict]) -> dict:
    """Analyze a list of Azure resources using OpenAI to find cost optimization opportunities."""
    if not resources:
        return {
            "summary": "No resources found to analyze.",
            "issues": [],
            "estimated_savings": "$0",
            "fix_commands": []
        }

    prompt = f"""
You are an expert Azure Cloud Architect and FinOps specialist.
I will provide you with a JSON list of Azure resources in a resource group. 
Please analyze these resources for:
1. Over-provisioning
2. Unused or idle resources
3. Misconfigurations
4. Wrong pricing tiers
5. Cost optimization opportunities

Here are the resources:
{json.dumps(resources, indent=2)}

Please return your analysis strictly as a JSON object with the following structure:
{{
  "summary": "A brief overall summary of the cost optimization status.",
  "issues": [
    {{
      "resource_name": "Name of the resource",
      "issue": "Description of the problem",
      "severity": "high | medium | low",
      "recommendation": "What should be done"
    }}
  ],
  "estimated_savings": "A string like '$50/month' or 'Unknown'",
  "fix_commands": [
    "az command to fix issue 1",
    "az command to fix issue 2"
  ]
}}

Return ONLY the JSON. Do not include markdown formatting like ```json ... ```. 
Ensure the output is valid, parseable JSON.
"""

    try:
        response = get_openai_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that outputs only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        
        response_content = response.choices[0].message.content.strip()
        
        # If the model includes markdown formatting despite instructions, clean it up
        if response_content.startswith("```json"):
            response_content = response_content[7:]
        if response_content.endswith("```"):
            response_content = response_content[:-3]
            
        analysis = json.loads(response_content.strip())
        return analysis

    except json.JSONDecodeError:
        raise RuntimeError("Failed to parse OpenAI response as JSON.")
    except Exception as e:
        raise RuntimeError(f"Error during AI analysis: {str(e)}")
