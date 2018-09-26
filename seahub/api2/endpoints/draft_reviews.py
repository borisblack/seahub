# Copyright (c) 2012-2016 Seafile Ltd.
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error

from seahub.drafts.models import Draft, DraftReview, DraftReviewExist

class DraftReviewsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated, )
    throttle_classes = (UserRateThrottle, )

    def post(self, request, format=None):
        """Create a draft review
        """
        draft_id = request.POST.get('draft_id', '')

        try:
            d = Draft.objects.get(pk=draft_id)
        except Draft.DoesNotExist:
            return api_error(status.HTTP_404_NOT_FOUND,
                             'Draft %s not found.' % draft_id)

        # perm check
        if d.username != request.user.username:
            return api_error(status.HTTP_403_FORBIDDEN,
                             'Permission denied.')

        try:
            DraftReview.objects.add(draft=d)
        except (DraftReviewExist):
            return api_error(status.HTTP_409_CONFLICT, 'Draft review already exists.')

        return Response(status.HTTP_200_OK)
