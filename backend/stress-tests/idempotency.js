"use strict";

const path = require("node:path");
const requests = Number(process.env.STRESS_IDEMPOTENCY_REQUESTS || 25);

module.exports = {
  config: {
    target: process.env.STRESS_TARGET || "http://localhost:3102",
    phases: [
      {
        duration: 1,
        arrivalCount: requests,
        name: `${requests} identical idempotent retries`,
      },
    ],
    processor: path.join(__dirname, "processor.cjs"),
  },
  scenarios: [
    {
      name: "Concurrent identical transfer retries",
      flow: [
        {
          post: {
            url: "/api/v1/transfers",
            headers: {
              Authorization: `Bearer ${process.env.STRESS_TOKEN}`,
              "Idempotency-Key": process.env.STRESS_IDEMPOTENCY_KEY,
            },
            json: {
              sourceAccountId: process.env.STRESS_IDEMPOTENCY_SOURCE_ID,
              destinationAccountId:
                process.env.STRESS_IDEMPOTENCY_DESTINATION_ID,
              amount: 100,
            },
            afterResponse: "expect201",
          },
        },
      ],
    },
  ],
};
