import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      shop {
        name
        plan {
          displayName
          partnerDevelopment
          shopifyPlus
        }
      }
    }
  `);

  const {
    data: {
      shop: { name },
    },
  } = await response.json();

  return json({ name });
};

export default function Index() {
  const { name } = useLoaderData<typeof loader>();

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <p>Welcome to {name}!</p>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 