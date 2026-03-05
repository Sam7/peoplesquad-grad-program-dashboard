# Discovery Schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "id": {"type": "string"},
    "name": {"type": "string"},
    "entity_type": {"type": "string"},
    "classification": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "industry_bucket": {"type": "string"},
        "is_government": {"type": "boolean"},
        "government_level": {"type": "string"}
      },
      "required": ["industry_bucket", "is_government", "government_level"]
    },
    "official_domains": {
      "type": "array",
      "items": {"type": "string"}
    },
    "urls": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "careers_url": {"type": ["string", "null"]},
        "grad_program_url": {"type": ["string", "null"]},
        "apply_url": {"type": ["string", "null"]},
        "investor_relations_url": {"type": ["string", "null"]}
      },
      "required": ["careers_url", "grad_program_url", "apply_url", "investor_relations_url"]
    },
    "branding": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "logo_candidates": {
          "type": "array",
          "items": {"type": "string"}
        }
      },
      "required": ["logo_candidates"]
    },
    "qualification": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "qualifies": {"type": "boolean"},
        "reason": {"type": "string"},
        "confidence": {"type": "string"}
      },
      "required": ["qualifies", "reason", "confidence"]
    },
    "provenance": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "sources": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "type": {"type": "string"},
              "title": {"type": "string"},
              "url": {"type": "string"}
            },
            "required": ["type", "title", "url"]
          }
        },
        "notes": {
          "type": "array",
          "items": {"type": "string"}
        }
      },
      "required": ["sources", "notes"]
    }
  },
  "required": ["id", "name", "entity_type", "classification", "official_domains", "urls", "branding", "qualification", "provenance"]
}
```
