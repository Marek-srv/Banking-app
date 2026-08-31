"use strict";

const path = require("node:path");
const requests = Number(process.env.STRESS_CONCURRENCY_REQUESTS || 100);

module.exports = {
  config: {
    target: process.env.STRESS_TARGET || "http://localhost:3102",
    phases: [
      {
        duration: 1,
        arrivalCount: requests,
        name: `${requests} simultaneous same-source transfers`,
      },
    ],
    processor: path.join(__dirname, "processor.cjs"),
  },
  scenarios: [
    {
      name: "Same funded source account",
      flow: [
        {
          post: {
            url: "/api/v1/transfers",
            headers: {
              Authorization: `Bearer ${process.env.STRESS_TOKEN}`,
            },
            beforeRequest: "addUniqueIdempotencyKey",
            json: {
              sourceAccountId: process.env.STRESS_CONCURRENCY_SOURCE_ID,
              destinationAccountId:
                process.env.STRESS_CONCURRENCY_DESTINATION_ID,
              amount: 500,
            },
            afterResponse: "expectTransferOutcome",
          },
        },
      ],
    },
  ],
};
