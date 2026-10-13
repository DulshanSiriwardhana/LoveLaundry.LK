"""Bill-service module (recreation of bill-service).

Owns receiving (gate passes), deliveries, dispatch, billing (commercial bills
and shop bills), returns, loyalty, linen tracking, monthly grids, reporting and
the append-only transaction journal. The pure balance engine in ``services``
is the single source of every delivered/outstanding/billable number.
"""
