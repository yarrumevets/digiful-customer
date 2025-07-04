import { GraphQLClient, gql } from "graphql-request";
import shopifyConfig from "./shopify.secret.js";

// Custom App
const gqlClient = new GraphQLClient(
  `${shopifyConfig.shopUrl}/admin/api/2025-04/graphql.json`,
  {
    headers: { "X-Shopify-Access-Token": shopifyConfig.adminApiAccessToken },
  }
);

// Public (partners) - !! shopifyConfig here is stored in DB
const gqlClientPublic = () => {
  // Since the admin api access token differs from one merchant to another
  // it has to come from the db:
  // @TODO: store in db and get from db; currently hardcoded the partners dev store access token here:
  const adminApiAccessTokenPublic = "";

  return new GraphQLClient(
    `${shopifyConfig.shopUrl}/admin/api/2025-04/graphql.json`, // <-- @TODO: get from stored in db or no?
    {
      headers: { "X-Shopify-Access-Token": adminApiAccessTokenPublic },
    }
  );
};

const gqlOrderQuery = gql`
  query ($orderId: ID!) {
    order: node(id: $orderId) {
      ... on Order {
        id
        name
        displayFinancialStatus
        # customer {
        #   id
        #   email
        # }
        lineItems(first: 10) {
          nodes {
            title
            quantity
            variant {
              id
              sku
            }
            product {
              id
              title
            }
          }
        }
      }
    }
  }
`;

export { gqlClient, gqlOrderQuery, gqlClientPublic };
