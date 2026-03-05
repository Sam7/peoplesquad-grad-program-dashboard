# Commercial Extraction Schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "commercial_context": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "exec_themes": {"type": "array", "items": {"type": "string"}},
        "profit_engine": {"type": ["string", "null"]},
        "headwinds": {"type": ["string", "null"]},
        "esg": {"type": ["string", "null"]},
        "recent_pivot": {"type": ["string", "null"]}
      },
      "required": ["exec_themes", "profit_engine", "headwinds", "esg", "recent_pivot"]
    },
    "section_provenance": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "commercial_context": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "confidence": {"type": "string"},
            "notes": {"type": "array", "items": {"type": "string"}},
            "sources": {
              "type": "array",
              "items": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "type": {"type": "string"},
                  "title": {"type": "string"},
                  "url": {"type": "string"},
                  "retrieved_at": {"type": ["string", "null"]}
                },
                "required": ["type", "title", "url", "retrieved_at"]
              }
            }
          },
          "required": ["confidence", "notes", "sources"]
        }
      },
      "required": ["commercial_context"]
    }
  },
  "required": ["commercial_context", "section_provenance"]
}
```
