# Webhook delay investigation
Synthetic fixture. Engineering only.
The Cedar retry queue batches retries behind an overloaded worker. Proposed mitigation: cap retry concurrency, separate initial deliveries from retry jobs, and inspect acknowledgement latency. No delivery-time promise has been approved. Do not expose queue names, operational markers or internal metrics to customers.
