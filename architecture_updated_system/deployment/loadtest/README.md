# Load testing — NOT YET EXECUTED

> **Status: scaffolding only.** No load test has been run, so this project makes
> **no claim** about concurrent-user capacity. The brief forbids stating figures
> such as "1,000 concurrent users" without a real, committed test result.

## Tooling

`k6` is **not installed** on the current host (`k6: command not found`). The
scenario below is written for k6; install it first:

```bash
# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Running

```bash
# Backend must be up on :8100 with a seeded admin user.
k6 run -e BASE_URL=http://127.0.0.1:8100 -e USER=admin -e PASS=admin-pass \
  deployment/loadtest/scenario.js
```

Commit the raw output under `deployment/loadtest/results/` and then, and only
then, update `docs/current_checkpoint.md` with measured numbers.
