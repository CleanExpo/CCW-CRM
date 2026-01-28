"""Internationalization service for content translation."""

import json
from datetime import datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.ollama_client import get_ollama_client
from src.db.demo_models import Product
from src.db.i18n_models import (
    CategoryTranslation,
    Language,
    ProductTranslation,
    TranslationQueue,
    UITranslation,
)

logger = structlog.get_logger(__name__)


class I18nService:
    """
    Service for managing translations and multi-language support.

    Features:
    - AI-powered translation using Ollama/Claude
    - Translation caching
    - Batch translation with queue management
    - Fallback to default language
    - Translation quality tracking
    """

    def __init__(self):
        """Initialize i18n service."""
        self.ollama = get_ollama_client()
        self.default_language = "en"
        self.supported_languages = [
            "en",
            "zh-CN",
            "zh-TW",
            "es",
            "pt",
            "ar",
            "vi",
            "hi",
            "ta",
            "te",
        ]

    async def get_active_languages(self, db: AsyncSession) -> list[Language]:
        """
        Get all active languages.

        Args:
            db: Database session

        Returns:
            List of active Language objects
        """
        stmt = select(Language).where(Language.is_active == True).order_by(Language.sort_order)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_product_translation(
        self, db: AsyncSession, product_id: UUID, language_code: str
    ) -> dict[str, Any] | None:
        """
        Get product translation for a specific language.

        Args:
            db: Database session
            product_id: Product UUID
            language_code: Target language code (e.g., 'zh-CN')

        Returns:
            Translation data dict or None if not found
        """
        stmt = select(ProductTranslation).where(
            ProductTranslation.product_id == product_id, ProductTranslation.language_code == language_code
        )
        result = await db.execute(stmt)
        translation = result.scalar_one_or_none()

        if not translation:
            return None

        return {
            "name": translation.name,
            "description": translation.description,
            "short_description": translation.short_description,
            "specifications": translation.specifications,
            "meta_title": translation.meta_title,
            "meta_description": translation.meta_description,
            "translation_status": translation.translation_status,
        }

    async def translate_product(
        self, db: AsyncSession, product_id: UUID, target_language: str, force_retranslate: bool = False
    ) -> dict[str, Any]:
        """
        Translate product to target language using AI.

        Workflow:
        1. Check if translation exists (unless force_retranslate)
        2. If not: fetch source product
        3. Generate translation via AI
        4. Save as 'ai_generated' status
        5. Return translation

        Args:
            db: Database session
            product_id: Product UUID
            target_language: Target language code
            force_retranslate: Force re-translation even if exists

        Returns:
            Translation data dict
        """
        # Check existing translation
        if not force_retranslate:
            existing = await self.get_product_translation(db, product_id, target_language)
            if existing:
                logger.info(
                    "Using existing translation",
                    product_id=str(product_id),
                    language=target_language,
                    status=existing["translation_status"],
                )
                return existing

        # Get source product
        stmt = select(Product).where(Product.id == product_id)
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()

        if not product:
            raise ValueError(f"Product not found: {product_id}")

        # Generate translation via AI
        logger.info("Generating AI translation", product_id=str(product_id), language=target_language)

        translation_data = await self._ai_translate_product(product, target_language)

        # Save to database
        await self._save_product_translation(
            db,
            product_id,
            target_language,
            translation_data,
            translation_status="ai_generated",
            translated_by="ai",
        )

        await db.commit()

        logger.info("Translation completed", product_id=str(product_id), language=target_language)

        return translation_data

    async def _ai_translate_product(self, product: Product, target_language: str) -> dict[str, Any]:
        """
        Use AI (Ollama) to translate product content.

        Args:
            product: Source Product object
            target_language: Target language code

        Returns:
            Translation data dict
        """
        # Map language codes to full names for better AI understanding
        language_names = {
            "en": "English",
            "zh-CN": "Chinese (Simplified)",
            "zh-TW": "Chinese (Traditional)",
            "es": "Spanish",
            "pt": "Portuguese",
            "ar": "Arabic",
            "vi": "Vietnamese",
            "hi": "Hindi",
            "ta": "Tamil",
            "te": "Telugu",
        }

        target_language_name = language_names.get(target_language, target_language)

        # Build translation prompt
        prompt = f"""You are a professional translator specializing in construction equipment and industrial supplies.

Translate the following product information from English to {target_language_name}.

IMPORTANT INSTRUCTIONS:
- Maintain technical accuracy and industry-specific terminology
- Keep product specifications precise
- Preserve any measurements, model numbers, or technical codes
- Make the description natural and suitable for native speakers
- Create SEO-friendly meta title and description

PRODUCT TO TRANSLATE:
Name: {product.name}
Description: {product.description or "N/A"}
Category: {product.category}
SKU: {product.sku}

OUTPUT FORMAT (JSON):
{{
    "name": "translated product name",
    "description": "translated full description",
    "short_description": "brief translated description (max 500 characters)",
    "meta_title": "SEO title (max 60 characters)",
    "meta_description": "SEO description (max 160 characters)"
}}

IMPORTANT: Return ONLY the JSON object, no other text.
"""

        try:
            # Generate translation
            response = await self.ollama.generate(
                prompt=prompt, temperature=0.3, max_tokens=2000  # Lower temperature for more consistent translations
            )

            # Parse JSON response
            translation_data = self._parse_translation_response(response)

            return translation_data

        except Exception as e:
            logger.error("AI translation failed", error=str(e), product_id=str(product.id), language=target_language)
            # Fallback: return source language content
            return {
                "name": product.name,
                "description": product.description,
                "short_description": (product.description or "")[:500] if product.description else "",
                "meta_title": product.name[:60],
                "meta_description": (product.description or "")[:160] if product.description else "",
            }

    def _parse_translation_response(self, response: str) -> dict[str, Any]:
        """
        Parse AI response to extract translation JSON.

        Args:
            response: Raw AI response

        Returns:
            Translation data dict
        """
        try:
            # Try to find JSON in response (may have text before/after)
            start_idx = response.find("{")
            end_idx = response.rfind("}") + 1

            if start_idx != -1 and end_idx > start_idx:
                json_str = response[start_idx:end_idx]
                data = json.loads(json_str)

                # Ensure all required fields exist
                return {
                    "name": data.get("name", ""),
                    "description": data.get("description", ""),
                    "short_description": data.get("short_description", "")[:500],
                    "meta_title": data.get("meta_title", "")[:60],
                    "meta_description": data.get("meta_description", "")[:160],
                }
            else:
                raise ValueError("No JSON found in response")

        except Exception as e:
            logger.error("Failed to parse translation response", error=str(e), response_preview=response[:200])
            raise ValueError(f"Invalid translation response format: {e}")

    async def _save_product_translation(
        self,
        db: AsyncSession,
        product_id: UUID,
        language_code: str,
        translation_data: dict[str, Any],
        translation_status: str = "pending",
        translated_by: str | None = None,
    ) -> ProductTranslation:
        """
        Save product translation to database.

        Args:
            db: Database session
            product_id: Product UUID
            language_code: Language code
            translation_data: Translation content
            translation_status: Status (pending, ai_generated, human_reviewed, approved)
            translated_by: Translator identifier

        Returns:
            ProductTranslation object
        """
        # Check if translation exists
        stmt = select(ProductTranslation).where(
            ProductTranslation.product_id == product_id, ProductTranslation.language_code == language_code
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing
            existing.name = translation_data["name"]
            existing.description = translation_data.get("description")
            existing.short_description = translation_data.get("short_description")
            existing.meta_title = translation_data.get("meta_title")
            existing.meta_description = translation_data.get("meta_description")
            existing.translation_status = translation_status
            existing.translated_by = translated_by
            existing.translated_at = datetime.utcnow()
            return existing
        else:
            # Create new
            translation = ProductTranslation(
                product_id=product_id,
                language_code=language_code,
                name=translation_data["name"],
                description=translation_data.get("description"),
                short_description=translation_data.get("short_description"),
                meta_title=translation_data.get("meta_title"),
                meta_description=translation_data.get("meta_description"),
                translation_status=translation_status,
                translated_by=translated_by,
                translated_at=datetime.utcnow(),
            )
            db.add(translation)
            return translation

    async def batch_translate_products(
        self, db: AsyncSession, product_ids: list[UUID], target_languages: list[str], priority: int = 5
    ) -> dict[str, Any]:
        """
        Queue multiple products for translation to multiple languages.

        Args:
            db: Database session
            product_ids: List of product UUIDs
            target_languages: List of language codes
            priority: Priority (1-10, 1=highest)

        Returns:
            Summary dict with queued count and queue IDs
        """
        queued_count = 0
        queue_ids = []

        for product_id in product_ids:
            for lang in target_languages:
                # Skip if already translated
                existing = await self.get_product_translation(db, product_id, lang)
                if existing and existing["translation_status"] in ["approved", "human_reviewed"]:
                    continue

                # Add to queue
                queue_entry = TranslationQueue(
                    entity_type="product",
                    entity_id=product_id,
                    target_language=lang,
                    priority=priority,
                    status="pending",
                )
                db.add(queue_entry)
                await db.flush()  # Flush to get the ID
                queue_ids.append(queue_entry.id)
                queued_count += 1

        await db.commit()

        logger.info("Products queued for translation", count=queued_count, products=len(product_ids))

        return {
            "queued": queued_count,
            "message": f"Queued {queued_count} translations for processing",
            "queue_ids": queue_ids,
        }

    async def get_ui_translations(self, db: AsyncSession, namespace: str, language: str) -> dict[str, str]:
        """
        Get all UI translations for a namespace and language.

        Args:
            db: Database session
            namespace: Translation namespace (e.g., 'common', 'products')
            language: Language code

        Returns:
            Dict mapping keys to translated values
        """
        stmt = select(UITranslation).where(
            UITranslation.namespace == namespace, UITranslation.language_code == language
        )
        result = await db.execute(stmt)
        translations = result.scalars().all()

        # If no translations found for this language, fall back to English
        if not translations and language != self.default_language:
            logger.warning(
                "No translations found, falling back to English", namespace=namespace, language=language
            )
            return await self.get_ui_translations(db, namespace, self.default_language)

        return {t.key: t.value for t in translations}

    async def get_category_translation(
        self, db: AsyncSession, category_code: str, language: str
    ) -> dict[str, Any] | None:
        """
        Get category translation.

        Args:
            db: Database session
            category_code: Category code (e.g., 'heavy_machinery')
            language: Language code

        Returns:
            Translation dict or None if not found
        """
        stmt = select(CategoryTranslation).where(
            CategoryTranslation.category_code == category_code, CategoryTranslation.language_code == language
        )
        result = await db.execute(stmt)
        translation = result.scalar_one_or_none()

        if not translation and language != self.default_language:
            # Fallback to English
            return await self.get_category_translation(db, category_code, self.default_language)

        if not translation:
            return None

        return {"name": translation.name, "description": translation.description}


# Singleton instance
_i18n_service: I18nService | None = None


def get_i18n_service() -> I18nService:
    """
    Get the singleton I18nService instance.

    Returns:
        I18nService instance
    """
    global _i18n_service
    if _i18n_service is None:
        _i18n_service = I18nService()
    return _i18n_service
