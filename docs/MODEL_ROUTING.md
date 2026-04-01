# Model Routing Guide

Routes AI model requests to the appropriate provider and model based on task type.

## Routing Table

| Task Type                    | Provider   | Model                     | Notes                            |
| ---------------------------- | ---------- | ------------------------- | -------------------------------- |
| Text generation (long-form)  | Anthropic  | claude-sonnet-4-6         | Default for copy/content         |
| Text generation (fast)       | Anthropic  | claude-haiku-4-5-20251001 | Quick responses, low latency     |
| Code generation              | Anthropic  | claude-opus-4-6           | Complex code tasks               |
| Image generation (marketing) | Google     | Imagen 4                  | Product shots, marketing visuals |
| Image generation (quick)     | Google     | Imagen 4 Fast             | Social media, thumbnails         |
| Multimodal reasoning         | Google     | Gemini 2.5 Pro            | Vision + text analysis           |
| Multimodal fast              | Google     | Gemini 2.0 Flash          | Quick multimodal tasks           |
| Embeddings                   | Google     | text-embedding-004        | Semantic search, similarity      |
| Audio/TTS                    | ElevenLabs | eleven_turbo_v2_5         | Product narration                |

## Imagen 4 Routing

**Model ID**: `imagen-4.0-generate-001`
**Use for**: Product marketing visuals, equipment shots, lifestyle imagery, course promotion

**Imagen 4 Fast**
**Model ID**: `imagen-4.0-fast-generate-001`
**Use for**: Social media thumbnails, quick iterations, A/B testing variants

### Imagen 4 Capabilities

- Photorealistic product photography
- Lifestyle scenes (cleaners at work, before/after)
- Equipment close-ups with technical detail
- Brand-consistent colour palettes
- Australian residential and commercial settings

## Gemini 2.5 Pro Routing

**Model ID**: `gemini-2.5-pro-preview-06-05`
**Use for**: Complex reasoning, document analysis, multimodal tasks requiring deep understanding

### Gemini 2.5 Pro Capabilities

- Analyse product images and generate technical descriptions
- Review competitor websites and extract feature information
- Summarise long technical documents (IICRC standards, SDS sheets)
- Generate structured data from unstructured product catalogues

## Decision Logic

```
if task == "image_generation":
    if quality == "high" and budget == "standard":
        route to Imagen 4
    elif speed == "priority":
        route to Imagen 4 Fast
elif task == "text_generation":
    if complexity == "high" or length > 2000:
        route to claude-opus-4-6
    elif latency == "critical":
        route to claude-haiku-4-5-20251001
    else:
        route to claude-sonnet-4-6
elif task == "multimodal":
    route to gemini-2.5-pro
```

## Cost Optimisation

- Cache responses for identical prompts (Redis, 1h TTL)
- Use Fast variants for draft/preview generation
- Use full models for final output only
- Batch image generation where possible (Imagen 4 supports up to 4 images per request)
