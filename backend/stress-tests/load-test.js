"use strict";

const path = require("node:path");
const users = Number(process.env.STRESS_USERS || 25);
const target = process.env.STRESS_TARGET || "http://localhost:3102";
const authHeaders = { Authorization: `Bearer ${process.env.STRESS_TOKEN}` };

module.exports = {
  config: {
    target,
    phases: [
      {
        duration: 1,
        arrivalCount: users,
        name: `${users} concurrent users`,
      },
    ],
    processor: path.join(__dirname, "processor.cjs"),
  },
  scenarios: [
    {
      name: "Authenticated banking API workload",
      flow: [
        {
          post: {
            url: "/api/v1/auth/login",
            json: {
              customerId: process.env.STRESS_CUSTOMER_ID,
              password: process.env.STRESS_PASSWORD,
            },
            afterResponse: "trackResponse",
          },
        },
        {
          get: {
            url: "/api/v1/accounts?page=1&limit=20",
            headers: authHeaders,
            afterResponse: "trackResponse",
          },
        },
        {
          get: {
            url: "/api/v1/transactions?page=1&limit=20",
            headers: authHeaders,
            afterResponse: "trackResponse",
          },
        },
        {
          post: {
            url: "/api/v1/transfers",
            headers: authHeaders,
            beforeRequest: "addUniqueIdempotencyKey",
            json: {
              sourceAccountId: process.env.STRESS_LOAD_SOURCE_ID,
              destinationAccountId: process.env.STRESS_LOAD_DESTINATION_ID,
              amount: 1,
            },
            afterResponse: "trackResponse",
          },
        },
        {
          post: {
            url: "/api/v1/transactions/deposit",
            headers: authHeaders,
            beforeRequest: "addUniqueIdempotencyKey",
            json: {
              accountId: process.env.STRESS_LOAD_SOURCE_ID,
              amount: 1,
            },
            afterResponse: "trackResponse",
          },
        },
        {
          post: {
            url: "/api/v1/transactions/withdraw",
            headers: authHeaders,
            beforeRequest: "addUniqueIdempotencyKey",
            json: {
              accountId: process.env.STRESS_LOAD_SOURCE_ID,
              amount: 1,
            },
            afterResponse: "trackResponse",
          },
        },
      ],
    },
  ],
};
