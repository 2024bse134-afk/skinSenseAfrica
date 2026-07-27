"""LLM infrastructure package.

Single responsibility: expose provider-facing adapters for language model calls.
Layering rule: provider-specific code is allowed here, while domain layer remains free of such imports.
"""
