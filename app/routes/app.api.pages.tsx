import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

interface PageNode {
  id: string;
  title: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("query")?.trim() ?? "";

  const response = await admin.graphql(
    `#graphql
      query TablifyPages($query: String) {
        pages(first: 50, query: $query) {
          edges {
            node {
              id
              title
            }
          }
        }
      }`,
    {
      variables: {
        query: search ? `title:*${search}*` : null,
      },
    },
  );

  const json = (await response.json()) as {
    data?: { pages?: { edges?: { node: PageNode }[] } };
  };

  const pages =
    json.data?.pages?.edges?.map((edge) => ({
      id: edge.node.id,
      title: edge.node.title,
    })) ?? [];

  return { pages };
};
