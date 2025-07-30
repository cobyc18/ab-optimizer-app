import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return { 
    user: {
      shop: admin.shop,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      accountOwner: admin.accountOwner,
      locale: admin.locale,
      collaborator: admin.collaborator,
      emailVerified: admin.emailVerified
    }
  };
};

export default function App() {
  const { user } = useLoaderData<typeof loader>();

  return <Outlet context={{ user }} />;
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs: any) => {
  return boundary.headers(headersArgs);
}; 