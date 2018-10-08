import logging
from django.shortcuts import render
from django.utils.translation import ugettext as _
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from seahub.api2.authentication import TokenAuthentication
from seahub.api2.base import APIView
from seahub.api2.throttling import UserRateThrottle
from seahub.api2.utils import api_error
from seahub.auth.decorators import login_required
from seahub.utils import is_org_context, normalize_dir_path
from seahub.utils.repo import is_valid_repo_id_format
from seahub.settings import ENABLE_THUMBNAIL, THUMBNAIL_SIZE_FOR_GRID
from seahub.views import check_folder_permission
from seaserv import seafile_api

from seahub.simple_search.utils import search_files, get_search_repos_map, \
        SEARCH_FILEEXT, is_valid_date, is_valid_size, get_int

logger = logging.getLogger(__name__)


@login_required
def simple_search(request):
    custom_search = False
    invalid_argument = False
    need_return_custom_search = False
    invalid_info = {
        'error': True,
        'error_msg': _(u'Invalid argument.'),
    }

    # Check GET parameters
    username = request.user.username
    org_id = request.user.org.org_id if is_org_context(request) else None
    keyword = request.GET.get('q', None)
    current_page = get_int(request.GET.get('page', '1'), 1)
    per_page = get_int(request.GET.get('per_page', '25'), 25)
    start = (current_page - 1) * per_page
    size = per_page
    if start < 0 or size < 0:
        invalid_argument = True

    search_repo = request.GET.get('search_repo', 'all')  # 'all' or repo_id
    search_repo = search_repo.lower()
    if not is_valid_repo_id_format(search_repo) and search_repo != 'all':
        invalid_argument = True

    search_path = request.GET.get('search_path', None)
    if search_path is not None and search_path[0] != '/':
        search_path = "/{0}".format(search_path)

    search_ftypes = request.GET.get('search_ftypes', 'all')  # 'all' or 'custom'
    search_ftypes = search_ftypes.lower()
    if search_ftypes not in ('all', 'custom'):
        invalid_argument = True

    time_from = request.GET.get('time_from', '')
    time_to = request.GET.get('time_to', '')
    size_from = request.GET.get('size_from', '')
    size_to = request.GET.get('size_to', '')

    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    size_from_mb = request.GET.get('size_from_mb', '')
    size_to_mb = request.GET.get('size_to_mb', '')

    if time_from:
        if not is_valid_date(time_from) and not invalid_argument:
            need_return_custom_search = True
            invalid_argument = True
            invalid_info['error_msg'] = _(u'Invalid date.')
    else:
        time_from = None

    if time_to:
        if not is_valid_date(time_to) and not invalid_argument:
            need_return_custom_search = True
            invalid_argument = True
            invalid_info['error_msg'] = _(u'Invalid date.')
    else:
        time_to = None

    if size_from:
        if not is_valid_size(size_from) and not invalid_argument:
            need_return_custom_search = True
            invalid_argument = True
            invalid_info['error_msg'] = _(u'Invalid file size.')
    else:
        size_from = None

    if size_to:
        if not is_valid_size(size_to) and not invalid_argument:
            need_return_custom_search = True
            invalid_argument = True
            invalid_info['error_msg'] = _(u'Invalid file size.')
    else:
        size_to = None

    if size_to and size_from and size_to < size_from and not invalid_argument:
        invalid_argument = True
        need_return_custom_search = True
        invalid_info['error_msg'] = _(u'Invalid file size range.')

    if time_to and time_from and time_to < time_from and not invalid_argument:
        invalid_argument = True
        need_return_custom_search = True
        invalid_info['error_msg'] = _(u'Invalid date range.')

    time_range = (time_from, time_to)
    size_range = (size_from, size_to)
    suffixes = None
    custom_ftypes =  request.GET.getlist('ftype')
    input_fileexts = request.GET.get('input_fexts', '')
    if search_ftypes == 'custom':
        suffixes = []
        if len(custom_ftypes) > 0:
            for ftp in custom_ftypes:
                if ftp in SEARCH_FILEEXT:
                    for ext in SEARCH_FILEEXT[ftp]:
                        suffixes.append(ext)

        if input_fileexts:
            input_fexts = input_fileexts.split(',')
            for i_ext in input_fexts:
                i_ext = i_ext.strip()
                if i_ext:
                    suffixes.append(i_ext)

    range_args = [time_from, time_to, size_from, size_to]
    if search_repo != 'all' or search_ftypes == 'custom' or any(e for e in range_args):
        custom_search = True

    if invalid_argument:
        if need_return_custom_search:
            invalid_info['keyword'] = keyword
            invalid_info['search_repo'] = search_repo
            invalid_info['search_ftypes'] = search_ftypes
            invalid_info['custom_ftypes'] = custom_ftypes
            invalid_info['input_fileexts'] = input_fileexts
            invalid_info['custom_search'] = custom_search
            invalid_info['date_from'] = date_from
            invalid_info['date_to'] = date_to
            invalid_info['size_from_mb'] = size_from_mb
            invalid_info['size_to_mb'] = size_to_mb
        return render(request, 'simple_search/search_results.html', invalid_info)

    repo_id_map = {}
    # Check recourse and permission when search in a single repo
    if is_valid_repo_id_format(search_repo):
        repo_id = search_repo
        repo = seafile_api.get_repo(repo_id)
        if not repo:
            data = {
                'error': True,
                'error_msg': _(u'Library %s not found.') % repo_id
            }
            return render(request, 'simple_search/search_results.html', data)

        # Check folder permissions
        if not check_folder_permission(request, repo_id, '/'):
            data = {
                'error': True,
                'error_msg': _(u'Permission denied.')
            }
            return render(request, 'simple_search/search_results.html', data)
        map_id = repo.origin_repo_id if repo.origin_repo_id else repo_id
        repo_id_map[map_id] = repo
    else:
        repo_id_map, repo_type_map = get_search_repos_map(search_repo, username, org_id)

    obj_desc = {
        'suffixes': suffixes,
        'time_range': time_range,
        'size_range': size_range
    }

    # Search file
    try:
        if keyword:
            results, total = search_files(repo_id_map, search_path, keyword, obj_desc, start, size, org_id)
        else:
            results, total, keyword = [], 0, ''
    except Exception as e:
        logger.error(e)
        data = {
            'error': True,
            'error_msg': _(u'Internal Server Error')
        }
        return render(request, 'simple_search/search_results.html', data)

    has_more = True if total > current_page * per_page else False

    return render(request, 'simple_search/search_results.html', {
            'repo': repo if is_valid_repo_id_format(search_repo) else None,
            'keyword': keyword,
            'results': results,
            'total': total,
            'has_more': has_more,
            'current_page': current_page,
            'prev_page': current_page - 1,
            'next_page': current_page + 1,
            'per_page': per_page,
            'search_repo': search_repo,
            'search_ftypes': search_ftypes,
            'custom_ftypes': custom_ftypes,
            'input_fileexts': input_fileexts,
            'error': False,
            'enable_thumbnail': ENABLE_THUMBNAIL,
            'thumbnail_size': THUMBNAIL_SIZE_FOR_GRID,
            'date_from': date_from,
            'date_to': date_to,
            'size_from_mb': size_from_mb,
            'size_to_mb': size_to_mb,
            'custom_search': custom_search
            })


