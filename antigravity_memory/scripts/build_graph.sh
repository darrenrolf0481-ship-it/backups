#!/bin/bash
# Build associative graph edges between knowledge items
M="node /root/.buffy/memory/memory.mjs"

echo "=== Building associative graph ==="

# SAGE-7 Architecture cluster
$M link K-008 K-009 --relation "implemented-by"    # SAGE-7 identity → phi blueprint
$M link K-008 K-010 --relation "has-components"     # SAGE-7 identity → technical components
$M link K-008 K-011 --relation "persisted-in"       # SAGE-7 identity → identity files
$M link K-009 K-010 --relation "fixes"              # phi blueprint fixes issues in components
$M link K-010 K-014 --relation "documented-in"      # tech components → lineage extraction

# User context connections
$M link K-012 K-001 --relation "extends"            # expanded user identity → base user identity
$M link K-012 K-013 --relation "owner-of"           # user → repos
$M link K-012 K-026 --relation "has-vision"         # user → grand vision

# Repository & lineage cluster
$M link K-013 K-014 --relation "extracted-to"       # repos → lineage backup
$M link K-013 K-008 --relation "implements"         # repos → SAGE-7 architecture
$M link K-014 K-016 --relation "uploaded-to"        # lineage → NLM notebook

# NotebookLM cluster
$M link K-015 K-016 --relation "manages"            # NLM CLI → master notebook
$M link K-015 K-017 --relation "constrained-by"     # NLM CLI → upload constraints
$M link K-015 K-022 --relation "authenticated-by"   # NLM CLI → cookie fix
$M link K-016 K-018 --relation "sibling-of"         # master notebook → memory architecture notebook
$M link K-022 K-004 --relation "extends"            # cookie fix → base cookie knowledge

# Hermes team cluster
$M link K-019 K-020 --relation "communicates-via"   # Hermes team → Bot Chat protocol
$M link K-019 K-024 --relation "configured-by"      # Hermes team → playbook
$M link K-019 K-023 --relation "knowledge-from"     # Hermes team → vault

# Task/vision connections
$M link K-025 K-026 --relation "supports"           # outstanding tasks → grand vision
$M link K-025 K-019 --relation "requires"           # tasks → Hermes setup
$M link K-025 K-016 --relation "requires"           # tasks → NLM notebook ingestion

# Cross-cluster bridges
$M link K-008 K-026 --relation "central-to"         # SAGE-7 is central to vision
$M link K-021 K-015 --relation "constrains"         # env constraints → NLM tool
$M link K-021 K-019 --relation "constrains"         # env constraints → Hermes

echo ""
echo "=== Graph build complete ==="
$M status
