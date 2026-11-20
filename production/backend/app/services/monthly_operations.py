def compute_monthly_operations(bills: list[dict]) -> dict:
    delivered = 0.0
    outstanding = 0.0
    billable = 0.0
    received = 0.0
    for bill in bills:
        amount = float(bill.get("amount") or 0.0)
        status = str(bill.get("status") or "")
        if status == "delivered":
            delivered += amount
        elif status == "outstanding":
            outstanding += amount
        elif status == "billable":
            billable += amount
        elif status == "received":
            received += amount
    return {
        "delivered": round(delivered, 2),
        "outstanding": round(outstanding, 2),
        "billable": round(billable, 2),
        "received": round(received, 2),
    }
