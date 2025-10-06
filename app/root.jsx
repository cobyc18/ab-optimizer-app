import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import styles from "./tailwind.css";

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <script src="https://cdn.shopify.com/storefront/web-components.js"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Load App Bridge script dynamically
            (function() {
              const script = document.createElement('script');
              script.src = 'https://cdn.shopify.com/shopifycloud/app-bridge.js';
              script.async = true;
              document.head.appendChild(script);
            })();
          `
        }} />
        <Meta />
        <Links />
      </head>
      <body className="bg-gray-50">
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
