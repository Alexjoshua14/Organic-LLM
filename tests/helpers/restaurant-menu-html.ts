/** HTML page with schema.org Menu JSON-LD for fetchRestaurantMenu tests. */
export const MOCK_RESTAURANT_MENU_HTML = `<!doctype html>
<html>
  <head>
    <script type="application/ld+json">
    {
      "@type": "Menu",
      "hasMenuSection": [{
        "@type": "MenuSection",
        "name": "Mains",
        "hasMenuItem": [{
          "@type": "MenuItem",
          "name": "Burger",
          "description": "Grass-fed beef",
          "offers": { "price": "18" }
        }]
      }]
    }
    </script>
  </head>
  <body><h1>Menu</h1></body>
</html>`;
