import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { admin } = await authenticate.admin(request);
    const { jobId } = await request.json();

    if (!jobId) {
      return json({ error: "jobId is required" }, { status: 400 });
    }

    const query = `
      query pollJob($id: ID!) {
        job(id: $id) {
          id
          done
        }
      }
    `;

    const response = await admin.graphql(query, {
      variables: { id: jobId }
    });

    const jsonResponse = await response.json();

    if (jsonResponse.errors) {
      console.error('❌ GraphQL job polling errors:', jsonResponse.errors);
      return json({ error: `GraphQL error: ${jsonResponse.errors[0]?.message || 'Unknown error'}` }, { status: 400 });
    }

    const job = jsonResponse.data?.job;
    
    if (!job) {
      return json({ error: "Job not found" }, { status: 404 });
    }

    return json({ 
      done: job.done || false,
      jobId: job.id
    });

  } catch (error) {
    console.error('❌ Error polling job:', error);
    return json({ error: `Server error: ${error.message}` }, { status: 500 });
  }
};

