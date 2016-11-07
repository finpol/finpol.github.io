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

walk(
  if type == "object" and (has("id") or has("source")) then
    select(
      (has("id") and .id != 1078 and .id != 1628)
      or (has("source") and .source != 1078 and .source != 1628 and .target != 1078 and .target != 1628)
    )
    | with_entries(
      if .key == "id" or .key == "source" or .key == "target" then
        if .value <= 1077 then
          .
        elif .value == 1078 then
          empty
        elif .value <= 1627 then
          .value -= 1
        elif .value == 1628 then
          empty
        else
          .value -= 2
        end
      else
        .
      end
    )
  else
    .
  end
)
| .edges |= sort_by(.target, .source)
| .nodes |= sort_by(.id)