class SimpleSearch(APIView):
    """
    Search all the repos
    """
    authentication_classes = (TokenAuthentication, SessionAuthentication)
    permission_classes = (IsAuthenticated,)
    throttle_classes = (UserRateThrottle,)

    def get(self, request):
        # Check GET parameters
        keyword = request.GET.get('q', None)
        if not keyword:
            error_msg = 'q invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        try:
            current_page = int(request.GET.get('page', '1'))
            per_page = int(request.GET.get('per_page', '10'))
        except ValueError:
            current_page = 1
            per_page = 10

        start = (current_page - 1) * per_page
        size = per_page
        if start < 0 or size < 0:
            error_msg = 'page or per_page invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        search_repo = request.GET.get('search_repo', 'all')  # scope or repo_id
        search_repo = search_repo.lower()
        if not is_valid_repo_id_format(search_repo) and \
                search_repo not in ('all', 'mine', 'shared', 'group', 'public'):
            error_msg = 'search_repo invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        search_path = request.GET.get('search_path', None)
        if search_path:
            search_path = normalize_dir_path(search_path)
            if not is_valid_repo_id_format(search_repo):
                error_msg = 'search_repo invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

            dir_id = seafile_api.get_dir_id_by_path(search_repo, search_path)
            if not dir_id:
                error_msg = 'Folder %s not found.' % search_path
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

        obj_type = request.GET.get('obj_type', None)
        if obj_type:
            obj_type = obj_type.lower()

        if obj_type and obj_type not in ('dir', 'file'):
            error_msg = 'obj_type invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        search_ftypes = request.GET.get('search_ftypes', 'all') # val: 'all' or 'custom'
        search_ftypes = search_ftypes.lower()
        if search_ftypes not in ('all', 'custom'):
            error_msg = 'search_ftypes invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        with_permission = request.GET.get('with_permission', 'false')
        with_permission = with_permission.lower()
        if with_permission not in ('true', 'false'):
            error_msg = 'with_permission invalid.'
            return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        time_from = request.GET.get('time_from', None)
        time_to = request.GET.get('time_to', None)
        if time_from is not None:
            try:
                time_from = int(time_from)
            except:
                error_msg = 'time_from invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if time_to is not None:
            try:
                time_to = int(time_to)
            except:
                error_msg = 'time_to invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        size_from = request.GET.get('size_from', None)
        size_to = request.GET.get('size_to', None)
        if size_from is not None:
            try:
                size_from = int(size_from)
            except:
                error_msg = 'size_from invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        if size_to is not None:
            try:
                size_to = int(size_to)
            except:
                error_msg = 'size_to invalid.'
                return api_error(status.HTTP_400_BAD_REQUEST, error_msg)

        time_range = (time_from, time_to)
        size_range = (size_from, size_to)

        suffixes = None
        custom_ftypes =  request.GET.getlist('ftype') # types like 'Image', 'Video'... same in utils/file_types.py
        input_fileexts = request.GET.get('input_fexts', '') # file extension input by the user
        if search_ftypes == 'custom':
            suffixes = []
            if len(custom_ftypes) > 0:
                for ftp in custom_ftypes:
                    if SEARCH_FILEEXT.has_key(ftp):
                        for ext in SEARCH_FILEEXT[ftp]:
                            suffixes.append(ext)

            if input_fileexts:
                input_fexts = input_fileexts.split(',')
                for i_ext in input_fexts:
                    i_ext = i_ext.strip()
                    if i_ext:
                        suffixes.append(i_ext)

        username = request.user.username
        org_id = request.user.org.org_id if is_org_context(request) else None
        repo_id_map = {}
        # Check recourse and permissin when search in a single repo
        if is_valid_repo_id_format(search_repo):
            repo_id = search_repo
            repo = seafile_api.get_repo(repo_id)
            # recourse check
            if not repo:
                error_msg = 'Library %s not found.' % repo_id
                return api_error(status.HTTP_404_NOT_FOUND, error_msg)

            # permission check
            if not check_folder_permission(request, repo_id, '/'):
                error_msg = 'Permission denied.'
                return api_error(status.HTTP_403_FORBIDDEN, error_msg)
            map_id = repo.origin_repo_id if repo.origin_repo_id else repo_id
            repo_id_map[map_id] = repo
            repo_type_map = {}
        else:
            repo_id_map, repo_type_map = get_search_repos_map(search_repo, username, org_id)

        obj_desc = {
            'obj_type': obj_type,
            'suffixes': suffixes,
            'time_range': time_range,
            'size_range': size_range
        }

        # Search files
        try:
            results, total = search_files(repo_id_map, search_path, keyword, obj_desc, start, size, org_id)
        except Exception as e:
            logger.error(e)
            error_msg = 'Internal Server Error'
            return api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, error_msg)

        for e in results:
            e.pop('repo', None)
            e.pop('exists', None)
            e.pop('last_modified_by', None)
            e.pop('name_highlight', None)
            e.pop('score', None)

            repo_id = e['repo_id']

            if with_permission.lower() == 'true':
                permission = check_folder_permission(request, repo_id, '/')
                if not permission:
                    continue
                e['permission'] = permission

            # get repo type
            if repo_type_map.has_key(repo_id):
                e['repo_type'] = repo_type_map[repo_id]
            else:
                e['repo_type'] = ''

        has_more = True if total > current_page * per_page else False

        return Response({"total": total, "results": results, "has_more": has_more})
