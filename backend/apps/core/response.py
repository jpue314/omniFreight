from rest_framework.response import Response


def ok(data, status=200, meta=None):
    """Wrap a success payload in the standard {data, errors, meta} envelope."""
    return Response({"data": data, "errors": None, "meta": meta}, status=status)
