# Buffy's Persistent Memory

A cognitive persistent memory store for the Buffy agent, inspired by Google
Antigravity's memory architecture (Brain / Conversations / Implicits /
Knowledge items / Artifacts) and community patterns (identity file, small
short-term context, timestamped RECAP session logs, associative knowledge
graph, confidence + decay).

## Layout

```
~/.buffy/memory/
├── IDENTITY.md          # Always-loaded identity + global rules (like Antigravity GEMINI.md)
├── SHORT_TERM.md        # Current context, kept <3 KB — state, not history
├── knowledge/           # Long-term knowledge items (one fact/lesson per file)
│   └── K-<n>-<slug>.md  #   frontmatter: id, tags, confidence, created, reinforced
├── graph.json           # Associative graph: nodes + edges {from, to, relation, weight}
├── sessions/            # Timestamped session logs with RECAP blocks
│   └── YYYY-MM-DD.md
├── contradictions.json  # Conflicting observations (both stay on record, status)
└── index.json           # Registry: item metadata, decay state, last session id
```

## CLI

`node ~/.buffy/memory/memory.mjs <command> [args]`

| Command | Purpose |
|---|---|
| `start` | Session bootstrap: load identity + short-term + last session recap, open today's log |
| `note "<text>"` | Append a timestamped entry to the current session log |
| `remember "<fact>" --tags a,b --confidence 0.9` | Promote to a long-term knowledge item |
| `recall "<query>"` | Ranked retrieval + associative graph expansion |
| `link <idA> <idB> --relation <r>` | Add an associative edge between items |
| `end "<day summary>"` | Close session: RECAP, extract lessons, decay old memories, refresh short-term |
| `status` | Memory stats |

## Cognitive model (short / long / associative)

- **Short-term**: today's session log (timestamped notes) + SHORT_TERM.md digest.
  History lives in session files; SHORT_TERM stays tiny so it is always cheap to load.
- **Long-term**: knowledge items with confidence scores. Unreinforced items decay
  over time (confidence × time decay). Reinforcing = `remember` a duplicate.
- **Associative**: `graph.json` edges link items; `recall` expands top matches
  through the graph so one memory pulls up related ones (Antigravity's
  "knowledge items linked together").
- **Contradictions**: conflicting observations are kept in contradictions.json
  instead of overwriting — both stay on record until resolved.