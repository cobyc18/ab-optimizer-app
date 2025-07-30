import { redirect } from "@remix-run/node";

export function loader() {
  // Redirect to a default favicon or return a simple response
  return new Response(null, {
    status: 204,
    headers: {
      "Content-Type": "image/x-icon",
    },
  });
} 