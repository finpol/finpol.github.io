#!/usr/bin/env jq

# Apply f to composite entities recursively, and to atoms
def walk(f):
  . as $in
  | if type == "object" then
      reduce keys[] as $key
        ( {}; . + { ($key):  ($in[$key] | walk(f)) } ) | f
  elif type == "array" then map( walk(f) ) | f
  else f
  end;

(..|select(type == "object" and has("id")).id) |= tonumber
| (..|select(type == "object" and has("source")).source) |= tonumber
| (..|select(type == "object" and has("target")).target) |= tonumber
| walk(
  if type == "object" and (has("id") or has("source")) then
    select(
      (has("id") and .id > 1658)
      or (has("source") and (.source > 1658 or .target > 1658 or .source == 570 or .target == 570))
    )
  else
    .
  end
)
| .edges |= sort_by(.target, .source)
| .nodes |= sort_by(.id)
