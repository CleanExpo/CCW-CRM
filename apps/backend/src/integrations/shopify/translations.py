"""
Shopify Multi-Language Translation Sync.

PHASE 3: Multi-Language Product Sync - Task 3.2
Handles syncing product translations between ERP and Shopify using GraphQL Translations API.
"""

from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Product
from src.db.translation_models import ProductTranslation
from src.integrations.shopify.client import ShopifyClient

logger = structlog.get_logger(__name__)

# Shopify Markets language code mapping
# ERP language codes → Shopify locale codes
LANGUAGE_CODE_MAPPING = {
    "en": "en",  # English
    "zh-cn": "zh-CN",  # Simplified Chinese
    "zh-tw": "zh-TW",  # Traditional Chinese
    "es": "es",  # Spanish
    "pt": "pt-BR",  # Portuguese (Brazil)
    "ar": "ar",  # Arabic
    "vi": "vi",  # Vietnamese
    "hi": "hi",  # Hindi
    "ta": "ta",  # Tamil
    "te": "te",  # Telugu
    "fr": "fr",  # French (commonly used in Shopify)
    "de": "de",  # German (commonly used in Shopify)
}


class ShopifyTranslationSyncer:
    """
    Manages bidirectional translation synchronization between ERP and Shopify.

    PHASE 3: Multi-Language Product Sync - Task 3.2 & 3.3
    Uses Shopify GraphQL Translations API to sync product translations.
    """

    def __init__(self, client: ShopifyClient):
        """Initialize with Shopify client.

        Args:
            client: Shopify API client instance
        """
        self.client = client

    def _map_language_code(self, erp_code: str) -> str:
        """Map ERP language code to Shopify locale code.

        Args:
            erp_code: ERP language code (e.g., 'zh-cn', 'es')

        Returns:
            Shopify locale code (e.g., 'zh-CN', 'es')
        """
        return LANGUAGE_CODE_MAPPING.get(erp_code.lower(), erp_code)

    def _reverse_map_language_code(self, shopify_code: str) -> str:
        """Map Shopify locale code to ERP language code.

        Args:
            shopify_code: Shopify locale code (e.g., 'zh-CN', 'es')

        Returns:
            ERP language code (e.g., 'zh-cn', 'es')
        """
        # Reverse lookup in mapping
        for erp_code, shopify_code_mapped in LANGUAGE_CODE_MAPPING.items():
            if shopify_code_mapped == shopify_code:
                return erp_code
        return shopify_code.lower()

    async def sync_product_translations_to_shopify(
        self,
        db: AsyncSession,
        product_id: UUID,
        shopify_product_id: str,
        languages: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Sync product translations from ERP to Shopify (ERP → Shopify).

        PHASE 3 - Task 3.2: Translation Syncer

        Args:
            db: Database session
            product_id: Product UUID
            shopify_product_id: Shopify product ID (GID format)
            languages: Optional list of language codes to sync. If None, syncs all available translations.

        Returns:
            Sync result with synced languages and errors
        """
        # Get product
        product_query = select(Product).where(Product.id == product_id)
        product_result = await db.execute(product_query)
        product = product_result.scalar_one_or_none()

        if not product:
            logger.error("Product not found for translation sync", product_id=str(product_id))
            return {"success": False, "error": "Product not found"}

        # Get translations from database
        translations_query = select(ProductTranslation).where(
            ProductTranslation.product_id == product_id
        )
        if languages:
            translations_query = translations_query.where(
                ProductTranslation.language_code.in_(languages)
            )

        translations_result = await db.execute(translations_query)
        translations = translations_result.scalars().all()

        if not translations:
            logger.info("No translations found for product", product_id=str(product_id))
            return {
                "success": True,
                "synced_languages": [],
                "message": "No translations to sync",
            }

        logger.info(
            "Syncing translations to Shopify",
            product_id=str(product_id),
            shopify_product_id=shopify_product_id,
            translation_count=len(translations),
        )

        # Build Shopify GraphQL resource ID
        if not shopify_product_id.startswith("gid://"):
            resource_id = f"gid://shopify/Product/{shopify_product_id}"
        else:
            resource_id = shopify_product_id

        # Prepare translations for GraphQL mutation
        translations_input = []
        for translation in translations:
            shopify_locale = self._map_language_code(translation.language_code)

            # Add translated name (title)
            if translation.translated_name:
                translations_input.append({
                    "locale": shopify_locale,
                    "key": "title",
                    "value": translation.translated_name,
                    "translatableContentDigest": "",  # Empty for now
                })

            # Add translated description (body_html)
            if translation.translated_description:
                translations_input.append({
                    "locale": shopify_locale,
                    "key": "body_html",
                    "value": translation.translated_description,
                    "translatableContentDigest": "",
                })

        if not translations_input:
            logger.warning(
                "No translated content to sync",
                product_id=str(product_id),
            )
            return {
                "success": True,
                "synced_languages": [],
                "message": "No translated content to sync",
            }

        # GraphQL mutation to register translations
        mutation = """
        mutation translationsRegister($resourceId: ID!, $translations: [TranslationInput!]!) {
          translationsRegister(resourceId: $resourceId, translations: $translations) {
            translations {
              locale
              key
              value
            }
            userErrors {
              field
              message
            }
          }
        }
        """

        variables = {
            "resourceId": resource_id,
            "translations": translations_input,
        }

        try:
            # Execute GraphQL mutation
            result = await self.client.graphql(mutation, variables)

            # Check for user errors
            user_errors = result.get("translationsRegister", {}).get("userErrors", [])
            if user_errors:
                error_messages = [
                    f"{err.get('field')}: {err.get('message')}" for err in user_errors
                ]
                logger.error(
                    "Shopify translation sync failed",
                    product_id=str(product_id),
                    errors=error_messages,
                )
                return {
                    "success": False,
                    "errors": error_messages,
                }

            # Extract synced translations
            synced_translations = result.get("translationsRegister", {}).get("translations", [])
            synced_languages = list(
                set(t["locale"] for t in synced_translations if "locale" in t)
            )

            logger.info(
                "Translations synced to Shopify successfully",
                product_id=str(product_id),
                synced_languages=synced_languages,
                synced_count=len(synced_translations),
            )

            return {
                "success": True,
                "synced_languages": synced_languages,
                "synced_count": len(synced_translations),
                "synced_translations": synced_translations,
            }

        except Exception as e:
            logger.error(
                "Failed to sync translations to Shopify",
                product_id=str(product_id),
                error=str(e),
            )
            return {"success": False, "error": str(e)}

    async def sync_translations_from_shopify(
        self,
        db: AsyncSession,
        product_id: UUID,
        shopify_product_id: str,
    ) -> dict[str, Any]:
        """
        Sync product translations from Shopify to ERP (Shopify → ERP).

        PHASE 3 - Task 3.3: Bidirectional Sync

        Args:
            db: Database session
            product_id: Product UUID
            shopify_product_id: Shopify product ID (GID format)

        Returns:
            Sync result
        """
        # Build Shopify GraphQL resource ID
        if not shopify_product_id.startswith("gid://"):
            resource_id = f"gid://shopify/Product/{shopify_product_id}"
        else:
            resource_id = shopify_product_id

        # GraphQL query to fetch translations
        query = """
        query getTranslations($resourceId: ID!) {
          translatableResource(resourceId: $resourceId) {
            resourceId
            translations(outdated: false) {
              locale
              key
              value
              updatedAt
            }
          }
        }
        """

        variables = {"resourceId": resource_id}

        try:
            # Execute GraphQL query
            result = await self.client.graphql(query, variables)

            translatable_resource = result.get("translatableResource")
            if not translatable_resource:
                logger.warning(
                    "No translatable resource found in Shopify",
                    product_id=str(product_id),
                    shopify_product_id=shopify_product_id,
                )
                return {
                    "success": True,
                    "synced_languages": [],
                    "message": "No translations found in Shopify",
                }

            shopify_translations = translatable_resource.get("translations", [])

            if not shopify_translations:
                logger.info("No translations found in Shopify for product", product_id=str(product_id))
                return {
                    "success": True,
                    "synced_languages": [],
                    "message": "No translations in Shopify",
                }

            logger.info(
                "Fetched translations from Shopify",
                product_id=str(product_id),
                translation_count=len(shopify_translations),
            )

            # Group translations by locale
            translations_by_locale: dict[str, dict[str, str]] = {}
            for translation in shopify_translations:
                locale = translation["locale"]
                key = translation["key"]
                value = translation["value"]

                if locale not in translations_by_locale:
                    translations_by_locale[locale] = {}

                translations_by_locale[locale][key] = value

            # Update or create ERP translations
            synced_languages = []
            for shopify_locale, trans_data in translations_by_locale.items():
                erp_language_code = self._reverse_map_language_code(shopify_locale)

                # Get or create translation record
                trans_query = select(ProductTranslation).where(
                    ProductTranslation.product_id == product_id,
                    ProductTranslation.language_code == erp_language_code,
                )
                trans_result = await db.execute(trans_query)
                translation = trans_result.scalar_one_or_none()

                if not translation:
                    translation = ProductTranslation(
                        product_id=product_id,
                        language_code=erp_language_code,
                        translated_name=trans_data.get("title", ""),
                        translated_description=trans_data.get("body_html", ""),
                    )
                    db.add(translation)
                else:
                    # Update existing translation
                    if "title" in trans_data:
                        translation.translated_name = trans_data["title"]
                    if "body_html" in trans_data:
                        translation.translated_description = trans_data["body_html"]

                synced_languages.append(erp_language_code)

            await db.commit()

            logger.info(
                "Translations synced from Shopify to ERP",
                product_id=str(product_id),
                synced_languages=synced_languages,
            )

            return {
                "success": True,
                "synced_languages": synced_languages,
                "synced_count": len(synced_languages),
            }

        except Exception as e:
            logger.error(
                "Failed to sync translations from Shopify",
                product_id=str(product_id),
                error=str(e),
            )
            return {"success": False, "error": str(e)}


# Singleton instance
_translation_syncer: ShopifyTranslationSyncer | None = None


def get_translation_syncer(client: ShopifyClient) -> ShopifyTranslationSyncer:
    """Get ShopifyTranslationSyncer singleton.

    Args:
        client: Shopify API client

    Returns:
        ShopifyTranslationSyncer instance
    """
    global _translation_syncer
    if _translation_syncer is None:
        _translation_syncer = ShopifyTranslationSyncer(client)
    return _translation_syncer
