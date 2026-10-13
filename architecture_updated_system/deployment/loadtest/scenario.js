// k6 load scenario for the recreated backend.
//
// NOT EXECUTED YET. This file exists so a real load test can be run and its
// results committed. Until then, no capacity claim is valid.
//
//   k6 run -e BASE_URL=http://127.0.0.1:8100 -e USER=admin -e PASS=admin-pass scenario.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8100";
const USER = __ENV.USER || "admin";
const PASS = __ENV.PASS || "admin-pass";

export const options = {
  scenarios: {
    login_and_read: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 25 },
        { duration: "1m", target: 25 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const login = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ user_name: USER, password: PASS }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(login, { "login 200": (r) => r.status === 200 });

  const token = login.json("access_token");
  if (token) {
    const health = http.get(`${BASE_URL}/health`);
    check(health, { "health 200": (r) => r.status === 200 });
  }
  sleep(1);
}
