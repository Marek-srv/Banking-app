"use strict";

const path = require("node:path");
const users = Number(process.env.STRESS_USERS || 25);
const authHeaders = { Authorization: `Bearer ${process.env.STRESS_TOKEN}` };

module.exports = {
  config: {
    target: process.env.STRESS_TARGET || "http://localhost:3102",
    phases: [
      {
        duration: 1,
        arrivalCount: users,
        name: `${users} users sending invalid transfers`,
      },
    ],
    processor: path.join(__dirname, "processor.cjs"),
  },
  scenarios: [
    {
      name: "Rejected transfers must not mutate financial state",
      flow: [
        {
          post: {
            url: "/api/v1/transfers",
            headers: authHeaders,
            json: {
              sourceAccountId: process.env.STRESS_LOAD_SOURCE_ID,
              destinationAccountId: process.env.STRESS_LOAD_DESTINATION_ID,
              amount: 999999999,
            },
            afterResponse: "expect409Or429",
          },
        },
        {
          post: {
            url: "/api/v1/transfers",
            headers: authHeaders,
            json: {
              sourceAccountId: process.env.STRESS_LOAD_SOURCE_ID,
              destinationAccountId: process.env.STRESS_LOAD_SOURCE_ID,
              amount: 1,
            },
            afterResponse: "expect400Or429",
          },
        },
        {
          post: {
            url: "/api/v1/transfers",
            headers: authHeaders,
            json: {
              sourceAccountId: process.env.STRESS_LOAD_SOURCE_ID,
              destinationAccountId: "9223372036854775807",
              amount: 1,
            },
            afterResponse: "expect404Or429",
          },
        },
        {
          post: {
            url: "/api/v1/transfers",
            headers: authHeaders,
            json: {
              sourceAccountId: process.env.STRESS_UNAUTHORIZED_SOURCE_ID,
              destinationAccountId: process.env.STRESS_LOAD_DESTINATION_ID,
              amount: 1,
            },
            afterResponse: "expect403Or429",
          },
        },
        {
          post: {
            url: "/api/v1/transfers",
            headers: authHeaders,
            json: {
              sourceAccountId: process.env.STRESS_LOAD_SOURCE_ID,
              destinationAccountId: process.env.STRESS_LOAD_DESTINATION_ID,
              amount: 0,
            },
            afterResponse: "expect400Or429",
          },
        },
        {
          post: {
            url: "/api/v1/transfers",
            headers: authHeaders,
            json: {
              sourceAccountId: process.env.STRESS_LOAD_SOURCE_ID,
              destinationAccountId: process.env.STRESS_LOAD_DESTINATION_ID,
              amount: -1,
            },
            afterResponse: "expect400Or429",
          },
        },
      ],
    },
  ],
};
