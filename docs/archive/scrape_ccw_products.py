"""Scrape products from ccwonline.com.au"""
import asyncio
import json
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup


async def scrape_ccw_products():
    """Scrape product listings from CCW website."""
    base_url = "https://ccwonline.com.au"
    products = []

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # Fetch shop page
        print("Fetching shop page...")
        response = await client.get(f"{base_url}/shop")
        soup = BeautifulSoup(response.text, "html.parser")

        # Find product categories
        print("Finding product categories...")
        category_links = soup.find_all("a", href=True)
        categories = []
        for link in category_links:
            href = link.get("href", "")
            if "/product-category/" in href or "/shop/" in href:
                full_url = urljoin(base_url, href)
                if full_url not in categories:
                    categories.append(full_url)
                    print(f"Found category: {full_url}")

        # Also try direct product listings
        product_links = []
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if "/product/" in href and href not in product_links:
                product_links.append(urljoin(base_url, href))

        print(f"\nFound {len(product_links)} product links")
        print(f"Found {len(categories)} category pages\n")

        # Scrape first 20 products
        for i, product_url in enumerate(product_links[:20], 1):
            try:
                print(f"[{i}/20] Scraping: {product_url}")
                prod_response = await client.get(product_url)
                prod_soup = BeautifulSoup(prod_response.text, "html.parser")

                # Extract product details
                title = prod_soup.find("h1", class_="product_title")
                name = title.text.strip() if title else "Unknown Product"

                price_elem = prod_soup.find("span", class_="woocommerce-Price-amount")
                price = price_elem.text.strip().replace("$", "").replace(",", "") if price_elem else "0.00"

                sku_elem = prod_soup.find("span", class_="sku")
                sku = sku_elem.text.strip() if sku_elem else f"CCW-{i:04d}"

                desc_elem = prod_soup.find("div", class_="woocommerce-product-details__short-description")
                description = desc_elem.text.strip()[:200] if desc_elem else ""

                # Determine category from URL or breadcrumbs
                category = "ACCESSORIES"
                if "machine" in product_url.lower() or "extractor" in name.lower():
                    category = "CLEANING_MACHINES"
                elif "chemical" in product_url.lower() or "detergent" in name.lower():
                    category = "CHEMICALS"
                elif "vacuum" in product_url.lower():
                    category = "VACUUM_CLEANERS"
                elif "part" in product_url.lower():
                    category = "PARTS"

                products.append({
                    "sku": sku,
                    "name": name,
                    "description": description,
                    "category": category,
                    "price": float(price) if price else 0.0,
                    "url": product_url
                })

                await asyncio.sleep(0.5)  # Be respectful

            except Exception as e:
                print(f"  Error: {e}")
                continue

    return products


async def main():
    products = await scrape_ccw_products()

    print(f"\n\n=== Scraped {len(products)} products ===\n")
    print(json.dumps(products, indent=2))

    # Save to file
    with open("ccw_products.json", "w") as f:
        json.dump(products, f, indent=2)

    print(f"\nSaved to ccw_products.json")


if __name__ == "__main__":
    asyncio.run(main())
