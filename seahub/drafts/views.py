# -*- coding: utf-8 -*-

import posixpath
from django.shortcuts import render, get_object_or_404
from django.utils.translation import ugettext as _

from seahub.auth.decorators import login_required
from seahub.views import check_folder_permission
from seahub.utils import render_permission_error
from seahub.drafts.models import Draft, DraftReview

@login_required
def drafts(request):
    return render(request, "react_app.html")


@login_required
def review(request, pk):
    d_r = get_object_or_404(DraftReview, pk=pk)

    d = d_r.draft_id
    #check perm
    uuid = d.origin_file_uuid
    file_path = posixpath.join(uuid.parent_path, uuid.filename)

    if request.user.username:
        permission = check_folder_permission(request, d.origin_repo_id, file_path)

    if permission is None:
        return render_permission_error(request, _(u'Permission denied.'))

    draft_file_name = d.draft_file_path.lstrip('/')

    return render(request, "draft_review.html", {
        "review_id": pk,
        "draft_id": d.id,
        "draft_repo_id": d.draft_repo_id,
        "draft_file_path": d.draft_file_path,
        "draft_origin_repo_id": d.origin_repo_id,
        "draft_origin_file_path": file_path,
        "draft_file_name": draft_file_name
        })
