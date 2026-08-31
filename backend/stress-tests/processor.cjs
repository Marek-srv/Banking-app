"use strict";

function emitResponseMetrics(requestParams, response, events) {
  const status = response.statusCode;
  events.emit("counter", "stress.responses.total", 1);
  events.emit(
    "counter",
    status >= 200 && status < 300
      ? "stress.responses.successful"
      : "stress.responses.failed",
    1
  );

  if (status >= 500) {
    events.emit("counter", "stress.database_errors", 1);
  }

  if (String(requestParams.url).includes("/transfers") && status >= 400) {
    events.emit("counter", "stress.transfer_failures", 1);
  }
}

function trackResponse(requestParams, response, context, events, next) {
  emitResponseMetrics(requestParams, response, events);
  next();
}

function addUniqueIdempotencyKey(requestParams, context, _events, next) {
  requestParams.headers = requestParams.headers || {};
  requestParams.headers["Idempotency-Key"] =
    `artillery-${context._uid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  next();
}

function validateStatus(allowedStatuses) {
  return (requestParams, response, context, events, next) => {
    emitResponseMetrics(requestParams, response, events);

    if (!allowedStatuses.includes(response.statusCode)) {
      events.emit("counter", "stress.validation_failures", 1);
      next(
        new Error(
          `Unexpected HTTP ${response.statusCode} for ${requestParams.url}; expected ${allowedStatuses.join(" or ")}`
        )
      );
      return;
    }

    next();
  };
}

module.exports = {
  trackResponse,
  addUniqueIdempotencyKey,
  expect201: validateStatus([201]),
  expect400Or429: validateStatus([400, 429]),
  expect403Or429: validateStatus([403, 429]),
  expect404Or429: validateStatus([404, 429]),
  expect409Or429: validateStatus([409, 429]),
  expectTransferOutcome: validateStatus([201, 409, 429]),
};
