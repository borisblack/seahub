import logging
import os
import posixpath
import stat
from django.shortcuts import get_object_or_404
from django.template.defaultfilters import filesizeformat
from django.utils.http import urlquote
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from seahub.api2.authentication import TokenAuthentication
from seahub.api2.throttling import UserRateThrottle
from seahub.base.templatetags.seahub_tags import translate_seahub_time
from seahub.settings import ENABLE_THUMBNAIL, THUMBNAIL_ROOT, THUMBNAIL_DEFAULT_SIZE, ENABLE_VIDEO_THUMBNAIL
from seahub.tags.models import Tags
from seahub.thumbnail.utils import get_thumbnail_src
from seahub.utils import FILEEXT_TYPE_MAP, get_user_repos, is_org_context
from seahub.utils.file_types import IMAGE, VIDEO
from seahub.views.file import can_preview_file
from seaserv import seafile_api

logger = logging.getLogger(__name__)


class TagsView(APIView):
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request, name=None):
        username = request.user.username
        org_id = request.user.org.org_id if is_org_context(request) else None
        owned_repos, shared_repos, groups_repos, public_repos = get_user_repos(username, org_id=org_id)
        repo_id_list =\
            [repo.id for repo in owned_repos] + \
            [repo.id for repo in shared_repos] + \
            [repo.id for repo in groups_repos] + \
            [repo.id for repo in public_repos]

        if name is None:
            def with_quotes(s):
                return "'" + s + "'"

            # sql = """
            #     SELECT DISTINCT t.* FROM tags_tags t
            #       LEFT JOIN tags_filetag f ON t.id = f.tag_id
            #         LEFT JOIN tags_fileuuidmap m ON f.uuid_id = m.uuid
            #     WHERE m.repo_id IN (%(repo_id_list)s)
            #     """
            # tag_list = Tags.objects.raw(sql, {'repo_id_list': repo_id_list})

            repo_id_text = ', '.join(map(with_quotes, repo_id_list))
            sql = """
                SELECT DISTINCT t.* FROM tags_tags t
                LEFT JOIN tags_filetag f ON t.id = f.tag_id
                    LEFT JOIN tags_fileuuidmap m ON f.uuid_id = m.uuid
                WHERE m.repo_id IN ({})
                """.format(repo_id_text)
            tag_list = Tags.objects.raw(sql)
            tag_list = [tag.to_dict() for tag in tag_list]

            return Response(tag_list, status=status.HTTP_200_OK)
        else:
            tag = get_object_or_404(Tags, name=name)
            fileuuidmap_list = tag.fileuuidmap_set.all()

            repo = None
            dir_list = []
            file_list = []
            for fileuuidmap in fileuuidmap_list:
                if repo is None or repo.id != fileuuidmap.repo_id:
                    repo = seafile_api.get_repo(fileuuidmap.repo_id)

                fullpath = posixpath.join(fileuuidmap.parent_path, fileuuidmap.filename)
                dirent = seafile_api.get_dirent_by_path(fileuuidmap.repo_id, fullpath)

                dirent.repo_id = repo.id
                dirent.parent_path = fileuuidmap.parent_path
                dirent.fullpath = fullpath
                dirent.last_modified = dirent.mtime
                if stat.S_ISDIR(dirent.mode):
                    dir_list.append(dirent)
                else:
                    if repo.version == 0:
                        file_size = seafile_api.get_file_size(repo.store_id, repo.version, dirent.obj_id)
                    else:
                        file_size = dirent.size
                    dirent.file_size = file_size if file_size else 0

                    can_preview, err_msg = can_preview_file(dirent.obj_name, file_size, repo)
                    dirent.can_preview = can_preview

                    file_list.append(dirent)

            dirent_list = []
            for d in dir_list:
                d_ = {
                    'is_dir': True,
                    'obj_name': d.obj_name,
                    'last_modified': d.last_modified,
                    'last_update': translate_seahub_time(d.last_modified),
                    'p_dpath': d.fullpath,
                    'perm': d.permission,
                    'repo_id': d.repo_id,
                    'parent_path': d.parent_path,
                }
                dirent_list.append(d_)

            size = int(request.GET.get('thumbnail_size', THUMBNAIL_DEFAULT_SIZE))

            for f in file_list:
                f_ = {
                    'is_file': True,
                    'obj_name': f.obj_name,
                    'last_modified': f.last_modified,
                    'last_update': translate_seahub_time(f.last_modified),
                    'file_size': filesizeformat(f.file_size),
                    'obj_id': f.obj_id,
                    'perm': f.permission,
                    'can_preview': f.can_preview,
                    'repo_id': f.repo_id,
                    'parent_path': f.parent_path,
                }

                if not repo.encrypted and ENABLE_THUMBNAIL:
                    file_ext = os.path.splitext(f.obj_name)[1][1:].lower()
                    file_type = FILEEXT_TYPE_MAP.get(file_ext)
                    if file_type == IMAGE:
                        f_['is_img'] = True

                    if file_type == VIDEO and ENABLE_VIDEO_THUMBNAIL:
                        f_['is_video'] = True

                    if file_type == IMAGE or file_type == VIDEO and ENABLE_VIDEO_THUMBNAIL:
                        thumbnail_file_path = os.path.join(THUMBNAIL_ROOT, str(size), f.obj_id)
                        thumbnail_exist = os.path.exists(thumbnail_file_path)
                        if thumbnail_exist:
                            src = get_thumbnail_src(f.repo_id, size, f.fullpath)
                            f_['encoded_thumbnail_src'] = urlquote(src)

                dirent_list.append(f_)

            return Response(dirent_list, status=status.HTTP_200_OK)
