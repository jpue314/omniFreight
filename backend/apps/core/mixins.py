from rest_framework.response import Response


class AuditMixin:
    """DRF view mixin that auto-sets created_by / updated_by from the request user."""

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class EnvelopeMixin:
    """Wraps single-object DRF responses in the {data, errors, meta} envelope.

    List responses are handled by StandardPagination. Destroy returns 204 (no body).
    """

    def retrieve(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        return Response({"data": serializer.data, "errors": None, "meta": None})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {"data": serializer.data, "errors": None, "meta": None},
            status=201,
            headers=self.get_success_headers(serializer.data),
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({"data": serializer.data, "errors": None, "meta": None})
