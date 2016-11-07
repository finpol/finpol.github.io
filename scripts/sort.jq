#!/usr/bin/env jq

(..|select(type == "object" and has("id")).id) |= tonumber
| (..|select(type == "object" and has("source")).source) |= tonumber
| (..|select(type == "object" and has("target")).target) |= tonumber
| .edges |= sort_by(.target, .source)
| .nodes |= sort_by(.id)
