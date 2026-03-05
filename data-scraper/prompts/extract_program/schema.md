# Program Extraction Schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "program": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "name": {"type": ["string", "null"]},
        "overview_url": {"type": ["string", "null"]},
        "direct_apply_url": {"type": ["string", "null"]},
        "open_date": {"type": ["string", "null"]},
        "close_date": {"type": ["string", "null"]},
        "streams": {"type": "array", "items": {"type": "string"}},
        "locations": {"type": "array", "items": {"type": "string"}},
        "salary_text": {"type": ["string", "null"]},
        "duration_text": {"type": ["string", "null"]},
        "rotation_text": {"type": ["string", "null"]}
      },
      "required": ["name", "overview_url", "direct_apply_url", "open_date", "close_date", "streams", "locations", "salary_text", "duration_text", "rotation_text"]
    },
    "eligibility": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "work_rights": {"type": ["string", "null"]},
        "graduation_window": {"type": ["string", "null"]},
        "disciplines": {"type": "array", "items": {"type": "string"}},
        "minimum_requirements": {"type": "array", "items": {"type": "string"}}
      },
      "required": ["work_rights", "graduation_window", "disciplines", "minimum_requirements"]
    },
    "recruitment_process": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "stages": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "name": {"type": "string"},
              "details": {"type": ["string", "null"]}
            },
            "required": ["name", "details"]
          }
        },
        "tips": {"type": "array", "items": {"type": "string"}}
      },
      "required": ["stages", "tips"]
    },
    "section_provenance": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "program": {"$ref": "#/$defs/provenance_section"},
        "eligibility": {"$ref": "#/$defs/provenance_section"},
        "recruitment_process": {"$ref": "#/$defs/provenance_section"}
      },
      "required": ["program", "eligibility", "recruitment_process"]
    }
  },
  "$defs": {
    "source": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "type": {"type": "string"},
        "title": {"type": "string"},
        "url": {"type": "string"},
        "retrieved_at": {"type": ["string", "null"]}
      },
      "required": ["type", "title", "url", "retrieved_at"]
    },
    "provenance_section": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "confidence": {"type": "string"},
        "notes": {"type": "array", "items": {"type": "string"}},
        "sources": {"type": "array", "items": {"$ref": "#/$defs/source"}}
      },
      "required": ["confidence", "notes", "sources"]
    }
  },
  "required": ["program", "eligibility", "recruitment_process", "section_provenance"]
}
```
